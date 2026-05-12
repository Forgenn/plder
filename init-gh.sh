#!/usr/bin/env bash
# GitHub CLI auto-configuration script
# Ensures gh is always authenticated using existing credentials

set -euo pipefail

info() { echo "[+] $1"; }
warn() { echo "[!] $1"; }
error() { echo "[x] $1"; }

# Check if gh is installed
if ! command -v gh &>/dev/null; then
    error "GitHub CLI (gh) not installed"
    exit 1
fi

# Check if already authenticated
if gh auth status &>/dev/null; then
    info "GitHub CLI already authenticated"
    gh auth status
    exit 0
fi

# Check if we have saved credentials
GH_CONFIG_DIR="${HOME}/.config/gh"
GH_HOSTS_FILE="${GH_CONFIG_DIR}/hosts.yml"

if [ -f "$GH_HOSTS_FILE" ]; then
    info "Found existing gh credentials at ${GH_HOSTS_FILE}"
    # Verify the token still works
    if gh auth status &>/dev/null; then
        info "Credentials verified and working"
        exit 0
    else
        warn "Existing credentials invalid or expired"
    fi
fi

# If we have an SSH key, suggest using SSH protocol
if [ -f ~/.ssh/id_ed25519 ]; then
    info "SSH key found at ~/.ssh/id_ed25519"
    echo ""
    echo "To authenticate GitHub CLI with your existing SSH key:"
    echo "  gh auth login -p ssh"
    echo ""
    echo "Or use HTTPS with a token:"
    echo "  gh auth login -p https"
else
    warn "No SSH key found. You'll need to authenticate:"
    echo "  gh auth login"
fi

exit 1
