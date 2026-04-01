#!/usr/bin/env node
// Fetches a URL and extracts readable content as plain text.
// Zero dependencies — uses only Node.js built-in fetch (Node 18+).

const url = process.argv[2];
const maxChars = parseInt(process.argv[3] ?? '8000', 10);

if (!url) {
  console.error('Usage: reader.mjs <url> [maxChars]');
  process.exit(1);
}

let res;
try {
  res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
} catch (e) {
  console.error(`Error fetching ${url}: ${e.message}`);
  process.exit(1);
}

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${res.statusText}`);
  process.exit(1);
}

let html = await res.text();

// Extract title
const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
const title = titleMatch?.[1]?.trim() ?? '';

// Remove noise blocks entirely (including their content)
for (const tag of ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'iframe', 'svg', 'form']) {
  html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
}

// Semantic → markdown
html = html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
  (_, n, t) => '\n\n' + '#'.repeat(+n) + ' ' + t.replace(/<[^>]+>/g, '').trim() + '\n');
html = html.replace(/<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
  (_, href, text) => { const t = text.replace(/<[^>]+>/g, '').trim(); return t ? `[${t}](${href})` : ''; });
html = html.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
html = html.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
html = html.replace(/<br\s*\/?>/gi, '\n');
html = html.replace(/<\/(?:p|div|section|article|tr)>/gi, '\n\n');

// Strip remaining tags
html = html.replace(/<[^>]+>/g, '');

// Decode HTML entities
html = html
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&mdash;/g, '—')
  .replace(/&ndash;/g, '–')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));

// Clean up whitespace
html = html
  .replace(/[ \t]+/g, ' ')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

if (title) process.stdout.write(`# ${title}\n\n`);
process.stdout.write(html.substring(0, maxChars) + '\n');
