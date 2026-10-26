const { test, describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'fetch-html.js');

function feedPage(items) {
  return `<!doctype html><html><body><div id="feed"><h2 style="height: 1500px">Item 1</h2></div><div id="end" style="height: 20px"></div><script>
    let count = 1;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      await fetch('/api');
      count++;
      document.getElementById('feed').insertAdjacentHTML('beforeend', '<h2 style="height: 1500px">Item ' + count + '</h2>');
      if (count >= ${items}) observer.disconnect();
    });
    observer.observe(document.getElementById('end'));
  </script></body></html>`;
}

const ROUTES = {
  '/page': {
    type: 'text/html; charset=utf-8',
    body: '<!doctype html><html><head><script>var x;</script></head><body><nav>Nav</nav><main><h1>Title</h1><p>Body</p></main></body></html>'
  },
  '/json': { type: 'application/json', body: '{"a_b": [1, 2], "c": "*x*", "note": "charset=latin1 café"}' },
  '/latin1': {
    type: 'text/html; charset=iso-8859-1',
    body: Buffer.from('<!doctype html><html><body><p>caf\xe9</p></body></html>', 'latin1')
  },
  '/meta-charset': {
    type: 'text/html',
    body: Buffer.from('<!doctype html><html><head><meta charset="windows-1252"></head><body><p>\x80 5</p></body></html>', 'latin1')
  },
  '/untyped': { type: '', body: '<!doctype html><html><body><p>sniffed</p></body></html>' },
  '/api': { type: 'application/json', body: '{"text": "From the API"}' },
  '/client-rendered': {
    type: 'text/html',
    body: `<!doctype html><html><body><div id="root"><p>Loading</p></div><script>
      setTimeout(async () => {
        const { text } = await (await fetch('/api')).json();
        document.getElementById('root').innerHTML = '<h1>Rendered</h1><p>' + text + '</p>';
      }, 300);
    </script></body></html>`
  },
  '/busy': {
    type: 'text/html',
    body: `<!doctype html><html><body><h1>Busy</h1><script>
      setInterval(() => fetch('/api'), 200);
    </script></body></html>`
  },
  '/feed': { type: 'text/html', body: feedPage(3) },
  '/endless': { type: 'text/html', body: feedPage(Infinity) }
};

let server;
let baseUrl;
let lastQuery;

test.before(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    lastQuery = url.search;
    if (url.pathname === '/slow') {
      return;
    }
    const route = ROUTES[url.pathname];
    if (!route) {
      response.writeHead(404, 'Not Found').end();
      return;
    }
    response.writeHead(200, route.type ? { 'Content-Type': route.type } : {}).end(route.body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.closeAllConnections();
  server.close();
});

function run(...args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [SCRIPT, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('converts an HTML page to Markdown without scripts', async () => {
  const { code, stdout } = await run(`${baseUrl}/page`);
  assert.equal(code, 0);
  assert.equal(stdout, 'Nav\n\n# Title\n\nBody\n');
});

test('applies filters given before or after the URL', async () => {
  assert.equal((await run(`${baseUrl}/page`, '--filters', 'extract-main')).stdout, '# Title\n\nBody\n');
  assert.equal((await run('--filters=remove-nav', `${baseUrl}/page`)).stdout, '# Title\n\nBody\n');
});

test('keeps the full query string', async () => {
  await run(`${baseUrl}/page?a=1&b=2`);
  assert.equal(lastQuery, '?a=1&b=2');
});

test('prints non-HTML responses unchanged', async () => {
  const { code, stdout, stderr } = await run(`${baseUrl}/json`);
  assert.equal(code, 0);
  assert.equal(stdout, ROUTES['/json'].body);
  assert.match(stderr, /application\/json, not HTML/);
});

test('converts HTML without a Content-Type header', async () => {
  assert.equal((await run(`${baseUrl}/untyped`)).stdout, 'sniffed\n');
});

test('decodes the charset from the header or a meta tag', async () => {
  assert.equal((await run(`${baseUrl}/latin1`)).stdout, 'café\n');
  assert.equal((await run(`${baseUrl}/meta-charset`)).stdout, '€ 5\n');
});

test('reports HTTP errors', async () => {
  const { code, stderr } = await run(`${baseUrl}/missing`);
  assert.equal(code, 1);
  assert.match(stderr, /HTTP 404 Not Found/);
});

test('gives up after the timeout', async () => {
  const { code, stderr } = await run(`${baseUrl}/slow`, '--timeout', '0.2');
  assert.equal(code, 1);
  assert.match(stderr, /no response within 0\.2 seconds/);
});

test('rejects bad arguments before fetching', async () => {
  const cases = [
    [[], /^Usage:/],
    [['not a url'], /Invalid URL/],
    [['file:///etc/passwd'], /Only http and https URLs are supported/],
    [[`${baseUrl}/page`, '--filters', 'remove-ads'], /Unknown filter: remove-ads/],
    [[`${baseUrl}/page`, '--timeout', '0'], /--timeout must be a positive number/],
    [[`${baseUrl}/page`, '--verbose'], /Unknown option '--verbose'/],
    [[`${baseUrl}/page`, '--render=yes'], /--render/],
    [[`${baseUrl}/page`, '--scroll=yes'], /--scroll/]
  ];
  for (const [args, message] of cases) {
    lastQuery = undefined;
    const { code, stdout, stderr } = await run(...args);
    assert.equal(code, 1, `expected exit 1 for ${args.join(' ')}`);
    assert.equal(stdout, '');
    assert.match(stderr, message);
    assert.equal(lastQuery, undefined, `fetched for ${args.join(' ')}`);
  }
});

test('without --render, content added by JavaScript is missing', async () => {
  assert.equal((await run(`${baseUrl}/client-rendered`)).stdout, 'Loading\n');
});

describe('with --render', () => {
  let chromeMissing;

  before(async () => {
    try {
      const browser = await chromium.launch({ channel: 'chrome', headless: true });
      await browser.close();
    } catch (error) {
      chromeMissing = `Google Chrome is not available: ${error.message.split('\n')[0]}`;
    }
  });

  it('converts the page after its JavaScript has run and the network is idle', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const { code, stdout, stderr } = await run(`${baseUrl}/client-rendered`, '--render');
    assert.equal(code, 0, stderr);
    assert.equal(stdout, '# Rendered\n\nFrom the API\n');
  });

  it('applies filters to the rendered page', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    assert.equal((await run(`${baseUrl}/page`, '--render', '--filters', 'remove-nav')).stdout, '# Title\n\nBody\n');
  });

  it('prints non-HTML responses unchanged', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const { code, stdout, stderr } = await run(`${baseUrl}/json`, '--render');
    assert.equal(code, 0);
    assert.equal(stdout, ROUTES['/json'].body);
    assert.match(stderr, /application\/json, not HTML/);
  });

  it('converts what has rendered when the network never goes idle', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const { code, stdout, stderr } = await run(`${baseUrl}/busy`, '--render', '--timeout', '2');
    assert.equal(code, 0);
    assert.equal(stdout, '# Busy\n');
    assert.match(stderr, /did not finish within 2 seconds/);
  });

  it('without --scroll, content that loads as you scroll is missing', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    assert.equal((await run(`${baseUrl}/feed`, '--render')).stdout, '## Item 1\n');
  });

  it('with --scroll, scrolls until the page stops growing', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const { code, stdout, stderr } = await run(`${baseUrl}/feed`, '--scroll');
    assert.equal(code, 0, stderr);
    assert.equal(stdout, '## Item 1\n\n## Item 2\n\n## Item 3\n');
    assert.equal(stderr, '');
  });

  it('with --scroll, stops an endless feed at the timeout', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const { code, stdout, stderr } = await run(`${baseUrl}/endless`, '--scroll', '--timeout', '4');
    assert.equal(code, 0);
    assert.match(stdout, /## Item 2\n/);
    assert.match(stderr, /did not finish within 4 seconds/);
  });

  it('reports HTTP errors and timeouts', async t => {
    if (chromeMissing) return t.skip(chromeMissing);
    const missing = await run(`${baseUrl}/missing`, '--render');
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /Failed to render .*: HTTP 404 Not Found/);

    const slow = await run(`${baseUrl}/slow`, '--render', '--timeout', '1.5');
    assert.equal(slow.code, 1);
    assert.match(slow.stderr, /no response within 1\.5 seconds/);
  });
});
