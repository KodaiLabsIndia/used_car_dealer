import React, { useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import type { Navigation } from "../navigation";
import { Icon, logo, Text, s } from "./ui";
import { can } from "../application/access";
import { NightDrive } from "./garage-motion";
export function GarageHeader({
  back = false,
  title,
  onBack,
}: {
  back?: boolean;
  title?: string;
  onBack?: (() => void) | undefined;
}) {
  const { session, t, working } = useApp(),
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
            disabled={working}
            accessibilityState={{ disabled: working }}
            onPress={() =>
              onBack
                ? onBack()
                : nav.canGoBack()
                  ? nav.goBack()
                  : nav.navigate("Home")
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
        {session && !can(session.actor, "overview") ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("help")}
            disabled={working}
            accessibilityState={{ disabled: working }}
            onPress={() => nav.navigate("Help")}
            style={{
              minHeight: 44,
              paddingHorizontal: 6,
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Icon name="help-circle-outline" size={22} />
            <Text style={{ fontSize: 11 }}>{t("help")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("settings")}
          disabled={working}
          accessibilityState={{ disabled: working }}
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
