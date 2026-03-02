import { z } from "zod";

/**
 * Tag to value mapping (e.g., "+timetracking": "Zeiterfassung")
 */
const TagMappingSchema = z.record(z.string(), z.string());

/**
 * Phase configuration with contextual activities
 */
const PhaseConfigSchema = z.object({
  name: z.string().min(1, "Phase name cannot be empty"),
  tags: z.array(z.string()).default([]),
  activities: TagMappingSchema.refine(
    (activities) => "default" in activities,
    { message: "Each phase must have a 'default' activity" }
  ),
});

/**
 * Project configuration with phases array
 */
const ProjectConfigSchema = z.object({
  name: z.string().min(1, "Project name cannot be empty"),
  phases: z
    .array(PhaseConfigSchema)
    .min(1, "Project must have at least one phase")
    .refine(
      (phases) => {
        const defaultPhases = phases.filter((p) => p.tags.length === 0);
        return defaultPhases.length === 1;
      },
      {
        message:
          "Project must have exactly one default phase (with empty tags array)",
      }
    ),
});

/**
 * Full configuration schema
 */
export const ConfigSchema = z.object({
  url: z.string().url("URL must be a valid URL"),
  roundingInterval: z.number().int().positive().default(15),
  project: z.record(z.string(), ProjectConfigSchema).refine(
    (projects) => Object.keys(projects).length > 0,
    { message: "At least one project must be defined" }
  ),
});

/**
 * Inferred TypeScript types from Zod schemas
 */
export type TagMapping = z.infer<typeof TagMappingSchema>;
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
