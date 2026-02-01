import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { Config, MappedEntry, ProjectConfig, TagMapping, TimewarriorEntry } from "./types";

/**
 * Load and parse configuration file
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const content = await readFile(configPath, "utf-8");
  const config = parseYaml(content) as Config;

  // Validate required fields
  if (!config.url) {
    throw new Error("Config missing required field: url");
  }
  if (!config.project) {
    throw new Error("Config missing required field: project");
  }

  // Set defaults
  config.roundingInterval = config.roundingInterval ?? 15;

  return config;
}

/**
 * Find a matching project config for a set of tags
 * Returns the project config and the tag that matched
 * Throws if multiple projects match or no project is found
 */
function findProject(tags: string[], projectMap: Config["project"]): { config: ProjectConfig; usedTag: string } {
  const matchingProjects: { tag: string; config: ProjectConfig }[] = [];

  for (const tag of tags) {
    if (projectMap[tag]) {
      matchingProjects.push({ tag, config: projectMap[tag] });
    }
  }

  if (matchingProjects.length > 1) {
    const projectNames = matchingProjects.map((p) => `${p.tag} (${p.config.name})`).join(", ");
    throw new Error(`Entry has multiple project tags: ${projectNames}. Tags: ${tags.join(", ")}`);
  }

  if (matchingProjects.length === 0) {
    throw new Error(`Entry has no project tag. Use +internal for internal work. Tags: ${tags.join(", ")}`);
  }

  return { config: matchingProjects[0].config, usedTag: matchingProjects[0].tag };
}

/**
 * Find the first matching value in a tag mapping
 */
function findMapping(tags: string[], mapping: TagMapping): { value: string; usedTag: string | null } {
  for (const tag of tags) {
    if (mapping[tag]) {
      return { value: mapping[tag], usedTag: tag };
    }
  }
  // Return default if no tag matches
  return { value: mapping.default || "", usedTag: null };
}

/**
 * Map a single timewarrior entry to Achievo fields
 */
export function mapEntry(entry: TimewarriorEntry, config: Config): MappedEntry {
  // Find matching project (throws if none or multiple found)
  const projectResult = findProject(entry.tags, config.project);
  const projectConfig = projectResult.config;

  // Find phase and activity within project context
  const phaseResult = findMapping(entry.tags, projectConfig.phase);
  const activityResult = findMapping(entry.tags, projectConfig.activity);

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
    phase: phaseResult.value,
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
 */
export function mapEntries(entries: TimewarriorEntry[], config: Config): MappedEntry[] {
  return entries.map((entry) => mapEntry(entry, config));
}
