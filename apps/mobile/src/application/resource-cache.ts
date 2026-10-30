export interface ResourceCache {
  read<T>(owner: string, key: string): Promise<T | null>;
  write(owner: string, key: string, value: unknown): Promise<void>;
}
export type ResourceResult<T> =
  | { kind: "fresh"; value: T }
  | { kind: "failed"; error: unknown; hadCache: boolean }
  | { kind: "cancelled" };

// Capture identity and loader before awaiting storage. A screen/filter change
// invalidates this read; it must not write a late response over newer work.
export async function readResource<T>(
  owner: string,
  key: string,
  loader: () => Promise<T>,
  cache: ResourceCache,
  current: () => boolean,
  showCached: (value: T) => void,
): Promise<ResourceResult<T>> {
  const cached = await cache.read<T>(owner, key).catch(() => null);
  if (!current()) return { kind: "cancelled" };
  if (cached !== null) showCached(cached);
  try {
    const fresh = await loader();
    if (!current()) return { kind: "cancelled" };
    await cache.write(owner, key, fresh);
    return current() ? { kind: "fresh", value: fresh } : { kind: "cancelled" };
  } catch (error) {
    return current()
      ? { kind: "failed", error, hadCache: cached !== null }
      : { kind: "cancelled" };
  }
}
