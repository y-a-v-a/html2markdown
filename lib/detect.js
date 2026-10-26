const HTML_MARKER = /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i;
const HTML_CONTENT_TYPE = /\b(text\/html|application\/xhtml\+xml)\b/i;

/**
 * Check whether text is an HTML document rather than text that mentions HTML
 * @param {string} text - Content to inspect
 * @returns {boolean}
 */
function looksLikeHTML(text) {
  if (typeof text !== 'string') {
    return false;
  }

  const start = text.trimStart().slice(0, 1024);
  return start.startsWith('<') && HTML_MARKER.test(start);
}

/**
 * Check whether a Content-Type header names an HTML media type
 * @param {string} contentType - Content-Type header value
 * @returns {boolean}
 */
function isHTMLContentType(contentType) {
  return HTML_CONTENT_TYPE.test(contentType || '');
}

module.exports = { looksLikeHTML, isHTMLContentType };
