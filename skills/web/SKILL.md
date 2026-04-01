---
name: web
description: Web search and page reading via self-hosted SearXNG + Jina Reader. Use when you need to look up documentation, research topics, fetch URLs, or find current information.
---

# Web Search & Reading

Two curl-only tools, no API keys, no npm installs.

## Search

```bash
curl -s "https://searxng.monederobox.dev/search?q=QUERY&format=json&engines=google,duckduckgo,bing"
```

Returns JSON. Key fields per result:
- `title` — page title
- `url` — page URL
- `content` — snippet
- `engine` — which engine returned it
- `score` — relevance

### Options

```bash
# Specific engines
&engines=google,duckduckgo,bing,wikipedia

# Time range
&time_range=day       # past 24h
&time_range=month
&time_range=year

# Page
&pageno=2
```

### Example — extract top URLs

```bash
curl -s "https://searxng.monederobox.dev/search?q=kubernetes+gateway+api&format=json" | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.results.slice(0,5).forEach(r=>console.log(r.title,'\n ',r.url,'\n ',r.content?.substring(0,120)))"
```

## Read a URL

Fetches any URL and returns clean markdown (strips nav, ads, scripts).

```bash
curl -s "https://r.jina.ai/https://example.com/some/page"
```

No key needed. Works on static and JS-rendered pages.

## Workflow

1. **Search** to find relevant URLs
2. **Read** the most relevant ones for full content
3. Combine and synthesize for the user

## When to Use

- Looking up library docs or API references
- Researching how to implement something
- Fetching a specific URL the user provides
- Finding current information beyond training cutoff
