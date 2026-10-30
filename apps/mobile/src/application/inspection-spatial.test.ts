import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterInspectionPoints,
  componentAnchor,
  orbitPose,
} from "./inspection-spatial";

test("overlapping pointers retain every linked part in separated touch targets", () => {
  const points = [
    { id: "roof", x: 100, y: 100 },
    { id: "diagnostics", x: 102, y: 102 },
    { id: "pillar", x: 125, y: 120 },
    { id: "bumper", x: 210, y: 150 },
  ];
  const grouped = clusterInspectionPoints(points);
  assert.deepEqual(
    grouped.flatMap((p) => p.ids).sort(),
    points.map((p) => p.id).sort(),
  );
  assert.ok(
    grouped.some(
      (p) => p.ids.includes("roof") && p.ids.includes("diagnostics"),
    ),
  );
  for (const a of grouped)
    for (const b of grouped) {
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 46);
    }
  assert.deepEqual(clusterInspectionPoints([]), []);
});

test("vehicle-relative inspection points keep left/right and front/rear consistent", () => {
  const left = componentAnchor("wheel.front_left"),
    right = componentAnchor("wheel.front_right"),
    rear = componentAnchor("wheel.rear_left");
  assert.equal(left[0], -right[0]);
  assert.ok(left[0] > 0 && right[0] < 0 && left[2] > 0 && rear[2] < 0);
  assert.ok(componentAnchor("body.roof")[1] > componentAnchor("underbody")[1]);
  const sedan = componentAnchor("body.roof", "sedan");
  assert.ok(sedan[1] < componentAnchor("body.roof", "suv")[1]);
  assert.equal(componentAnchor("wheel.front_left", "sedan")[2], left[2]);
});

test("touch orbit can turn around the car while keeping zoom and pole angles bounded", () => {
  const pose = orbitPose(8 * Math.PI, -4, 0.1);
  assert.equal(pose.theta, 8 * Math.PI);
  assert.ok(pose.phi > 0 && pose.radius >= 4.8);
  const far = orbitPose(-Math.PI, 20, 100);
  assert.ok(far.phi < Math.PI && far.radius <= 11);
});
