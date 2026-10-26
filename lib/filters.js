/**
 * Content filters. DOM filters run on the parsed page before conversion,
 * Markdown filters run on the converted output.
 */

const domino = require('@mixmark-io/domino');

const SECTIONING = 'article, aside, main, nav, section';

function removeAll(elements) {
  for (const element of elements) {
    element.remove();
  }
}

/**
 * Remove <nav> elements and elements with role="navigation"
 */
function removeNav(root) {
  removeAll(Array.from(root.querySelectorAll('nav, [role="navigation"]')));
  return root;
}

/**
 * Remove the page footer: <footer> elements outside sectioning content and
 * elements with role="contentinfo". Footers inside an article are kept.
 */
function removeFooter(root) {
  const footers = Array.from(root.querySelectorAll('footer'))
    .filter(footer => !footer.parentElement?.closest(SECTIONING));
  removeAll(footers);
  removeAll(Array.from(root.querySelectorAll('[role="contentinfo"]')));
  return root;
}

/**
 * Narrow the page to its main content: <main>, then role="main",
 * then a single <article>. Falls back to the whole page.
 */
function extractMain(root) {
  const articles = root.querySelectorAll('article');
  return (
    root.querySelector('main') ||
    root.querySelector('[role="main"]') ||
    (articles.length === 1 ? articles[0] : root)
  );
}

/**
 * Collapse three or more consecutive newlines into two
 */
function cleanWhitespace(markdown) {
  return markdown.replace(/\n{3,}/g, '\n\n');
}

const DOM_FILTERS = {
  'remove-nav': removeNav,
  'remove-footer': removeFooter,
  'extract-main': extractMain
};

const MARKDOWN_FILTERS = {
  'clean-whitespace': cleanWhitespace,
  'remove-scripts': markdown => markdown
};

const FILTER_NAMES = [...Object.keys(DOM_FILTERS), ...Object.keys(MARKDOWN_FILTERS)];

/**
 * Throw when a filter name is not known
 * @param {string[]} filterNames
 */
function assertFilters(filterNames) {
  const unknown = filterNames.filter(name => !FILTER_NAMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown filter: ${unknown.join(', ')}. Available filters: ${FILTER_NAMES.join(', ')}`);
  }
}

/**
 * Check whether any of filterNames needs the parsed page
 * @param {string[]} filterNames
 * @returns {boolean}
 */
function hasDomFilters(filterNames) {
  return filterNames.some(name => name in DOM_FILTERS);
}

/**
 * Parse the page and apply the DOM filters among filterNames, in order
 * @param {string} html - HTML content to filter
 * @param {string[]} filterNames
 * @returns {Element} The element to convert
 */
function applyDomFilters(html, filterNames) {
  return filterNames
    .filter(name => name in DOM_FILTERS)
    .reduce((element, name) => DOM_FILTERS[name](element), domino.createDocument(html).body);
}

/**
 * Apply the Markdown filters among filterNames, in order
 * @param {string} markdown
 * @param {string[]} filterNames
 * @returns {string}
 */
function applyMarkdownFilters(markdown, filterNames) {
  return filterNames
    .filter(name => name in MARKDOWN_FILTERS)
    .reduce((text, name) => MARKDOWN_FILTERS[name](text), markdown);
}

module.exports = {
  FILTER_NAMES,
  assertFilters,
  hasDomFilters,
  applyDomFilters,
  applyMarkdownFilters
};
