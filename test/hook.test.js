const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'hook-bash.js');

function runHook(input) {
  const result = spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8'
  });
  return {
    status: result.status,
    stderr: result.stderr,
    output: result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : undefined
  };
}

function bashCall(command, stdout) {
  return {
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    tool_response: { stdout, stderr: 'curl progress', interrupted: false, isImage: false }
  };
}

const HTML = '<!doctype html><html><head><title>T</title><script>var x = 1;</script></head><body><h1>Hello</h1><p>World</p></body></html>';

test('replaces HTML curl output with Markdown and keeps the other fields', () => {
  const { status, output } = runHook(bashCall('curl -s https://example.com', HTML));
  assert.equal(status, 0);
  assert.equal(output.hookEventName, 'PostToolUse');
  assert.deepEqual(output.updatedToolOutput, {
    stdout: '# Hello\n\nWorld',
    stderr: 'curl progress',
    interrupted: false,
    isImage: false
  });
  assert.match(output.additionalContext, /converted 123 bytes of HTML output to 14 bytes of Markdown/);
});

test('handles curl inside a compound command', () => {
  const { output } = runHook(bashCall('cd /tmp && curl -sL https://example.com | head -100', HTML));
  assert.equal(output.updatedToolOutput.stdout, '# Hello\n\nWorld');
});

test('passes through non-HTML output, non-curl commands, and other tools', () => {
  const cases = [
    bashCall('curl -s https://api.example.com', '{"html": "<html></html>"}'),
    bashCall('curl -si https://example.com', `HTTP/2 200\r\ncontent-type: text/html\r\n\r\n${HTML}`),
    bashCall('cat page.html', HTML),
    bashCall('echo libcurl', HTML),
    { ...bashCall('curl x', HTML), tool_name: 'Read' },
    { tool_name: 'Bash', tool_input: { command: 'curl -s x' } }
  ];
  for (const input of cases) {
    const result = runHook(input);
    assert.equal(result.status, 0);
    assert.equal(result.output, undefined, `expected no output for ${input.tool_input.command}`);
  }
});

test('exits 0 without output on invalid input', () => {
  const result = runHook('not json');
  assert.equal(result.status, 0);
  assert.equal(result.output, undefined);
  assert.match(result.stderr, /html2markdown hook:/);
});

test('keeps multi-byte characters that straddle stdin chunk boundaries', () => {
  const text = '€ café 日本語 '.repeat(20000);
  const { output } = runHook(bashCall('curl -s https://example.com', `<!doctype html><html><body><p>${text}</p></body></html>`));
  assert.equal(output.updatedToolOutput.stdout.includes('�'), false);
  assert.equal(output.updatedToolOutput.stdout, text.trim());
});
