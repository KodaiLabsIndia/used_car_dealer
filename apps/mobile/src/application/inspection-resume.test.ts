import test from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@arihant/contracts";
import { nextInspectionCheck } from "./inspection-index";
const task = {
  status: "in_progress",
  collaborative: true,
  assignedTo: "ravi",
  items: ["accepted", "other", "photo", "video", "returned"].map((id) => ({
    id,
    required: true,
    requiresClip: id === "video",
    measurementUnit: null,
    configurationPending: false,
  })),
  allocations: ["accepted", "other", "photo", "video", "returned"].map(
    (id) => ({
      itemId: id,
      assignedTo: id === "other" ? "suresh" : "ravi",
      state: id === "accepted" ? "accepted" : "assigned",
    }),
  ),
  answers: [{ itemId: "video", result: "ok", evidenceId: "proof" }],
  evidence: [{ id: "proof", itemId: "video" }],
  clipItemIds: [],
  recheckItems: [],
} as unknown as Task;
test("resume skips accepted and other people's checks and preserves a writable local edit", () => {
  assert.equal(nextInspectionCheck(task, "ravi"), 2);
  assert.equal(nextInspectionCheck(task, "ravi", 3, true), 3);
  assert.equal(nextInspectionCheck(task, "ravi", 0, true), 2);
  assert.equal(nextInspectionCheck(task, "nobody"), null);
});
test("resume prioritizes returned checks and treats a missing required video as unfinished", () => {
  assert.equal(
    nextInspectionCheck({ ...task, recheckItems: ["returned"] }, "ravi"),
    4,
  );
  assert.equal(nextInspectionCheck(task, "ravi", 3), 3);
  assert.equal(
    nextInspectionCheck({ ...task, status: "completed" }, "ravi"),
    null,
  );
  assert.equal(
    nextInspectionCheck(
      {
        ...task,
        allocations: task.allocations.map((a) => ({
          ...a,
          state: "submitted",
        })),
      },
      "ravi",
    ),
    null,
  );
});
