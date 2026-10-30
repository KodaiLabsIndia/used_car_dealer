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
