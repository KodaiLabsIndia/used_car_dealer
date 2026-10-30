import { FormRow } from "./layout";
import React from "react";
import { View } from "react-native";
import { useApp } from "../state/app-context";
import { DateField } from "./date-field";
import { SelectField } from "./workspace";
import { Text, s } from "./ui";

export function DateTimeField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { language } = useApp(),
    hi = language === "hi";
  const [day = "", time = ""] = value.split(" ");
  const [hour = "", minute = "00"] = time.split(":");
  const canChooseTime = /^\d{4}-\d{2}-\d{2}$/.test(day);
  const writeTime = (h: string, m: string) => onChange(`${day} ${h}:${m}`);
  const hours = Array.from({ length: 24 }, (_, h) => ({
    id: String(h).padStart(2, "0"),
    label: new Date(2026, 0, 1, h).toLocaleTimeString(hi ? "hi-IN" : "en-IN", {
      hour: "numeric",
      hour12: true,
    }),
  }));
  return (
    <View style={{ gap: 12 }}>
      <DateField
        label={label}
        value={day}
        disabled={disabled}
        onChange={(next) => onChange(next ? `${next} ${hour}:${minute}` : "")}
      />
      <FormRow>
        <View style={{ flex: 1 }}>
          <SelectField
            label={hi ? "घंटा" : "Hour"}
            value={hour}
            options={hours}
            disabled={disabled || !canChooseTime}
            onChange={(next) => writeTime(next, minute)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField
            label={hi ? "मिनट" : "Minute"}
            value={minute}
            options={Array.from({ length: 60 }, (_, m) => ({
              id: String(m).padStart(2, "0"),
              label: String(m).padStart(2, "0"),
            }))}
            disabled={disabled || !canChooseTime}
            onChange={(next) => writeTime(hour, next)}
          />
        </View>
      </FormRow>
      <Text style={s.muted}>
        {hi
          ? "पहले तारीख, फिर घंटा और मिनट चुनें। समय इस फोन की स्थानीय घड़ी के अनुसार है।"
          : "Choose the date, then hour and minute. Time uses this phone’s local clock."}
      </Text>
    </View>
  );
}
