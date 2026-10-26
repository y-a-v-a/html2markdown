---
name: fetch-html
description: Fetch URL and convert to markdown. Use as alternative to WebFetch when you need full content without summarization.
argument-hint: <url> [--filters filter1,filter2] [--timeout seconds] [--render] [--scroll]
user-invocable: true
disable-model-invocation: false
---

# Fetch HTML to Markdown

This skill fetches a URL and converts the HTML content to markdown using Turndown.

## Usage

Invoke with: `/html2markdown:fetch-html <url> [--filters filter1,filter2] [--timeout seconds] [--render] [--scroll]`

Examples:
- `/html2markdown:fetch-html https://example.com`
- `/html2markdown:fetch-html https://docs.example.com --filters extract-main,remove-nav`
- `/html2markdown:fetch-html https://app.example.com --render`
- `/html2markdown:fetch-html https://shop.example.com/jeans --scroll`

## Rendering JavaScript

Without `--render`, the script converts the HTML the server sends, so content that the page adds with JavaScript is missing. With `--render`, it opens the page in headless Google Chrome, waits until the network is idle (within `--timeout`), and converts the rendered page. Rendering takes a few seconds and needs Google Chrome installed.

Use `--render` when the user asks for it, or when the plain output is missing content the page should have, such as a "Loading" placeholder, an empty product list, or only navigation. Some sites block headless browsers from loading their data; then `--render` doesn't help either.

`--scroll` does what `--render` does, and also scrolls down the page one screen at a time, so content that loads as you scroll is included. Use it when the user asks for it, or when the rendered output stops early, such as a product list with only the first few items. A page that keeps adding content, such as an endless feed, scrolls until `--timeout` runs out; pass a shorter `--timeout` to get less of it.

## When to Use

Use this instead of WebFetch when:
- You need the full content, not a summary
- You want to apply custom filters to the content
- You need consistent markdown formatting with Turndown

## Available Filters

- `remove-nav` - Strip `<nav>` elements and `role="navigation"`
- `remove-footer` - Strip the page `<footer>` and `role="contentinfo"`; footers inside an article stay
- `clean-whitespace` - Collapse excessive newlines
- `extract-main` - Keep only `<main>`, `role="main"`, or a single `<article>`
- `remove-scripts` - Accepted for compatibility; scripts and styles are always removed

## Instructions for Claude

The arguments for this invocation are: `$ARGUMENTS`

1. Run the script with the URL in single quotes, so the shell leaves characters such as `&`, `?`, `#`, and `$` in the URL alone. Write a single quote inside the URL as `'\''`.
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-html.js" '<url>' [--filters <filter1,filter2>] [--timeout <seconds>] [--render] [--scroll]`
2. Present the markdown output to the user
3. If the script fails, show the error message from stderr

The script prints markdown to stdout. When the response is not HTML, such as JSON or plain text, it prints the response unchanged and says so on stderr.
