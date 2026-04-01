---
name: web
description: Web search and page reading via SearXNG + reader. Use for research, investigation, looking things up, verifying facts, reading URLs, or any task requiring current/external information. Always verify claims against real sources.
---

# Web Search & Verification

No API keys, no dependencies.

## IMPORTANT: Verification-First Approach

**Never present unverified information as fact.** When answering questions about:
- Library versions, APIs, or compatibility
- Best practices or recommended approaches
- Current state of tools, frameworks, or services
- Any factual claim that could be outdated or wrong

You MUST:
1. **Search first** — don't rely on training data alone
2. **Read the actual source** — snippets aren't enough, fetch the page
3. **Cross-reference** — check at least 2 sources when claims conflict
4. **Cite your sources** — always show where information came from
5. **Say when you can't verify** — if sources are unavailable, say so clearly

## Search

```bash
curl -s "https://searxng.monederobox.dev/search?q=QUERY&format=json"
```

Key fields per result: `title`, `url`, `content` (snippet), `engine`, `score`.

### Options

```bash
&engines=google,duckduckgo,bing,wikipedia   # specific engines
&time_range=day|month|year                  # recency filter
&pageno=2                                   # pagination
```

### Print top results

```bash
curl -s "https://searxng.monederobox.dev/search?q=QUERY&format=json" | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  d.results.slice(0,5).forEach(r=>console.log(r.title,'\n ',r.url,'\n ',r.content?.substring(0,120)))"
```

## Read a page

Fetches a URL and extracts readable content as markdown. Zero dependencies, Node.js built-in fetch.

```bash
node {baseDir}/reader.mjs <url> [maxChars]
```

- `maxChars` — output limit (default: 8000)

## Standard Research Workflow

1. **Search** — find relevant results
2. **Read** — fetch the top 2-3 most relevant pages
3. **Verify** — cross-reference key claims across sources
4. **Synthesize** — combine findings with citations
5. **Flag uncertainty** — note anything you couldn't verify

## When to Use

- User says: research, investigate, look up, find out, check, verify, compare
- Questions about library versions, APIs, docs, best practices
- Any URL the user shares — always read it
- Any factual claim that could be wrong or outdated
- Before recommending a specific tool, library, or approach
