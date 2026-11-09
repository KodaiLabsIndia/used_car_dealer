import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import {
  StackActions,
  type NavigationContainerRefWithCurrent,
} from "@react-navigation/native";
import { useLayout } from "./layout";
import { Icon, Text, type IconName } from "./ui";
import { useApp } from "../state/app-context";
import { can } from "../application/access";
import {
  mainDestination,
  mainSection,
  type CurrentScreen,
  type MainSection,
} from "../application/main-navigation";
import type { RootStack } from "../navigation";
export function MainNavigation({
  navigation,
  screen,
  rail,
}: {
  navigation: NavigationContainerRefWithCurrent<RootStack>;
  screen: CurrentScreen;
  rail: boolean;
}) {
  const { session, language } = useApp(),
    { fontScale, width } = useLayout();
  const oversight = can(session!.actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const selected = mainSection(screen, oversight);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const entries: { id: MainSection; label: string; icon: IconName }[] =
    oversight
      ? [
          {
            id: "home",
            label: tr("Home", "होम", "मुख्य"),
            icon: "home-outline",
          },
          {
            id: "cars",
            label: tr("Cars", "गाड़ियाँ", "गाड्या"),
            icon: "car-sport-outline",
          },
          {
            id: "work",
            label: tr("Work", "काम", "काम"),
            icon: "clipboard-outline",
          },
          {
            id: "staff",
            label: tr("Staff", "कर्मचारी", "कर्मचारी"),
            icon: "people-outline",
          },
          {
            id: "review",
            label: tr("Review", "समीक्षा", "तपासा"),
            icon: "checkmark-done-circle-outline",
          },
        ]
      : [
          {
            id: "home",
            label: tr("Home", "होम", "मुख्य"),
            icon: "home-outline",
          },
          {
            id: "work",
            label: tr("My work", "मेरा काम", "माझे काम"),
            icon: "clipboard-outline",
          },
          { id: "me", label: tr("Me", "मैं", "मी"), icon: "person-outline" },
        ];
  if (screen.name === "Scan" || (keyboard && !rail)) return null;
  const large = fontScale >= 1.5;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: rail ? 174 : undefined,
        flexDirection: rail ? "column" : "row",
        flexWrap: large && !rail ? "wrap" : "nowrap",
        gap: 4,
        padding: 7,
        backgroundColor: "#101010",
        borderColor: "#383836",
        borderTopWidth: rail ? 0 : 1,
        borderRightWidth: rail ? 1 : 0,
      }}
    >
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="tab"
          accessibilityLabel={entry.label}
          accessibilityState={{ selected: selected === entry.id }}
          onPress={() => {
            const destination = mainDestination(entry.id);
            if (!navigation.isReady()) return;
            const exists = navigation
              .getRootState()
              ?.routes.some((r) => r.name === destination.name);
            if (exists)
              navigation.dispatch(
                StackActions.popTo(destination.name, destination.params),
              );
            else
              navigation.dispatch({ type: "NAVIGATE", payload: destination });
          }}
          style={{
            flex: rail || large ? undefined : 1,
            ...(large && !rail
              ? {
                  flexBasis: oversight ? ("30%" as const) : ("30%" as const),
                  flexGrow: 1,
                }
              : {}),
            minWidth: 0,
            minHeight: 58,
            paddingHorizontal: 3,
            paddingVertical: 8,
            gap: 4,
            borderRadius: 13,
            flexDirection: rail ? "row" : "column",
            alignItems: "center",
            justifyContent: rail ? "flex-start" : "center",
            backgroundColor: selected === entry.id ? "#392327" : "transparent",
          }}
        >
          <Icon
            name={entry.icon}
            size={22}
            color={selected === entry.id ? "#FF9FA4" : "#AAA7A2"}
          />
          <Text
            style={{
              fontSize: width < 380 && oversight ? 11 : 12,
              fontWeight: selected === entry.id ? "600" : "400",
              flexShrink: 1,
              textAlign: "center",
              color: selected === entry.id ? "#FFF" : "#AAA7A2",
            }}
          >
            {entry.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
