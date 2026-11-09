import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
export function useLiveRefresh(refresh: () => void) {
  const focused = useIsFocused(),
    current = useRef(refresh),
    first = useRef(true);
  current.current = refresh;
  useEffect(() => {
    if (!focused) return;
    const tick = () => {
      if (AppState.currentState === "active") current.current();
    };
    if (first.current) first.current = false;
    else tick();
    const timer = setInterval(tick, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [focused]);
}
