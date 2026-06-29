<#
  VynMM setup / build / run - Windows (PowerShell).

  Installs prerequisites (Rust, MSVC build tools, WebView2, npm deps),
  generates icons, and optionally launches the app.

  Usage:
    .\scripts\setup.ps1               # install deps, then run native app (tauri dev)
    .\scripts\setup.ps1 -Browser      # install deps, then run web preview (no Rust)
    .\scripts\setup.ps1 -Build        # install deps, then build a release bundle
    .\scripts\setup.ps1 -NoStart      # only install deps and prepare
#>
[CmdletBinding()]
param(
  [switch]$Browser,
  [switch]$Build,
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "!   $m" -ForegroundColor Yellow }
function Have($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }

$mode = if ($Browser) { "browser" } elseif ($Build) { "build" } elseif ($NoStart) { "none" } else { "app" }
$hasWinget = Have winget

# --- 1. Node.js -----------------------------------------------------------
if (-not (Have node)) {
  Warn "Node.js not found."
  if ($hasWinget) {
    Info "Installing Node.js LTS via winget..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Warn "Open a NEW terminal so PATH updates, then re-run this script."
    exit 0
  } else {
    throw "Install Node.js 20+ from https://nodejs.org and re-run."
  }
}
Info "Node $(node --version)"

if ($mode -ne "browser") {
  # --- 2. MSVC C++ build tools (required to compile Rust on Windows) ------
  $hasCl = Have cl
  $hasVs = Test-Path "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not $hasCl -and -not $hasVs) {
    if ($hasWinget) {
      Info "Installing Visual Studio C++ Build Tools via winget (large download)..."
      winget install -e --id Microsoft.VisualStudio.2022.BuildTools `
        --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" `
        --accept-source-agreements --accept-package-agreements
    } else {
      Warn "MSVC C++ Build Tools not found and winget unavailable."
      Warn "Install 'Desktop development with C++' from:"
      Warn "  https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    }
  }

  # --- 3. WebView2 (preinstalled on Win11; ensure for Win10) --------------
  $wv2 = Test-Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  if (-not $wv2 -and $hasWinget) {
    Info "Installing WebView2 Runtime..."
    winget install -e --id Microsoft.EdgeWebView2Runtime `
      --accept-source-agreements --accept-package-agreements
  }

  # --- 4. Rust ------------------------------------------------------------
  if (-not (Have cargo)) {
    Info "Installing Rust via rustup..."
    if ($hasWinget) {
      winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements
    } else {
      $tmp = Join-Path $env:TEMP "rustup-init.exe"
      Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $tmp
      & $tmp -y
    }
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  }
  if (Have rustc) { Info "Rust $(rustc --version)" }
  else { Warn "Rust installed but not on PATH yet - open a new terminal and re-run." }
}

# --- 5. npm dependencies --------------------------------------------------
Info "Installing npm dependencies..."
npm install

# --- 6. Icons -------------------------------------------------------------
if (-not (Test-Path "src-tauri\icons\icon.ico")) {
  Info "Generating app icons..."
  npm run make:icon
  npx tauri icon app-icon.png
}

# --- 7. Start / build -----------------------------------------------------
switch ($mode) {
  "browser" { Info "Starting web preview at http://localhost:5183 (Ctrl+C to stop)..."; npm run dev }
  "build"   { Info "Building release bundle..."; npm run app:build; Info "Installers under src-tauri\target\release\bundle\" }
  "app"     { Info "Launching VynMM (first run compiles Rust - can take a few minutes)..."; npm run app:dev }
  "none"    { Info "Setup complete. Run 'npm run app:dev' (native) or 'npm run dev' (browser)." }
}
