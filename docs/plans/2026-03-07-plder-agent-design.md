# plder Agent Design

> Pi-based coding agent with custom extensions and skills for structured development workflows.

## Overview

plder is a personal coding agent built on top of [Pi](https://github.com/badlogic/pi-mono) (vanilla), extended with community packages and custom skills/extensions. The goal is a general-purpose agent that enforces development discipline (TDD, code review, worktrees) while supporting multiple LLM providers with smart routing.

## Architecture

```
Pi (vanilla runtime)
|
+-- Community Packages
|   +-- shitty-extensions --- plan-mode, memory-mode, cost-tracker, ultrathink
|   +-- pi-skills (official) --- brave-search, browser-tools
|   +-- subagent package --- parallel task execution
|
+-- Custom Skills (markdown, ~/.pi/agent/skills/ or .pi/skills/)
|   +-- brainstorming --- idea -> design -> plan workflow
|   +-- tdd --- test-first enforcement
|   +-- git-worktree --- worktree lifecycle management
|   +-- code-review --- review scoring + auto-merge + CI verification
|
+-- Custom Extensions (TypeScript, ~/.pi/agent/extensions/)
    +-- model-router.ts --- smart model routing by task type
    +-- project-context.ts --- project awareness + persistent memory
```

## Providers

### Anthropic (Claude) - Built-in
- Uses Pi's native Anthropic provider
- Auth: OAuth token (local development machine)
- Models: Claude Opus (complex reasoning), Claude Sonnet (code gen), Claude Haiku (cheap tasks)

### GLM (Zhipu AI / Z.AI) - Built-in
- Uses Pi's native `zai` provider (built-in since Pi includes GLM-4.5/4.7 models)
- Auth: `ZAI_API_KEY` environment variable
- Base URL: `https://api.z.ai/api/coding/paas/v4`
- Models: GLM-4.5-Flash (cheap), GLM-4.7 (reasoning), GLM-4.5V (vision)
- API format: `openai-completions`

## Community Packages

### shitty-extensions
- **plan-mode**: Structured planning before implementation
- **memory-mode**: Persistent knowledge across sessions (replaces CLAUDE.md auto-memory)
- **cost-tracker**: Real-time token cost visibility per session
- **ultrathink**: Extended reasoning for complex problems

### pi-skills (official, by Mario Zechner)
- **brave-search**: Web search + content extraction via Brave Search API
- **browser-tools**: Browser automation via Chrome DevTools Protocol

### Subagent package (TBD - evaluate community options)
- Parallel task execution across multiple agent instances
- Candidates: richardgill/pi-packages task-tool, PiSwarm, or shitty-extensions if it adds one

## Custom Skills

### 1. brainstorming
**Trigger**: User says "build", "add", "create", "implement" something new
**Flow**:
1. Explore project context (files, docs, recent commits)
2. Ask clarifying questions one at a time (prefer multiple choice)
3. Propose 2-3 approaches with trade-offs and recommendation
4. Present design section by section, get approval after each
5. Write design doc to `docs/plans/YYYY-MM-DD-<topic>-design.md`
6. Transition to implementation planning

**Key principles**: One question at a time, YAGNI ruthlessly, incremental validation.

### 2. tdd
**Trigger**: Implementing any feature or bugfix
**Flow**:
1. Write a failing test first
2. Run test - must fail (proves the test tests something)
3. Implement minimum code to make test pass
4. Run test - must pass
5. Refactor if needed
6. Run full test suite

**Hard gate**: No implementation code before a failing test exists.
**Adapts to project**: Detects test runner (Go test, vitest, pytest, cargo test, etc.)

### 3. git-worktree
**Trigger**: Starting a new feature branch
**Flow**:
1. Create worktree: `git worktree add ../<project>-<feature> -b feature/<feature>`
2. Set up development environment in worktree
3. (work happens)
4. Push branch, create PR: `git push -u origin feature/<feature> && gh pr create`
5. After merge, clean up: `git worktree remove ../<project>-<feature>`

**Naming conventions**:
- Worktree dir: `<project>-<feature-name>` (sibling to main dir)
- Branch: `feature/<feature-name>`

**Helper script**: `scripts/worktree-setup.sh`

### 4. code-review
**Trigger**: PR is ready or feature implementation is complete
**Flow**:
1. Review all changed files in the PR/branch
2. Check against project conventions (CLAUDE.md, linting, tests)
3. Score the changes (0-100)
4. If score >= 80: auto-merge via `gh pr merge --squash`
5. Wait for CI/CD pipeline to complete
6. Verify deployment succeeded

**Helper script**: `scripts/review.sh`

## Custom Extensions

### 1. model-router.ts
Hooks into task context to route to the appropriate model.

**Routing rules**:
- Exploration/search/simple questions -> GLM-4.5-Flash (zai, cheapest)
- Code generation, editing, refactoring -> Claude Sonnet (anthropic)
- Complex reasoning, architecture, debugging -> Claude Opus (anthropic)
- Vision tasks -> GLM-4.5V (zai)

Implementation: hooks into `input` event, analyzes the user's input to classify task type, sets model accordingly.

### 2. project-context.ts
Provides project awareness and persistent memory.

**On session_start**:
- Reads project config files (CLAUDE.md, .pi/project.md, package.json, go.mod, etc.)
- Reads persistent memory file (~/.pi/agent/memory/<project>.md)
- Injects relevant context into system prompt via `before_agent_start`

**On session_shutdown**:
- Extracts learned patterns from the conversation
- Updates memory file with new knowledge
- Deduplicates and prunes stale entries

**Memory file format**: Markdown with semantic sections (architecture, patterns, gotchas, preferences).

## File Structure

```
plder/
  docs/
    plans/
      2026-03-07-plder-agent-design.md  (this file)
  extensions/
    model-router.ts
    project-context.ts
  skills/
    brainstorming/
      SKILL.md
    tdd/
      SKILL.md
    git-worktree/
      SKILL.md
      scripts/
        setup.sh
    code-review/
      SKILL.md
      scripts/
        review.sh
  scripts/
    install.sh        # Installs Pi + community packages + symlinks extensions/skills
  settings.json       # Pi project settings (packages, model config)
  README.md
```

## Installation Script

`scripts/install.sh` will:
1. Check Pi is installed (`pi --version`)
2. Install community packages (`pi package install ...`)
3. Symlink extensions to `~/.pi/agent/extensions/`
4. Symlink skills to `~/.pi/agent/skills/`
5. Copy/merge settings into Pi config

## Build Order

1. **Phase 1 - Foundation**: Install Pi, configure Anthropic + ZAI providers, install community packages
2. **Phase 2 - Core Skills**: Port `brainstorming` and `tdd` skills
3. **Phase 3 - Routing & Context**: Write `model-router.ts` and `project-context.ts`
4. **Phase 4 - Workflow Skills**: Port `git-worktree` and `code-review` skills
5. **Phase 5 - Tune & Iterate**: Real-world usage, adjust prompts and routing

## Trade-offs

**Gains over Claude Code**:
- Model flexibility (Claude + GLM, easy to add more)
- Cost visibility (built-in tracking)
- Full control (MIT licensed, everything is yours)
- Lighter overhead (~200 token system prompt vs ~10K)
- BYO API keys (no subscription cost beyond tokens)

**Trades**:
- Time to build/port (4 skills, 2 extensions)
- Community package stability risk
- Terminal only (no IDE integration)
- No built-in permission sandbox (YOLO by default)
- Skills are "soft" enforcement (LLM can ignore them)
