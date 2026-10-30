import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import { GarageHeader } from "./header";

// Width, rather than device model, also handles rotation and tablet split view.
export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const tablet = width >= 768;
  return {
    width,
    height,
    fontScale,
    tablet,
    split: width >= 900 && fontScale < 1.5,
    columns: width >= 1000 && fontScale < 1.5 ? 2 : 1,
    gutter: tablet ? 28 : 20,
  };
}
export function ContentScroll({
  children,
  narrow = false,
  contentContainerStyle,
  ...props
}: ScrollViewProps & { narrow?: boolean }) {
  const { gutter } = useLayout();
  return (
    <ScrollView
      {...props}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          width: "100%",
          maxWidth: narrow ? 640 : 1280,
          alignSelf: "center",
          padding: gutter,
          gap: 18,
          paddingBottom: 36,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
export function Split({
  first,
  second,
  style,
}: {
  first: ReactNode;
  second: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { split } = useLayout();
  return (
    <View
      style={[
        {
          flexDirection: split ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 18 }}>{first}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 18 }}>{second}</View>
    </View>
  );
}
export function FormRow({ children }: { children: ReactNode }) {
  const { fontScale } = useLayout();
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, minWidth: 0 }}
    >
      {React.Children.toArray(children).map((child, i) => (
        <View
          key={React.isValidElement(child) && child.key != null ? child.key : i}
          style={{
            flexBasis: 190 * fontScale,
            flexGrow: 1,
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
export function RecordRow({ children }: { children: ReactNode }) {
  const { width, fontScale } = useLayout();
  const stack = width < 700 && fontScale >= 1.3;
  return (
    <View
      style={{
        flexDirection: stack ? "column" : "row",
        alignItems: stack ? "flex-start" : "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      {React.Children.map(children, (child) => {
        if (
          !stack ||
          !React.isValidElement<{
            style?: StyleProp<ViewStyle>;
            name?: string;
          }>(child)
        )
          return child;
        if (child.props.name?.startsWith("chevron")) return null;
        if (child.type === View)
          return React.cloneElement(child, {
            style: [child.props.style, { flex: 0, width: "100%", minWidth: 0 }],
          });
        return child;
      })}
    </View>
  );
}

export function CaptureLayout({
  camera,
  controls,
}: {
  camera: ReactNode;
  controls: ReactNode;
}) {
  const { width, height } = useLayout();
  const horizontal = width > height && width >= 600;
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        flexDirection: horizontal ? "row" : "column",
      }}
    >
      <View style={{ flex: 1, minWidth: 0, minHeight: 100 }}>{camera}</View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{
          flexGrow: 0,
          flexShrink: 1,
          ...(horizontal
            ? { width: Math.min(320, width * 0.4) }
            : { maxHeight: height * 0.48 }),
        }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {controls}
      </ScrollView>
    </View>
  );
}
export function CardGrid({ children }: { children: ReactNode }) {
  const { columns } = useLayout();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {React.Children.toArray(children).map((child, i) => (
        <View
          key={React.isValidElement(child) && child.key != null ? child.key : i}
          style={{
            width: columns === 2 ? "48%" : "100%",
            flexGrow: 1,
            maxWidth: columns === 2 ? "48.8%" : "100%",
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
export function WorkScreen({
  title,
  children,
  narrow = false,
}: {
  title: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GarageHeader back title={title} />
      <ContentScroll narrow={narrow}>{children}</ContentScroll>
    </KeyboardAvoidingView>
  );
}
