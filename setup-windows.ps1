param(
  [switch]$Start
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

Write-Host "Installing and building the Lexicon SDK..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "sdk")
try {
  & $Npm install
  & $Npm run build
} finally {
  Pop-Location
}
Write-Host "Installing the Lexicon demo..." -ForegroundColor Cyan
$DemoPath = Join-Path $ProjectRoot "demo"
Push-Location $DemoPath
try {
  if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
  }
  & $Npm install

  Write-Host "Setup complete." -ForegroundColor Green
  Write-Host "Add your Gemini key to demo\.env.local before using assistant features." -ForegroundColor Yellow

  if ($Start) {
    & $Npm run dev
  } else {
    Write-Host "Run: cd .\demo; npm run dev"
  }
} finally {
  Pop-Location
}
