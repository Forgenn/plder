---
name: web
description: Web search and page reading. Use when you need to look up documentation, research topics, fetch a URL, or find current information.
---

# Web Search & Reading

No API keys, no dependencies, no prod setup needed.

## Search

Self-hosted SearXNG at `searxng.monederobox.dev` (Tailscale/LAN only).

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

Fetches a URL and extracts readable content as markdown. Zero dependencies, uses Node.js built-in fetch.

```bash
node {baseDir}/reader.mjs <url> [maxChars]
```

- `url` — the page to fetch
- `maxChars` — optional output limit (default: 8000)

### Example

```bash
node {baseDir}/reader.mjs https://kubernetes.io/docs/concepts/services-networking/gateway/ 5000
```

## Workflow

1. **Search** to find relevant URLs
2. **Read** the top results for full content
3. Synthesize and answer

## When to Use

- Looking up library docs or API references
- Researching how to implement something
- Fetching a specific URL the user provides
- Finding current information beyond training cutoff
