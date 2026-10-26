#!/usr/bin/env node

const { looksLikeHTML } = require('./lib/detect');

/**
 * Read JSON input from stdin
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function formatSize(text) {
  const bytes = Buffer.byteLength(text);
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Main hook logic
 */
async function main() {
  const input = await readStdin();

  if (input.tool_name !== 'Bash' || !/\bcurl\b/.test(input.tool_input?.command || '')) {
    return;
  }

  const response = input.tool_response;
  if (!response || !looksLikeHTML(response.stdout)) {
    return;
  }

  const { convert } = require('./lib/converter');
  const markdown = convert(response.stdout);

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `html2markdown converted ${formatSize(response.stdout)} of HTML output to ${formatSize(markdown)} of Markdown. ` +
        'For the raw HTML, save it with `curl -o <file>` and read the file with the Read tool.',
      updatedToolOutput: { ...response, stdout: markdown }
    }
  };

  process.stdout.write(JSON.stringify(output));
}

main().catch(error => {
  console.error(`html2markdown hook: ${error.message}`);
});
