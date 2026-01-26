#!/usr/bin/env node

import { program } from "commander";
import { parseTimewarrior, readInput } from "./parser";
import { loadConfig, mapEntries } from "./mapper";
import { prepareEntries, printSummary } from "./aggregator";
import { closeSession, login } from "./automation/login";
import { enterAllTimeEntries } from "./automation/timeEntry";
import { CliOptions } from "./types";

async function main() {
  program
    .name("auto-achievo")
    .description("Sync timewarrior entries to Achievo")
    .version("1.0.0")
    .option("-f, --file <path>", "Read timewarrior data from file instead of stdin")
    .option("-c, --config <path>", "Path to config file", "config.yaml")
    .option("-d, --dry-run", "Show what would be entered without making changes", false)
    .option("-v, --visible", "Show browser window (non-headless mode)", false)
    .parse(process.argv);

  const options = program.opts<CliOptions>();

  try {
    // Load configuration
    console.log(`Loading config from ${options.config}...`);
    const config = await loadConfig(options.config);

    // Read input
    console.log("Reading timewarrior data...");
    const input = await readInput(options.file);

    // Parse timewarrior output
    const entries = parseTimewarrior(input);
    console.log(`Parsed ${entries.length} time entries`);

    if (entries.length === 0) {
      console.log("No entries found in input.");
      process.exit(0);
    }

    // Map to Achievo fields
    const mappedEntries = mapEntries(entries, config);

    // Check for unmapped entries
    const unmapped = mappedEntries.filter(
      (e) => !e.projekt || !e.phase || !e.aktivität
    );
    if (unmapped.length > 0) {
      console.warn("\n⚠ Warning: Some entries could not be fully mapped:");
      for (const entry of unmapped) {
        console.warn(`  ${entry.date} - Tags: ${entry.originalTags.join(", ")}`);
        if (!entry.projekt) console.warn("    Missing: projekt");
        if (!entry.phase) console.warn("    Missing: phase");
        if (!entry.aktivität) console.warn("    Missing: aktivität");
      }
      console.warn("");
    }

    // Prepare entries (round to 15 min, build comments)
    const prepared = prepareEntries(mappedEntries);

    // Print summary
    printSummary(prepared);

    // If dry run, stop here
    if (options.dryRun) {
      console.log("Dry run complete. No entries were submitted.");
      process.exit(0);
    }

    // Confirm before proceeding
    if (process.stdin.isTTY) {
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question("Proceed with entering these time entries? (y/N) ", resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== "y") {
        console.log("Aborted.");
        process.exit(0);
      }
    }

    // Start browser automation
    const session = await login(config.url, !options.visible);

    try {
      // Enter all time entries
      const result = await enterAllTimeEntries(
        session.page,
        config.url,
        prepared
      );

      if (result.failed > 0) {
        console.log(
          `\n⚠ ${result.failed} entries failed. Please check manually.`
        );
        process.exit(1);
      }
    } finally {
      await closeSession(session);
    }

    console.log("✓ All done!");
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
