"use client"

type BrowserWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

export type LivePcmChunk = {
  data: string
  mimeType: string
}

function browserAudioContext() {
  return window.AudioContext ?? (window as BrowserWindow).webkitAudioContext
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return window.btoa(binary)
}

function base64ToFloat32(base64: string) {
  const binary = window.atob(base64)
  const byteLength = binary.length - (binary.length % 2)
  const bytes = new Uint8Array(byteLength)
  for (let index = 0; index < byteLength; index += 1) bytes[index] = binary.charCodeAt(index)
  const pcm = new Int16Array(bytes.buffer)
  const floats = new Float32Array(pcm.length)
  for (let index = 0; index < pcm.length; index += 1) floats[index] = Math.max(-1, (pcm[index] ?? 0) / 32768)
  return floats
}

function floatToPcmBuffer(floats: Float32Array) {
  const pcm = new Int16Array(floats.length)
  let energy = 0
  for (let index = 0; index < floats.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, floats[index] ?? 0))
    energy += sample * sample
    pcm[index] = sample < 0 ? sample * 32768 : sample * 32767
  }
  return { buffer: pcm.buffer, level: Math.min(1, Math.sqrt(energy / Math.max(1, pcm.length)) * 4) }
}

function workletSource() {
  return `
    class LexiconPcmCapture extends AudioWorkletProcessor {
      constructor() {
        super(); this.pending = []; this.pendingLength = 0;
      }
      process(inputs) {
        const input = inputs[0] && inputs[0][0];
        if (!input || input.length === 0) return true;
        this.pending.push(new Float32Array(input)); this.pendingLength += input.length;
        if (this.pendingLength < 2048) return true;
        const output = new Int16Array(this.pendingLength);
        let offset = 0; let energy = 0;
        for (const frame of this.pending) {
          for (let index = 0; index < frame.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, frame[index]));
            energy += sample * sample;
            output[offset++] = sample < 0 ? sample * 32768 : sample * 32767;
          }
        }
        this.pending = []; this.pendingLength = 0;
        this.port.postMessage({ buffer: output.buffer, level: Math.min(1, Math.sqrt(energy / output.length) * 4) }, [output.buffer]);
        return true;
      }
    }
    registerProcessor("lexicon-pcm-capture", LexiconPcmCapture);
  `
}

/** Streams browser microphone PCM chunks directly to a constrained Live session. */
export class MicrophonePcmStream {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private silentGain: GainNode | null = null
  private workletUrl: string | null = null

  constructor(
    private readonly onChunk: (chunk: LivePcmChunk) => void,
    private readonly onLevel: (level: number) => void
  ) {}

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this browser.")
    const AudioContextClass = browserAudioContext()
    if (!AudioContextClass) throw new Error("Live audio is unavailable in this browser.")

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    this.context = new AudioContextClass({ sampleRate: 16000, latencyHint: "interactive" })
    await this.context.resume()
    this.source = this.context.createMediaStreamSource(this.stream)
    this.silentGain = this.context.createGain()
    this.silentGain.gain.value = 0
    this.silentGain.connect(this.context.destination)

    if (this.context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      this.workletUrl = URL.createObjectURL(new Blob([workletSource()], { type: "text/javascript" }))
      await this.context.audioWorklet.addModule(this.workletUrl)
      const worklet = new AudioWorkletNode(this.context, "lexicon-pcm-capture")
      worklet.port.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; level: number }>) => this.emit(event.data.buffer, event.data.level)
      this.processor = worklet
    } else {
      const processor = this.context.createScriptProcessor(2048, 1, 1)
      processor.onaudioprocess = (event) => {
        const next = floatToPcmBuffer(event.inputBuffer.getChannelData(0))
        this.emit(next.buffer, next.level)
      }
      this.processor = processor
    }

    this.source.connect(this.processor)
    this.processor.connect(this.silentGain)
    return this.context.sampleRate
  }

  private emit(buffer: ArrayBuffer, level: number) {
    if (!this.context) return
    this.onLevel(Math.max(0, Math.min(1, Number(level) || 0)))
    this.onChunk({ data: bufferToBase64(buffer), mimeType: `audio/pcm;rate=${this.context.sampleRate}` })
  }

  async stop() {
    this.stream?.getTracks().forEach((track) => track.stop())
    try { this.source?.disconnect() } catch {}
    try { this.processor?.disconnect() } catch {}
    try { this.silentGain?.disconnect() } catch {}
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl)
    if (this.context && this.context.state !== "closed") await this.context.close()
    this.stream = null
    this.context = null
    this.source = null
    this.processor = null
    this.silentGain = null
    this.workletUrl = null
  }
}

/** Queues Gemini's 24 kHz PCM response without gaps or browser speech synthesis. */
export class GeminiPcmPlayer {
  private context: AudioContext | null = null
  private nextStartAt = 0
  private sources = new Set<AudioBufferSourceNode>()

  constructor(private readonly sampleRate = 24000) {}

  async prepare() {
    const AudioContextClass = browserAudioContext()
    if (!AudioContextClass) throw new Error("Live audio playback is unavailable in this browser.")
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContextClass({ sampleRate: this.sampleRate, latencyHint: "interactive" })
    }
    if (this.context.state === "suspended") await this.context.resume()
  }

  async enqueue(base64Data: string) {
    if (!base64Data) return
    await this.prepare()
    if (!this.context) return
    const samples = base64ToFloat32(base64Data)
    if (!samples.length) return
    const buffer = this.context.createBuffer(1, samples.length, this.sampleRate)
    buffer.copyToChannel(samples, 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.context.destination)
    const startAt = Math.max(this.context.currentTime + 0.01, this.nextStartAt)
    this.nextStartAt = startAt + buffer.duration
    this.sources.add(source)
    source.onended = () => this.sources.delete(source)
    source.start(startAt)
  }

  interrupt() {
    this.sources.forEach((source) => {
      try { source.stop() } catch {}
    })
    this.sources.clear()
    this.nextStartAt = this.context?.currentTime ?? 0
  }

  async close() {
    this.interrupt()
    if (this.context && this.context.state !== "closed") await this.context.close()
    this.context = null
  }
}
