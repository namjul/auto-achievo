import { Frame, Page } from "playwright";
import { AggregatedEntry } from "../types";
import { formatDuration } from "../aggregator";

/**
 * Get the main content frame (Achievo 1.4.6 uses iframes)
 */
async function getContentFrame(page: Page): Promise<Frame> {
  const frameElement = await page.$('iframe[src*="dispatch.php"], frame[src*="dispatch.php"]');

  if (frameElement) {
    const frame = await frameElement.contentFrame();
    if (frame) {
      return frame;
    }
  }

  return page.mainFrame();
}

/**
 * Navigate to the hours add page for a specific date
 */
async function navigateToHoursPage(page: Page, baseUrl: string, date: string): Promise<Frame> {
  const hoursUrl = `${baseUrl}/dispatch.php?atknodetype=timereg.hours&atkaction=add&activitydate=${date}`;
  await page.goto(hoursUrl);
  await page.waitForLoadState("networkidle");
  return getContentFrame(page);
}

/**
 * Normalize text by replacing non-breaking spaces with regular spaces
 */
function normalizeText(text: string): string {
  return text.replace(/\u00A0/g, " ").trim();
}

/**
 * Select an option from a dropdown by visible text
 * Handles Achievo's &nbsp; in option labels
 */
async function selectByText(frame: Frame, selector: string, text: string): Promise<boolean> {
  const select = frame.locator(selector);

  if ((await select.count()) === 0) {
    console.warn(`  ⚠ Dropdown not found: ${selector}`);
    return false;
  }

  const options = await select.locator("option").all();
  const searchText = normalizeText(text).toLowerCase();
  const optionTexts: string[] = [];

  for (const option of options) {
    const rawText = await option.textContent();
    if (rawText) {
      const normalized = normalizeText(rawText);
      optionTexts.push(normalized);
      if (normalized.toLowerCase().includes(searchText)) {
        const value = await option.getAttribute("value");
        if (value) {
          await select.selectOption(value);
          return true;
        }
      }
    }
  }

  console.warn(`  ⚠ Could not find option containing "${text}"`);
  console.warn(`    Available: ${optionTexts.join(", ")}`);
  return false;
}

/**
 * Select a dropdown and wait for page reload (cascading dropdowns)
 * Achievo reloads the page when project/phase changes
 */
async function selectAndWaitForReload(
  page: Page,
  frame: Frame,
  selector: string,
  text: string
): Promise<Frame> {
  const selected = await selectByText(frame, selector, text);

  if (selected) {
    // Trigger the onchange handler by dispatching a change event
    await frame.locator(selector).dispatchEvent("change");

    // Wait for page reload from the onchange handler
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      // Timeout is ok - page may not reload for every selection
    }

    // Re-get frame after potential reload
    return getContentFrame(page);
  }

  return frame;
}

/**
 * Set the date using Achievo's day/month/year dropdowns
 */
async function setDate(frame: Frame, date: string): Promise<void> {
  const [year, month, day] = date.split("-");
  const dayNum = parseInt(day, 10).toString();
  const monthNum = parseInt(month, 10).toString();

  await frame.locator('select#activitydate\\[day\\]').selectOption(dayNum);
  await frame.locator('select#activitydate\\[month\\]').selectOption(monthNum);
  const yearInput = frame.locator('input#activitydate\\[year\\]');
  await yearInput.fill(year);
}

/**
 * Set the time using Achievo's hours/minutes select dropdowns
 */
async function setTime(frame: Frame, durationMinutes: number): Promise<void> {
  const hours = Math.floor(durationMinutes / 60).toString();
  const minutes = (durationMinutes % 60).toString();

  await frame.locator('select#time_hours').selectOption(hours);
  await frame.locator('select#time_minutes').selectOption(minutes);
}

/**
 * Fill in the time entry form
 */
async function fillTimeEntryForm(page: Page, frame: Frame, entry: AggregatedEntry): Promise<Frame> {
  // Set date
  await setDate(frame, entry.date);

  // Select project (triggers phase reload via onchange)
  frame = await selectAndWaitForReload(page, frame, 'select#projectid', entry.projekt);

  // Select phase (triggers activity reload via onchange)
  frame = await selectAndWaitForReload(page, frame, 'select#phaseid', entry.phase);

  // Select activity (no reload)
  await selectByText(frame, 'select#activityid', entry.aktivität);

  // Set time
  await setTime(frame, entry.duration);

  // Fill remark
  if (entry.comments) {
    await frame.locator('textarea#remark').fill(entry.comments);
  }

  return frame;
}

/**
 * Submit the time entry form
 */
async function submitForm(page: Page, frame: Frame): Promise<void> {
  const submitButton = frame.locator('input[name="atksaveandclose"]');
  await submitButton.click({ force: true });
  await page.waitForLoadState("networkidle");
}

/**
 * Enter a single time entry into Achievo
 */
export async function enterTimeEntry(page: Page, baseUrl: string, entry: AggregatedEntry): Promise<boolean> {
  try {
    const parts = [entry.date, formatDuration(entry.duration), entry.projekt, entry.phase, entry.aktivität, entry.comments || ""].filter(Boolean);
    console.log(`  Entering: ${parts.join(" | ")}`);

    let frame = await navigateToHoursPage(page, baseUrl, entry.date);
    frame = await fillTimeEntryForm(page, frame, entry);
    await submitForm(page, frame);

    console.log(`  ✓ Saved`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Enter all time entries into Achievo
 */
export async function enterAllTimeEntries(
  page: Page,
  baseUrl: string,
  entries: AggregatedEntry[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  console.log(`\nEntering ${entries.length} time entries...\n`);

  for (const entry of entries) {
    const result = await enterTimeEntry(page, baseUrl, entry);
    if (result) {
      success++;
    } else {
      failed++;
    }

    await page.waitForTimeout(1000);
  }

  console.log(`\nDone: ${success} saved, ${failed} failed\n`);

  return { success, failed };
}
