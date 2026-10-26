const TurndownService = require('turndown');
const {
  assertFilters,
  hasDomFilters,
  applyDomFilters,
  applyMarkdownFilters
} = require('./filters');

const NON_CONTENT = ['script', 'style', 'noscript', 'template', 'title'];
const BLOCK_MARKER = /^(?:#{1,6}\s+|(?:[-+*]|\d+\.)\s+|>\s?)+/;

let turndown;

/**
 * Join multi-line link text into one line, so a link around block elements
 * still renders as a link. Markers that block elements add at the start of a
 * line are dropped; the same characters in text are escaped by Turndown.
 */
function singleLine(content) {
  if (!content.includes('\n')) {
    return content;
  }

  return content
    .split('\n')
    .map(line => line.trim().replace(BLOCK_MARKER, ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * Convert an HTML document to Markdown using Turndown
 * @param {string} html - HTML content to convert
 * @param {string[]} filters - Names of filters to apply, see lib/filters.js
 * @returns {string} Markdown content
 */
function convert(html, filters = []) {
  assertFilters(filters);

  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      strongDelimiter: '**',
      emDelimiter: '_',
      linkStyle: 'inlined'
    });
    turndown.remove(NON_CONTENT);

    const { inlineLink } = turndown.options.rules;
    turndown.addRule('singleLineLink', {
      filter: inlineLink.filter,
      replacement: (content, node, options) => inlineLink.replacement(singleLine(content), node, options)
    });
  }

  const input = hasDomFilters(filters) ? applyDomFilters(html, filters) : html;
  return applyMarkdownFilters(turndown.turndown(input), filters);
}

module.exports = { convert };
