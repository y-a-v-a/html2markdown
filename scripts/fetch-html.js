#!/usr/bin/env node

const { convert } = require('../lib/converter');
const { applyFilters } = require('../lib/filters');

/**
 * Parse command-line arguments
 * Expected format: <url> [--filters filter1,filter2]
 */
function parseArgs(args) {
  if (args.length < 3) {
    console.error('Usage: fetch-html.js <url> [--filters filter1,filter2]');
    console.error('');
    console.error('Examples:');
    console.error('  fetch-html.js https://example.com');
    console.error('  fetch-html.js https://example.com --filters remove-nav,clean-whitespace');
    console.error('');
    console.error('Available filters:');
    console.error('  remove-nav         - Strip navigation elements');
    console.error('  remove-footer      - Strip footer content');
    console.error('  clean-whitespace   - Collapse excessive newlines');
    console.error('  extract-main       - Try to find main content area');
    console.error('  remove-scripts     - Remove script/style remnants');
    process.exit(1);
  }

  const url = args[2];
  let filters = [];

  // Look for --filters argument
  const filtersIndex = args.indexOf('--filters');
  if (filtersIndex !== -1 && args[filtersIndex + 1]) {
    filters = args[filtersIndex + 1].split(',').map(f => f.trim());
  }

  return { url, filters };
}

/**
 * Fetch URL content using native fetch (Node.js 18+)
 */
async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCode/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    return { content, contentType };
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

/**
 * Check if content is HTML
 */
function isHTML(content, contentType) {
  // Check content-type header first
  if (contentType.includes('text/html')) {
    return true;
  }

  // Fallback: check content for HTML markers
  const normalized = content.trim().toLowerCase().slice(0, 500);
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<!doctype html public') ||
    normalized.includes('<html') ||
    normalized.includes('<head>') ||
    normalized.includes('<body>')
  );
}

/**
 * Main function
 */
async function main() {
  try {
    const { url, filters } = parseArgs(process.argv);

    // Fetch the URL
    const { content, contentType } = await fetchUrl(url);

    // Check if it's HTML
    if (!isHTML(content, contentType)) {
      console.error(`Warning: Content does not appear to be HTML (Content-Type: ${contentType})`);
      console.error('Attempting conversion anyway...');
    }

    // Convert to markdown
    let markdown = convert(content);

    // Apply filters if requested
    if (filters.length > 0) {
      markdown = applyFilters(markdown, filters);
    }

    // Output to stdout
    console.log(markdown);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
