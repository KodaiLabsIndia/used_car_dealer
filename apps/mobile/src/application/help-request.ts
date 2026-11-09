import type { Task } from "@arihant/contracts";
export function helpChecks(task: Task | null, person: string) {
  if (!task || ["submitted", "completed"].includes(task.status)) return [];
  if (!task.collaborative) return task.assignedTo === person ? task.items : [];
  return task.items.filter((item) =>
    task.allocations?.some(
      (a) =>
        a.itemId === item.id &&
        a.assignedTo === person &&
        ["assigned", "in_progress", "recheck"].includes(a.state),
    ),
  );
}
export function helpPayload(
  task: Task,
  person: string,
  itemId: string,
  note: string,
) {
  if (!helpChecks(task, person).some((item) => item.id === itemId)) return null;
  return {
    action: "help" as const,
    itemId,
    note,
    allocationVersion:
      task.allocations?.find((a) => a.itemId === itemId)?.assignmentVersion ??
      null,
  };
}
