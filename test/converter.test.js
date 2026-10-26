const test = require('node:test');
const assert = require('node:assert/strict');
const { convert } = require('../lib/converter');
const { FILTER_NAMES } = require('../lib/filters');

const PAGE = `<!doctype html>
<html>
<head>
  <title>Page title</title>
  <style>.a { color: red }</style>
  <script>var inHead = 1;</script>
</head>
<body>
  <nav><a href="/">Home</a> | <a href="/menu">Menu</a></nav>
  <div role="navigation"><a href="/side">Sidebar link</a></div>
  <main>
    <h1>Restaurant menu guide</h1>
    <p>This guide explains how the menu navigation works.</p>
    <article>
      <p>Copyright of this recipe belongs to the chef.</p>
      <footer>Posted by the chef</footer>
    </article>
    <script>var inBody = 2;</script>
  </main>
  <footer>Copyright 2026 Example</footer>
  <div role="contentinfo">Contact details</div>
  <noscript>Enable JavaScript</noscript>
  <template><p>Template content</p></template>
</body>
</html>`;

test('removes head, script, style, noscript, and template content', () => {
  const markdown = convert(PAGE);
  for (const text of ['Page title', 'color: red', 'inHead', 'inBody', 'Enable JavaScript', 'Template content']) {
    assert.equal(markdown.includes(text), false, `unexpected "${text}" in output`);
  }
  assert.match(markdown, /^# Restaurant menu guide$/m);
});

test('uses the configured Markdown style', () => {
  const markdown = convert('<h2>Title</h2><ul><li>one</li></ul><p><strong>b</strong> <em>i</em> <a href="https://x.test/">link</a></p><pre><code>code</code></pre>');
  assert.equal(markdown, '## Title\n\n-   one\n\n**b** _i_ [link](https://x.test/)\n\n```\ncode\n```');
});

test('without filters, navigation and footers stay', () => {
  const markdown = convert(PAGE);
  assert.match(markdown, /\[Home\]\(\/\)/);
  assert.match(markdown, /Copyright 2026 Example/);
});

test('remove-nav removes navigation elements but keeps text about menus', () => {
  const markdown = convert(PAGE, ['remove-nav']);
  assert.equal(markdown.includes('[Home](/)'), false);
  assert.equal(markdown.includes('Sidebar link'), false);
  assert.match(markdown, /# Restaurant menu guide/);
  assert.match(markdown, /This guide explains how the menu navigation works\./);
});

test('remove-footer removes the page footer but keeps article footers and copyright text', () => {
  const markdown = convert(PAGE, ['remove-footer']);
  assert.equal(markdown.includes('Copyright 2026 Example'), false);
  assert.equal(markdown.includes('Contact details'), false);
  assert.match(markdown, /Posted by the chef/);
  assert.match(markdown, /Copyright of this recipe belongs to the chef\./);
});

test('extract-main keeps the whole <main> element', () => {
  const markdown = convert(PAGE, ['extract-main']);
  assert.match(markdown, /^# Restaurant menu guide/);
  assert.match(markdown, /This guide explains how the menu navigation works\./);
  assert.match(markdown, /Posted by the chef$/);
  assert.equal(markdown.includes('Home'), false);
  assert.equal(markdown.includes('Copyright 2026'), false);
});

test('extract-main falls back to role="main", then a single article, then the page', () => {
  assert.equal(convert('<p>out</p><div role="main"><p>in</p></div>', ['extract-main']), 'in');
  assert.equal(convert('<p>out</p><article><p>in</p></article>', ['extract-main']), 'in');
  assert.equal(convert('<p>a</p><article>b</article><article>c</article>', ['extract-main']), 'a\n\nb\n\nc');
});

test('clean-whitespace collapses runs of blank lines', () => {
  const markdown = convert('<p>a</p><br><br><br><br><p>b</p>', ['clean-whitespace']);
  assert.equal(/\n{3,}/.test(markdown), false);
});

test('every documented filter is accepted, unknown filters throw', () => {
  assert.doesNotThrow(() => convert(PAGE, FILTER_NAMES));
  assert.throws(() => convert(PAGE, ['remove-ads']), /Unknown filter: remove-ads/);
});

test('keeps links around block elements on one line', () => {
  assert.equal(
    convert('<ul><li><a href="/"><div>NOS.nl Voorpagina</div></a></li></ul>'),
    '-   [NOS.nl Voorpagina](/)'
  );
  assert.equal(
    convert('<a href="/a"><img src="i.webp" alt=""><h3>Title</h3><p>Teaser <b>text</b>.</p><ul><li>tag</li></ul></a>'),
    '[![](i.webp) Title Teaser **text**. tag](/a)'
  );
  assert.equal(
    convert('<a href="/x"><p>- not a list</p><p># not a heading</p><p>1. not numbered</p></a>'),
    '[\\- not a list \\# not a heading 1\\. not numbered](/x)'
  );
  assert.equal(
    convert('<a href="/a(b)" title="say &quot;hi&quot;"><p>x</p><p>y</p></a>'),
    '[x y](/a\\(b\\) "say \\"hi\\"")'
  );
  assert.equal(convert('<a href="/b">b<br>c</a>'), '[b c](/b)');
});

test('leaves single-line links as Turndown writes them', () => {
  assert.equal(convert('<p>foo<a href="/"> bar</a> <a href="/b">baz</a></p>'), 'foo [bar](/) [baz](/b)');
  assert.equal(convert('<p><a href="/"><img src="i.png" alt="logo"></a></p>'), '[![logo](i.png)](/)');
});

test('handles fragments and empty input', () => {
  assert.equal(convert('<p>Hello <b>world</b></p>'), 'Hello **world**');
  assert.equal(convert(''), '');
});
