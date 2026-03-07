#!/usr/bin/env bash
# Worktree setup script — run after creating a new git worktree.
# Copy this to your project's scripts/ directory and customize.
set -euo pipefail

WORKTREE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[worktree-setup] Setting up ${WORKTREE_DIR}..."

# Install dependencies if package manager detected
if [ -f "${WORKTREE_DIR}/package.json" ]; then
    echo "[worktree-setup] Installing npm dependencies..."
    cd "$WORKTREE_DIR"
    if [ -f "package-lock.json" ]; then
        npm ci
    elif [ -f "bun.lockb" ]; then
        bun install
    elif [ -f "pnpm-lock.yaml" ]; then
        pnpm install
    else
        npm install
    fi
fi

if [ -f "${WORKTREE_DIR}/go.mod" ]; then
    echo "[worktree-setup] Downloading Go modules..."
    cd "$WORKTREE_DIR" && go mod download
fi

if [ -f "${WORKTREE_DIR}/Cargo.toml" ]; then
    echo "[worktree-setup] Fetching Rust dependencies..."
    cd "$WORKTREE_DIR" && cargo fetch
fi

if [ -f "${WORKTREE_DIR}/pyproject.toml" ] || [ -f "${WORKTREE_DIR}/requirements.txt" ]; then
    echo "[worktree-setup] Python project detected — install dependencies manually."
fi

# Copy environment files from main worktree if they exist
MAIN_DIR="$(git -C "$WORKTREE_DIR" worktree list --porcelain | head -1 | cut -d' ' -f2)"
if [ -n "$MAIN_DIR" ] && [ -f "${MAIN_DIR}/.env" ] && [ ! -f "${WORKTREE_DIR}/.env" ]; then
    echo "[worktree-setup] Copying .env from main worktree..."
    cp "${MAIN_DIR}/.env" "${WORKTREE_DIR}/.env"
fi

echo "[worktree-setup] Done."
