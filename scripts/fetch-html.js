#!/usr/bin/env node

const { parseArgs } = require('node:util');
const { convert } = require('../lib/converter');
const { assertFilters } = require('../lib/filters');
const { looksLikeHTML, isHTMLContentType } = require('../lib/detect');
const { renderUrl } = require('../lib/render');

const USAGE = `Usage: fetch-html.js <url> [--filters filter1,filter2] [--timeout seconds] [--render] [--scroll]

Examples:
  fetch-html.js https://example.com
  fetch-html.js https://example.com --filters remove-nav,clean-whitespace
  fetch-html.js https://example.com --render
  fetch-html.js https://example.com --scroll

Options:
  --filters <list>   Comma-separated filters to apply
  --timeout <secs>   Give up when the response takes longer (default: 30)
  --render           Run the page's JavaScript in headless Google Chrome and
                     convert the page once the network is idle
  --scroll           Like --render, and also scroll down one screen at a time,
                     so content that loads as you scroll is included

Available filters:
  remove-nav         - Strip <nav> elements and role="navigation"
  remove-footer      - Strip the page <footer> and role="contentinfo"
  clean-whitespace   - Collapse excessive newlines
  extract-main       - Keep only <main>, role="main", or a single <article>
  remove-scripts     - Accepted for compatibility; scripts and styles are always removed`;

const USER_AGENT = 'Mozilla/5.0 (compatible; ClaudeCode/1.0)';
const CHARSET = /charset\s*=\s*["']?([\w.:-]+)/i;
const META_CHARSET = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i;

class UsageError extends Error {}

/**
 * Parse command-line arguments
 * Expected format: <url> [--filters filter1,filter2] [--timeout seconds] [--render] [--scroll]
 */
function parseCommandLine(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        filters: { type: 'string', default: '' },
        timeout: { type: 'string', default: '30' },
        render: { type: 'boolean', default: false },
        scroll: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      }
    });
  } catch (error) {
    throw new UsageError(error.message);
  }

  const { values, positionals } = parsed;
  if (values.help || positionals.length !== 1) {
    throw new UsageError();
  }

  let url;
  try {
    url = new URL(positionals[0]);
  } catch {
    throw new UsageError(`Invalid URL: ${positionals[0]}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`Only http and https URLs are supported, got ${url.protocol}`);
  }

  const timeout = Number(values.timeout);
  if (!(timeout > 0)) {
    throw new UsageError(`--timeout must be a positive number of seconds, got ${values.timeout}`);
  }

  const filters = values.filters.split(',').map(f => f.trim()).filter(Boolean);
  assertFilters(filters);

  return { url, filters, timeout, render: values.render || values.scroll, scroll: values.scroll };
}

/**
 * Decode the body using the charset from the Content-Type header or a
 * <meta> tag, because Response.text() always decodes as UTF-8
 */
function decode(bytes, contentType) {
  const charset =
    CHARSET.exec(contentType)?.[1] ||
    META_CHARSET.exec(bytes.subarray(0, 1024).toString('latin1'))?.[1] ||
    'utf-8';

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/**
 * Fetch URL content using native fetch, giving up after timeout seconds
 */
async function fetchUrl(url, timeout) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeout * 1000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const bytes = Buffer.from(await response.arrayBuffer());
    return { content: decode(bytes, contentType), contentType };
  } catch (error) {
    const reason = error.name === 'TimeoutError'
      ? `no response within ${timeout} seconds`
      : error.cause?.message || error.message;
    throw new Error(`Failed to fetch ${url}: ${reason}`);
  }
}

async function main() {
  const { url, filters, timeout, render, scroll } = parseCommandLine(process.argv.slice(2));
  const { content, contentType, complete = true } = render
    ? await renderUrl(url, timeout, { scroll })
    : await fetchUrl(url, timeout);

  if (!complete) {
    console.error(`Rendering did not finish within ${timeout} seconds; converting what has rendered so far.`);
  }

  if (!isHTMLContentType(contentType) && !looksLikeHTML(content)) {
    console.error(`Content-Type is ${contentType || 'missing'}, not HTML; printing the response unchanged.`);
    process.stdout.write(content);
    return;
  }

  process.stdout.write(`${convert(content, filters)}\n`);
}

main().catch(error => {
  if (error instanceof UsageError) {
    console.error(error.message ? `Error: ${error.message}\n\n${USAGE}` : USAGE);
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exitCode = 1;
});
