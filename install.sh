#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="${HOME}/.pi/agent"

info() { echo "[+] $1"; }
warn() { echo "[!] $1"; }
error() { echo "[x] $1"; exit 1; }

warn "NOTE: Symlink install is legacy. Prefer: pi install git:github.com/Forgenn/plder"
echo ""

# Check Pi is installed
command -v pi &>/dev/null || error "Pi not installed. Run: npm install -g @mariozechner/pi-coding-agent"

# Check settings.json exists
if [ ! -f "${SCRIPT_DIR}/settings.json" ]; then
    error "settings.json not found. Copy settings.json.example to settings.json and configure it."
fi

# Symlink settings.json -> ~/.pi/agent/settings.json
mkdir -p "$AGENT_DIR"
if [ -L "${AGENT_DIR}/settings.json" ]; then
    rm "${AGENT_DIR}/settings.json"
elif [ -f "${AGENT_DIR}/settings.json" ]; then
    mv "${AGENT_DIR}/settings.json" "${AGENT_DIR}/settings.json.bak"
    warn "Backed up existing settings.json to settings.json.bak"
fi
ln -s "${SCRIPT_DIR}/settings.json" "${AGENT_DIR}/settings.json"
info "settings.json -> ${AGENT_DIR}/settings.json"

# Symlink models.json -> ~/.pi/agent/models.json
if [ -f "${SCRIPT_DIR}/models.json" ]; then
    if [ -L "${AGENT_DIR}/models.json" ]; then
        rm "${AGENT_DIR}/models.json"
    elif [ -f "${AGENT_DIR}/models.json" ]; then
        mv "${AGENT_DIR}/models.json" "${AGENT_DIR}/models.json.bak"
        warn "Backed up existing models.json to models.json.bak"
    fi
    ln -s "${SCRIPT_DIR}/models.json" "${AGENT_DIR}/models.json"
    info "models.json -> ${AGENT_DIR}/models.json"
fi

# Symlink extensions
mkdir -p "${AGENT_DIR}/extensions"
for ext in "${SCRIPT_DIR}/extensions/"*.ts; do
    [ -f "$ext" ] || continue
    name="$(basename "$ext")"
    target="${AGENT_DIR}/extensions/${name}"
    [ -L "$target" ] && rm "$target"
    ln -s "$ext" "$target"
    info "${name} -> ${target}"
done

# Symlink skills
mkdir -p "${AGENT_DIR}/skills"
for skill_dir in "${SCRIPT_DIR}/skills/"*/; do
    [ -d "$skill_dir" ] || continue
    name="$(basename "$skill_dir")"
    target="${AGENT_DIR}/skills/${name}"
    [ -L "$target" ] && rm "$target"
    ln -s "$skill_dir" "$target"
    info "${name} -> ${target}"
done

# Symlink themes
mkdir -p "${AGENT_DIR}/themes"
for theme in "${SCRIPT_DIR}/themes/"*.json; do
    [ -f "$theme" ] || continue
    name="$(basename "$theme")"
    target="${AGENT_DIR}/themes/${name}"
    [ -L "$target" ] && rm "$target"
    ln -s "$theme" "$target"
    info "${name} -> ${target}"
done

info "Done. Run 'pi' from any directory."
