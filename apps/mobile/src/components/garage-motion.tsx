import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors } from "@arihant/design-tokens";
import type { Dashboard, Stage } from "@arihant/contracts";
import { journeyCar, logo, Text, Button, s } from "./ui";
import { useApp } from "../state/app-context";
export const routeStages: Stage[] = [
  "inspection",
  "purchase",
  "refurbishment",
  "ready",
  "delivered",
];
export const stageKeys = {
  inspection: "inspectStage",
  purchase: "purchaseStage",
  refurbishment: "repairStage",
  ready: "readyStage",
  delivered: "deliveredStage",
} as const;
export function useReducedMotion() {
  const [reduced, set] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(set);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", set);
    return () => sub.remove();
  }, []);
  return reduced;
}
export function GarageRoute({
  counts,
  selected,
  onSelect,
}: {
  counts: Dashboard["stages"];
  selected: Stage | null;
  onSelect: (s: Stage | null) => void;
}) {
  const { t } = useApp(),
    reduced = useReducedMotion(),
    x = useRef(new Animated.Value(0)).current,
    [width, setWidth] = useState(300);
  useEffect(() => {
    const target =
      (Math.max(0, routeStages.indexOf(selected || "inspection")) *
        (width - 48)) /
      4;
    if (reduced) x.setValue(target);
    else {
      const a = Animated.spring(x, {
        toValue: target,
        useNativeDriver: true,
        damping: 19,
        stiffness: 130,
        mass: 1,
      });
      a.start();
      return () => a.stop();
    }
  }, [selected, width, reduced]);
  return (
    <View
      style={m.route}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={m.road}>
        <View style={m.dashes} />
      </View>
      <Animated.Image
        source={journeyCar}
        accessible={false}
        style={[
          m.routeCar,
          { transform: [{ translateX: x }, { rotate: "-90deg" }] },
        ]}
      />
      <View style={m.stages}>
        {routeStages.map((stage) => (
          <Pressable
            key={stage}
            accessibilityRole="button"
            accessibilityLabel={`${t(stageKeys[stage])}, ${counts[stage]}`}
            accessibilityState={{ selected: selected === stage }}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onSelect(selected === stage ? null : stage);
            }}
            style={[
              m.stop,
              selected === stage && { borderTopColor: colors.red },
            ]}
          >
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              {counts[stage]}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: selected === stage ? "#fff" : colors.muted,
                lineHeight: 16,
                textAlign: "center",
              }}
            >
              {t(stageKeys[stage])}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function NightDrive({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useApp(),
    reduced = useReducedMotion(),
    distance = useRef(new Animated.Value(0)).current,
    [driving, setDriving] = useState(false);
  useEffect(() => {
    if (!visible || !driving || reduced) {
      distance.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(distance, {
          toValue: 1,
          duration: 1450,
          useNativeDriver: true,
        }),
        Animated.timing(distance, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, driving, reduced]);
  return (
    <Modal
      visible={visible}
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
        <ScrollView
          contentContainerStyle={[
            m.night,
            { width: "100%", maxWidth: 640, alignSelf: "center" },
          ]}
        >
          <Image
            source={logo}
            style={{ width: 98, height: 63, resizeMode: "contain" }}
          />
          <Text style={[s.title, { textAlign: "center", marginTop: 20 }]}>
            {t("nightDrive")}
          </Text>
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 10 }}
          >
            {t("nightHint")}
          </Text>
          <View style={m.nightRoad}>
            <View style={m.roadBorder} />
            <View style={[m.roadBorder, { left: undefined, right: 10 }]} />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Animated.View
                key={i}
                style={{
                  position: "absolute",
                  width: 3,
                  height: 24,
                  backgroundColor: "#ffffff60",
                  left: 88,
                  top: i * 49 - 45,
                  transform: [
                    {
                      translateY: distance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 49],
                      }),
                    },
                  ],
                }}
              />
            ))}
            <Image
              source={journeyCar}
              style={{
                width: 54,
                height: 94,
                position: "absolute",
                left: 63,
                top: 90,
                transform: [{ rotate: "180deg" }],
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("drive")}
            onPressIn={() => {
              setDriving(true);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
            }}
            onPressOut={() => setDriving(false)}
            style={[s.button, { width: "100%" }]}
          >
            <Text style={s.buttonText}>{t("drive")}</Text>
          </Pressable>
          <Button
            label={t("close")}
            secondary
            onPress={onClose}
            style={{ width: "100%", marginTop: 12 }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const m = StyleSheet.create({
  route: { paddingTop: 38 },
  road: {
    position: "absolute",
    top: 13,
    left: 21,
    right: 21,
    height: 15,
    backgroundColor: "#292929",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#505050",
    overflow: "hidden",
  },
  dashes: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#aaa",
    top: 6,
  },
  routeCar: { position: "absolute", left: 13, top: 1, width: 22, height: 38 },
  stages: { flexDirection: "row" },
  stop: {
    flex: 1,
    minHeight: 65,
    padding: 4,
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: colors.line,
    gap: 3,
  },
  night: {
    flexGrow: 1,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  nightRoad: {
    height: 270,
    width: 180,
    backgroundColor: "#232323",
    marginVertical: 25,
    overflow: "hidden",
    borderRadius: 18,
  },
  roadBorder: {
    position: "absolute",
    height: "100%",
    width: 2,
    backgroundColor: colors.red,
    left: 10,
  },
});
