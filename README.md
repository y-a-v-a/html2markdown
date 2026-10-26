# HTML to Markdown - Claude Code Plugin

A Claude Code plugin that automatically converts HTML responses from `curl` commands to markdown using Turndown, and provides a skill to fetch and convert any URL.

## Features

- **Automatic conversion**: PostToolUse hook replaces HTML output of `curl` commands with markdown, so Claude reads less noise and fewer tokens
- **Manual fetching**: `/html2markdown:fetch-html` skill to fetch and convert any URL
- **Custom filters**: Remove navigation and footers, or keep only the main content
- **Clean output**: `<head>`, scripts, styles, `<noscript>` and `<template>` content never end up in the markdown
- **Portable**: Uses `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths

## Requirements

- **Node.js 20 or higher** (uses native `fetch`, `util.parseArgs`, and `playwright-core`)
- **npm** on the `PATH`, so Claude Code can install the dependencies
- **Google Chrome**, only for the `--render` and `--scroll` options
- Claude Code

## Installation

### Option 1: Local Development/Testing

Install dependencies and test the plugin locally:

```bash
npm install
claude --plugin-dir /path/to/html2markdown
```

### Option 2: Plugin Marketplace

1. Add this plugin to a marketplace (see [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces))
2. Install via `/plugin install html2markdown`

Claude Code installs the dependencies itself when it copies the plugin, because the repository contains both `package.json` and `package-lock.json`. Keep the lockfile committed: without it, Claude Code skips the install and the plugin can't load Turndown. See [Node.js package dependencies](https://code.claude.com/docs/en/plugins/loading#node-js-package-dependencies).

## Usage

### Automatic Conversion (Hook)

The plugin automatically detects HTML in `curl` command responses and replaces it with markdown:

```bash
# Claude runs this:
curl https://example.com

# Claude receives markdown instead of the raw HTML
```

Output that isn't an HTML document passes through unchanged, such as JSON, plain text, or `curl -i` output that starts with response headers. To read the raw HTML, Claude can save it with `curl -o page.html <url>` and open the file with the Read tool; the hook tells Claude this each time it converts.

### Manual Fetching (Skill)

Use the `/html2markdown:fetch-html` skill to fetch and convert URLs:

```bash
/html2markdown:fetch-html https://example.com
```

With filters:

```bash
/html2markdown:fetch-html https://docs.example.com --filters extract-main,remove-nav
```

With a timeout in seconds (the default is 30):

```bash
/html2markdown:fetch-html https://slow.example.com --timeout 60
```

When the response isn't HTML, such as JSON, the skill prints it unchanged instead of running it through Turndown, which would escape characters like `_` and `*`.

### Rendering JavaScript

By default the skill converts the HTML the server sends, so content that a page adds with JavaScript, such as a React app's product list, is missing. Add `--render` to run the page in headless Google Chrome first:

```bash
/html2markdown:fetch-html https://app.example.com --render
```

The script then waits until the page has made no network requests for half a second, and converts the rendered page. The `--timeout` budget covers the whole render. If the page keeps making requests, for example for analytics polling, the script converts what has rendered when time runs out and says so on stderr.

Some pages add content only as you scroll down, such as a product list that grows or sections that appear when they come into view. Add `--scroll` to scroll down the page one screen at a time before converting it. It turns on `--render` too:

```bash
/html2markdown:fetch-html https://shop.example.com/jeans --scroll
```

Each screen stays in view for two frames: long enough for the page to see which elements came into view and start loading their content. At the bottom, the script waits until the network has been quiet for half a second. If the page grew, it scrolls on; if not, it converts the page. A page that keeps adding content, such as an endless feed, scrolls until `--timeout` runs out, so a shorter timeout gives you less of it. In our measurements, scrolling added between 0.1 and 3 seconds to ordinary pages, and 7 seconds to the Node.js `fs` documentation, which is 216 screens long.

Things to know:

- Rendering takes a few seconds per page, compared with well under a second without it
- It uses the Google Chrome installed on your machine through [`playwright-core`](https://playwright.dev/docs/library), so no extra browser is downloaded. Each render uses a fresh browser context with no profile, cookies, or logins
- The page's JavaScript runs inside Chrome's sandbox. Playwright turns the sandbox off by default; the script turns it on. In a Linux container without user namespaces, Chrome may then fail to start
- `--scroll` scrolls the window only. A page that scrolls inside an inner element doesn't move, and the output is the same as with `--render` alone
- Lists that keep only the visible rows in the page, often called virtualized lists, end up with only the last rows after scrolling
- Pages that wait for scrolling to stop before loading more load that content only at the bottom of the page
- Some sites block headless browsers from loading their data. For example, the product list on g-star.com comes from a search API that answers headless Chrome with HTTP 403, so `--render` doesn't bring in those products

### Available Filters

Filters work on HTML elements, not on words in the text, so a paragraph that mentions a "menu" stays.

- `remove-nav` - Strip `<nav>` elements and `role="navigation"`
- `remove-footer` - Strip the page `<footer>` and `role="contentinfo"`; footers inside an article stay
- `clean-whitespace` - Collapse excessive newlines
- `extract-main` - Keep only `<main>`, `role="main"`, or a single `<article>`; otherwise keep the whole page
- `remove-scripts` - Accepted for compatibility; scripts and styles are always removed

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
│   ├── detect.js            # HTML detection, loads without Turndown
│   ├── render.js            # Headless Chrome rendering for --render
│   └── filters.js           # HTML element and markdown filters
├── scripts/
│   └── fetch-html.js        # Fetch URL and convert
├── test/                    # node:test suites, run offline
├── hook-bash.js             # Hook script for curl detection
├── package.json
├── package-lock.json        # Needed for Claude Code's dependency install
└── README.md
```

## How It Works

### PostToolUse Hook

1. Runs only for Bash commands that call `curl`, through the hook's `"if": "Bash(curl *)"` condition, so other Bash commands don't start a Node.js process. Claude Code checks each part of a compound command such as `cd docs && curl ...`
2. Checks if the output is an HTML document: it must start with `<` and contain a doctype, `<html>`, `<head>` or `<body>` tag
3. Converts HTML to markdown using Turndown. Turndown loads only at this point
4. Replaces the tool output with the markdown through `updatedToolOutput`, and adds a short note through `additionalContext`

If anything fails, the hook exits without output and Claude sees the original output.

### Fetch Skill

1. Takes URL and optional filters as arguments
2. Fetches the URL using the native `fetch` API, with a timeout. With `--render`, loads it in headless Google Chrome instead and waits until the network is idle; with `--scroll`, also scrolls to the bottom of the page
3. Decodes the response with the charset from the `Content-Type` header or a `<meta>` tag
4. Applies requested filters to the HTML elements
5. Converts to markdown using Turndown
6. Returns markdown to Claude

## Development

### Running the Tests

```bash
npm install
npm test
```

The tests use the built-in `node:test` runner and a local HTTP server, so they don't need network access. The `--render` and `--scroll` tests skip themselves when Google Chrome isn't installed.

### Testing the Hook

Run Claude Code with the plugin loaded:

```bash
npm install
claude --plugin-dir /path/to/html2markdown
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
- PostToolUse hook with Bash matcher and a `Bash(curl *)` condition
- User-invocable skill with argument support

## References

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Turndown](https://github.com/mixmark-io/turndown)
