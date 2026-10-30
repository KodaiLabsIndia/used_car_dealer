import React, { useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@arihant/design-tokens";
import { localDateInput } from "../application/payment-date";
import { useLayout } from "./layout";
import { useApp } from "../state/app-context";
import { Button, Icon, Text, s } from "./ui";

function localDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]) - 1,
    day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  return year >= 1900 &&
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
}

// Calendar values remain date-only strings; a timezone conversion must not move
// a selected payment/follow-up to the preceding day. Server policy still decides
// which dates are valid for each business action.
export function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { width, fontScale } = useLayout();
  const stackMonth = width < 360 || fontScale >= 1.5;
  const { language } = useApp(),
    hi = language === "hi",
    locale = hi ? "hi-IN" : "en-IN";
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(() => new Date());
  const selected = localDay(value);
  const full = (date: Date) =>
    date.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  function pick(date: Date | null) {
    onChange(date ? localDateInput(date) : "");
    setOpen(false);
  }
  function move(months: number) {
    const next = new Date(
      month.getFullYear(),
      month.getMonth() + months,
      1,
      12,
    );
    if (next.getFullYear() >= 1900 && next.getFullYear() <= 9999)
      setMonth(next);
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
    12,
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((first.getDay() + count) / 7) * 7 },
    (_, i) => i - first.getDay() + 1,
  );
  const arrow = (label: string, months: number, back: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => move(months)}
      style={{
        minHeight: 48,
        minWidth: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: colors.card,
      }}
    >
      <Icon name={back ? "chevron-back" : "chevron-forward"} />
    </Pressable>
  );
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontWeight: "600" }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? full(selected) : hi ? "तारीख चुनें" : "Choose date"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setMonth(selected ?? new Date());
          setOpen(true);
        }}
        style={[
          s.input,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Icon name="calendar-outline" />
        <Text style={{ flex: 1 }}>
          {selected
            ? full(selected)
            : value
              ? hi
                ? "तारीख फिर चुनें"
                : "Choose date again"
              : hi
                ? "तारीख चुनें"
                : "Choose date"}
        </Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <ScrollView
            contentContainerStyle={{
              padding: 20,
              gap: 16,
              width: "100%",
              maxWidth: 600,
              alignSelf: "center",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 24, lineHeight: 34, fontWeight: "600" }}
            >
              {label}
            </Text>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {arrow(hi ? "पिछला साल" : "Previous year", -12, true)}
              <Text accessibilityLiveRegion="polite" style={{ fontSize: 20 }}>
                {month.getFullYear()}
              </Text>
              {arrow(hi ? "अगला साल" : "Next year", 12, false)}
            </View>
            {stackMonth ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ fontSize: 20, textAlign: "center" }}
              >
                {month.toLocaleDateString(locale, { month: "long" })}
              </Text>
            ) : null}
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {arrow(hi ? "पिछला महीना" : "Previous month", -1, true)}
              {!stackMonth ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ fontSize: 20, flex: 1, textAlign: "center" }}
                >
                  {month.toLocaleDateString(locale, { month: "long" })}
                </Text>
              ) : null}
              {arrow(hi ? "अगला महीना" : "Next month", 1, false)}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(hi
                ? ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"]
                : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
              ).map((day) => (
                <View
                  key={day}
                  style={{
                    width: `${100 / 7}%`,
                    alignItems: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={{ fontSize: 12, color: colors.muted }}
                  >
                    {day}
                  </Text>
                </View>
              ))}
              {cells.map((day, i) => {
                if (day < 1 || day > count)
                  return (
                    <View
                      key={i}
                      style={{ width: `${100 / 7}%`, minHeight: 48 }}
                    />
                  );
                const date = new Date(
                    month.getFullYear(),
                    month.getMonth(),
                    day,
                    12,
                  ),
                  chosen = localDateInput(date) === value;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={full(date)}
                    accessibilityState={{ selected: chosen }}
                    onPress={() => pick(date)}
                    style={{
                      width: `${100 / 7}%`,
                      minHeight: 48,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      backgroundColor: chosen ? colors.red : "transparent",
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={{
                        fontSize: 17,
                        fontWeight: chosen ? "600" : "400",
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button
              label={hi ? "आज" : "Today"}
              onPress={() => pick(new Date())}
            />
            {value ? (
              <Button
                secondary
                label={hi ? "तारीख हटाएँ" : "Clear date"}
                onPress={() => pick(null)}
              />
            ) : null}
            <Button
              secondary
              label={hi ? "बंद करें" : "Close"}
              onPress={() => setOpen(false)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
