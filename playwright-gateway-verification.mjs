import { chromium } from 'playwright';
import net from 'node:net';

const APP_URL = 'http://localhost:3000/map';
const EMAIL = 'you@example.com';
const PASSWORD = 'DevTest123!';
const TEST_GATEWAY_NAME = `PW-${Date.now()}`;
const TEST_SEGMENT = 'SEG-PW';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function portIsOpen(port) {
  for (const host of ['127.0.0.1', '::1']) {
    const result = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (result) return true;
  }
  return false;
}

const consoleMessages = [];
const consoleErrors = [];

async function main() {
  console.log('=== Port check ===');
  const frontendOpen = await portIsOpen(3000);
  const backendOpen = await portIsOpen(8080);
  console.log(`3000 open: ${frontendOpen}`);
  console.log(`8080 open: ${backendOpen}`);
  if (!frontendOpen || !backendOpen) {
    throw new Error('Required dev servers are not listening on 3000/8080.');
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  page.on('console', (msg) => {
    const text = `[BROWSER_CONSOLE][${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    console.log(text);
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    const text = `[PAGEERROR] ${err.message}`;
    consoleMessages.push(text);
    console.log(text);
    consoleErrors.push(text);
  });
  page.on('requestfailed', (req) => {
    const text = `[REQUEST_FAILED] ${req.url()} :: ${req.failure()?.errorText || 'unknown error'}`;
    consoleMessages.push(text);
    console.log(text);
  });

  const apiRequests = [];
  const apiResponses = [];
  page.on('request', (req) => {
    try {
      if (req.url().includes('/api/v1/gateways')) {
        const body = req.postData();
        apiRequests.push({ url: req.url(), method: req.method(), body });
        console.log(`[NETWORK][REQUEST] ${req.method()} ${req.url()} ${body ? 'BODY=' + body : ''}`);
      }
    } catch (e) {
      console.log('[NETWORK][REQUEST][ERROR]', e && e.message ? e.message : String(e));
    }
  });
  page.on('response', (res) => {
    try {
      if (res.url().includes('/api/v1/gateways')) {
        const p = (async () => {
          let text = '';
          try { text = await res.text(); } catch (e) { text = `<unable to read response body: ${e && e.message ? e.message : String(e)}>`; }
          apiResponses.push({ url: res.url(), status: res.status(), body: text });
          console.log(`[NETWORK][RESPONSE] ${res.status()} ${res.url()} ${text ? 'BODY=' + text : ''}`);
        })();
        // fire-and-forget; we'll await later if needed
      }
    } catch (e) {
      console.log('[NETWORK][RESPONSE][ERROR]', e && e.message ? e.message : String(e));
    }
  });

  try {
    console.log('=== a. Sign in ===');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[autocomplete="email"]', { timeout: 20000 });
    await page.locator('input[autocomplete="email"]').fill(EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await page.waitForURL('**/map', { timeout: 20000 });
    console.log(`PASS - signed in, landed on ${page.url()}`);

    console.log('=== b. Click Edge Gateway Status button ===');
    await page.locator('button[title*="edge gateways online"]').click();
    await page.waitForSelector('h2:has-text("Edge Gateways")', { timeout: 15000 });
    console.log('PASS - Gateways modal opened');
    // Ensure the Registered Gateways section is expanded (click the header if present)
    try {
      const regHeader = page.getByText('Registered Gateways');
      if (await regHeader.count() > 0) {
        await regHeader.first().click().catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    console.log('=== c. Open create modal and fill form ===');
    await page.getByRole('button', { name: /\+ Register New Gateway/i }).click();
    await page.waitForSelector('text=Register New Gateway', { timeout: 15000 });
    await page.locator('input[placeholder="EG-01"]').fill(TEST_GATEWAY_NAME);
    await page.locator('select').nth(0).selectOption('MQTT');
    await page.locator('select').nth(1).selectOption('real');
    await page.locator('input[placeholder="SEG-021"]').fill(TEST_SEGMENT);
    await page.locator('select').nth(2).selectOption('online');
    console.log('PASS - create form filled');

    console.log('=== d. Save and assert no error toast ===');
    await page.getByRole('button', { name: /^Save$/i }).click();
    await sleep(1200);
    const errorToastVisible = await page.getByText('Save failed').isVisible().catch(() => false);
    if (errorToastVisible) {
      throw new Error('FAIL - error toast displayed after save');
    }
    console.log('PASS - no error toast appeared');

    console.log('=== e. Assert new gateway appears within 8 seconds (shared refresh proof) ===');
    // Try a text-based selector for the created gateway (more robust than assuming a button)
    const selectorText = `text=${TEST_GATEWAY_NAME}`;
    let appeared = false;
    try {
      await page.waitForSelector(selectorText, { timeout: 8000 });
      appeared = true;
    } catch (e) {
      appeared = false;
    }
    if (!appeared) {
      // dump any captured network activity for diagnostics
      console.log('--- DIAGNOSTIC: API requests captured ---');
      for (const r of apiRequests) console.log(JSON.stringify(r));
      console.log('--- DIAGNOSTIC: API responses captured ---');
      for (const r of apiResponses) console.log(JSON.stringify(r));
      // dump locator count and full page HTML for inspection
      try {
        const count = await page.locator(`text=${TEST_GATEWAY_NAME}`).count().catch(() => 0);
        console.log('--- DIAGNOSTIC: locator count ---', count);
      } catch (e) {
        console.log('--- DIAGNOSTIC: failed to count locator ---', e && e.message ? e.message : String(e));
      }
      try {
        console.log('--- DIAGNOSTIC: Full page HTML (truncated to 20000 chars) ---');
        const html = await page.content();
        console.log(html.slice(0, 20000));
      } catch (e) {
        console.log('--- DIAGNOSTIC: failed to read page content ---', e && e.message ? e.message : String(e));
      }
      try {
        const buttons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button[title="Click to edit this gateway"]')).map(b => b.innerText.trim());
        }).catch(() => []);
        console.log('--- DIAGNOSTIC: gateway edit buttons text ---');
        console.log(JSON.stringify(buttons));
      } catch (e) {
        console.log('--- DIAGNOSTIC: failed to read gateway buttons ---', e && e.message ? e.message : String(e));
      }
      throw new Error(`FAIL - gateway '${TEST_GATEWAY_NAME}' did not appear within 8s`);
    }
    console.log('PASS - gateway text appeared in DOM');

    console.log('=== f. Click row and confirm edit modal pre-fills ===');
    await row.click();
    await page.waitForSelector(`text=Edit Gateway: ${TEST_GATEWAY_NAME}`, { timeout: 15000 });
    const editName = await page.locator('input[placeholder="EG-01"]').inputValue();
    const editSegment = await page.locator('input[placeholder="SEG-021"]').inputValue();
    if (editName !== TEST_GATEWAY_NAME) {
      throw new Error(`FAIL - edit modal name mismatch: expected '${TEST_GATEWAY_NAME}', got '${editName}'`);
    }
    if (editSegment !== TEST_SEGMENT) {
      throw new Error(`FAIL - edit modal segment mismatch: expected '${TEST_SEGMENT}', got '${editSegment}'`);
    }
    console.log(`PASS - edit modal prefilled with name='${editName}' and segment='${editSegment}'`);

    console.log('=== g. Console scan ===');
    if (consoleErrors.length > 0) {
      throw new Error(`FAIL - browser console errors detected: ${consoleErrors.join(' | ')}`);
    }
    console.log('PASS - no browser console error messages were emitted');
    console.log('=== Final console messages ===');
    for (const line of consoleMessages) console.log(line);
    console.log('=== PLAYWRIGHT_VERIFICATION_PASS ===');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('PLAYWRIGHT_VERIFICATION_FAIL');
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
