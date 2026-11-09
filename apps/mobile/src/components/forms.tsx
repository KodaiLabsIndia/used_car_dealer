import React, { useState, type Ref, type ComponentRef } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { uxText } from "../state/ux-copy";
import { Icon, Text, s, type IconName } from "./ui";
export function Field({
  label,
  inputRef,
  helper,
  error,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...props
}: TextInputProps & {
  label: string;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  helper?: string | undefined;
  error?: string | undefined;
}) {
  const { language } = useApp();
  const [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false);
  const toggle = visible
    ? uxText(language, "Hide password", "पासवर्ड छिपाएँ")
    : uxText(language, "Show password", "पासवर्ड दिखाएँ");
  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      <Text
        style={{
          fontWeight: "600",
          color: error ? "#FFC0C5" : focused ? "#F6C3C5" : "#F4F0EC",
        }}
      >
        {label}
      </Text>
      <View style={{ position: "relative" }}>
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          accessibilityHint={helper ?? props.accessibilityHint}
          placeholderTextColor="#AAA7A2"
          secureTextEntry={secureTextEntry && !visible}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            s.input,
            props.multiline
              ? { minHeight: 104, textAlignVertical: "top" }
              : undefined,
            {
              borderColor: error
                ? "#EC8F99"
                : focused
                  ? "#E58087"
                  : colors.line,
            },
            secureTextEntry ? { paddingRight: 60 } : undefined,
            style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toggle}
            accessibilityState={{ selected: visible }}
            onPress={() => setVisible((v) => !v)}
            style={{
              position: "absolute",
              right: 5,
              top: 4,
              minWidth: 44,
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={visible ? "eye-off-outline" : "eye-outline"}
              color="#D8C6C4"
              size={21}
            />
          </Pressable>
        ) : null}
      </View>
      {helper ? (
        <Text style={{ fontSize: 12, color: "#AAA7A2" }}>{helper}</Text>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 12, color: "#FFC0C5" }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function Choice({
  label,
  detail,
  selected,
  onPress,
  icon = "ellipse-outline",
  disabled = false,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        padding: 13,
        borderRadius: 13,
        backgroundColor: selected ? "#3D262B" : colors.card,
        borderWidth: 1,
        borderColor: selected ? "#D87F88" : colors.line,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        opacity: pressed ? 0.8 : disabled ? 0.6 : 1,
      })}
    >
      <Icon
        name={selected ? "checkmark-circle" : icon}
        color={selected ? "#FFAFB7" : "#CCC"}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: "600" }}>{label}</Text>
        {detail ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
