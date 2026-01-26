import { AggregatedEntry, MappedEntry } from "./types";

/**
 * Round minutes to nearest 15-minute increment
 */
export function roundToQuarterHour(minutes: number): number {
  return Math.round(minutes / 15) * 15;
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
 * Rounds duration to 15 minutes and builds comments from annotation + unused tags
 */
export function prepareEntries(entries: MappedEntry[]): AggregatedEntry[] {
  return entries
    .map((entry) => {
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
        phase: entry.phase,
        aktivität: entry.aktivität,
        duration: roundToQuarterHour(entry.duration),
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

    const parts = [
      formatDuration(entry.duration),
      entry.projekt,
      entry.phase,
      entry.aktivität,
      entry.comments || "",
    ].filter(Boolean);
    console.log(`  ${parts.join(" | ")}`);
  }

  if (currentDate) {
    console.log(`  Daily Total: ${formatDuration(dailyTotal)}`);
  }

  console.log(`\n=== Grand Total: ${formatDuration(grandTotal)} ===\n`);
}
