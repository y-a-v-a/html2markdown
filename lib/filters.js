/**
 * Custom content filters for processed markdown
 */

/**
 * Remove navigation elements from markdown
 * Looks for common patterns like "Navigation", "Menu", etc.
 */
function removeNav(markdown) {
  // Simple heuristic: remove lines that look like navigation
  const lines = markdown.split('\n');
  const filtered = lines.filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes('navigation') &&
           !lower.includes('menu') &&
           !lower.match(/^\s*\[home\]\s*\|/i);
  });
  return filtered.join('\n');
}

/**
 * Remove footer content from markdown
 * Looks for common patterns like "Copyright", "Footer", etc.
 */
function removeFooter(markdown) {
  const lines = markdown.split('\n');
  const filtered = lines.filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes('copyright') &&
           !lower.includes('footer') &&
           !lower.match(/©/);
  });
  return filtered.join('\n');
}

/**
 * Clean excessive whitespace from markdown
 * Collapses multiple consecutive newlines into at most 2
 */
function cleanWhitespace(markdown) {
  // Collapse 3+ newlines into 2
  return markdown.replace(/\n{3,}/g, '\n\n');
}

/**
 * Extract main content area
 * This is a simple heuristic - finds the largest contiguous block of text
 */
function extractMain(markdown) {
  const blocks = markdown.split(/\n{2,}/);

  // Find the longest block (likely main content)
  let longest = '';
  for (const block of blocks) {
    if (block.length > longest.length) {
      longest = block;
    }
  }

  return longest;
}

/**
 * Remove script and style remnants
 * Turndown should handle this, but catch any stragglers
 */
function removeScripts(markdown) {
  return markdown
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

/**
 * Apply a set of filters to markdown content
 * @param {string} markdown - Markdown content to filter
 * @param {string[]} filterNames - Array of filter names to apply
 * @returns {string} Filtered markdown
 */
function applyFilters(markdown, filterNames = []) {
  const filterMap = {
    'remove-nav': removeNav,
    'remove-footer': removeFooter,
    'clean-whitespace': cleanWhitespace,
    'extract-main': extractMain,
    'remove-scripts': removeScripts
  };

  let result = markdown;

  for (const filterName of filterNames) {
    const filter = filterMap[filterName];
    if (filter) {
      result = filter(result);
    } else {
      console.warn(`Unknown filter: ${filterName}`);
    }
  }

  return result;
}

module.exports = {
  removeNav,
  removeFooter,
  cleanWhitespace,
  extractMain,
  removeScripts,
  applyFilters
};
