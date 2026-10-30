import React from "react";
import { View } from "react-native";
import type { VehicleConfiguration } from "@arihant/contracts";
import { Text, s } from "./ui";
import { SelectField } from "./workspace";

export function VehicleConfigurationFields({
  value,
  onChange,
  hi,
  disabled = false,
}: {
  value: VehicleConfiguration;
  onChange: (v: VehicleConfiguration) => void;
  hi: boolean;
  disabled?: boolean;
}) {
  const fields = [
    [
      "bodyType",
      hi ? "बॉडी का प्रकार" : "Body type",
      [
        ["sedan", "Sedan", "सेडान"],
        ["hatchback", "Hatchback", "हैचबैक"],
        ["suv", "SUV", "SUV"],
        ["mpv", "MPV / MUV", "MPV / MUV"],
        ["van", "Van", "वैन"],
        ["coupe", "Coupe", "कूपे"],
        ["convertible", "Convertible", "कन्वर्टिबल"],
        ["wagon", "Wagon", "वैगन"],
        ["pickup", "Pickup", "पिकअप"],
      ],
    ],
    [
      "fuel",
      hi ? "ईंधन / मोटर" : "Fuel / powertrain",
      [
        ["petrol", "Petrol", "पेट्रोल"],
        ["diesel", "Diesel", "डीज़ल"],
        ["electric", "Electric", "इलेक्ट्रिक"],
        ["hybrid", "Hybrid", "हाइब्रिड"],
        ["cng", "CNG", "CNG"],
        ["lpg", "LPG", "LPG"],
      ],
    ],
    [
      "transmission",
      hi ? "गियरबॉक्स" : "Transmission",
      [
        ["manual", "Manual", "मैनुअल"],
        ["automatic", "Automatic", "ऑटोमैटिक"],
        ["amt", "AMT", "AMT"],
        ["cvt", "CVT", "CVT"],
        ["dct", "DCT", "DCT"],
      ],
    ],
  ] as const;
  return (
    <View style={{ gap: 15 }}>
      {fields.map(([key, label, values]) => (
        <SelectField
          key={key}
          label={label}
          value={value[key]}
          disabled={disabled}
          options={[
            { id: "unknown", label: hi ? "अभी पक्का नहीं" : "Not confirmed" },
            ...values.map(([id, en, h]) => ({ id, label: hi ? h : en })),
          ]}
          onChange={(id) => onChange({ ...value, [key]: id })}
        />
      ))}
      <Text style={s.muted}>
        {hi
          ? "जिसकी जानकारी पक्की नहीं, उसकी जाँच नहीं हटेगी। कर्मचारी प्रमाण के साथ पुष्टि करेगा।"
          : "Unconfirmed equipment stays in the inspection for an explicit, evidence-backed decision."}
      </Text>
    </View>
  );
}
