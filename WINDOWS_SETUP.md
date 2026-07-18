# Run Lexicon on Windows

## Requirements

- Windows 10 or 11
- Node.js 20 or newer from https://nodejs.org/
- npm (included with Node.js)
- A Gemini API key for the assistant and live-voice features

## Quick setup

Open PowerShell in the extracted `lexicon` folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

Then open `demo\.env.local` and set:

```text
LEXICON_GEMINI_API_KEY=your_key_here
```

Start the application:

```powershell
cd .\demo
npm run dev
```

Open http://localhost:3000 in Chrome or Brave. If port 3000 is busy, use the URL printed by Next.js.

## Manual setup

```powershell
cd .\sdk
npm install
npm run build
cd ..\demo
Copy-Item .env.example .env.local
npm install
npm run dev
```

Keep browser zoom at 100%. For recording, also keep Windows display scaling at 100% where possible.
