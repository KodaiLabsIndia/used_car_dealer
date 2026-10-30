import assert from "node:assert/strict";
import test from "node:test";
import { readResource, type ResourceCache } from "./resource-cache";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
test("switching cars while cache loads cannot fetch or cache the next car under the previous car", async () => {
  const disk = deferred<{ id: string } | null>();
  const writes: Array<[string, string, unknown]> = [];
  const cache: ResourceCache = {
    read: async <T>(_owner: string, key: string) =>
      (key === "car:A" ? await disk.promise : null) as T | null,
    write: async (owner, key, value) => {
      writes.push([owner, key, value]);
    },
  };
  let activeA = true,
    callsA = 0;
  let currentLoader = async () => {
    callsA++;
    return { id: "A" };
  };
  const first = readResource(
    "owner",
    "car:A",
    currentLoader,
    cache,
    () => activeA,
    () => {},
  );
  currentLoader = async () => ({ id: "B" });
  activeA = false;
  const second = await readResource(
    "owner",
    "car:B",
    currentLoader,
    cache,
    () => true,
    () => {},
  );
  disk.resolve(null);
  assert.deepEqual(await first, { kind: "cancelled" });
  assert.deepEqual(second, { kind: "fresh", value: { id: "B" } });
  assert.equal(callsA, 0);
  assert.deepEqual(writes, [["owner", "car:B", { id: "B" }]]);
});
test("a late response from a cancelled refresh cannot overwrite the newer cached version", async () => {
  const slow = deferred<{ version: number }>(),
    started = deferred<void>();
  let active = true;
  const writes: unknown[] = [];
  const cache: ResourceCache = {
    read: async () => null,
    write: async (_owner, _key, value) => {
      writes.push(value);
    },
  };
  const previous = readResource(
    "owner",
    "task:A",
    () => {
      started.resolve();
      return slow.promise;
    },
    cache,
    () => active,
    () => {},
  );
  await started.promise;
  active = false;
  const fresh = await readResource(
    "owner",
    "task:A",
    async () => ({ version: 3 }),
    cache,
    () => true,
    () => {},
  );
  slow.resolve({ version: 2 });
  assert.deepEqual(await previous, { kind: "cancelled" });
  assert.deepEqual(fresh, { kind: "fresh", value: { version: 3 } });
  assert.deepEqual(writes, [{ version: 3 }]);
});
