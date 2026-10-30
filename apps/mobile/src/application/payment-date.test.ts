import assert from "node:assert/strict";
import { test } from "node:test";
import { localDateInput, paymentTimestamp } from "./payment-date.ts";

test("payment dates reject future and rolled-over calendar days", () => {
  const now = new Date(2026, 2, 1, 0, 15);
  for (const day of [
    "2026-02-30",
    "2026-02-29",
    "2026-03-02",
    "2026-13-01",
    "26-03-01",
    "",
    "1899-01-01",
  ])
    assert.equal(paymentTimestamp(day, now), null, day);
  assert.equal(paymentTimestamp(localDateInput(now), now), now.toISOString());
  const yesterday = new Date(paymentTimestamp("2026-02-28", now)!);
  assert.equal(localDateInput(yesterday), "2026-02-28");
  assert.equal(yesterday.getHours(), 0);
});
