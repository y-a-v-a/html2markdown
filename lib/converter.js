const TurndownService = require('turndown');

/**
 * Convert HTML to Markdown using Turndown
 * @param {string} html - HTML content to convert
 * @param {object} options - Optional Turndown configuration overrides
 * @returns {string} Markdown content
 */
function convert(html, options = {}) {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '_',
    linkStyle: 'inlined',
    ...options
  });

  return turndown.turndown(html);
}

module.exports = { convert };
