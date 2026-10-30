import React from "react";
import { Pressable, View } from "react-native";
import type { Task } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import {
  checkState,
  inspectionProgress,
  zones,
} from "../application/inspection-index";
import { inspectionPartName } from "../application/inspection-parts";
import { useLayout } from "./layout";
import { Button, Icon, Text, s, type IconName } from "./ui";
import { SelectField } from "./workspace";

export const sectionIcons: Record<string, IconName> = {
  identity: "document-text-outline",
  exterior: "car-outline",
  visibility: "eye-outline",
  wheels: "ellipse-outline",
  powertrain: "cog-outline",
  underbody: "construct-outline",
  cabin: "person-outline",
  electrical: "flash-outline",
  safety: "shield-checkmark-outline",
  road_test: "speedometer-outline",
  general: "list-outline",
};
const statusNames = {
  pending: ["Not checked", "जाँच बाकी"],
  recheck: ["Recheck", "दोबारा जाँच"],
  blocked: ["Cannot inspect", "जाँच नहीं हो सकी"],
  issue: ["Issue found", "समस्या"],
  exception: ["N/A · review needed", "लागू नहीं · समीक्षा"],
  done: ["Recorded", "जाँच दर्ज"],
};

export function InspectionSections({
  task,
  index,
  onOpen,
  onFind,
  onFocus,
  zone,
  part,
  setZone,
  setPart,
  hi,
}: {
  task: Task;
  index: number;
  onOpen: (index: number) => void;
  onFind: () => void;
  onFocus: (index: number) => void;
  zone: string | null;
  part: string;
  setZone: (zone: string | null) => void;
  setPart: (part: string) => void;
  hi: boolean;
}) {
  const layout = useLayout(),
    progress = inspectionProgress(task),
    missing = new Set(progress.missing.map((i) => i.id));
  const rows = task.items
    .map((item, i) => ({ item, i }))
    .filter((r) => !zone || r.item.zone === zone);
  const parts = [...new Set(rows.map((r) => r.item.componentId))];
  const activePart = parts.includes(part) ? part : parts[0];
  if (!zone)
    return (
      <View style={{ gap: 12 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={s.label}>
            {hi ? "जाँच के हिस्से" : "Inspection sections"}
          </Text>
          <Text style={s.muted}>
            {progress.completed}/{progress.total}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {zones
            .filter(([id]) => task.items.some((i) => i.zone === id))
            .map(([id, en, h]) => {
              const checks = task.items.filter((i) => i.zone === id),
                pending = checks.filter((i) => missing.has(i.id)).length;
              const issues = checks.filter((i) =>
                task.answers.some(
                  (a) => a.itemId === i.id && a.result === "problem",
                ),
              ).length;
              const cols =
                layout.width < 480 && layout.fontScale >= 1.8
                  ? 1
                  : layout.split
                    ? 4
                    : layout.fontScale >= 1.3
                      ? 2
                      : 3;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`${hi ? h : en}, ${checks.length - pending}/${checks.length}, ${issues} ${hi ? "समस्या" : "issues"}`}
                  onPress={() => {
                    setZone(id);
                    setPart("");
                    const candidates = task.items
                      .map((item, i) => ({ item, i }))
                      .filter((r) => r.item.zone === id);
                    const first =
                      candidates.find((r) => missing.has(r.item.id)) ||
                      candidates[0];
                    if (first) onFocus(first.i);
                  }}
                  style={{
                    width: `${(100 - (cols - 1) * 2.5) / cols}%`,
                    flexGrow: 0,
                    minHeight: 106,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: issues ? colors.red : colors.line,
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    gap: 7,
                  }}
                >
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <Icon name={sectionIcons[id] || "list-outline"} size={23} />
                    {issues ? (
                      <Text style={{ color: "#ffadb3", fontSize: 11 }}>
                        {issues} !
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{ fontSize: 12, lineHeight: 18, fontWeight: "600" }}
                  >
                    {hi ? h : en}
                  </Text>
                  <Text style={[s.muted, { fontSize: 11 }]}>
                    {checks.length - pending}/{checks.length}
                  </Text>
                  <View
                    style={{
                      height: 3,
                      backgroundColor: colors.line,
                      borderRadius: 2,
                    }}
                  >
                    <View
                      style={{
                        height: 3,
                        width: `${checks.length ? ((checks.length - pending) / checks.length) * 100 : 0}%`,
                        backgroundColor: colors.red,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
        </View>
        <Button
          secondary
          icon="search-outline"
          label={hi ? "कोई जाँच ढूँढें" : "Find any check"}
          onPress={onFind}
        />
      </View>
    );
  const section = zones.find(([id]) => id === zone);
  const done = rows.filter((r) => !missing.has(r.item.id)).length;
  return (
    <View style={{ gap: 14 }}>
      <Button
        secondary
        icon="arrow-back-outline"
        label={hi ? "सभी हिस्से" : "All sections"}
        onPress={() => setZone(null)}
      />
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={s.title}>{section?.[hi ? 2 : 1]}</Text>
        <Text style={s.muted}>
          {done}/{rows.length}
        </Text>
      </View>
      <SelectField
        label={hi ? "पुर्जा चुनें" : "Choose a part"}
        value={activePart || ""}
        options={parts.map((id) => {
          const checks = rows.filter((r) => r.item.componentId === id);
          return {
            id,
            label: `${inspectionPartName(id, hi)} · ${checks.filter((r) => !missing.has(r.item.id)).length}/${checks.length}`,
          };
        })}
        onChange={(id) => {
          setPart(id);
          const candidates = rows.filter((r) => r.item.componentId === id);
          const first =
            candidates.find((r) => missing.has(r.item.id)) || candidates[0];
          if (first) onFocus(first.i);
        }}
      />
      {rows
        .filter((r) => r.item.componentId === activePart)
        .map(({ item, i }) => {
          const state = checkState(task, item);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              onPress={() => onOpen(i)}
              style={{
                padding: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: i === index ? colors.red : colors.line,
                backgroundColor: colors.card,
                gap: 8,
                minHeight: 84,
              }}
            >
              <View style={s.row}>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 23 }}>
                  {item.order}. {hi ? item.titleHi : item.title}
                </Text>
                <Icon name="chevron-forward-outline" size={20} />
              </View>
              <Text style={[s.muted, { fontSize: 11 }]}>
                {statusNames[state][hi ? 1 : 0]} ·{" "}
                {item.requiresClip
                  ? hi
                    ? "फोटो + वीडियो"
                    : "Photo + video"
                  : hi
                    ? "फोटो"
                    : "Photo"}
                {item.measurementUnit ? ` · ${item.measurementUnit}` : ""}
                {item.critical ? (hi ? " · सुरक्षा" : " · Safety") : ""}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}
