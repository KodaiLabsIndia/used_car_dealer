import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useApp } from "../state/app-context";
import { useReducedMotion } from "./garage-motion";
import { Icon, Text } from "./ui";
export function ActionFeedback() {
  const { feedback } = useApp(),
    reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!feedback) {
      opacity.setValue(0);
      return;
    }
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [feedback?.id, reduced]);
  if (!feedback) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: "center",
        opacity,
        transform: reduced
          ? []
          : [
              {
                translateY: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          maxWidth: 650,
          backgroundColor: "#243C2E",
          borderWidth: 1,
          borderColor: "#628A6E",
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="checkmark-circle-outline" color="#ADE0B8" />
        <Text style={{ fontSize: 14, color: "#E9F8EB", flexShrink: 1 }}>
          {feedback.message}
        </Text>
      </View>
    </Animated.View>
  );
}
