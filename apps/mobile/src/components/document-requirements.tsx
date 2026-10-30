import React, { useState } from "react";
import { View } from "react-native";
import type { CarRequirements, CarDocument } from "@arihant/contracts";
import { useApp } from "../state/app-context";
import { SelectField } from "./workspace";
import { Button, Panel, Pill, Text, s } from "./ui";

export function DocumentRequirements({
  data,
  pages,
  onLink,
  onAdd,
  onAssign,
  busy,
}: {
  data: CarRequirements;
  pages: CarDocument[];
  busy: boolean;
  onLink: (setId: string, ruleId: string, documentId: string) => Promise<void>;
  onAdd: (binding: string) => void;
  onAssign: (stage: "purchase" | "intake") => Promise<void>;
}) {
  const { language } = useApp(),
    hi = language === "hi";
  const tr = (en: string, h: string, mr: string) =>
    language === "mr" ? mr : hi ? h : en;
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<
    "purchase" | "intake" | "sale" | "delivery"
  >("purchase");
  const [linking, setLinking] = useState("");
  // Saved responses from the previous app version do not include this field.
  const assignableStages = data.assignableStages ?? [];
  const status = {
    missing: tr("Missing", "नहीं मिला", "नाही"),
    pending: tr("Awaiting review", "समीक्षा बाकी", "तपासणी बाकी"),
    rejected: tr("Retake needed", "फिर से चाहिए", "पुन्हा द्या"),
    accepted: tr("Accepted", "मंज़ूर", "स्वीकारले"),
  };
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.title}>
        {tr("Required documents", "ज़रूरी दस्तावेज़", "आवश्यक कागदपत्रे")}
      </Text>
      <SelectField
        label={tr("Stage", "चरण", "टप्पा")}
        value={stage}
        options={[
          { id: "purchase", label: tr("Purchase", "खरीद", "खरेदी") },
          { id: "intake", label: tr("Intake", "प्राप्ति", "ताब्यात घेणे") },
          { id: "sale", label: tr("Sale", "बिक्री", "विक्री") },
          { id: "delivery", label: tr("Delivery", "डिलीवरी", "डिलिव्हरी") },
        ]}
        onChange={(id) => setStage(id as typeof stage)}
      />
      {!data.sets.length && assignableStages.length ? (
        <Text>
          {tr(
            "Assign the current company checklist to this car.",
            "इस गाड़ी को कंपनी की मौजूदा सूची दें।",
            "या गाडीला कंपनीची सध्याची यादी द्या.",
          )}
        </Text>
      ) : null}
      {assignableStages.map((stage) => (
        <Button
          key={stage}
          secondary
          disabled={busy}
          label={
            stage === "purchase"
              ? tr(
                  "Assign purchase documents",
                  "खरीद की सूची दें",
                  "खरेदीची यादी द्या",
                )
              : tr(
                  "Assign intake documents",
                  "प्राप्ति की सूची दें",
                  "गाडी ताब्यात घेण्याची यादी द्या",
                )
          }
          onPress={() => void onAssign(stage)}
        />
      ))}
      {!data.sets.length && !assignableStages.length ? (
        <Text>
          {data.assignableStages
            ? tr(
                "Completed stages retain their original requirements. Later pages can be added as support documents.",
                "पूरे चरण की मूल सूची सुरक्षित है। बाद के पेज सहायक दस्तावेज़ में जोड़ें।",
                "पूर्ण टप्प्यांच्या मूळ अटी कायम राहतात. नंतरची पाने सहाय्यक कागदपत्रे म्हणून जोडा.",
              )
            : tr(
                "Refresh when connected to see which stages can receive a checklist.",
                "किस चरण को सूची दे सकते हैं, देखने के लिए इंटरनेट आने पर ताज़ा करें।",
                "कोणत्या टप्प्याला यादी देता येईल हे पाहण्यासाठी जोडणी आल्यावर पुन्हा लोड करा.",
              )}
        </Text>
      ) : null}
      {data.sets
        .filter((set) => set.stage === stage)
        .map((set) => (
          <View key={set.id} style={{ gap: 12 }}>
            <Text style={s.label}>
              {set.stage} ·{" "}
              {set.policyVersion
                ? `${tr("Version", "संस्करण", "आवृत्ती")} ${set.policyVersion}`
                : tr(
                    "Starter · owner publication pending",
                    "शुरुआती · मालिक की मंज़ूरी बाकी",
                    "सुरुवातीची · मालकाची मंजुरी बाकी",
                  )}
            </Text>
            {set.bookingId ? (
              <Text style={s.muted}>
                {tr("Sale", "बिक्री", "विक्री")} ·{" "}
                {set.bookingLabel ?? set.bookingId.slice(0, 8)}
              </Text>
            ) : null}
            {set.items.map((item) => {
              const key = `${set.id}::${item.rule.id}`;
              return (
                <Panel key={item.rule.id} style={{ gap: 10 }}>
                  <Text style={s.label}>
                    {language === "mr"
                      ? item.rule.titleMr
                      : hi
                        ? item.rule.titleHi
                        : item.rule.title}
                  </Text>
                  <Pill
                    label={`${item.rule.required ? tr("Required", "ज़रूरी", "आवश्यक") : tr("Optional", "वैकल्पिक", "ऐच्छिक")} · ${status[item.status]}`}
                    warning={item.rule.required && item.status !== "accepted"}
                  />
                  {item.rule.applicability ? (
                    <Text>{item.rule.applicability}</Text>
                  ) : null}
                  {item.documentTitle ? (
                    <Text>
                      {item.documentTitle}
                      {item.reviewedByName ? ` · ${item.reviewedByName}` : ""}
                    </Text>
                  ) : null}
                  {!set.locked ? (
                    <>
                      <Button
                        secondary
                        label={tr(
                          "Add proof page",
                          "सबूत का पेज जोड़ें",
                          "पुराव्याचे पान जोडा",
                        )}
                        disabled={busy}
                        onPress={() => onAdd(key)}
                      />
                      {pages.length ? (
                        <Button
                          secondary
                          label={tr(
                            "Use uploaded page",
                            "अपलोड हुआ पेज चुनें",
                            "अपलोड केलेले पान निवडा",
                          )}
                          onPress={() => setLinking(linking === key ? "" : key)}
                        />
                      ) : null}
                      {pages.length && linking === key ? (
                        <>
                          <SelectField
                            label={tr(
                              "Or link an uploaded page",
                              "या अपलोड हुआ पेज जोड़ें",
                              "किंवा अपलोड केलेले पान जोडा",
                            )}
                            value={selected[key] ?? ""}
                            options={pages.map((p) => ({
                              id: p.id,
                              label: `${p.title} · ${p.status}`,
                            }))}
                            onChange={(id) =>
                              setSelected({ ...selected, [key]: id })
                            }
                            disabled={busy}
                          />
                          <Button
                            secondary
                            label={tr(
                              "Link selected page",
                              "चुना पेज जोड़ें",
                              "निवडलेले पान जोडा",
                            )}
                            disabled={busy || !selected[key]}
                            onPress={() =>
                              void onLink(set.id, item.rule.id, selected[key]!)
                            }
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Text style={s.muted}>
                      {tr(
                        "Finalized stage · proof retained",
                        "चरण पूरा · सबूत सुरक्षित",
                        "टप्पा पूर्ण · पुरावा जतन केला",
                      )}
                    </Text>
                  )}
                </Panel>
              );
            })}
          </View>
        ))}
    </View>
  );
}
