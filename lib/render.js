const { setTimeout: sleep } = require('node:timers/promises');
const { isHTMLContentType } = require('./detect');

const QUIET_MS = 500;
const POLL_MS = 50;

function firstLine(message) {
  return message.split('\n')[0];
}

function trackRequests(page) {
  const inflight = new Set();
  let lastActivity = Date.now();
  const start = request => {
    inflight.add(request);
    lastActivity = Date.now();
  };
  const finish = request => {
    inflight.delete(request);
    lastActivity = Date.now();
  };
  page.on('request', start);
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);

  return async function waitForQuiet(deadline) {
    const since = Date.now();
    while (inflight.size > 0 || Date.now() - Math.max(lastActivity, since) < QUIET_MS) {
      if (Date.now() >= deadline) {
        return false;
      }
      await sleep(POLL_MS);
    }
    return true;
  };
}

function pageHeight() {
  return (document.scrollingElement || document.documentElement).scrollHeight;
}

async function scrollOneScreen() {
  const y = window.scrollY;
  window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
  const height = (document.scrollingElement || document.documentElement).scrollHeight;
  await Promise.race([
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise(resolve => setTimeout(resolve, 100))
  ]);
  return { moved: window.scrollY > y, height };
}

async function scrollToEnd(page, waitForQuiet, deadline) {
  while (Date.now() < deadline) {
    const { moved, height } = await page.evaluate(scrollOneScreen);
    if (moved) {
      continue;
    }
    if (!await waitForQuiet(deadline)) {
      return false;
    }
    if (await page.evaluate(pageHeight) === height) {
      return true;
    }
  }
  return false;
}

/**
 * Load a page in headless Google Chrome, let its JavaScript run until the
 * network is idle, and return the rendered HTML. Non-HTML responses are
 * returned as they arrived.
 * @param {URL|string} url - Page to render
 * @param {number} timeout - Seconds for the whole render
 * @param {{scroll?: boolean}} [options] - scroll: scroll down one screen at a
 *   time, waiting for the network after each, until the page stops growing
 * @returns {Promise<{content: string, contentType: string, complete: boolean}>}
 *   complete is false when the page was still loading when time ran out
 */
async function renderUrl(url, timeout, { scroll = false } = {}) {
  const deadline = Date.now() + timeout * 1000;
  const { chromium } = require('playwright-core');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
  } catch (error) {
    throw new Error(`--render needs Google Chrome installed: ${firstLine(error.message)}`);
  }

  try {
    const page = await browser.newPage();
    const waitForQuiet = trackRequests(page);

    let navigation;
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        navigation = response;
      }
    });

    const response = await page
      .goto(String(url), { waitUntil: 'domcontentloaded', timeout: timeout * 1000 })
      .catch(error => {
        if (navigation && !navigation.ok()) {
          return navigation;
        }
        throw error;
      });

    if (response && !response.ok()) {
      throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
    }

    const contentType = response?.headers()['content-type'] || '';
    if (contentType && !isHTMLContentType(contentType)) {
      return { content: await response.text(), contentType, complete: true };
    }

    let complete = await waitForQuiet(deadline);
    if (complete && scroll) {
      complete = await scrollToEnd(page, waitForQuiet, deadline);
    }

    return { content: await page.content(), contentType: 'text/html', complete };
  } catch (error) {
    const reason = error.name === 'TimeoutError'
      ? `no response within ${timeout} seconds`
      : firstLine(error.message);
    throw new Error(`Failed to render ${url}: ${reason}`);
  } finally {
    await browser.close();
  }
}

module.exports = { renderUrl };
