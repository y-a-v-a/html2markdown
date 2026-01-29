# HTML to Markdown - Claude Code Plugin

A Claude Code plugin that automatically converts HTML responses from `curl` commands to markdown using Turndown, and provides a skill to fetch and convert any URL.

## Features

- **Automatic conversion**: PostToolUse hook intercepts `curl` command responses and converts HTML to markdown
- **Manual fetching**: `/html2markdown:fetch-html` skill to fetch and convert any URL
- **Custom filters**: Apply filters to clean up converted markdown
- **Portable**: Uses `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths

## Requirements

- **Node.js 18.0.0 or higher** (uses native `fetch` API)
- Claude Code

## Installation

### Option 1: Local Development/Testing

Install dependencies and test the plugin locally:

```bash
npm install
claude --plugin-dir /Users/nlbruiv/Projects/vincent/html2markdown
```

### Option 2: Plugin Marketplace

1. Add this plugin to a marketplace (see [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces))
2. Install via `/plugin install html2markdown`

## Usage

### Automatic Conversion (Hook)

The plugin automatically detects HTML in `curl` command responses and converts them to markdown:

```bash
# Claude runs this:
curl https://example.com

# Hook automatically converts HTML response to markdown
```

### Manual Fetching (Skill)

Use the `/html2markdown:fetch-html` skill to fetch and convert URLs:

```bash
/html2markdown:fetch-html https://example.com
```

With filters:

```bash
/html2markdown:fetch-html https://docs.example.com --filters remove-nav,clean-whitespace
```

### Available Filters

- `remove-nav` - Strip navigation elements
- `remove-footer` - Strip footer content
- `clean-whitespace` - Collapse excessive newlines
- `extract-main` - Try to find main content area
- `remove-scripts` - Remove script/style remnants

## Plugin Structure

```
html2markdown/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   └── fetch-html/
│       └── SKILL.md         # Fetch and convert skill
├── hooks/
│   └── hooks.json           # PostToolUse hook configuration
├── lib/
│   ├── converter.js         # Turndown conversion logic
│   └── filters.js           # HTML filters
├── scripts/
│   └── fetch-html.js        # Fetch URL and convert
├── hook-bash.js             # Hook script for curl detection
├── package.json
└── README.md
```

## How It Works

### PostToolUse Hook

1. Listens for Bash tool calls containing `curl`
2. Checks if response is HTML (looks for doctype, html, head, body tags)
3. Converts HTML to markdown using Turndown
4. Injects markdown as additional context for Claude

### Fetch Skill

1. Takes URL and optional filters as arguments
2. Fetches URL using node-fetch
3. Applies requested filters to HTML
4. Converts to markdown using Turndown
5. Returns markdown to Claude

## Development

### Testing the Hook

Run Claude Code with the plugin loaded:

```bash
npm install
claude --plugin-dir /Users/nlbruiv/Projects/vincent/html2markdown
```

Then ask Claude to fetch a URL:

```
Can you fetch https://example.com using curl?
```

### Testing the Skill

```
/html2markdown:fetch-html https://example.com
```

## Configuration

The plugin uses:

- `${CLAUDE_PLUGIN_ROOT}` for portable paths
- PostToolUse hook with Bash matcher
- User-invocable skill with argument support

## References

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Turndown](https://github.com/mixmark-io/turndown)
