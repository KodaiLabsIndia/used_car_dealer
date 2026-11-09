import { readResource } from "../application/resource-cache";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
export function useResource<T>(key: string, loader: () => Promise<T>) {
  const { session, revision, t } = useApp(),
    [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState({ id: 0, quiet: false });
  const currentLoader = useRef(loader);
  const currentScope = useRef("");
  const currentRevision = useRef(revision);
  // Resource responses and user-authored drafts never share a storage namespace.
  // A new version also retires caches written by the earlier loader race.
  const cacheKey = `resource:v3:${key}`;
  currentLoader.current = loader;
  const owner = session?.actor.id || "";
  useEffect(() => {
    let cancelled = false;
    // Freeze the loader with this cache key before the first asynchronous read.
    // A later screen/filter must never fetch its record into this key's cache.
    const loader = currentLoader.current;
    const scope = `${owner}:${key}`;
    const scopeChanged = currentScope.current !== scope;
    currentScope.current = scope;
    if (scopeChanged) setData(null);
    // Polling keeps the current screen steady. New records, commands and manual
    // refreshes still show progress; cache scoping and stale-response guards stay unchanged.
    const quiet =
      attempt.quiet &&
      !scopeChanged &&
      currentRevision.current === revision &&
      data !== null;
    currentRevision.current = revision;
    setLoading(!quiet);
    if (!quiet) {
      setError("");
      setOffline(false);
    }
    void (async () => {
      const result = await readResource(
        owner,
        cacheKey,
        loader,
        { read: loadLocal, write: saveLocal },
        () => !cancelled,
        (cached) => {
          if (scopeChanged) setData(cached);
        },
      );
      if (cancelled || result.kind === "cancelled") return;
      if (result.kind === "fresh") {
        setData(result.value);
        setOffline(false);
        setError("");
      } else {
        const err = result.error as { status?: number; message?: string };
        if (err.status === 404 || err.status === 403 || err.status === 401) {
          await deleteLocal(owner, cacheKey).catch(() => {});
          if (cancelled) return;
          setData(null);
        }
        setOffline(err.status === 0 && result.hadCache);
        setError(err.message || "Please try again.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, key, revision, attempt]);
  return {
    data,
    loading,
    offline,
    error: offline ? t("offline") : error,
    refresh: () => setAttempt((n) => ({ id: n.id + 1, quiet: false })),
    refreshQuiet: () => setAttempt((n) => ({ id: n.id + 1, quiet: true })),
  };
}
