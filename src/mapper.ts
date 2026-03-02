import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { Config, MappedEntry, PhaseConfig, ProjectConfig, TimewarriorEntry } from "./types";
import { ConfigSchema } from "./schema";

/**
 * Load and parse configuration file with Zod validation
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const content = await readFile(configPath, "utf-8");
  const rawConfig = parseYaml(content);

  // Validate with Zod schema
  const result = ConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (err: any) => `  - ${err.path.join(".")}: ${err.message}`
    ).join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Find a matching project config for a set of tags
 * Returns the project config and the tag that matched
 * Returns null if no project is found
 * Throws if multiple projects match
 */
function findProject(entry: TimewarriorEntry, projectMap: Config["project"]): { config: ProjectConfig; usedTag: string } | null {
  const matchingProjects: { tag: string; config: ProjectConfig }[] = [];

  for (const tag of entry.tags) {
    if (projectMap[tag]) {
      matchingProjects.push({ tag, config: projectMap[tag] });
    }
  }

  if (matchingProjects.length > 1) {
    const projectNames = matchingProjects.map((p) => `${p.tag} (${p.config.name})`).join(", ");
    const annotationText = entry.annotation ? ` - "${entry.annotation}"` : '';
    throw new Error(`Entry ${entry.id} on ${entry.date}${annotationText} has multiple project tags: ${projectNames}. Tags: ${entry.tags.join(", ")}`);
  }

  if (matchingProjects.length === 0) {
    return null;
  }

  return { config: matchingProjects[0].config, usedTag: matchingProjects[0].tag };
}

/**
 * Find the matching phase for a set of tags
 * Returns the phase config and the tag that matched it
 */
function findPhase(tags: string[], phases: PhaseConfig[]): { phase: PhaseConfig; usedTag: string | null } {
  // First, try to find a phase by tag match
  for (const phase of phases) {
    for (const tag of tags) {
      if (phase.tags.includes(tag)) {
        return { phase, usedTag: tag };
      }
    }
  }
  
  // If no match, return the default phase (the one with empty tags array)
  const defaultPhase = phases.find((p) => p.tags.length === 0);
  if (!defaultPhase) {
    throw new Error("No default phase found (this should be caught by Zod validation)");
  }
  
  return { phase: defaultPhase, usedTag: null };
}

/**
 * Find the matching activity within a phase
 */
function findActivity(tags: string[], activities: Record<string, string>): { value: string; usedTag: string | null } {
  for (const tag of tags) {
    if (activities[tag]) {
      return { value: activities[tag], usedTag: tag };
    }
  }
  // Return default activity
  return { value: activities.default || "", usedTag: null };
}

/**
 * Map a single timewarrior entry to Achievo fields
 * Returns null if entry has no project tag
 */
export function mapEntry(entry: TimewarriorEntry, config: Config): MappedEntry | null {
  // Find matching project (returns null if none found, throws if multiple found)
  const projectResult = findProject(entry, config.project);
  if (!projectResult) {
    return null;
  }
  const projectConfig = projectResult.config;

  // Find phase first (phase determines available activities)
  const phaseResult = findPhase(entry.tags, projectConfig.phases);
  
  // Find activity within the selected phase's context
  const activityResult = findActivity(entry.tags, phaseResult.phase.activities);

  // Collect tags that were used for mapping
  const usedTags = new Set<string>();
  if (projectResult.usedTag) usedTags.add(projectResult.usedTag);
  if (phaseResult.usedTag) usedTags.add(phaseResult.usedTag);
  if (activityResult.usedTag) usedTags.add(activityResult.usedTag);

  // Find unused tags (excluding @-prefixed organization tags)
  const unusedTags = entry.tags.filter(
    (tag) => !usedTags.has(tag) && !tag.startsWith("@")
  );

  return {
    date: entry.date,
    projekt: projectConfig.name,
    projektTag: projectResult.usedTag,
    phase: phaseResult.phase.name,
    phaseTag: phaseResult.usedTag,
    aktivität: activityResult.value,
    aktivitätTag: activityResult.usedTag,
    duration: entry.duration,
    annotation: entry.annotation,
    originalTags: entry.tags,
    unusedTags,
  };
}

/**
 * Map all timewarrior entries to Achievo fields
 * Filters out entries without project tags
 * Returns both mapped entries and skipped entries for display
 */
export function mapEntries(entries: TimewarriorEntry[], config: Config): { mapped: MappedEntry[]; skipped: TimewarriorEntry[] } {
  const mapped: MappedEntry[] = [];
  const skipped: TimewarriorEntry[] = [];

  for (const entry of entries) {
    const result = mapEntry(entry, config);
    if (result) {
      mapped.push(result);
    } else {
      skipped.push(entry);
    }
  }

  return { mapped, skipped };
}
