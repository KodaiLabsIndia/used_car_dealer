import test from "node:test";
import assert from "node:assert/strict";
import { reviewFormValues } from "./form-review";
test("form review shows named choices and exact paise without changing submitted values", () => {
  const values = {
    amount: "१२,३४५.६७",
    person: "staff-id",
    day: "2026-11-09",
    confirmed: "yes",
  };
  const steps = [
    {
      fields: [
        { key: "amount", label: "Amount", kind: "money" as const },
        {
          key: "person",
          label: "Person",
          kind: "select" as const,
          options: [{ id: "staff-id", label: "Ravi" }],
        },
      ],
    },
    {
      fields: [
        { key: "day", label: "Date", kind: "date" as const },
        { key: "confirmed", label: "Confirmed", kind: "choice" as const },
      ],
    },
  ];
  const before = JSON.stringify(values),
    rows = reviewFormValues(steps, values, "en");
  assert.equal(rows[0]?.value, "₹12,345.67");
  assert.equal(rows[1]?.value, "Ravi");
  assert.equal(rows[2]?.step, 1);
  assert.equal(rows[3]?.value, "Confirmed");
  assert.equal(JSON.stringify(values), before);
});
test("form review makes invalid currency and missing confirmations visible", () => {
  const rows = reviewFormValues(
    [
      {
        fields: [
          { key: "amount", label: "Amount", kind: "money" },
          { key: "choice", label: "Confirm", kind: "choice" },
          { key: "optional", label: "Note" },
        ],
      },
    ],
    { amount: "1.999" },
    "en",
  );
  assert.equal(rows[0]?.invalid, true);
  assert.equal(rows[1]?.unconfirmed, true);
  assert.equal(rows[2]?.value, "Not provided");
});

test("a saved selection removed from available choices requires review without changing its stored ID", () => {
  const values = { person: "removed-staff" };
  const [row] = reviewFormValues(
    [
      {
        fields: [
          {
            key: "person",
            label: "Responsible person",
            kind: "select",
            options: [{ id: "ravi", label: "Ravi" }],
          },
        ],
      },
    ],
    values,
    "en",
  );
  assert.equal(row?.invalid, true);
  assert.equal(row?.value, "Selection needs review");
  assert.equal(values.person, "removed-staff");
});
