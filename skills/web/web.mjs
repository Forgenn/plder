#!/usr/bin/env node
// Web search and page reading tool.
// Zero dependencies — Node.js built-in fetch only (Node 18+).

const SEARXNG = "https://searxng.monederobox.dev";

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`Usage:
  web.mjs search <query> [options]   Search the web via SearXNG
  web.mjs read   <url>   [options]   Fetch a URL and extract readable content

Search options:
  -n <num>               Number of results (default: 5)
  --time day|month|year  Filter by recency
  --engines <list>       Comma-separated engines (default: google,duckduckgo,bing)

Read options:
  --max <chars>          Max output characters (default: 8000)
`);
  process.exit(0);
}

async function search() {
  const queryParts = [];
  let n = 5, time = null, engines = null;

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === "-n"        && args[i+1]) { n       = parseInt(args[++i], 10); }
    else if (args[i] === "--time"    && args[i+1]) { time    = args[++i]; }
    else if (args[i] === "--engines" && args[i+1]) { engines = args[++i]; }
    else queryParts.push(args[i]);
  }

  const query = queryParts.join(" ");
  if (!query) { console.error("Error: search query is required"); process.exitCode = 1; return; }

  const params = new URLSearchParams({ q: query, format: "json" });
  if (time)    params.set("time_range", time);
  if (engines) params.set("engines", engines);

  let res;
  try {
    res = await fetch(`${SEARXNG}/search?${params}`, { signal: AbortSignal.timeout(15000) });
  } catch (e) {
    console.error(`Error: could not reach SearXNG — ${e.message}`);
    console.error("(SearXNG is only accessible on Tailscale or LAN)");
    process.exitCode = 1; return;
  }

  if (!res.ok) { console.error(`Error: SearXNG returned HTTP ${res.status}`); process.exitCode = 1; return; }

  const data = await res.json();
  const results = (data.results ?? []).slice(0, n);

  if (results.length === 0) { console.log("No results found. Try rephrasing the query."); return; }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`[${i + 1}] ${r.title}`);
    console.log(`    URL: ${r.url}`);
    if (r.content) console.log(`    ${r.content.trim()}`);
    console.log();
  }
}

async function read() {
  const urlParts = [];
  let max = 8000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max" && args[i+1]) { max = parseInt(args[++i], 10); }
    else urlParts.push(args[i]);
  }

  const url = urlParts[0];
  if (!url) { console.error("Error: URL is required"); process.exitCode = 1; return; }

  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
  } catch (e) {
    console.error(`Error fetching ${url}: ${e.message}`);
    process.exitCode = 1; return;
  }

  if (!res.ok) { console.error(`HTTP ${res.status}: ${res.statusText}`); process.exitCode = 1; return; }

  let html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";

  for (const tag of ["script", "style", "noscript", "nav", "header", "footer", "aside", "iframe", "svg", "form"]) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }

  html = html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    (_, n, t) => "\n\n" + "#".repeat(+n) + " " + t.replace(/<[^>]+>/g, "").trim() + "\n");
  html = html.replace(/<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => { const t = text.replace(/<[^>]+>/g, "").trim(); return t ? `[${t}](${href})` : ""; });
  html = html.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  html = html.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");
  html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/(?:p|div|section|article|tr)>/gi, "\n\n");
  html = html.replace(/<[^>]+>/g, "");

  html = html
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));

  html = html
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (title) process.stdout.write(`# ${title}\n\n`);
  process.stdout.write(html.substring(0, max) + "\n");
}

if      (cmd === "search") await search();
else if (cmd === "read")   await read();
else { console.error(`Unknown command: ${cmd}. Use 'search' or 'read'.`); process.exitCode = 1; }
