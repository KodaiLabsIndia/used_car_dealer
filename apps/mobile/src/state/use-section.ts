import { useEffect, useRef, useState } from "react";
import { loadLocal, saveLocal } from "../adapters/local-store";
import { useApp } from "./app-context";

// Section/step selection belongs to the person and record, not to a viewport.
export function useSection<T extends string>(
  key: string,
  initial: T,
  values: readonly T[],
) {
  const { session } = useApp();
  const owner = session!.actor.id;
  const [selected, setSelected] = useState(initial);
  const touched = useRef(false);
  const allowed = useRef(values);
  allowed.current = values;
  useEffect(() => {
    let active = true;
    touched.current = false;
    setSelected(initial);
    void loadLocal<T>(owner, `section:${key}`)
      .then((value) => {
        if (
          active &&
          !touched.current &&
          value &&
          allowed.current.includes(value)
        )
          setSelected(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [owner, key, initial]);
  function select(value: T) {
    if (!allowed.current.includes(value)) return;
    touched.current = true;
    setSelected(value);
    void saveLocal(owner, `section:${key}`, value).catch(() => {});
  }
  return [selected, select] as const;
}
