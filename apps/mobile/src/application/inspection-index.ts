import { inspectionProgress, type Task } from "@arihant/contracts";
export { checkState, inspectionProgress } from "@arihant/contracts";

export const zones = [
  ["identity", "Identity", "पहचान"],
  ["exterior", "Body", "बॉडी"],
  ["visibility", "Glass", "शीशे"],
  ["wheels", "Wheels", "पहिए"],
  ["powertrain", "Powertrain", "इंजन / मोटर"],
  ["underbody", "Underbody", "नीचे का हिस्सा"],
  ["cabin", "Cabin", "केबिन"],
  ["electrical", "Electrical", "बिजली"],
  ["safety", "Safety", "सुरक्षा"],
  ["road_test", "Tests", "टेस्ट"],
  ["general", "Other", "अन्य"],
] as const;

export function componentChecks(task: Task, component: string) {
  return task.items.filter((i) => i.componentId === component);
}

/** Choose only this person's writable, unfinished checks; never discard a local edit. */
export function nextInspectionCheck(
  task: Task,
  personId: string,
  current = 0,
  keepCurrentDraft = false,
): number | null {
  if (["submitted", "completed"].includes(task.status)) return null;
  const writable = new Set(
    task.collaborative
      ? (task.allocations ?? [])
          .filter(
            (a) =>
              a.assignedTo === personId &&
              ["assigned", "in_progress", "recheck"].includes(a.state),
          )
          .map((a) => a.itemId)
      : task.assignedTo === personId
        ? task.items.map((i) => i.id)
        : [],
  );
  if (keepCurrentDraft && writable.has(task.items[current]?.id ?? ""))
    return current;
  const missing = new Set(
    inspectionProgress({
      ...task,
      items: task.items
        .filter((i) => writable.has(i.id))
        .map((i) => ({ ...i, required: true })),
    }).missing.map((i) => i.id),
  );
  const candidates = task.items
    .map((i, index) => ({ i, index }))
    .filter(({ i }) => missing.has(i.id));
  const returned = candidates.find(
    ({ i }) =>
      task.recheckItems.includes(i.id) ||
      (task.allocations ?? []).some(
        (a) => a.itemId === i.id && a.state === "recheck",
      ),
  );
  if (returned) return returned.index;
  return (
    candidates.find(({ index }) => index >= current)?.index ??
    candidates[0]?.index ??
    null
  );
}
