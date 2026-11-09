import { useEffect, useId } from "react";
import { useApp } from "./app-context";
// Keep a pending command on screen. This is interaction feedback, never authority.
export function useInteractionLock(busy: boolean) {
  const id = useId(),
    { setWorking } = useApp();
  useEffect(() => {
    if (!busy) return;
    setWorking(id, true);
    return () => setWorking(id, false);
  }, [busy, id, setWorking]);
}
