import assert from "node:assert/strict";
import test from "node:test";
import { futureDayTimestamp } from "./future-date";
test("booking and warranty dates reject rollover/past dates and retain the selected local day", () => {
  const now = new Date(2026, 9, 30, 10, 0);
  assert.equal(futureDayTimestamp("2026-02-30", now), null);
  assert.equal(futureDayTimestamp("2026-10-29", now), null);
  assert.equal(futureDayTimestamp("30/10/2026", now), null);
  const date = new Date(futureDayTimestamp("2026-10-30", now)!);
  assert.equal(date.getDate(), 30);
  assert.equal(date.getHours(), 23);
  assert.equal(date.getMinutes(), 59);
});
