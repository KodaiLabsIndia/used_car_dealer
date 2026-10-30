import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { ActionRow, Button, ErrorNotice, Text, s } from "./ui";
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
  const { session, language } = useApp(),
    owner = session!.actor.id,
    hi = language === "hi",
    key = `business-form:${spec.key}`;
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const values = Object.fromEntries(
      spec.steps.flatMap((s) => s.fields).map((f) => [f.key, f.initial ?? ""]),
    );
    void loadLocal<Draft>(owner, key)
      .then((saved) => {
        if (active) setDraft(saved ?? { values, version, step: 0 });
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
    void saveLocal(owner, key, next).catch(() =>
      setError(
        hi
          ? "ड्राफ्ट सेव नहीं हुआ।"
          : "Could not save the draft on this device.",
      ),
    );
  }
  async function submit() {
    if (!draft) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
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
  const step = Math.min(draft.step, spec.steps.length - 1),
    last = step === spec.steps.length - 1,
    stale = draft.version !== version;
  return (
    <FocusPage
      scrollKey={`${spec.key}:${step}`}
      top={
        <>
          <Text style={{ fontSize: 20, fontWeight: "600" }}>{spec.title}</Text>
          <StepHeader
            labels={spec.steps.map((s) => s.label)}
            current={step}
            disabled={busy}
            onSelect={(n) => update({ ...draft, step: n })}
          />
        </>
      }
      footer={
        <ActionRow>
          <Button
            secondary
            label={hi ? "बंद करें" : "Close"}
            disabled={busy}
            onPress={onCancel}
            style={{ flex: 1 }}
          />
          {step > 0 ? (
            <Button
              secondary
              label={hi ? "पीछे" : "Back"}
              disabled={busy}
              onPress={() => update({ ...draft, step: step - 1 })}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={last ? spec.submitLabel : hi ? "अगला" : "Next"}
            busy={busy}
            disabled={last && stale}
            onPress={() =>
              last ? void submit() : update({ ...draft, step: step + 1 })
            }
            style={{ flex: 2 }}
          />
        </ActionRow>
      }
    >
      <Text style={s.muted}>{summary}</Text>
      {error || serverError ? (
        <ErrorNotice message={error || serverError || ""} />
      ) : null}
      {stale ? (
        <ErrorNotice
          message={
            hi
              ? "रिकॉर्ड बदल गया। नई जानकारी जाँचकर आगे बढ़ें।"
              : "The car record changed. Review its latest amounts before continuing."
          }
          retry={() => {
            setError("");
            update({ ...draft, version });
          }}
        />
      ) : null}
      {spec.note ? <Text style={s.muted}>{spec.note}</Text> : null}
      {(spec.steps[step]?.fields ?? []).map((f) =>
        f.kind === "choice" ? (
          <Choice
            key={f.key}
            label={f.label}
            {...(f.detail ? { detail: f.detail } : {})}
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
            placeholder={f.detail}
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
    </FocusPage>
  );
}
