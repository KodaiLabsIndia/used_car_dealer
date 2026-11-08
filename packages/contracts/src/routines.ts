import { z } from "zod";
import type { components } from "./generated";
const definitionSchema = z.object({
  title: z.string(),
  assignedTo: z.string().uuid(),
  weekdays: z.array(z.number().int()),
  steps: z.array(z.string()),
  active: z.boolean(),
});
export const routineItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  templateVersion: z.number().int(),
  currentDefinition: definitionSchema,
  definition: definitionSchema,
  assigneeName: z.string(),
  workDate: z.string(),
  runVersion: z.number().int(),
  completedSteps: z.array(z.number().int()),
  events: z.array(
    z.object({
      version: z.number().int(),
      step: z.number().int(),
      done: z.boolean(),
      note: z.string(),
      byName: z.string(),
      createdAt: z.string(),
    }),
  ),
  started: z.boolean(),
  dueToday: z.boolean(),
});
export const routineBoardSchema = z.object({
  today: z.string(),
  items: z.array(routineItemSchema),
});
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type RoutineBoard = z.infer<typeof routineBoardSchema>;
export type SaveRoutine = components["schemas"]["SaveRoutine"];
export type RoutineStepCommand = Omit<
  components["schemas"]["RoutineStepCommand"],
  "note"
> & { note?: string };
