import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  View,
} from "react-native";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { ActionRow, Button, ErrorNotice, Icon, Panel, Text, s } from "./ui";
import { useInteractionLock } from "../state/use-interaction-lock";
import { reviewFormValues } from "../application/form-review";
import { uxText } from "../state/ux-copy";
import { Choice, Field } from "./forms";
import { FocusPage, SelectField, StepHeader } from "./workspace";
import { DateField } from "./date-field";
import { DateTimeField } from "./date-time-field";

export type BusinessField = {
  key: string;
  label: string;
  kind?:
    "text" | "money" | "number" | "date" | "datetime" | "choice" | "select";
  initial?: string | undefined;
  detail?: string;
  multiline?: boolean;
  options?: { id: string; label: string }[];
};
export type BusinessFormSpec = {
  key: string;
  title: string;
  note?: string | undefined;
  submitLabel: string;
  steps: { label: string; fields: BusinessField[] }[];
};
type Draft = { values: Record<string, string>; version: number; step: number };
export function BusinessForm({
  spec,
  serverError,
  version,
  summary,
  onCancel,
  onSubmit,
  onBusyChange,
}: {
  spec: BusinessFormSpec;
  serverError?: string | undefined;
  version: number;
  summary: string;
  onCancel: () => void;
  onSubmit: (
    values: Record<string, string>,
    version: number,
  ) => Promise<boolean>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { session, language, announce } = useApp(),
    owner = session!.actor.id,
    hi = language === "hi",
    tr = (en: string, h: string, mr: string) =>
      language === "mr" ? mr : hi ? h : en,
    key = `business-form:${spec.key}`;
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [restored, setRestored] = useState(false),
    [stored, setStored] = useState(false);
  useInteractionLock(busy);
  const writes = useRef(Promise.resolve());
  const writeId = useRef(0);
  useEffect(() => {
    let active = true;
    const values = Object.fromEntries(
      spec.steps.flatMap((s) => s.fields).map((f) => [f.key, f.initial ?? ""]),
    );
    void loadLocal<Draft>(owner, key)
      .then((saved) => {
        if (active) {
          setDraft(
            saved
              ? { ...saved, values: { ...values, ...saved.values } }
              : { values, version, step: 0 },
          );
          setRestored(!!saved);
          setStored(!!saved);
        }
      })
      .catch(() => {
        if (active) {
          setDraft({ values, version, step: 0 });
          setError(
            hi ? "ड्राफ्ट नहीं खुला।" : "Could not restore the saved draft.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [owner, key]);
  function update(next: Draft) {
    setDraft(next);
    setStored(false);
    const id = ++writeId.current;
    writes.current = writes.current
      .catch(() => {})
      .then(() => saveLocal(owner, key, next));
    void writes.current
      .then(() => {
        if (writeId.current === id) setStored(true);
      })
      .catch(() =>
        setError(
          tr(
            "Could not save the draft on this phone. Keep this screen open and try again.",
            "फोन पर मसौदा सेव नहीं हुआ। यह स्क्रीन खुली रखें और फिर कोशिश करें।",
            "फोनवर मसुदा जतन झाला नाही. ही स्क्रीन उघडी ठेवा व पुन्हा प्रयत्न करा.",
          ),
        ),
      );
  }
  async function close(discard = false) {
    if (!draft || busy) return;
    setBusy(true);
    onBusyChange(true);
    try {
      if (discard) await writes.current.catch(() => {});
      else await writes.current;
      if (discard) await deleteLocal(owner, key);
      else await saveLocal(owner, key, draft);
      announce(
        tr(
          discard ? "Draft cleared" : "Draft saved",
          discard ? "मसौदा हटाया" : "मसौदा सेव हुआ",
          discard ? "मसुदा काढला" : "मसुदा जतन केला",
        ),
      );
      onCancel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  function discard() {
    Alert.alert(
      tr("Discard this draft?", "यह मसौदा हटाएँ?", "हा मसुदा काढायचा?"),
      tr(
        "Only this form’s saved draft will be removed.",
        "केवल इस फॉर्म का सहेजा मसौदा हटेगा।",
        "फक्त या फॉर्मचा जतन केलेला मसुदा काढला जाईल.",
      ),
      [
        { text: tr("Keep draft", "मसौदा रखें", "मसुदा ठेवा"), style: "cancel" },
        {
          text: tr("Discard", "हटाएँ", "काढा"),
          style: "destructive",
          onPress: () => void close(true),
        },
      ],
    );
  }
  async function submit() {
    if (!draft) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await writes.current;
      if (await onSubmit(draft.values, draft.version))
        await deleteLocal(owner, key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  if (!draft) return <ActivityIndicator color="#fff" />;
  const step = Math.max(0, Math.min(draft.step, spec.steps.length)),
    last = step === spec.steps.length,
    stale = draft.version !== version,
    review = reviewFormValues(spec.steps, draft.values, language);
  return (
    <FocusPage
      scrollKey={`${spec.key}:${step}`}
      top={
        <>
          <Text style={{ fontSize: 20, fontWeight: "600" }}>{spec.title}</Text>
          <StepHeader
            labels={[
              ...spec.steps.map((s) => s.label),
              tr("Review", "जाँचें", "तपासा"),
            ]}
            current={step}
            disabled={busy}
            onSelect={(n) => {
              Keyboard.dismiss();
              update({ ...draft, step: n });
            }}
          />
        </>
      }
      footer={
        <ActionRow>
          <Button
            secondary
            label={tr("Save & close", "सेव कर बंद करें", "जतन करून बंद करा")}
            disabled={busy}
            onPress={() => void close()}
            style={{ flex: 1 }}
          />
          {step > 0 ? (
            <Button
              secondary
              label={tr("Back", "पीछे", "मागे")}
              disabled={busy}
              onPress={() => update({ ...draft, step: step - 1 })}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={
              last
                ? spec.submitLabel
                : step === spec.steps.length - 1
                  ? tr("Review", "जाँचें", "तपासा")
                  : tr("Next", "अगला", "पुढे")
            }
            busy={busy}
            disabled={last && (stale || review.some((row) => row.invalid))}
            onPress={() =>
              last
                ? void submit()
                : (Keyboard.dismiss(), update({ ...draft, step: step + 1 }))
            }
            style={{ flex: 2 }}
          />
        </ActionRow>
      }
    >
      <Text style={s.muted}>{summary}</Text>
      {stored ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: 12, color: "#A9C4B1" }}
        >
          {restored
            ? uxText(language, "Saved draft restored", "सहेजा मसौदा खुला")
            : uxText(language, "Saved on this phone", "इस फोन पर सेव है")}
        </Text>
      ) : null}
      {error || serverError ? (
        <ErrorNotice message={error || serverError || ""} />
      ) : null}
      {stale ? (
        <ErrorNotice
          message={tr(
            "This record changed. Review its latest details before continuing.",
            "रिकॉर्ड बदल गया। नई जानकारी जाँचकर आगे बढ़ें।",
            "नोंद बदलली आहे. पुढे जाण्यापूर्वी नवीन माहिती तपासा.",
          )}
          retryLabel={tr(
            "Review with latest record",
            "नए रिकॉर्ड के साथ जाँचें",
            "नवीन नोंदीसह तपासा",
          )}
          retry={() => {
            setError("");
            update({ ...draft, version, step: spec.steps.length });
          }}
        />
      ) : null}
      {spec.note ? <Text style={s.muted}>{spec.note}</Text> : null}
      {last ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: "600" }}>
            {uxText(
              language,
              "Review before saving",
              "सेव करने से पहले जाँचें",
            )}
          </Text>
          {review.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={`${uxText(language, "Edit", "बदलें")} ${row.label}`}
              disabled={busy}
              onPress={() => update({ ...draft, step: row.step })}
              style={{
                padding: 14,
                borderRadius: 13,
                backgroundColor: row.invalid ? "#43272B" : "#242321",
                borderWidth: 1,
                borderColor: row.invalid ? "#EC8F99" : "#393733",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: "#AAA7A2" }}>
                {row.label}
              </Text>
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: row.unconfirmed ? "#E6C79F" : "#F4F1ED",
                  }}
                >
                  {row.value}
                </Text>
                <Icon name="create-outline" size={18} color="#EFAEB6" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {(spec.steps[step]?.fields ?? []).map((f) =>
        f.kind === "choice" ? (
          <Choice
            key={f.key}
            label={f.label}
            {...(f.detail ? { detail: f.detail } : {})}
            disabled={busy}
            selected={draft.values[f.key] === "yes"}
            onPress={() => {
              if (!busy)
                update({
                  ...draft,
                  values: {
                    ...draft.values,
                    [f.key]: draft.values[f.key] === "yes" ? "no" : "yes",
                  },
                });
            }}
            icon="checkmark-circle-outline"
          />
        ) : f.kind === "select" ? (
          <SelectField
            key={f.key}
            label={f.label}
            value={draft.values[f.key] ?? ""}
            options={f.options ?? []}
            disabled={busy}
            onChange={(value) =>
              update({ ...draft, values: { ...draft.values, [f.key]: value } })
            }
          />
        ) : f.kind === "datetime" ? (
          <DateTimeField
            key={f.key}
            label={f.label}
            value={draft.values[f.key] ?? ""}
            disabled={busy}
            onChange={(value) =>
              update({ ...draft, values: { ...draft.values, [f.key]: value } })
            }
          />
        ) : f.kind === "date" ? (
          <DateField
            key={f.key}
            label={f.label}
            value={draft.values[f.key] ?? ""}
            disabled={busy}
            onChange={(value) =>
              update({ ...draft, values: { ...draft.values, [f.key]: value } })
            }
          />
        ) : (
          <Field
            key={f.key}
            label={f.label}
            value={draft.values[f.key] ?? ""}
            helper={f.detail}
            multiline={f.multiline}
            keyboardType={
              f.kind === "money"
                ? "decimal-pad"
                : f.kind === "number"
                  ? "number-pad"
                  : "default"
            }
            editable={!busy}
            onChangeText={(value) =>
              update({ ...draft, values: { ...draft.values, [f.key]: value } })
            }
          />
        ),
      )}
      <Button
        secondary
        label={tr("Discard draft", "मसौदा हटाएँ", "मसुदा काढा")}
        disabled={busy}
        onPress={discard}
      />
    </FocusPage>
  );
}
