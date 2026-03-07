# plder

Personal coding agent built on [Pi](https://github.com/badlogic/pi-mono) with custom extensions and skills.

## What is this?

Pi (vanilla) + cherry-picked community packages + custom TypeScript extensions + custom skills for structured development workflows.

## Stack

- **Runtime**: Pi coding agent
- **Providers**: Anthropic (Claude via OAuth), Zhipu AI (GLM via API key)
- **Community**: shitty-extensions, pi-skills, subagent package
- **Custom extensions**: GLM provider, model routing, project context
- **Custom skills**: brainstorming, TDD, git worktree, code review

## Setup

```bash
# Install Pi
npm install -g @mariozechner/pi-coding-agent

# Run install script
./scripts/install.sh
```

## Structure

```
extensions/     # TypeScript extensions (symlinked to ~/.pi/agent/extensions/)
skills/         # Pi skills (symlinked to ~/.pi/agent/skills/)
scripts/        # Helper scripts (install, worktree setup, review)
docs/plans/     # Design documents
```

## Design

See [docs/plans/2026-03-07-plder-agent-design.md](docs/plans/2026-03-07-plder-agent-design.md).
