#!/usr/bin/env bash
# Automated pre-review checks — run before manual code review.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}  FAIL${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "${YELLOW}  WARN${NC} $1"; WARN=$((WARN + 1)); }

echo "Running pre-review checks..."
echo ""

# -------------------------------------------------------------------
# 1. Check for uncommitted changes
# -------------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
    warn "Uncommitted changes detected"
else
    pass "Working tree clean"
fi

# -------------------------------------------------------------------
# 2. Check branch is up to date with main
# -------------------------------------------------------------------
MAIN_BRANCH="main"
git fetch origin "$MAIN_BRANCH" --quiet 2>/dev/null || true
BEHIND=$(git rev-list --count "HEAD..origin/${MAIN_BRANCH}" 2>/dev/null || echo "?")
if [ "$BEHIND" = "0" ]; then
    pass "Branch up to date with ${MAIN_BRANCH}"
elif [ "$BEHIND" = "?" ]; then
    warn "Could not check if branch is up to date"
else
    warn "Branch is ${BEHIND} commits behind ${MAIN_BRANCH}"
fi

# -------------------------------------------------------------------
# 3. Run linter if available
# -------------------------------------------------------------------
if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
    echo -n "  Running lint... "
    if npm run lint --silent 2>/dev/null; then
        pass "Lint passed"
    else
        fail "Lint failed"
    fi
elif [ -f "Cargo.toml" ]; then
    echo -n "  Running clippy... "
    if cargo clippy --quiet 2>/dev/null; then
        pass "Clippy passed"
    else
        fail "Clippy failed"
    fi
elif [ -f "go.mod" ]; then
    echo -n "  Running go vet... "
    if go vet ./... 2>/dev/null; then
        pass "go vet passed"
    else
        fail "go vet failed"
    fi
else
    warn "No linter detected"
fi

# -------------------------------------------------------------------
# 4. Run tests if available
# -------------------------------------------------------------------
if [ -f "package.json" ] && grep -q '"test"' package.json 2>/dev/null; then
    echo -n "  Running tests... "
    if npm test --silent 2>/dev/null; then
        pass "Tests passed"
    else
        fail "Tests failed"
    fi
elif [ -f "Cargo.toml" ]; then
    echo -n "  Running cargo test... "
    if cargo test --quiet 2>/dev/null; then
        pass "Tests passed"
    else
        fail "Tests failed"
    fi
elif [ -f "go.mod" ]; then
    echo -n "  Running go test... "
    if go test ./... 2>/dev/null; then
        pass "Tests passed"
    else
        fail "Tests failed"
    fi
else
    warn "No test runner detected"
fi

# -------------------------------------------------------------------
# 5. Check for secrets / sensitive files
# -------------------------------------------------------------------
SENSITIVE_PATTERNS=('.env' 'credentials' 'secret' 'private_key' 'api_key')
STAGED_FILES=$(git diff --name-only origin/${MAIN_BRANCH}...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "")

FOUND_SENSITIVE=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if echo "$STAGED_FILES" | grep -qi "$pattern"; then
        fail "Potentially sensitive file in diff: $(echo "$STAGED_FILES" | grep -i "$pattern")"
        FOUND_SENSITIVE=true
    fi
done
if [ "$FOUND_SENSITIVE" = false ]; then
    pass "No sensitive files detected"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}Review blocked — fix failures before proceeding.${NC}"
    exit 1
else
    echo -e "${GREEN}Pre-review checks passed.${NC}"
    exit 0
fi
