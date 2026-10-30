import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "@arihant/contracts";
import { itemSchema } from "@arihant/contracts";
import { checkState, inspectionProgress } from "./inspection-index";

function inspection(): Task {
  // Only the projection's inputs; no server or React Native dependency.
  return {
    items: [
      itemSchema.parse({
        id: "tyre",
        title: "Tyre",
        titleHi: "टायर",
        instruction: "Measure",
        instructionHi: "मापें",
        order: 1,
        required: true,
        measurementUnit: "mm",
        configurationPending: true,
        requiresClip: true,
      }),
    ],
    answers: [
      {
        itemId: "tyre",
        result: "ok",
        note: "",
        evidenceId: "photo",
        reading: 4.2,
        applicabilityConfirmed: true,
      },
    ],
    evidence: [{ id: "photo", itemId: "tyre" }],
    clipItemIds: ["tyre"],
    recheckItems: [],
  } as unknown as Task;
}

test("completion waits for actual photo, required clip, measurement and applicability confirmation", () => {
  assert.equal(inspectionProgress(inspection()).completed, 1);
  for (const patch of [
    { evidence: [] },
    { clipItemIds: [] },
    { recheckItems: ["tyre"] },
  ])
    assert.equal(
      inspectionProgress({ ...inspection(), ...patch }).completed,
      0,
    );
  for (const patch of [{ reading: null }, { applicabilityConfirmed: false }]) {
    const task = inspection();
    task.answers[0] = { ...task.answers[0]!, ...patch };
    assert.equal(inspectionProgress(task).completed, 0);
  }
});

test("unable stays unfinished while an explicit N/A goes to review and findings stay distinct", () => {
  const task = inspection();
  task.answers[0]!.result = "unable";
  assert.equal(checkState(task, task.items[0]!), "blocked");
  assert.equal(inspectionProgress(task).completed, 0);
  task.answers[0]!.result = "not_applicable";
  task.answers[0]!.reading = null;
  task.answers[0]!.applicabilityConfirmed = false;
  task.clipItemIds = [];
  assert.equal(inspectionProgress(task).completed, 1);
  assert.equal(inspectionProgress(task).exceptions, 1);
  task.answers[0]!.result = "problem";
  assert.equal(inspectionProgress(task).issues, 1);
  assert.equal(inspectionProgress(task).exceptions, 0);
});
