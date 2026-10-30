import assert from "node:assert/strict";
import { test } from "node:test";
import { maxMoneyPaise, parseRupees, rupeeInput } from "./money.ts";

test("currency entry preserves paise across Indian grouping and Hindi numerals", () => {
  assert.equal(parseRupees("₹ 5,25,000.25"), 52_500_025);
  assert.equal(parseRupees("५२५०००.२५"), 52_500_025);
  assert.equal(parseRupees("0.01"), 1);
  assert.equal(parseRupees("0.29"), 29);
  assert.equal(parseRupees("0"), 0);
});

test("ambiguous, negative, fractional-paise and excessive amounts are rejected", () => {
  for (const value of [
    "",
    " ",
    "-20",
    "5e5",
    "1.001",
    "1.",
    "NaN",
    "Infinity",
    "10.2.3",
    "1000000000.01",
  ]) {
    assert.equal(parseRupees(value), null, value);
  }
});

test("editing a saved amount never changes its paise value", () => {
  for (const amount of [
    0,
    1,
    29,
    101,
    99999999,
    maxMoneyPaise - 1,
    maxMoneyPaise,
  ]) {
    assert.equal(parseRupees(rupeeInput(amount)), amount);
  }
});
