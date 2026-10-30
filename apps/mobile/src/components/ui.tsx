import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Platform,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@arihant/design-tokens";
import type { Car } from "@arihant/contracts";
export const stockImages = {
  sonet: require("../../assets/sonet.jpg"),
  seltos: require("../../assets/seltos.jpg"),
  generic: require("../../assets/journey-car.png"),
};
export const logo = require("../../assets/arihant-logo.png");
export const journeyCar = require("../../assets/journey-car.png");
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
function hasDevanagari(value: ReactNode): boolean {
  return React.Children.toArray(value).some((child) =>
    typeof child === "string"
      ? /[\u0900-\u097f]/u.test(child)
      : React.isValidElement<{ children?: ReactNode }>(child)
        ? hasDevanagari(child.props.children)
        : false,
  );
}
export function Text({ style, ...props }: TextProps) {
  const typography = StyleSheet.flatten(style);
  const fontSize = typography?.fontSize ?? 14;
  const devanagari = hasDevanagari(props.children);
  return (
    <NativeText
      {...props}
      style={[
        {
          fontFamily: "Jakarta",
          color: colors.white,
          fontSize,
          lineHeight: typography?.lineHeight ?? Math.ceil(fontSize * 1.5),
        },
        style,
        // Jakarta has no Devanagari glyphs; use native Hindi/Marathi metrics.
        devanagari && {
          fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
        },
      ]}
    >
      {props.children}
      {/* Android can omit the final shaped word despite measuring its width.
          A trailing space avoids this upstream bug (react-native#57110). */}
      {devanagari && Platform.OS === "android" ? " " : null}
    </NativeText>
  );
}
export function Icon({
  name,
  size = 22,
  color = colors.white,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  label,
  accessibilityLabel,
  onPress,
  icon,
  secondary = false,
  busy = false,
  disabled = false,
  selected,
  style,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || busy, busy, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.48 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}
// Preserve each button's intrinsic label width. Equal flex widths can split
// even a single word; wrapping the whole control also respects large text.
export function ActionRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: 10,
          minWidth: 0,
        },
        style,
      ]}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<{ style?: StyleProp<ViewStyle> }>(child))
          return child;
        if (child.type !== Button && child.type !== Text) return child;
        return React.cloneElement(child, {
          style: [
            child.props.style,
            {
              flex: 0,
              flexBasis: "auto",
              flexGrow: 1,
              flexShrink: child.type === Button ? 0 : 1,
              maxWidth: "100%",
            },
          ],
        });
      })}
    </View>
  );
}
export function Pill({
  label,
  warning = false,
}: {
  label: string;
  warning?: boolean;
}) {
  return (
    <View style={[s.pill, warning && { backgroundColor: "#49351c" }]}>
      <Text style={[s.pillText, warning && { color: colors.amber }]}>
        {warning ? "◷ " : ""}
        {label}
      </Text>
    </View>
  );
}
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.panel, style]}>{children}</View>;
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Panel style={{ borderColor: "#995058", gap: 10 }}>
      <Text style={{ color: "#ffd4d7" }}>{message}</Text>
      {retry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={retry}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon name="refresh-outline" />
          <Text>Try again</Text>
        </Pressable>
      ) : null}
    </Panel>
  );
}
export function CarThumb({ car, size = 70 }: { car: Car; size?: number }) {
  return (
    <Image
      source={stockImages[car.imageKey]}
      accessibilityLabel={`${car.make} ${car.model} ${car.registration}`}
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        backgroundColor: "#292929",
        resizeMode: car.imageKey === "generic" ? "contain" : "cover",
      }}
    />
  );
}
export const s = StyleSheet.create({
  button: {
    minHeight: 59,
    borderRadius: 12,
    backgroundColor: colors.red,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16,
    flexShrink: 1,
    textAlign: "center",
  },
  panel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
  },
  pill: {
    maxWidth: "100%",
    flexShrink: 1,
    backgroundColor: "#323232",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, color: "#eee", lineHeight: 17 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: "600", letterSpacing: -1 },
  muted: { color: colors.muted },
  label: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    lineHeight: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  content: { padding: 20, gap: 17, paddingBottom: 35 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 54,
    padding: 15,
    color: "#fff",
    fontFamily: "Jakarta",
    fontSize: 15,
  },
  divider: { height: 1, backgroundColor: colors.line },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
});
