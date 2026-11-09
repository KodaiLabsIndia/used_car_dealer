import test from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@arihant/contracts";
import { helpChecks, helpPayload } from "./help-request";
const task = {
  status: "in_progress",
  collaborative: true,
  items: [{ id: "a" }, { id: "b" }, { id: "c" }],
  allocations: [
    {
      itemId: "a",
      assignedTo: "ravi",
      state: "assigned",
      assignmentVersion: 3,
    },
    {
      itemId: "b",
      assignedTo: "meena",
      state: "assigned",
      assignmentVersion: 2,
    },
    {
      itemId: "c",
      assignedTo: "ravi",
      state: "accepted",
      assignmentVersion: 1,
    },
  ],
} as unknown as Task;
test("help only offers the person's mutable checks", () => {
  assert.deepEqual(
    helpChecks(task, "ravi").map((i) => i.id),
    ["a"],
  );
  assert.equal(helpPayload(task, "ravi", "b", ""), null);
  assert.equal(helpPayload(task, "ravi", "c", ""), null);
  assert.equal(helpPayload(task, "ravi", "", ""), null);
  assert.deepEqual(helpPayload(task, "ravi", "a", "Need help"), {
    action: "help",
    itemId: "a",
    note: "Need help",
    allocationVersion: 3,
  });
});
test("help stops after reassignment, submission or completion", () => {
  assert.equal(
    helpPayload(
      {
        ...task,
        allocations: task.allocations.map((a) => ({
          ...a,
          assignedTo: "meena",
        })),
      },
      "ravi",
      "a",
      "",
    ),
    null,
  );
  for (const status of ["submitted", "completed"] as const)
    assert.equal(helpPayload({ ...task, status }, "ravi", "a", ""), null);
});

test("returned checks remain eligible for a new help request", () => {
  const returned = {
    ...task,
    allocations: task.allocations.map((a) =>
      a.itemId === "a" ? { ...a, state: "recheck" as const } : a,
    ),
  };
  assert.equal(
    helpPayload(returned, "ravi", "a", "How do I recheck?")?.allocationVersion,
    3,
  );
});
