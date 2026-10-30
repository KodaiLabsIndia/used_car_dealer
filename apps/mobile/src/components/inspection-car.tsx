import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
} from "react";
import { AppState, Pressable, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { ChecklistItem, VehicleConfiguration } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import { Text, s } from "./ui";
import { useLayout } from "./layout";
import { useReducedMotion } from "./garage-motion";
import type { ViewName } from "./inspection-car-scene";
const Scene = lazy(() => import("./inspection-car-scene"));
const labels = {
  front: ["Front", "आगे"],
  rear: ["Rear", "पीछे"],
  left: ["Left", "बायाँ"],
  right: ["Right", "दायाँ"],
  top: ["Top", "ऊपर"],
  below: ["Below", "नीचे"],
};

class RenderBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function InspectionCar({
  configuration,
  item,
  components,
  onSelect,
  hi,
}: {
  configuration: VehicleConfiguration;
  item: ChecklistItem;
  components: string[];
  onSelect: (id: string) => void;
  hi: boolean;
}) {
  const [view, setView] = useState<ViewName>("front"),
    [presetRequest, setPresetRequest] = useState(0),
    [rotated, setRotated] = useState(false),
    [viewport, setViewport] = useState<string | null>(null),
    [enabled, setEnabled] = useState(true),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const focused = useIsFocused();
  const layout = useLayout();
  const onOrbit = useCallback(() => setRotated(true), []);
  useEffect(() => setRotated(false), [viewport]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  const reduced = useReducedMotion();
  const family =
    configuration.bodyType === "sedan"
      ? "sedan"
      : configuration.bodyType === "hatchback"
        ? "hatchback"
        : "suv";
  useEffect(() => {
    const c = item.componentId;
    setRotated(false);
    setPresetRequest((n) => n + 1);
    setView(
      c.includes("left")
        ? "left"
        : c.includes("right")
          ? "right"
          : c === "cabin"
            ? "top"
            : c === "underbody"
              ? "below"
              : c.includes("rear") || c.includes("tailgate")
                ? "rear"
                : "front",
    );
  }, [item.componentId]);
  const fallback = (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <Text>
        {hi
          ? "ऊपर सभी जाँच से कोई भी जाँच चुनें।"
          : "Use All checks above to choose any item."}
      </Text>
    </View>
  );
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: "#0d1115",
      }}
    >
      <Text
        style={[
          s.muted,
          { fontSize: 10, paddingHorizontal: 10, paddingTop: 8 },
        ]}
      >
        {hi ? `सामान्य ${family} नक्शा` : `Generic ${family} schematic`}
      </Text>
      <View
        onLayout={({ nativeEvent: { layout: bounds } }) =>
          setViewport(
            `${Math.round(bounds.width)}:${Math.round(bounds.height)}`,
          )
        }
        style={{
          height: layout.split ? 296 : Math.min(200, layout.height * 0.23),
        }}
      >
        {enabled && focused && foreground && viewport ? (
          <RenderBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <Scene
                // Expo GL retains its native drawing buffer across layout changes.
                // Recreate it after measuring the new viewport so pins and geometry agree.
                key={viewport}
                family={family}
                active={item.componentId}
                components={components}
                hi={hi}
                onSelect={onSelect}
                view={view}
                reduced={reduced}
                presetRequest={presetRequest}
                onOrbit={onOrbit}
              />
            </Suspense>
          </RenderBoundary>
        ) : (
          fallback
        )}
      </View>
      <Text style={[s.muted, { fontSize: 10, paddingHorizontal: 10 }]}>
        {hi
          ? "घुमाने के लिए खींचें · जाँच के लिए लाल बिंदु छुएँ"
          : "Drag to rotate · tap a red dot for checks"}
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", padding: 5, gap: 2 }}
      >
        {(Object.keys(labels) as ViewName[]).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: view === v && !rotated }}
            onPress={() => {
              setView(v);
              setRotated(false);
              setPresetRequest((n) => n + 1);
            }}
            style={{
              minHeight: 48,
              paddingHorizontal: 8,
              justifyContent: "center",
              backgroundColor:
                view === v && !rotated ? "#392124" : "transparent",
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 11 }}>{labels[v][hi ? 1 : 0]}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hi
              ? enabled
                ? "3D बंद करें"
                : "3D चालू करें"
              : enabled
                ? "Use list only"
                : "Show 3D"
          }
          onPress={() => setEnabled((v) => !v)}
          style={{
            minHeight: 48,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ fontSize: 11 }}>
            {enabled ? (hi ? "सूची" : "List") : "3D"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
