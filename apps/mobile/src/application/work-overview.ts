import {
  inspectionPortion,
  type RoutineItem,
  type Task,
} from "@arihant/contracts";

type InspectionWork = Pick<
  Task,
  "id" | "assignedTo" | "status" | "helpOpen" | "dueAt"
> &
  Partial<Pick<Task, "collaborative" | "allocations" | "items">>;
export function personalInspectionWork<T extends InspectionWork>(
  tasks: readonly T[],
  person: string,
  serverNow: string,
) {
  const own = tasks
    .filter((t) =>
      t.collaborative
        ? t.allocations?.some((a) => a.assignedTo === person)
        : t.assignedTo === person,
    )
    .map((t) =>
      t.collaborative && t.items
        ? (inspectionPortion(t as unknown as Task, person) as unknown as T)
        : t,
    );
  const now = Date.parse(serverNow);
  const rank = (t: T) =>
    t.status === "recheck"
      ? 0
      : t.helpOpen
        ? 1
        : t.dueAt && Date.parse(t.dueAt) < now
          ? 2
          : t.status === "in_progress"
            ? 3
            : 4;
  const todo = own
    .filter((t) => t.status !== "completed" && t.status !== "submitted")
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
        a.id.localeCompare(b.id),
    );
  return {
    todo,
    review: own.filter((t) =>
      t.collaborative
        ? t.allocations?.some(
            (a) => a.assignedTo === person && a.state === "submitted",
          )
        : t.status === "submitted",
    ),
    finished: own.filter((t) => t.status === "completed"),
  };
}
export function routinePhase(
  item: Pick<
    RoutineItem,
    "dueToday" | "completedSteps" | "definition" | "started"
  >,
) {
  if (!item.dueToday) return "not_due" as const;
  if (item.completedSteps.length === item.definition.steps.length)
    return "finished" as const;
  return item.started ? ("in_progress" as const) : ("todo" as const);
}
export function nextRoutineStep(
  item: Pick<RoutineItem, "definition" | "completedSteps">,
) {
  return item.definition.steps.findIndex(
    (_, i) => !item.completedSteps.includes(i),
  );
}
