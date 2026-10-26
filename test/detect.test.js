const test = require('node:test');
const assert = require('node:assert/strict');
const { looksLikeHTML, isHTMLContentType } = require('../lib/detect');

test('looksLikeHTML detects HTML documents', () => {
  assert.ok(looksLikeHTML('<!DOCTYPE html><html><body></body></html>'));
  assert.ok(looksLikeHTML('<html lang="en"><p>hi</p></html>'));
  assert.ok(looksLikeHTML('\n\n  <!doctype html>'));
  assert.ok(looksLikeHTML('﻿<!doctype html>'));
  assert.ok(looksLikeHTML('<!-- comment --><head><title>x</title></head>'));
  assert.ok(looksLikeHTML('<body class="page">text</body>'));
});

test('looksLikeHTML ignores text that only mentions HTML', () => {
  assert.equal(looksLikeHTML('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<!doctype html><html></html>'), false);
  assert.equal(looksLikeHTML('3:<html lang="en">'), false);
  assert.equal(looksLikeHTML('{"body": "<html></html>"}'), false);
  assert.equal(looksLikeHTML('<div>fragment</div>'), false);
  assert.equal(looksLikeHTML('<htmlish>'), false);
  assert.equal(looksLikeHTML(''), false);
  assert.equal(looksLikeHTML(undefined), false);
  assert.equal(looksLikeHTML({ stdout: '<html>' }), false);
});

test('isHTMLContentType matches HTML media types only', () => {
  assert.ok(isHTMLContentType('text/html'));
  assert.ok(isHTMLContentType('text/html; charset=utf-8'));
  assert.ok(isHTMLContentType('application/xhtml+xml'));
  assert.equal(isHTMLContentType('application/json'), false);
  assert.equal(isHTMLContentType('text/plain'), false);
  assert.equal(isHTMLContentType(''), false);
  assert.equal(isHTMLContentType(undefined), false);
});
