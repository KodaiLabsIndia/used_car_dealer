import React, { useRef, useState } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import type { Navigation } from "../navigation";
import { Icon, logo, Text, s } from "./ui";
import { NightDrive } from "./garage-motion";
export function GarageHeader({
  back = false,
  title,
}: {
  back?: boolean;
  title?: string;
}) {
  const { session, t } = useApp(),
    nav = useNavigation<Navigation>(),
    taps = useRef<number[]>([]),
    [night, setNight] = useState(false);
  function logoPress() {
    if (session?.actor.role !== "owner") return;
    const now = Date.now();
    taps.current = [...taps.current.filter((v) => now - v < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setNight(true);
    }
  }
  return (
    <>
      <View
        style={{
          backgroundColor: colors.black,
          paddingHorizontal: 20,
          width: "100%",
          maxWidth: 1280,
          alignSelf: "center",
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 15,
          borderBottomWidth: 1,
          borderBottomColor: "#282828",
        }}
      >
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={() =>
              nav.canGoBack() ? nav.goBack() : nav.navigate("Home")
            }
            style={s.iconButton}
          >
            <Icon name="arrow-back-outline" />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Arihant Cars"
            onPress={logoPress}
            style={{ minWidth: 80, minHeight: 53, justifyContent: "center" }}
          >
            <Image
              source={logo}
              style={{ width: 80, height: 52, resizeMode: "contain" }}
            />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600" }}>
            {title || session?.actor.name}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted }}>
            {t(session?.actor.role === "owner" ? "all" : "work")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("settings")}
          onPress={() => nav.navigate("Settings")}
          style={s.iconButton}
        >
          <Icon name="person-outline" size={21} />
        </Pressable>
      </View>
      <NightDrive visible={night} onClose={() => setNight(false)} />
    </>
  );
}
export function BottomNav({
  owner,
  onDecisions,
  onHelp,
  onGarage,
  onWork,
  active,
}: {
  owner: boolean;
  onDecisions?: () => void;
  onHelp?: () => void;
  onGarage?: () => void;
  onWork?: () => void;
  active?: "garage" | "work" | "decisions";
}) {
  const nav = useNavigation<Navigation>(),
    { t } = useApp();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.3;
  const entries = owner
    ? [
        {
          name: "speedometer-outline" as const,
          label: t("garage"),
          selected: active === "garage",
          go: () =>
            onGarage ? onGarage() : nav.navigate("Home", { scope: "all" }),
        },
        {
          name: "clipboard-outline" as const,
          label: t("work"),
          selected: active === "work",
          go: () =>
            onWork ? onWork() : nav.navigate("Home", { scope: "mine" }),
        },
        {
          name: "car-sport-outline" as const,
          label: t("cars"),
          selected: false,
          go: () => nav.navigate("Cars"),
        },
        {
          name: "checkmark-done-circle-outline" as const,
          label: t("decisions"),
          selected: active === "decisions",
          go: () =>
            onDecisions
              ? onDecisions()
              : nav.navigate("Home", { scope: "decisions" }),
        },
      ]
    : [
        {
          name: "home-outline" as const,
          label: t("work"),
          selected: true,
          go: () => nav.navigate("Home"),
        },
        {
          name: "qr-code-outline" as const,
          label: t("scan"),
          selected: false,
          go: () => nav.navigate("Scan"),
        },
        {
          name: "help-circle-outline" as const,
          label: t("help"),
          selected: false,
          go: () => onHelp?.(),
        },
      ];
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        backgroundColor: colors.black,
        borderTopWidth: 1,
        borderColor: colors.line,
        padding: 7,
      }}
    >
      {entries.map((e) => (
        <Pressable
          accessibilityRole="button"
          key={e.label}
          accessibilityState={{ selected: e.selected }}
          onPress={e.go}
          style={{
            flex: 1,
            flexBasis: stacked ? "45%" : "20%",
            minWidth: 0,
            minHeight: 55,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Icon
            name={e.name}
            size={22}
            color={e.selected ? "#ff7c83" : "#fff"}
          />
          <Text style={{ fontSize: 11, textAlign: "center", flexShrink: 1 }}>
            {e.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
