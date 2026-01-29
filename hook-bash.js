#!/usr/bin/env node

const { convert } = require('./lib/converter');

/**
 * Read JSON input from stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error.message}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Check if content is HTML
 */
function isHTML(content) {
  if (typeof content !== 'string') {
    return false;
  }

  const normalized = content.trim().toLowerCase().slice(0, 500);
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<!doctype html public') ||
    normalized.includes('<html') ||
    normalized.includes('<head>') ||
    normalized.includes('<body>')
  );
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readStdin();

    // Only process Bash tool calls with curl commands
    if (input.tool_name !== 'Bash') {
      return; // Pass through
    }

    const command = input.tool_input?.command || '';
    if (!command.includes('curl')) {
      return; // Pass through
    }

    // Extract stdout from tool response
    const stdout = input.tool_response?.stdout || '';

    // Check if it's HTML
    if (!isHTML(stdout)) {
      return; // Pass through
    }

    // Convert to markdown
    const markdown = convert(stdout);

    // Return additional context
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `HTML detected and converted to Markdown:\n\n${markdown}`
      }
    };

    console.log(JSON.stringify(output));

  } catch (error) {
    // Log error to stderr but don't fail the hook
    console.error(`Hook error: ${error.message}`);
    // Pass through (no output to stdout)
  }
}

main();
