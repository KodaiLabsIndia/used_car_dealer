import React from "react";
import { Pressable, View } from "react-native";
import type { RoutineItem } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import { routinePhase, nextRoutineStep } from "../application/work-overview";
import { useApp } from "../state/app-context";
import { Icon, Text } from "./ui";
import { operationColors } from "./operations";
export function RoutineCard({
  item,
  onPress,
  showPerson = false,
}: {
  item: RoutineItem;
  onPress: () => void;
  showPerson?: boolean;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const phase = routinePhase(item);
  const done = phase === "finished";
  const next = nextRoutineStep(item);
  const status = done
    ? tr("Finished", "पूरा हुआ", "पूर्ण")
    : phase === "in_progress"
      ? tr("Continue", "आगे करें", "पुढे करा")
      : phase === "not_due"
        ? tr("Not due today", "आज नहीं करना", "आज करायचे नाही")
        : tr("Ready to start", "शुरू करें", "सुरू करा");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.definition.title}, ${item.assigneeName}`}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: done ? "#3E5948" : operationColors.line,
        backgroundColor: pressed ? "#302C28" : operationColors.card,
        gap: 14,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: done ? "#294232" : "#3B2D27",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={done ? "checkmark-done-outline" : "repeat-outline"}
            color={done ? colors.green : "#E8BCA1"}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", width: "100%" }}>
            {item.definition.title}
          </Text>
          {showPerson ? (
            <Text style={{ fontSize: 12, color: operationColors.muted }}>
              {item.assigneeName}
            </Text>
          ) : null}
        </View>
        <Icon
          name="chevron-forward-outline"
          size={18}
          color={operationColors.muted}
        />
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 4,
          backgroundColor: operationColors.line,
        }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 4,
            width: `${(item.completedSteps.length / item.definition.steps.length) * 100}%`,
            backgroundColor: done ? colors.green : colors.red,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 12, color: done ? colors.green : "#E8BCA1" }}>
          {status}
        </Text>
        <Text style={{ fontSize: 12, color: operationColors.muted }}>
          {item.completedSteps.length}/{item.definition.steps.length}{" "}
          {tr("steps", "चरण", "टप्पे")}
        </Text>
      </View>
      {next >= 0 && item.dueToday ? (
        <Text
          style={{ fontSize: 13, color: operationColors.muted, width: "100%" }}
        >
          {tr("Next", "अगला", "पुढील")}: {item.definition.steps[next]}
        </Text>
      ) : null}
    </Pressable>
  );
}
