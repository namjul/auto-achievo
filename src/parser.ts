import { TimewarriorEntry } from "./types";

/**
 * Parse duration string (H:MM:SS) to minutes
 */
function parseDuration(duration: string): number {
  const parts = duration.split(":");
  if (parts.length !== 3) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);

  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Parse tags string like "+773, +emt, @wienfluss" into array
 */
function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Parse timewarrior summary output into structured entries
 *
 * Expected format:
 * Wk Date       Day ID  Tags                                   Annotation       Start      End    Time    Total
 * W3 2026-01-12 Mon @56 +emt, @wienfluss                                     12:55:14 13:10:10 0:14:56
 *                   @55 +773, +emt, @wienfluss                               13:10:10 13:21:41 0:11:31
 *                   @50 +308, +emt, @wienfluss                               19:13:59 20:53:07 1:39:08  5:35:56
 */
export function parseTimewarrior(input: string): TimewarriorEntry[] {
  const lines = input.split("\n");
  const entries: TimewarriorEntry[] = [];

  let currentDate = "";
  let headerParsed = false;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Skip header line
    if (line.includes("Wk Date") && line.includes("Tags")) {
      headerParsed = true;
      continue;
    }

    // Skip lines before header
    if (!headerParsed) continue;

    // Skip separator lines (-- ----------)
    if (line.trim().startsWith("--")) continue;

    // Skip total/summary lines at the end
    if (line.trim().match(/^\d+:\d{2}:\d{2}$/)) continue;

    // Check if this line starts with a date (Wk Date Day pattern)
    const dateMatch = line.match(/^W\d+\s+(\d{4}-\d{2}-\d{2})\s+\w{3}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
    }

    // Find the @ID in the line
    const idMatch = line.match(/@(\d+)/);
    if (!idMatch || !currentDate) continue;

    const id = idMatch[1];

    // Find all time patterns (H:MM:SS or HH:MM:SS) in the line
    const timePattern = /\d{1,2}:\d{2}:\d{2}/g;
    const times: string[] = [];
    let match;
    while ((match = timePattern.exec(line)) !== null) {
      times.push(match[0]);
    }

    // Need at least 3 times: Start, End, Time
    // May have 4 if there's a Total column
    if (times.length < 3) continue;

    // Times from the end: [..., Start, End, Time] or [..., Start, End, Time, Total]
    // The Time (duration) is the 2nd-to-last if Total exists, or last if no Total
    // We can detect Total because it's typically larger than Time for a single entry
    let start: string, end: string, time: string;

    if (times.length >= 4) {
      // Check if last time looks like a daily total (usually > individual time)
      const lastTime = parseDuration(times[times.length - 1]);
      const secondLastTime = parseDuration(times[times.length - 2]);

      if (lastTime > secondLastTime) {
        // Last is Total, second-to-last is Time
        start = times[times.length - 4];
        end = times[times.length - 3];
        time = times[times.length - 2];
      } else {
        // No total, take last 3
        start = times[times.length - 3];
        end = times[times.length - 2];
        time = times[times.length - 1];
      }
    } else {
      // Exactly 3 times
      start = times[times.length - 3];
      end = times[times.length - 2];
      time = times[times.length - 1];
    }

    // Extract tags and annotation from the text between @ID and first time
    const idEndPos = line.indexOf(`@${id}`) + id.length + 1;
    const firstTimePos = line.indexOf(start);
    const middleText = line.substring(idEndPos, firstTimePos).trim();

    // Split middle text into tags and annotation
    // Tags are comma-separated items starting with + or @
    // Annotation is everything after the last tag
    const parts = middleText.split(/\s{2,}/); // Split on 2+ spaces
    let tagsStr = parts[0] || "";
    let annotation = parts.slice(1).join(" ").trim();

    entries.push({
      date: currentDate,
      id: `@${id}`,
      tags: parseTags(tagsStr),
      annotation,
      start,
      end,
      duration: parseDuration(time),
    });
  }

  return entries;
}

/**
 * Read input from stdin or file
 */
export async function readInput(filePath?: string): Promise<string> {
  if (filePath) {
    const fs = await import("fs/promises");
    return fs.readFile(filePath, "utf-8");
  }

  // Read from stdin
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });

    // Handle case where stdin is TTY (no piped input)
    if (process.stdin.isTTY) {
      console.error("Error: No input provided. Pipe timewarrior output or use --file option.");
      process.exit(1);
    }
  });
}
