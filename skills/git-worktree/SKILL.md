---
name: git-worktree
description: Use when starting a new feature branch. Manages git worktree lifecycle — creation, development, PR, and cleanup.
---

# Git Worktree

Manages isolated workspaces for feature development using git worktrees.

## Trigger

User says "start feature", "new branch", "work on X", or begins a new implementation task.

## Naming Conventions

- **Worktree directory**: `../<project>-<feature-name>` (sibling to main project dir)
- **Branch name**: `feature/<feature-name>`

## Flow

**K8s Remote Mode**: If K8s remote execution is active, git commands (worktree add, push, branch) execute on the pod. The repo lives on the pod's PVC, not locally. Use `/k8s` to check connection status before starting.

### Step 1: Create Worktree

```bash
# From the main project directory
FEATURE_NAME="<feature-name>"
PROJECT="$(basename "$PWD")"

git worktree add "../${PROJECT}-${FEATURE_NAME}" -b "feature/${FEATURE_NAME}"
cd "../${PROJECT}-${FEATURE_NAME}"
```

If a setup script exists, run it:
```bash
./scripts/worktree-setup.sh 2>/dev/null || true
```

### Step 2: Develop

Work normally in the worktree directory. Use `tdd` skill for implementation.

### Step 3: Push and Create PR

When the feature is ready:

```bash
git push -u origin "feature/${FEATURE_NAME}"
gh pr create --fill
```

### Step 4: After Merge — Cleanup

Once the PR is merged:

```bash
cd "../${PROJECT}"
git worktree remove "../${PROJECT}-${FEATURE_NAME}"
git branch -d "feature/${FEATURE_NAME}"
```

## Helper Script

The `scripts/setup.sh` script in this skill directory can be copied to projects. It handles:
- Installing dependencies in the worktree
- Copying environment files (.env)
- Any project-specific setup

## Rules

- Always create worktrees as siblings to the main project directory
- Never work directly on main/master for features
- Clean up worktrees after merge — don't let them accumulate
- One worktree per feature
