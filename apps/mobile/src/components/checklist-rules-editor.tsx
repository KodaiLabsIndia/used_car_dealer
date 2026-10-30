import React, { useState } from "react";
import { View } from "react-native";
import type { ChecklistItem } from "@arihant/contracts";
import { useApp } from "../state/app-context";
import { zones } from "../application/inspection-index";
import { inspectionParts } from "../application/inspection-parts";
import { SectionTabs, SelectField } from "./workspace";
import { Choice, Field } from "./forms";
import { Text, s } from "./ui";

export function ChecklistRulesEditor({
  item,
  onChange,
  disabled,
}: {
  item: ChecklistItem;
  onChange: (patch: Partial<ChecklistItem>) => void;
  disabled: boolean;
}) {
  const { language } = useApp(),
    hi = language === "hi";
  const tr = (en: string, h: string, mr: string) =>
    language === "mr" ? mr : hi ? h : en;
  const [group, setGroup] = useState<"mapping" | "proof" | "applicability">(
    "mapping",
  );
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.label}>
        {tr("Check rules", "जाँच के नियम", "तपासणीचे नियम")}
      </Text>
      <SectionTabs
        selected={group}
        onChange={(value) => setGroup(value as typeof group)}
        disabled={disabled}
        items={[
          {
            id: "mapping",
            label: tr("Mapping", "हिस्सा", "भाग"),
            icon: "car-outline",
          },
          {
            id: "proof",
            label: tr("Proof rules", "सबूत के नियम", "पुराव्याचे नियम"),
            icon: "camera-outline",
          },
          {
            id: "applicability",
            label: tr("Applies to", "किन गाड़ियों पर", "कोणत्या गाड्यांना"),
            icon: "options-outline",
          },
        ]}
      />
      {group === "mapping" ? (
        <>
          <SelectField
            label={tr("Section", "विभाग", "विभाग")}
            value={item.zone}
            options={zones.map(([id, en, h]) => ({ id, label: hi ? h : en }))}
            disabled={disabled}
            onChange={(zone) =>
              onChange({ zone: zone as ChecklistItem["zone"] })
            }
          />
          <SelectField
            label={tr(
              "Car part / 3D pointer",
              "गाड़ी का हिस्सा / 3D बिंदु",
              "गाडीचा भाग / 3D बिंदू",
            )}
            value={item.componentId}
            options={Object.entries(inspectionParts).map(([id, [en, h]]) => ({
              id,
              label: hi ? h : en,
            }))}
            disabled={disabled}
            onChange={(componentId) => onChange({ componentId })}
          />
          <SelectField
            label={tr("Inspection method", "जाँच का तरीका", "तपासणीची पद्धत")}
            value={item.method}
            options={(
              [
                "visual",
                "function",
                "measurement",
                "document",
                "diagnostic",
                "road_test",
              ] as const
            ).map((id) => ({ id, label: id }))}
            disabled={disabled}
            onChange={(method) =>
              onChange({ method: method as ChecklistItem["method"] })
            }
          />
        </>
      ) : null}
      {group === "proof" ? (
        <>
          <Choice
            label={tr(
              "Safety-critical finding",
              "सुरक्षा की गंभीर समस्या",
              "सुरक्षेची गंभीर समस्या",
            )}
            selected={item.critical}
            onPress={() => !disabled && onChange({ critical: !item.critical })}
          />
          <Choice
            label={tr(
              "Video proof required as well as photo",
              "फोटो के साथ वीडियो भी ज़रूरी",
              "फोटोसोबत व्हिडिओही आवश्यक",
            )}
            selected={item.requiresClip}
            onPress={() =>
              !disabled && onChange({ requiresClip: !item.requiresClip })
            }
          />
          <SelectField
            label={tr(
              "Required measurement unit",
              "ज़रूरी माप की इकाई",
              "आवश्यक मोजमापाचे एकक",
            )}
            value={item.measurementUnit ?? "none"}
            options={[
              {
                id: "none",
                label: tr("No measurement", "माप नहीं", "मोजमाप नाही"),
              },
              ...["mm", "psi", "V", "km"].map((id) => ({ id, label: id })),
            ]}
            disabled={disabled}
            onChange={(unit) =>
              onChange({
                measurementUnit:
                  unit === "none"
                    ? null
                    : (unit as ChecklistItem["measurementUnit"]),
              })
            }
          />
        </>
      ) : null}
      {group === "applicability" ? (
        <>
          <Text style={s.label}>
            {tr(
              "Vehicle applicability · leave empty for all",
              "किन गाड़ियों पर लागू · सभी के लिए खाली रखें",
              "कोणत्या गाड्यांना लागू · सर्वांसाठी रिकामे ठेवा",
            )}
          </Text>
          <Text style={s.muted}>
            {tr(
              "Unknown equipment requires confirmation during inspection. Rules never remove proof already recorded.",
              "अज्ञात उपकरण की जाँच में पुष्टि चाहिए। नियम पहले दर्ज सबूत नहीं हटाते।",
              "अज्ञात उपकरणाची तपासणीवेळी खात्री करावी. नियम आधीचे पुरावे काढत नाहीत.",
            )}
          </Text>
          {(
            [
              {
                key: "fuels",
                label: tr("Fuel types", "ईंधन", "इंधन"),
                values: [
                  "petrol",
                  "diesel",
                  "cng",
                  "lpg",
                  "hybrid",
                  "electric",
                ],
              },
              {
                key: "transmissions",
                label: tr("Transmission types", "गियरबॉक्स", "गिअरबॉक्स"),
                values: ["manual", "automatic", "amt", "cvt", "dct"],
              },
            ] as const
          ).map(({ key, label, values }) => (
            <View key={key} style={{ gap: 6 }}>
              <Text>{label}</Text>
              {values.map((id) => (
                <Choice
                  key={id}
                  label={id}
                  selected={item.applicability[key].includes(id)}
                  onPress={() =>
                    !disabled &&
                    onChange({
                      applicability: {
                        ...item.applicability,
                        [key]: item.applicability[key].includes(id)
                          ? item.applicability[key].filter((v) => v !== id)
                          : [...item.applicability[key], id],
                      },
                    })
                  }
                />
              ))}
            </View>
          ))}
          <Field
            label={tr(
              "Equipment key · optional",
              "उपकरण की पहचान · वैकल्पिक",
              "उपकरणाची ओळख · ऐच्छिक",
            )}
            value={item.applicability.feature ?? ""}
            maxLength={60}
            editable={!disabled}
            onChangeText={(feature) =>
              onChange({
                applicability: {
                  ...item.applicability,
                  feature: feature.trim() || null,
                },
              })
            }
          />
        </>
      ) : null}
    </View>
  );
}
