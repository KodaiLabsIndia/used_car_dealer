import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const root = path.resolve(import.meta.dirname, "..");
const input = path.join(root, "data/inspection-models");
const manifest = JSON.parse(fs.readFileSync(path.join(input, "source.json")));
for (const [file, digest] of Object.entries(manifest.files)) {
  const raw = fs.readFileSync(path.join(input, "source", file));
  if (createHash("sha256").update(raw).digest("hex") !== digest)
    throw Error(`Source changed: ${file}`);
}
const output = {};
for (const [family, name, height] of [
  ["sedan", "NormalCar1", 1.42],
  ["hatchback", "NormalCar2", 1.48],
  ["suv", "SUV", 1.68],
]) {
  const model = new OBJLoader().parse(
    fs.readFileSync(path.join(input, "source", `${name}.obj`), "utf8"),
  );
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 4.3 / size.z;
  let lightZ = 0,
    lightCount = 0;
  model.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const group of node.geometry.groups) {
      if (mats[group.materialIndex]?.name !== "Headlights") continue;
      const p = node.geometry.getAttribute("position");
      for (let k = group.start; k < group.start + group.count; k++) {
        lightZ += p.getZ(k);
        lightCount++;
      }
    }
  });
  const turn = lightCount && lightZ / lightCount < center.z ? -1 : 1;
  let count = 0;
  const id = (key) => {
    const s = createHash("sha256")
      .update(`arihant:generic:${family}:${key}`)
      .digest("hex")
      .slice(0, 32);
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20)}`;
  };
  const materials = new Map();
  const material = (m) => {
    if (materials.has(m.name)) return materials.get(m.name);
    const palette = {
      Black: "#171a20",
      Grey: "#718091",
      Windows: "#172530",
      Headlights: "#f0ead7",
      TailLights: "#b61525",
    };
    const glass = m.name === "Windows",
      lights = m.name.includes("lights") || m.name === "TailLights";
    const result = new THREE.MeshStandardMaterial({
      name: m.name,
      color: palette[m.name] || "#c4cbd4",
      metalness: glass ? 0.35 : lights ? 0 : m.name === "Black" ? 0.05 : 0.4,
      roughness: glass ? 0.18 : m.name === "Black" ? 0.8 : 0.34,
    });
    if (lights) {
      result.emissive.copy(result.color);
      result.emissiveIntensity = 0.12;
    }
    result.uuid = id(`material:${m.name}`);
    materials.set(m.name, result);
    return result;
  };
  model.traverse((node) => {
    node.uuid = id(`node:${count++}`);
    if (!node.isMesh) return;
    node.geometry.uuid = id(`geometry:${node.name}`);
    const p = node.geometry.getAttribute("position"),
      normals = node.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(
        i,
        (p.getX(i) - center.x) * scale * turn,
        ((p.getY(i) - box.min.y) * height) / size.y,
        (p.getZ(i) - center.z) * scale * turn,
      );
      // Correct normals for the nonuniform height adjustment and 180° yaw.
      const n = new THREE.Vector3(
        (normals.getX(i) * turn) / scale,
        (normals.getY(i) * size.y) / height,
        (normals.getZ(i) * turn) / scale,
      ).normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
    node.geometry.computeBoundingSphere();
    node.material = Array.isArray(node.material)
      ? node.material.map(material)
      : material(node.material);
  });
  const file = `apps/mobile/assets/inspection-models/${family}.json`;
  fs.writeFileSync(
    path.join(root, file),
    JSON.stringify(model.toJSON(), (_key, v) =>
      typeof v === "number" ? Math.round(v * 100000) / 100000 : v,
    ) + "\n",
  );
  output[family] = {
    source: name,
    file,
    bytes: fs.statSync(path.join(root, file)).size,
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(root, file)))
      .digest("hex"),
    length: 4.3,
    height,
    frontPositiveZ: true,
  };
}
fs.writeFileSync(
  path.join(input, "derived.json"),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(output);
