import assert from "node:assert/strict";
import test from "node:test";
import { commandFingerprint } from "./command-identity";
test("changed financial drafts cannot be mistaken for the replayed pending command", () => {
  const a = {
    action: "payment",
    amountPaise: 100001,
    expectedVersion: 2,
    note: undefined,
  };
  assert.equal(
    commandFingerprint(a),
    commandFingerprint({
      expectedVersion: 2,
      amountPaise: 100001,
      action: "payment",
    }),
  );
  assert.notEqual(
    commandFingerprint(a),
    commandFingerprint({ ...a, amountPaise: 200001 }),
  );
  assert.notEqual(
    commandFingerprint(a),
    commandFingerprint({ ...a, expectedVersion: 3 }),
  );
});
