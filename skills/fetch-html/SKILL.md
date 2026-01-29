---
name: fetch-html
description: Fetch URL and convert to markdown. Use as alternative to WebFetch when you need full content without summarization.
argument-hint: <url> [--filters filter1,filter2]
user-invocable: true
disable-model-invocation: false
---

# Fetch HTML to Markdown

This skill fetches a URL and converts the HTML content to markdown using Turndown.

## Usage

Invoke with: `/html2markdown:fetch-html <url> [--filters filter1,filter2]`

Examples:
- `/html2markdown:fetch-html https://example.com`
- `/html2markdown:fetch-html https://docs.example.com --filters remove-nav,clean-whitespace`

## When to Use

Use this instead of WebFetch when:
- You need the full content, not a summary
- You want to apply custom filters to the content
- You need consistent markdown formatting with Turndown

## Available Filters

- `remove-nav` - Strip navigation elements
- `remove-footer` - Strip footer content
- `clean-whitespace` - Collapse excessive newlines
- `extract-main` - Try to find main content area
- `remove-scripts` - Remove script/style remnants

## Instructions for Claude

When this skill is invoked:

1. Parse the arguments from `$ARGUMENTS`
2. Execute: `node "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-html.js" $ARGUMENTS`
3. Present the markdown output to the user
4. If the script fails, show the error message from stderr

The script will output clean markdown to stdout that you can analyze and present.
