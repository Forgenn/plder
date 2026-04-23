---
name: web
description: Web search and page reading via SearXNG + reader. Use for research, investigation, looking things up, verifying facts, reading URLs, or any task requiring current/external information. Always verify claims against real sources.
---

# Web Search & Verification

One script, two commands:

```bash
node {baseDir}/web.mjs search <query> [options]
node {baseDir}/web.mjs read   <url>   [options]
```

---

## Rule: Verification-First

**Never state a fact from memory alone.** Always go to the web when:
- Asked to research, investigate, look up, find, check, verify, compare
- The answer involves versions, APIs, docs, compatibility, or current state of anything
- The user shares a URL — always read it, don't guess its contents
- You're about to recommend a tool, library, or approach — verify it first
- Any claim that could be outdated or wrong

If you can't reach the web or results are empty, say so explicitly — do not fall back to guessing.

---

## Search

```bash
node {baseDir}/web.mjs search "query terms here"
node {baseDir}/web.mjs search "query" -n 10
node {baseDir}/web.mjs search "query" --time month
node {baseDir}/web.mjs search "site:docs.anthropic.com tool use"
```

Options:
- `-n <num>` — number of results (default: 5)
- `--time day|month|year` — filter by recency
- `--engines google,duckduckgo,bing,wikipedia` — specific engines

Output: numbered list of `title`, `URL`, and a short snippet per result.

**Query tips:**
- Be specific: `kubernetes gateway api httproute timeout` not `kubernetes networking`
- Use quotes for exact phrases: `"breaking changes" react 19`
- Scope to a site when relevant: `site:docs.anthropic.com tool use`

---

## Read a page

```bash
node {baseDir}/web.mjs read https://example.com/page
node {baseDir}/web.mjs read https://example.com/page --max 5000
```

Options:
- `--max <chars>` — output character limit (default: 8000)

Returns the page as readable markdown. Works well for docs, GitHub, Wikipedia, MDN, Stack Overflow. If the output looks like broken/empty HTML, the page is JS-rendered — skip it and try another result.

---

## When to search vs read

**Snippet is enough** — the answer is a simple fact visible in the search snippet (e.g. "what port does X use").

**Must read the full page** — API reference, config options, how-to guides, anything where exact details matter, or when the snippet is ambiguous. Read **2-3 pages** per task to cross-reference.

---

## Full research flow

```bash
# 1. Search
node {baseDir}/web.mjs search "kubernetes gateway api httproute timeout syntax"

# 2. Read the most relevant results (usually 2-3)
node {baseDir}/web.mjs read https://gateway-api.sigs.k8s.io/guides/http-timeouts/
node {baseDir}/web.mjs read https://gateway-api.sigs.k8s.io/reference/spec/

# 3. Synthesize with citations:
#    "According to [title](url), the timeout is configured via..."
```

---

## Output format

After researching, always structure your answer as:
1. **Direct answer**
2. **Sources** — every URL you read, as `[title](url)`
3. **Caveats** — anything you couldn't verify or that may have changed

---

## Error handling

- **"could not reach SearXNG"** — not on Tailscale/LAN; say so, don't guess
- **No results** — rephrase the query, try different keywords
- **Broken/empty read output** — page is JS-rendered; try a different result
- **Timeout** — skip that URL, note it as unverified
