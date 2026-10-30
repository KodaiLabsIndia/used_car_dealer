import React from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@arihant/design-tokens";
import { Icon, Text, s, type IconName } from "./ui";
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#999"
        style={s.input}
        {...props}
      />
    </View>
  );
}
export function Choice({
  label,
  detail,
  selected,
  onPress,
  icon = "ellipse-outline",
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 60,
        padding: 14,
        borderRadius: 12,
        backgroundColor: selected ? "#422024" : colors.card,
        borderWidth: 1,
        borderColor: selected ? "#ef5961" : colors.line,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      }}
    >
      <Icon
        name={selected ? "checkmark-circle" : icon}
        color={selected ? "#ff7c83" : "#ccc"}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600" }}>{label}</Text>
        {detail ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
