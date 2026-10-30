import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import type { Purchase, PurchaseReceipt } from "@arihant/contracts";
import { ActionRow, Button, ErrorNotice, Panel, Text, s } from "./ui";
import { Field, Choice } from "./forms";
import { FocusPage, SelectField, StepHeader } from "./workspace";
import { useSection } from "../state/use-section";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
type Draft = {
  location: string;
  odometer: string;
  fuel: PurchaseReceipt["fuel"];
  keyCount: number;
  accessories: string;
  conditionNote: string;
  hasNewIssue: boolean;
  handoverReference: string;
  templateId: string;
  assignedTo: string;
};
export function PurchaseHandover({
  purchase,
  busy,
  onReceive,
  onOpenIntake,
}: {
  purchase: Purchase;
  busy: boolean;
  onReceive: (receipt: PurchaseReceipt) => Promise<boolean>;
  onOpenIntake: (id: string) => void;
}) {
  const { api, session, language } = useApp(),
    hi = language === "hi",
    ownerId = session!.actor.id,
    key = `handover-form:${purchase.id}`;
  const steps = ["car", "condition", "signoff"] as const;
  const [step, setStep] = useSection(`handover:${purchase.id}`, "car", steps);
  const fuelLabels: Record<PurchaseReceipt["fuel"], string> = {
    unknown: hi ? "पता नहीं" : "Unknown",
    empty: hi ? "खाली" : "Empty",
    quarter: hi ? "एक चौथाई" : "Quarter",
    half: hi ? "आधा" : "Half",
    three_quarters: hi ? "तीन चौथाई" : "Three quarters",
    full: hi ? "पूरा" : "Full",
  };
  const options = useResource(`handover-options:${purchase.id}`, async () => ({
    people: await api.people(),
    templates: (await api.templates()).filter((t) => t.kind === "intake"),
  }));
  const [draft, setDraft] = useState<Draft>({
      location: purchase.car.location,
      odometer: purchase.car.odometerKm?.toString() || "",
      fuel: "unknown",
      keyCount: 1,
      accessories: "",
      conditionNote: "",
      hasNewIssue: false,
      handoverReference: "",
      templateId: "",
      assignedTo: ownerId,
    }),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadLocal<Draft>(ownerId, key)
      .catch(() => null)
      .then((saved) => {
        if (active) {
          if (saved) setDraft(saved);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ownerId, key]);
  function edit<K extends keyof Draft>(field: K, value: Draft[K]) {
    if (busy) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    void saveLocal(ownerId, key, next);
  }
  function confirm() {
    const odometerKm = Number(draft.odometer);
    if (
      !draft.odometer.trim() ||
      !Number.isInteger(odometerKm) ||
      odometerKm < 0 ||
      odometerKm > 3000000 ||
      !draft.location.trim() ||
      !draft.handoverReference.trim() ||
      !draft.templateId ||
      (draft.hasNewIssue && !draft.conditionNote.trim())
    ) {
      setError(
        hi
          ? "जगह, किलोमीटर, हस्तांतरण संदर्भ और जाँच चुनें। नई समस्या है तो उसका विवरण लिखें।"
          : "Check the location, kilometres, handover reference and checklist. Describe any new issue.",
      );
      return;
    }
    setError("");
    const { odometer: _odometer, ...fields } = draft;
    const receipt: PurchaseReceipt = {
      ...fields,
      location: draft.location.trim(),
      handoverReference: draft.handoverReference.trim(),
      odometerKm,
    };
    Alert.alert(
      hi ? "गाड़ी प्राप्त हुई?" : "Car physically received?",
      hi
        ? "दर्ज जानकारी सेव होगी और चुने व्यक्ति को इनटेक जाँच मिलेगी। भुगतान का बाकी अलग रहेगा।"
        : "Save this handover and assign the intake check. Any payment balance stays outstanding.",
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "हस्तांतरण दर्ज करें" : "Record handover",
          onPress: () => {
            void onReceive(receipt).then(async (success) => {
              if (success) await deleteLocal(ownerId, key);
            });
          },
        },
      ],
    );
  }
  if (purchase.receivedAt && purchase.receipt) {
    const receipt = purchase.receipt;
    return (
      <FocusPage
        footer={
          purchase.intakeTaskId ? (
            <Button
              label={hi ? "इनटेक जाँच खोलें" : "Open intake inspection"}
              icon="clipboard-outline"
              onPress={() => onOpenIntake(purchase.intakeTaskId!)}
            />
          ) : undefined
        }
      >
        <Panel style={{ gap: 12 }}>
          <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: "600" }}>
            {hi ? "गाड़ी प्राप्त हो गई" : "Car received"}
          </Text>
          <Text>
            {receipt.location} · {receipt.odometerKm.toLocaleString("en-IN")} km
          </Text>
          <Text>
            {hi ? "चाबी" : "Keys"}: {receipt.keyCount} · {hi ? "ईंधन" : "Fuel"}:{" "}
            {fuelLabels[receipt.fuel]}
          </Text>
          <Text selectable>{receipt.handoverReference}</Text>
          {receipt.accessories ? (
            <Text>
              {hi ? "सामान" : "Accessories"}: {receipt.accessories}
            </Text>
          ) : null}
          {receipt.hasNewIssue ? (
            <Text style={{ color: "#ffc283" }}>
              {hi
                ? "प्राप्ति की नई समस्या पर आगे काम होगा।"
                : "An arrival issue was recorded for follow-up."}
            </Text>
          ) : null}
          {receipt.conditionNote ? <Text>{receipt.conditionNote}</Text> : null}
          <Text style={s.muted}>
            {new Date(purchase.receivedAt).toLocaleString(
              hi ? "hi-IN" : "en-IN",
            )}
          </Text>
        </Panel>
      </FocusPage>
    );
  }
  if (purchase.status !== "acquired")
    return (
      <FocusPage>
        <Panel>
          <Text>
            {hi
              ? "पहले दस्तावेज़ वाले हिस्से में खरीद समझौता दर्ज करें। उसके बाद यहाँ गाड़ी की प्राप्ति दर्ज होगी।"
              : "Record the purchase agreement in Documents first, then record physical receipt here."}
          </Text>
        </Panel>
      </FocusPage>
    );
  const current = steps.indexOf(step);
  function go(index: number) {
    if (busy) return;
    if (index > current) {
      const reading = Number(draft.odometer);
      if (
        !draft.location.trim() ||
        !draft.odometer.trim() ||
        !Number.isInteger(reading) ||
        reading < 0 ||
        reading > 3000000 ||
        (purchase.car.odometerKm !== null && reading < purchase.car.odometerKm)
      ) {
        setError(
          hi
            ? "प्राप्ति की जगह और किलोमीटर जाँचें।"
            : "Check the receiving location and odometer reading.",
        );
        setStep("car");
        return;
      }
      if (index > 1 && draft.hasNewIssue && !draft.conditionNote.trim()) {
        setError(
          hi
            ? "नई समस्या का विवरण लिखें।"
            : "Describe the new issue found on arrival.",
        );
        setStep("condition");
        return;
      }
    }
    setError("");
    setStep(steps[index]!);
  }
  return (
    <FocusPage
      scrollKey={step}
      top={
        <StepHeader
          labels={[
            hi ? "गाड़ी" : "Car",
            hi ? "हालत" : "Condition",
            hi ? "प्राप्ति दर्ज" : "Sign off",
          ]}
          current={current}
          onSelect={go}
          disabled={busy}
        />
      }
      footer={
        <ActionRow>
          {current > 0 ? (
            <Button
              label={hi ? "पीछे" : "Back"}
              secondary
              disabled={busy}
              onPress={() => go(current - 1)}
              style={{ flex: 1 }}
            />
          ) : null}
          {current < 2 ? (
            <Button
              label={hi ? "आगे" : "Next"}
              icon="arrow-forward-outline"
              disabled={!ready || busy}
              onPress={() => go(current + 1)}
              style={{ flex: 2 }}
            />
          ) : (
            <Button
              label={hi ? "प्राप्ति दर्ज करें" : "Record handover"}
              icon="key-outline"
              busy={busy}
              disabled={!ready || !purchase.documentsClear || !options.data}
              onPress={confirm}
              style={{ flex: 2 }}
            />
          )}
        </ActionRow>
      }
    >
      {error || options.error ? (
        <ErrorNotice message={error || options.error} retry={options.refresh} />
      ) : null}
      {!ready ? <ActivityIndicator color="#fff" /> : null}
      {step === "car" ? (
        <Panel style={{ gap: 14 }}>
          <Field
            label={hi ? "गाड़ी कहाँ प्राप्त हुई?" : "Receiving location"}
            value={draft.location}
            onChangeText={(v) => edit("location", v)}
            maxLength={120}
            editable={!busy}
          />
          <Field
            label={hi ? "प्राप्ति पर किलोमीटर" : "Odometer at handover (km)"}
            value={draft.odometer}
            onChangeText={(v) => edit("odometer", v)}
            keyboardType="number-pad"
            maxLength={7}
            editable={!busy}
          />
          <Text style={{ fontWeight: "600" }}>
            {hi ? "कितनी चाबियाँ?" : "How many keys?"}
          </Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[0, 1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${hi ? "चाबी" : "keys"}`}
                accessibilityState={{
                  selected: draft.keyCount === n,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => edit("keyCount", n)}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: draft.keyCount === n ? "#C72128" : "#393939",
                }}
              >
                <Text>{n}</Text>
              </Pressable>
            ))}
          </View>
          <SelectField
            label={hi ? "ईंधन" : "Fuel level"}
            value={draft.fuel}
            options={Object.entries(fuelLabels).map(([id, label]) => ({
              id,
              label,
              icon: "water-outline",
            }))}
            onChange={(value) => edit("fuel", value as PurchaseReceipt["fuel"])}
            disabled={busy}
          />
        </Panel>
      ) : null}
      {step === "condition" ? (
        <>
          <Field
            label={
              hi ? "सामान / एक्सेसरीज़ (वैकल्पिक)" : "Accessories (optional)"
            }
            value={draft.accessories}
            onChangeText={(v) => edit("accessories", v)}
            multiline
            maxLength={1000}
            editable={!busy}
          />
          <Choice
            label={hi ? "नई समस्या मिली" : "New issue found on arrival"}
            selected={draft.hasNewIssue}
            onPress={() => edit("hasNewIssue", !draft.hasNewIssue)}
            icon="alert-circle-outline"
          />
          <Field
            label={
              draft.hasNewIssue
                ? hi
                  ? "नई समस्या का विवरण"
                  : "Describe the new issue"
                : hi
                  ? "हालत पर टिप्पणी (वैकल्पिक)"
                  : "Condition note (optional)"
            }
            value={draft.conditionNote}
            onChangeText={(v) => edit("conditionNote", v)}
            multiline
            maxLength={1000}
            editable={!busy}
          />
        </>
      ) : null}
      {step === "signoff" ? (
        <>
          <Field
            label={
              hi ? "हस्तांतरण संदर्भ" : "Handover acknowledgement reference"
            }
            value={draft.handoverReference}
            onChangeText={(v) => edit("handoverReference", v)}
            maxLength={120}
            editable={!busy}
          />
          <SelectField
            label={hi ? "इनटेक जाँच" : "Intake inspection"}
            value={draft.templateId}
            options={
              options.data?.templates.map((t) => ({
                id: t.id,
                label: t.name,
                detail: `v${t.version} · ${t.items.length} ${hi ? "फोटो" : "photos"} · ${t.approved ? (hi ? "स्वीकृत" : "Approved") : hi ? "ड्राफ्ट" : "Draft"}`,
                icon: "clipboard-outline",
              })) || []
            }
            onChange={(value) => edit("templateId", value)}
            disabled={busy || !options.data}
          />
          <SelectField
            label={hi ? "कौन जाँच करेगा?" : "Who will inspect?"}
            value={draft.assignedTo}
            options={
              options.data?.people.map((p) => ({
                id: p.id,
                label: `${p.name}${p.id === ownerId ? (hi ? " · मैं" : " · Me") : ""}`,
                icon: "person-outline",
              })) || []
            }
            onChange={(value) => edit("assignedTo", value)}
            disabled={busy || !options.data}
          />
          <Text style={s.muted}>
            {hi
              ? "चुने व्यक्ति को इनटेक जाँच मिलेगी। बाकी भुगतान अलग रहेगा।"
              : "The selected person receives the intake check. Any payment balance stays outstanding."}
          </Text>
          {!purchase.documentsClear ? (
            <Text style={{ color: "#ffc283" }}>
              {hi
                ? "पहले दस्तावेज़ की बाकी जाँच पूरी करें।"
                : "Resolve the outstanding document checks first."}
            </Text>
          ) : null}
        </>
      ) : null}
    </FocusPage>
  );
}
