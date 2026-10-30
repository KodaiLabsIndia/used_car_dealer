export type Point = [number, number, number];
export type ProjectedPoint = { id: string; x: number; y: number };
// Keep touch targets separate while retaining every projected component.
export function clusterInspectionPoints(points: ProjectedPoint[]) {
  const groups = points.map((p) => ({ ids: [p.id], x: p.x, y: p.y }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]!,
          b = groups[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) >= 46) continue;
        const total = a.ids.length + b.ids.length;
        groups[i] = {
          ids: [...a.ids, ...b.ids],
          x: (a.x * a.ids.length + b.x * b.ids.length) / total,
          y: (a.y * a.ids.length + b.y * b.ids.length) / total,
        };
        groups.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return groups;
}
// Front +Z, vehicle's left +X, up +Y. Generic SUV coordinate frame.
export function componentAnchor(c: string, family = "suv"): Point {
  const side = c.includes("left") ? 1 : c.includes("right") ? -1 : 0,
    x = side * 1.01;
  let p: Point;
  if (c === "vehicle") p = [0, 0.57, 2.19];
  else if (c === "body") p = [0, 1.2, -2.1];
  else if (c.includes("bonnet") || c === "engine_bay") p = [0, 1.13, 1.25];
  else if (c.includes("fender")) p = [x, 0.89, 1.35];
  else if (c.includes("quarter")) p = [x, 1.04, -1.4];
  else if (c.includes("sill")) p = [x, 0.43, 0];
  else if (c.includes("pillar")) p = [x * 0.9, 1.47, 0.1];
  else if (c.startsWith("wheel."))
    p = [x, 0.36, c.includes("front") ? 1.35 : -1.28];
  else if (c.startsWith("door."))
    p = [x, 1.02, c.includes("front") ? 0.45 : -0.65];
  else if (c.startsWith("light."))
    p = [side * 0.75, 0.85, c.includes("front") ? 2.02 : -2.03];
  else if (c.includes("tailgate")) p = [0, 1.05, -2.16];
  else if (c.includes("rear_bumper")) p = [0, 0.5, -2.18];
  else if (c.includes("front_bumper")) p = [0, 0.5, 2.18];
  else if (c.includes("roof") || c === "cabin") p = [0, 1.75, -0.2];
  else if (c.includes("mirror")) p = [side * 1.12, 1.2, 0.73];
  else if (c.includes("glass")) p = [0, 1.4, c.includes("rear") ? -1.65 : 0.83];
  else if (c === "underbody" || c === "system.electric") p = [0, 0.15, -0.2];
  else if (c === "system.transmission") p = [0.3, 0.35, 0.6];
  else if (c === "system.gas") p = [0, 0.73, -2.1];
  else if (c === "system.wheels") p = [0, 0.4, 1.35];
  else if (c === "system.electrical") p = [-0.3, 1.75, 0.1];
  else p = [0.3, 1.75, 0.1];
  const height =
    family === "sedan" ? 1.42 : family === "hatchback" ? 1.48 : 1.68;
  return [p[0], (p[1] * height) / 1.68, p[2]];
}
export function orbitPose(theta: number, phi: number, radius: number) {
  return {
    theta,
    phi: Math.max(0.12, Math.min(Math.PI - 0.12, phi)),
    radius: Math.max(4.8, Math.min(11, radius)),
  };
}
