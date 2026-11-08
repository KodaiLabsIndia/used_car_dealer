import React from "react";
import { Pressable, View } from "react-native";
import { colors } from "@arihant/design-tokens";
import { useLayout } from "./layout";
import { Icon, Text, type IconName } from "./ui";
export const operationColors = {
  ink: "#F6F3EE",
  muted: "#AAA7A2",
  card: "#222221",
  line: "#383836",
  accent: "#F0676C",
};
export function WorkHeading({
  title,
  kicker,
  action,
  onPress,
}: {
  title: string;
  kicker?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ gap: 5 }}>
      {kicker ? (
        <Text
          style={{
            color: operationColors.accent,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: "600",
          }}
        >
          {kicker}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "600",
            color: operationColors.ink,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {title}
        </Text>
        {action && onPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: "#E8ACA8", fontSize: 12 }}>{action} →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
export function WorkRow({
  title,
  detail,
  icon,
  onPress,
  stamp,
  tone = "normal",
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
  stamp?: string | undefined;
  tone?: "normal" | "success" | "warning";
}) {
  const color =
    tone === "success"
      ? colors.green
      : tone === "warning"
        ? colors.amber
        : "#E7B3AB";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 17,
        minHeight: 84,
        borderRadius: 18,
        backgroundColor: pressed ? "#332B29" : operationColors.card,
        gap: 8,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: tone === "success" ? "#294232" : "#342E2B",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              width: "100%",
              flexShrink: 1,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: operationColors.muted,
              width: "100%",
            }}
          >
            {detail}
          </Text>
        </View>
        <Icon
          name="chevron-forward-outline"
          color={operationColors.muted}
          size={17}
        />
      </View>
      {stamp ? (
        <Text style={{ fontSize: 11, color, paddingLeft: 53 }}>{stamp}</Text>
      ) : null}
    </Pressable>
  );
}
export function WorkGrid({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useLayout();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {React.Children.toArray(children).map((child, i) => (
        <View
          key={i}
          style={{
            flexBasis: width < 600 || fontScale >= 1.3 ? "100%" : "46%",
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
export function WorkEmpty({
  title,
  detail,
  icon = "checkmark-done-circle-outline",
}: {
  title: string;
  detail: string;
  icon?: IconName;
}) {
  return (
    <View
      style={{
        backgroundColor: "#242925",
        borderRadius: 22,
        padding: 24,
        gap: 10,
      }}
    >
      <Icon name={icon} color={colors.green} size={30} />
      <Text style={{ fontSize: 20, fontWeight: "600", width: "100%" }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: operationColors.muted }}>
        {detail}
      </Text>
    </View>
  );
}
export function WorkNavigation<T extends string>({
  items,
  selected,
  onChange,
  rail,
}: {
  items: { id: T; label: string; icon: IconName }[];
  selected: T;
  onChange: (id: T) => void;
  rail: boolean;
}) {
  const { fontScale } = useLayout();
  const large = fontScale >= 1.3;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: rail ? 196 : undefined,
        flexDirection: rail ? "column" : "row",
        flexWrap: rail ? "nowrap" : "wrap",
        gap: rail ? 8 : 4,
        padding: rail ? 14 : 8,
        backgroundColor: "#101010",
        borderColor: "#30302E",
        borderRightWidth: rail ? 1 : 0,
        borderTopWidth: rail ? 0 : 1,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: selected === item.id }}
          onPress={() => onChange(item.id)}
          style={{
            flex: rail || large ? undefined : 1,
            ...(!rail && large
              ? { flexBasis: "46%" as const, flexGrow: 1 }
              : {}),
            minWidth: 0,
            minHeight: 64,
            padding: rail ? 12 : 4,
            borderRadius: 16,
            flexDirection: rail || large ? "row" : "column",
            alignItems: "center",
            justifyContent: rail ? "flex-start" : "center",
            gap: 6,
            backgroundColor: selected === item.id ? "#342024" : "transparent",
          }}
        >
          <Icon
            name={item.icon}
            color={selected === item.id ? "#FF9598" : operationColors.muted}
            size={23}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: selected === item.id ? "600" : "400",
              color:
                selected === item.id
                  ? operationColors.ink
                  : operationColors.muted,
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
