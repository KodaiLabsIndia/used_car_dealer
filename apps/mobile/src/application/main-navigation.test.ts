import test from "node:test";
import assert from "node:assert/strict";
import { mainDestination, mainSection } from "./main-navigation";
test("home navigation clears prior staff or profile destination explicitly", () => {
  assert.deepEqual(mainDestination("home"), {
    name: "Home",
    params: { area: "today", employeeArea: "today" },
  });
  assert.equal(
    mainSection({ name: "Home", params: { area: "people" } }, true),
    "staff",
  );
  assert.equal(
    mainSection({ name: "Home", params: { employeeArea: "me" } }, false),
    "me",
  );
  assert.equal(mainSection(mainDestination("home"), true), "home");
  assert.equal(mainSection(mainDestination("home"), false), "home");
});
test("primary destinations lead directly to cars, work, named staff and review", () => {
  assert.equal(mainDestination("cars").name, "Cars");
  assert.equal(mainDestination("work").name, "Work");
  assert.equal(mainDestination("review").name, "Decisions");
  assert.deepEqual(mainDestination("staff"), {
    name: "Home",
    params: { area: "people" },
  });
});
test("detail pages retain their section and workforce follows the viewer role", () => {
  for (const name of ["Car", "Documents", "Purchase", "Business", "Stock"])
    assert.equal(mainSection({ name }, true), "cars");
  for (const name of [
    "Task",
    "InspectionAllocation",
    "Routines",
    "Job",
    "Clips",
    "Help",
  ])
    assert.equal(mainSection({ name }, false), "work");
  assert.equal(
    mainSection({ name: "Work", params: { personId: "ravi" } }, true),
    "staff",
  );
  assert.equal(mainSection({ name: "Workforce" }, true), "staff");
  assert.equal(mainSection({ name: "Workforce" }, false), "me");
});
