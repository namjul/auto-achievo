/**
 * Raw parsed entry from timewarrior export
 */
export interface TimewarriorEntry {
  date: string; // YYYY-MM-DD format
  id: string;
  tags: string[];
  annotation: string;
  start: string;
  end: string;
  duration: number; // in minutes
}

/**
 * Entry mapped to Achievo fields
 */
export interface MappedEntry {
  date: string;
  projekt: string;
  projektTag: string; // Tag that mapped to projekt
  phase: string;
  phaseTag: string | null; // Tag that mapped to phase (null if default)
  aktivität: string;
  aktivitätTag: string | null; // Tag that mapped to aktivität (null if default)
  duration: number; // in minutes
  annotation: string;
  originalTags: string[];
  unusedTags: string[]; // Tags not used for mapping
}

/**
 * Aggregated entry ready for Achievo submission
 */
export interface AggregatedEntry {
  date: string;
  projekt: string;
  projektTag: string;
  phase: string;
  phaseTag: string | null;
  aktivität: string;
  aktivitätTag: string | null;
  duration: number; // in minutes, rounded to 15-min increments
  comments: string; // Combined annotations and unused tags
}

/**
 * Configuration types (imported from schema.ts for validation)
 */
export type { TagMapping, PhaseConfig, ProjectConfig, Config } from "./schema";

/**
 * CLI options
 */
export interface CliOptions {
  file?: string;
  dryRun: boolean;
  headless: boolean;
  config: string;
}
