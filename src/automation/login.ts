import { Browser, BrowserContext, Page, chromium } from "playwright";

export interface AchievoSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launch browser and navigate to Achievo login page
 * User must manually log in; the function waits for successful login
 */
export async function login(url: string, headless: boolean): Promise<AchievoSession> {
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 50, // Slow down when visible for debugging
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to Achievo
  await page.goto(url);

  // Check if already logged in by looking for a known element
  // Otherwise wait for manual login
  const isLoggedIn = await checkIfLoggedIn(page);

  if (!isLoggedIn) {
    console.log("\n🔐 Please log in to Achievo in the browser window...");
    console.log("   Waiting for login to complete...\n");

    // Wait for navigation after login
    // Achievo 1.4.6 uses iframes, so look for iframe with dispatch.php
    await page.waitForSelector('iframe[src*="dispatch.php"], a[href*="dispatch.php"], frame[src*="dispatch.php"]', {
      timeout: 300000, // 5 minute timeout for manual login
    });

    console.log("✓ Login successful!\n");
  }

  return { browser, context, page };
}

/**
 * Check if user is already logged in
 */
async function checkIfLoggedIn(page: Page): Promise<boolean> {
  try {
    // Look for elements that only appear when logged in
    // Achievo 1.4.6 uses iframes for content
    await page.waitForSelector('iframe[src*="dispatch.php"], a[href*="dispatch.php"], frame[src*="dispatch.php"]', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the browser session
 */
export async function closeSession(session: AchievoSession): Promise<void> {
  await session.browser.close();
}
