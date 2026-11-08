import type { ChecklistItem, Task } from "./index";

export function checkState(task: Task, item: ChecklistItem) {
  const answer = task.answers.find((a) => a.itemId === item.id);
  if (task.recheckItems.includes(item.id)) return "recheck";
  if (!answer) return "pending";
  if (answer.result === "unable") return "blocked";
  if (answer.result === "problem") return "issue";
  if (answer.result === "not_applicable") return "exception";
  return "done";
}

export function inspectionProgress(task: Task) {
  const required = task.items.filter((i) => i.required);
  const missing = required.filter((i) => {
    const a = task.answers.find((v) => v.itemId === i.id);
    return (
      !a ||
      a.result === "unable" ||
      task.recheckItems.includes(i.id) ||
      !task.evidence.some((e) => e.id === a.evidenceId && e.itemId === i.id) ||
      (["ok", "problem"].includes(a.result) &&
        ((i.measurementUnit !== null && a.reading === null) ||
          (i.configurationPending && !a.applicabilityConfirmed))) ||
      (i.requiresClip &&
        a.result !== "not_applicable" &&
        !task.clipItemIds.includes(i.id))
    );
  });
  return {
    total: required.length,
    completed: required.length - missing.length,
    missing,
    issues: task.answers.filter((a) => a.result === "problem").length,
    blocked: task.answers.filter((a) => a.result === "unable").length,
    exceptions: task.answers.filter((a) => a.result === "not_applicable")
      .length,
  };
}

/** A view only: the server retains one master inspection and all source authors. */
export function inspectionPortion(task: Task, person: string): Task {
  if (!task.collaborative) return task;
  const own = task.allocations.filter((a) => a.assignedTo === person);
  const ids = new Set(own.map((a) => a.itemId));
  const states = own.map((a) => a.state);
  const status: Task["status"] =
    states.length && states.every((s) => ["accepted", "waived"].includes(s))
      ? "completed"
      : states.length &&
          states.every((s) => ["submitted", "accepted", "waived"].includes(s))
        ? "submitted"
        : states.includes("recheck")
          ? "recheck"
          : states.some((s) => s !== "assigned")
            ? "in_progress"
            : "assigned";
  return {
    ...task,
    status,
    items: task.items.filter((i) => ids.has(i.id)),
    answers: task.answers.filter((a) => ids.has(a.itemId)),
    evidence: task.evidence.filter((e) => ids.has(e.itemId)),
    recheckItems: task.recheckItems.filter((id) => ids.has(id)),
  };
}
export const checkRevision = (a: Task["allocations"][number]) => ({
  itemId: a.itemId,
  assignmentVersion: a.assignmentVersion,
  version: a.version,
});
export function writableChecks(task: Task, person: string) {
  return task.allocations.filter(
    (a) =>
      a.assignedTo === person &&
      ["assigned", "in_progress", "recheck"].includes(a.state),
  );
}

/** Old phone caches predate per-check allocation; the next server fetch supplies it. */
export function allocationFor(
  task: Partial<Pick<Task, "allocations">> | null | undefined,
  itemId: string | undefined,
) {
  return task?.allocations?.find((a) => a.itemId === itemId);
}
