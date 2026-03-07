#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_DIR="${HOME}/.pi/agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# -------------------------------------------------------------------
# 1. Check Pi is installed
# -------------------------------------------------------------------
if ! command -v pi &>/dev/null; then
    error "Pi is not installed. Run: npm install -g @mariozechner/pi-coding-agent"
fi
info "Pi found: $(pi --version 2>/dev/null || echo 'unknown version')"

# -------------------------------------------------------------------
# 2. Install community packages
# -------------------------------------------------------------------
info "Installing community packages..."

PACKAGES=(
    "npm:@nicepkg/shitty-extensions"
    "git:github.com/nicepkg/pi-skills"
)

for pkg in "${PACKAGES[@]}"; do
    info "  Installing ${pkg}..."
    pi install "$pkg" || warn "  Failed to install ${pkg}, skipping"
done

# -------------------------------------------------------------------
# 3. Symlink extensions to ~/.pi/agent/extensions/
# -------------------------------------------------------------------
info "Symlinking extensions..."
mkdir -p "${AGENT_DIR}/extensions"

for ext in "${PROJECT_DIR}/extensions/"*.ts; do
    [ -f "$ext" ] || continue
    name="$(basename "$ext")"
    target="${AGENT_DIR}/extensions/plder-${name}"
    if [ -L "$target" ]; then
        rm "$target"
    fi
    ln -s "$ext" "$target"
    info "  ${name} -> ${target}"
done

# -------------------------------------------------------------------
# 4. Symlink skills to ~/.pi/agent/skills/
# -------------------------------------------------------------------
info "Symlinking skills..."
mkdir -p "${AGENT_DIR}/skills"

for skill_dir in "${PROJECT_DIR}/skills/"*/; do
    [ -d "$skill_dir" ] || continue
    name="$(basename "$skill_dir")"
    target="${AGENT_DIR}/skills/${name}"
    if [ -L "$target" ]; then
        rm "$target"
    fi
    ln -s "$skill_dir" "$target"
    info "  ${name} -> ${target}"
done

# -------------------------------------------------------------------
# 5. Copy project settings into .pi/
# -------------------------------------------------------------------
info "Setting up project config..."
mkdir -p "${PROJECT_DIR}/.pi"

if [ -f "${PROJECT_DIR}/.pi/settings.json" ]; then
    info "  .pi/settings.json already exists, skipping"
else
    cp "${PROJECT_DIR}/settings.json" "${PROJECT_DIR}/.pi/settings.json"
    info "  Copied settings.json -> .pi/settings.json"
fi

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------
echo ""
info "plder installed successfully!"
info "Run 'pi' from ${PROJECT_DIR} to start."
