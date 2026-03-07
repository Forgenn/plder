---
name: code-review
description: Use when a PR is ready or feature implementation is complete. Reviews changes, scores quality, and handles merge workflow.
---

# Code Review

Structured review of code changes with quality scoring and merge workflow.

## Trigger

User says "review", "ready for review", or a feature implementation is complete.

## Flow

### Step 1: Identify Changes

```bash
# If on a feature branch with a PR
gh pr diff

# Or compare against main
git diff main...HEAD
```

List all changed files and categorize:
- New files
- Modified files
- Deleted files

### Step 2: Review Each File

For each changed file, check:

1. **Correctness**: Does it do what it's supposed to?
2. **Tests**: Are new behaviors covered by tests?
3. **Conventions**: Does it follow project conventions (linting, naming, structure)?
4. **Security**: Any obvious vulnerabilities (injection, exposed secrets, etc.)?
5. **Simplicity**: Is it the simplest solution? Any unnecessary complexity?

### Step 3: Score

Rate the changes 0-100:

| Range | Meaning |
|-------|---------|
| 90-100 | Excellent — merge immediately |
| 80-89 | Good — merge with minor notes |
| 70-79 | Acceptable — address comments before merge |
| 50-69 | Needs work — significant issues |
| 0-49 | Major problems — rethink approach |

### Step 4: Report

Present findings:
```
## Review: <branch-name>

Score: XX/100

### Summary
<one paragraph>

### Issues
- [ ] Issue 1 (severity: high/medium/low)
- [ ] Issue 2

### Positives
- Good thing 1
- Good thing 2
```

### Step 5: Merge Decision

- **Score >= 80**: Offer to merge
  ```bash
  gh pr merge --squash --auto
  ```
- **Score < 80**: List what needs to change before merge

### Step 6: Post-Merge Verification

After merge:
```bash
# Wait for CI
gh pr checks --watch

# Verify merge succeeded
gh pr view --json state --jq '.state'
```

## Helper Script

Use `scripts/review.sh` in this skill directory for automated checks (linting, test run, etc.) before the manual review.

## Rules

- Always review the full diff, not just new files
- Check tests exist for new behavior
- Don't auto-merge below score 80
- Verify CI passes after merge
