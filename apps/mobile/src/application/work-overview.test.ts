import assert from "node:assert/strict";
import test from "node:test";
import {
  personalInspectionWork,
  routinePhase,
  nextRoutineStep,
} from "./work-overview";

test("personal work excludes another assignee and separates review from unfinished work", () => {
  const result = personalInspectionWork(
    [
      {
        id: "other",
        assignedTo: "owner",
        status: "recheck",
        helpOpen: false,
        dueAt: null,
      },
      {
        id: "review",
        assignedTo: "ravi",
        status: "submitted",
        helpOpen: true,
        dueAt: null,
      },
      {
        id: "done",
        assignedTo: "ravi",
        status: "completed",
        helpOpen: false,
        dueAt: null,
      },
      {
        id: "open",
        assignedTo: "ravi",
        status: "assigned",
        helpOpen: false,
        dueAt: null,
      },
    ],
    "ravi",
    "2026-11-08T10:00:00Z",
  );
  assert.deepEqual(
    result.todo.map((t) => t.id),
    ["open"],
  );
  assert.deepEqual(
    result.review.map((t) => t.id),
    ["review"],
  );
  assert.deepEqual(
    result.finished.map((t) => t.id),
    ["done"],
  );
});
test("rechecks, help and actual overdue work precede ongoing and unscheduled inspections", () => {
  const tasks = [
    { id: "new", status: "assigned", dueAt: null },
    { id: "active", status: "in_progress", dueAt: null },
    { id: "late", status: "assigned", dueAt: "2026-11-08T08:00:00Z" },
    { id: "recheck", status: "recheck", dueAt: null },
    { id: "help", status: "in_progress", dueAt: null },
  ].map((t) => ({
    ...t,
    assignedTo: "ravi",
    helpOpen: t.id === "help",
  })) as Parameters<typeof personalInspectionWork>[0];
  assert.deepEqual(
    personalInspectionWork(tasks, "ravi", "2026-11-08T10:00:00Z").todo.map(
      (t) => t.id,
    ),
    ["recheck", "help", "late", "active", "new"],
  );
});
const definition = {
  title: "Opening",
  assignedTo: "ravi",
  active: true,
  weekdays: [0],
  steps: ["Keys", "Yard"],
};
test("routine progress keeps the next unrecorded step and a finished state", () => {
  const item = {
    definition,
    dueToday: true,
    started: true,
    completedSteps: [0],
  };
  assert.equal(routinePhase(item), "in_progress");
  assert.equal(nextRoutineStep(item), 1);
  assert.equal(routinePhase({ ...item, completedSteps: [0, 1] }), "finished");
  assert.equal(nextRoutineStep({ ...item, completedSteps: [0, 1] }), -1);
});
test("a paused template does not erase work already started on its saved day", () => {
  assert.equal(
    routinePhase({
      definition: { ...definition, active: false },
      dueToday: true,
      started: true,
      completedSteps: [0],
    }),
    "in_progress",
  );
  assert.equal(
    routinePhase({
      definition,
      dueToday: false,
      started: false,
      completedSteps: [],
    }),
    "not_due",
  );
});

test("a shared inspection appears in the employee routine queue using current checks, with partial review alongside unfinished work", async () => {
  const { itemSchema, inspectionPortion } = await import("@arihant/contracts");
  const master = {
    id: "shared",
    assignedTo: "owner",
    status: "in_progress",
    collaborative: true,
    helpOpen: false,
    dueAt: null,
    items: ["body", "engine", "brakes"].map((id, order) =>
      itemSchema.parse({
        id,
        order,
        title: id,
        titleHi: id,
        instruction: id,
        instructionHi: id,
        required: true,
      }),
    ),
    allocations: [
      { itemId: "body", assignedTo: "ravi", state: "submitted" },
      { itemId: "engine", assignedTo: "ravi", state: "assigned" },
      { itemId: "brakes", assignedTo: "meena", state: "accepted" },
    ],
    answers: [],
    evidence: [],
    recheckItems: [],
    clipItemIds: [],
  } as unknown as import("@arihant/contracts").Task;
  const work = personalInspectionWork([master], "ravi", "2026-11-08T10:00:00Z");
  assert.equal(work.todo[0]?.id, "shared");
  assert.equal(work.review[0]?.id, "shared");
  assert.deepEqual(
    work.todo[0]?.items.map((i) => i.id),
    ["body", "engine"],
  );
  assert.equal(master.items.length, 3);
  assert.equal(inspectionPortion(master, "meena").status, "completed");
  assert.equal(personalInspectionWork([master], "owner", "").todo.length, 0);
  const tomorrow = personalInspectionWork(
    [master],
    "ravi",
    "2026-11-09T10:00:00Z",
  );
  assert.equal(tomorrow.todo[0]?.id, "shared");
  master.allocations[0]!.assignedTo = "meena";
  master.allocations[1]!.assignedTo = null;
  assert.equal(personalInspectionWork([master], "ravi", "").todo.length, 0);
});
