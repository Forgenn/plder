# plder

Personal development agent built on [Pi](https://github.com/badlogic/pi-mono) with remote K8s execution, auth failover, and structured workflows.

## Install

```bash
# Install Pi
npm install -g @mariozechner/pi-coding-agent

# Install plder as a pi package
pi install git:github.com/Forgenn/plder
```

Or add to your `~/.pi/agent/settings.json`:

```json
{
  "packages": ["git:github.com/Forgenn/plder"]
}
```

## Extensions

| Extension | Description |
|-----------|-------------|
| `k8s-remote` | Route all tool operations through kubectl exec to a K8s dev pod |
| `auth-failover` | OAuth primary, API key fallback, GLM emergency |
| `model-router` | `/model` command for switching between Claude and GLM |
| `project-context` | Auto-detect project type and inject context into system prompt |

## Skills

| Skill | Trigger |
|-------|---------|
| `/brainstorming` | Design-first workflow for new features |
| `/tdd` | Test-driven development enforcement |
| `/git-worktree` | Feature branch isolation via git worktrees |
| `/code-review` | Structured review with quality scoring |

## K8s Remote Execution

Create `.pi/k8s.json` in your project:

```json
{
  "namespace": "dev",
  "container": "dev",
  "remoteCwd": "/home/dev/myproject"
}
```

Then: `pi --k8s` or use `/k8s connect` during a session.

## Provider Setup

Copy `models.json.example` to `~/.pi/agent/models.json` and add your API keys:

```bash
cp models.json.example ~/.pi/agent/models.json
# Edit with your ZAI_API_KEY
```

## Legacy Install (symlinks)

If you prefer symlinks over pi packages: `./install.sh`
