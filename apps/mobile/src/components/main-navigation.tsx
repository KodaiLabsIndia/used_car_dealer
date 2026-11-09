import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Keyboard,
  Pressable,
  View,
} from "react-native";
import {
  StackActions,
  type NavigationContainerRefWithCurrent,
} from "@react-navigation/native";
import { useResource } from "../state/use-resource";
import { useReducedMotion } from "./garage-motion";
import { uxText } from "../state/ux-copy";
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
  const {
      session,
      language,
      api,
      working,
      keyboardVisible: keyboard,
    } = useApp(),
    { fontScale, width } = useLayout();
  const oversight = can(session!.actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const selected = mainSection(screen, oversight);
  const reviews = useResource<Awaited<ReturnType<typeof api.decisions>> | null>(
    `navigation:reviews:${oversight}`,
    () => (oversight ? api.decisions(0) : Promise.resolve(null)),
  );
  const reduced = useReducedMotion(),
    scale = useRef(new Animated.Value(1)).current,
    previousCount = useRef<number | null>(null);
  const reviewCount = reviews.data?.total ?? 0;
  useEffect(() => {
    if (!oversight) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") reviews.refreshQuiet();
    }, 30000);
    return () => clearInterval(timer);
  }, [oversight, session?.actor.id]);
  useEffect(() => {
    if (!reviews.data) return;
    scale.setValue(1);
    const before = previousCount.current;
    previousCount.current = reviewCount;
    if (reduced || before === null || reviewCount <= before) return;
    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.15,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      scale.setValue(1);
    };
  }, [reviewCount, reduced]);

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
          accessibilityState={{
            selected: selected === entry.id,
            disabled: working,
          }}
          accessibilityHint={
            entry.id === "review"
              ? tr(
                  `${reviewCount} requests waiting`,
                  `${reviewCount} अनुरोध बाकी`,
                  `${reviewCount} विनंत्या बाकी`,
                )
              : undefined
          }
          disabled={working}
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
          <View style={{ position: "relative" }}>
            {working && selected === entry.id ? (
              <ActivityIndicator color="#FFC2C9" size="small" />
            ) : (
              <Icon
                name={entry.icon}
                size={22}
                color={selected === entry.id ? "#FF9FA4" : "#AAA7A2"}
              />
            )}
            {entry.id === "review" && reviewCount > 0 ? (
              <Animated.View
                style={{
                  position: "absolute",
                  right: -14,
                  top: -7,
                  minWidth: 19,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  backgroundColor: "#B92F3C",
                  alignItems: "center",
                  transform: [{ scale }],
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    lineHeight: 16,
                    color: "#FFF",
                    fontWeight: "600",
                  }}
                >
                  {reviewCount > 99 ? "99+" : reviewCount}
                </Text>
              </Animated.View>
            ) : null}
          </View>
          <Text
            style={{
              fontSize: width < 380 && oversight ? 11 : 12,
              fontWeight: selected === entry.id ? "600" : "400",
              flexShrink: 1,
              textAlign: "center",
              color: selected === entry.id ? "#FFF" : "#AAA7A2",
            }}
          >
            {working && selected === entry.id
              ? uxText(language, "Please wait", "कृपया रुकें")
              : entry.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
