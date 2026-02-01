import { AggregatedEntry, MappedEntry } from "./types";

/**
 * Round minutes to nearest interval
 * Returns 0 for entries under minThreshold (to be filtered out)
 */
export function roundToInterval(
  minutes: number,
  interval: number,
  minThreshold: number = 5
): number {
  if (minutes < minThreshold) return 0;
  const rounded = Math.round(minutes / interval) * interval;
  return rounded === 0 ? interval : rounded;
}

/**
 * Smart rounding that preserves the total sum as closely as possible.
 * Uses the largest remainder method to distribute rounding errors.
 */
function smartRoundGroup(
  durations: number[],
  interval: number,
  minThreshold: number = 5
): number[] {
  // Filter out entries below threshold (they become 0)
  const validIndices = durations
    .map((d, i) => (d >= minThreshold ? i : -1))
    .filter((i) => i >= 0);

  if (validIndices.length === 0) {
    return durations.map(() => 0);
  }

  // Calculate actual total (ALL entries, including ones that will be dropped)
  // This ensures dropped time gets distributed to remaining entries
  const actualTotal = durations.reduce((sum, d) => sum + d, 0);

  // Round actual total to nearest interval
  const targetTotal = Math.round(actualTotal / interval) * interval;

  // Initial rounding for each entry
  const rounded = durations.map((d) => roundToInterval(d, interval, minThreshold));
  let roundedTotal = rounded.reduce((sum, d) => sum + d, 0);

  // Calculate remainder for each valid entry (how far from rounding threshold)
  const remainders = validIndices.map((i) => {
    const remainder = durations[i] % interval;
    const wasRoundedUp = remainder >= interval / 2;
    return {
      index: i,
      remainder,
      wasRoundedUp,
      distance: wasRoundedUp ? interval - remainder : remainder,
    };
  });

  // Sort by distance (closest to threshold first - these are the "close calls")
  remainders.sort((a, b) => a.distance - b.distance);

  // Adjust to match target total
  let diff = targetTotal - roundedTotal;

  for (const r of remainders) {
    if (diff === 0) break;

    if (diff > 0 && !r.wasRoundedUp) {
      // Need to add time, and this entry was rounded down
      rounded[r.index] += interval;
      diff -= interval;
    } else if (diff < 0 && r.wasRoundedUp) {
      // Need to subtract time, and this entry was rounded up
      if (rounded[r.index] > interval) {
        rounded[r.index] -= interval;
        diff += interval;
      }
    }
  }

  return rounded;
}

/**
 * Apply smart rounding per project to preserve each project's total
 */
export function smartRoundByProject(
  entries: MappedEntry[],
  interval: number,
  minThreshold: number = 5
): number[] {
  // Group entries by project
  const projectGroups = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const project = entries[i].projekt;
    if (!projectGroups.has(project)) {
      projectGroups.set(project, []);
    }
    projectGroups.get(project)!.push(i);
  }

  // Apply smart rounding to each project group
  const result = new Array<number>(entries.length);
  for (const [, indices] of projectGroups) {
    const durations = indices.map((i) => entries[i].duration);
    const rounded = smartRoundGroup(durations, interval, minThreshold);
    for (let j = 0; j < indices.length; j++) {
      result[indices[j]] = rounded[j];
    }
  }

  return result;
}

/**
 * Format minutes as hours:minutes string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Convert mapped entries to final entries (one per timewarrior line)
 * Uses smart rounding per project to preserve totals
 */
export function prepareEntries(
  entries: MappedEntry[],
  interval: number = 15
): AggregatedEntry[] {
  // Apply smart rounding per project
  const roundedDurations = smartRoundByProject(entries, interval);

  return entries
    .map((entry, i) => {
      const commentParts: string[] = [];
      if (entry.annotation) {
        commentParts.push(entry.annotation);
      }
      if (entry.unusedTags.length > 0) {
        commentParts.push(entry.unusedTags.join(", "));
      }

      return {
        date: entry.date,
        projekt: entry.projekt,
        projektTag: entry.projektTag,
        phase: entry.phase,
        phaseTag: entry.phaseTag,
        aktivität: entry.aktivität,
        aktivitätTag: entry.aktivitätTag,
        duration: roundedDurations[i],
        comments: commentParts.join("; "),
      };
    })
    .filter((entry) => entry.duration > 0);
}

/**
 * Print a summary of aggregated entries
 */
export function printSummary(entries: AggregatedEntry[]): void {
  console.log("\n=== Time Entry Summary ===\n");

  let currentDate = "";
  let dailyTotal = 0;
  let grandTotal = 0;

  for (const entry of entries) {
    if (entry.date !== currentDate) {
      if (currentDate) {
        console.log(`  Daily Total: ${formatDuration(dailyTotal)}\n`);
      }
      currentDate = entry.date;
      dailyTotal = 0;
      console.log(`Date: ${entry.date}`);
    }

    dailyTotal += entry.duration;
    grandTotal += entry.duration;

    const projektDisplay = `${entry.projekt} (${entry.projektTag})`;
    const phaseDisplay = entry.phaseTag ? `${entry.phase} (${entry.phaseTag})` : entry.phase;
    const aktivitätDisplay = entry.aktivitätTag ? `${entry.aktivität} (${entry.aktivitätTag})` : entry.aktivität;

    const parts = [
      formatDuration(entry.duration),
      projektDisplay,
      phaseDisplay,
      aktivitätDisplay,
      entry.comments || "",
    ].filter(Boolean);
    console.log(`  ${parts.join(" | ")}`);
  }

  if (currentDate) {
    console.log(`  Daily Total: ${formatDuration(dailyTotal)}`);
  }

  console.log(`\n=== Grand Total: ${formatDuration(grandTotal)} ===\n`);
}
