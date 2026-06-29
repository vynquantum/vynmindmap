#!/usr/bin/env bash
#
# VynMM setup / build / run — Linux & macOS.
#
# Installs prerequisites (Rust, OS libraries, npm deps), generates icons, and
# optionally launches the app.
#
# Usage:
#   ./scripts/setup.sh                # install deps, then run the native app (tauri dev)
#   ./scripts/setup.sh --browser      # install deps, then run the web preview (no Rust needed)
#   ./scripts/setup.sh --build        # install deps, then build a release bundle
#   ./scripts/setup.sh --no-start     # only install deps and prepare
#
set -euo pipefail

cd "$(dirname "$0")/.."
MODE="app"   # app | browser | build | none

for arg in "$@"; do
  case "$arg" in
    --browser) MODE="browser" ;;
    --build)   MODE="build" ;;
    --no-start) MODE="none" ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

info() { printf "\033[1;34m==>\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m!  \033[0m %s\n" "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"

# --- 1. Node.js -----------------------------------------------------------
if ! have node; then
  warn "Node.js not found."
  if [ "$OS" = "Darwin" ] && have brew; then
    info "Installing Node via Homebrew..."
    brew install node
  elif have apt-get; then
    info "Installing Node via apt (NodeSource)..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "Please install Node.js 20+ from https://nodejs.org and re-run."; exit 1
  fi
fi
info "Node $(node --version)"

# --- 2. OS libraries (only needed for the native Tauri app) ---------------
if [ "$MODE" != "browser" ]; then
  if [ "$OS" = "Linux" ]; then
    if have apt-get; then
      info "Installing Linux build libraries (apt)..."
      sudo apt-get update
      sudo apt-get install -y \
        libwebkit2gtk-4.1-dev build-essential curl wget file \
        libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
    elif have dnf; then
      info "Installing Linux build libraries (dnf)..."
      sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
        libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++ make
    elif have pacman; then
      info "Installing Linux build libraries (pacman)..."
      sudo pacman -Syu --needed --noconfirm webkit2gtk-4.1 base-devel curl wget file \
        openssl libayatana-appindicator librsvg
    else
      warn "Unknown Linux package manager — install Tauri's prerequisites manually:"
      warn "https://v2.tauri.app/start/prerequisites/"
    fi
  elif [ "$OS" = "Darwin" ]; then
    if ! xcode-select -p >/dev/null 2>&1; then
      info "Installing Xcode Command Line Tools..."
      xcode-select --install || true
      warn "Finish the Xcode CLT install if a dialog appeared, then re-run."
    fi
  fi

  # --- 3. Rust ------------------------------------------------------------
  if ! have cargo; then
    info "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck disable=SC1090
    source "$HOME/.cargo/env"
  fi
  info "Rust $(rustc --version)"
fi

# --- 4. npm dependencies --------------------------------------------------
info "Installing npm dependencies..."
npm install

# --- 5. Icons -------------------------------------------------------------
if [ ! -f src-tauri/icons/icon.ico ]; then
  info "Generating app icons..."
  npm run make:icon
  npx tauri icon app-icon.png
fi

# --- 6. Start / build -----------------------------------------------------
case "$MODE" in
  browser)
    info "Starting web preview at http://localhost:5183 (Ctrl+C to stop)..."
    npm run dev
    ;;
  build)
    info "Building release bundle..."
    npm run app:build
    info "Done. Find installers under src-tauri/target/release/bundle/"
    ;;
  app)
    info "Launching VynMM (first run compiles Rust — this can take a few minutes)..."
    npm run app:dev
    ;;
  none)
    info "Setup complete. Run 'npm run app:dev' (native) or 'npm run dev' (browser)."
    ;;
esac
