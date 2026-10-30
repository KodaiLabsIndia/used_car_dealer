import { formatDateTime } from "../components/date-format";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { randomUUID } from "expo-crypto";
import * as Speech from "expo-speech";
import {
  type ChecklistItem,
  type CreateChecklistRevision,
  type ManagedChecklist,
  createChecklistRevisionSchema,
  itemSchema,
} from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { sendCommand } from "../application/send-command";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import { Field, Choice } from "../components/forms";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";

type Draft = Omit<CreateChecklistRevision, "commandId">;
const emptyItem = (): ChecklistItem =>
  itemSchema.parse({
    id: randomUUID(),
    title: "",
    titleHi: "",
    instruction: "",
    instructionHi: "",
    order: 1,
    required: true,
  });
const empty = (): Draft => ({
  name: "",
  kind: "pre_purchase",
  basedOnId: null,
  reason: "",
  items: [emptyItem()],
});
export function ChecklistsScreen(_: ScreenProps<"Checklists">) {
  const { api, session, language, changed } = useApp(),
    owner = session!.actor.id,
    hi = language === "hi",
    tr = (en: string, hn: string) => (hi ? hn : en);
  const resource = useResource("managed-checklists", () =>
    api.managedChecklists(),
  );
  const [section, setSection] = useState<
      "versions" | "details" | "checks" | "review"
    >("versions"),
    [draft, setDraft] = useState<Draft | null>(null),
    [step, setStep] = useState(0),
    [reviewIndex, setReviewIndex] = useState(0),
    [selected, setSelected] = useState<ManagedChecklist | null>(null),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadLocal<Draft>(owner, "checklist-editor-draft")
      .then((value) => {
        if (active) setDraft(value ?? empty());
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      active = false;
      void Speech.stop();
    };
  }, [owner]);
  async function update(next: Draft) {
    setDraft(next);
    try {
      await saveLocal(owner, "checklist-editor-draft", next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const item = draft?.items[step];
  const kinds = [
    { id: "pre_purchase", label: tr("Before purchase", "खरीद से पहले") },
    { id: "intake", label: tr("Arrival / intake", "गाड़ी की प्राप्ति") },
    { id: "repair_qc", label: tr("Repair quality check", "मरम्मत की जाँच") },
    { id: "delivery", label: tr("Before delivery", "डिलीवरी से पहले") },
  ];
  function revise(record: ManagedChecklist) {
    void update({
      name: record.template.name,
      kind: record.template.kind,
      basedOnId: record.template.id,
      reason: "",
      items: record.template.items.map((i) => ({ ...i })),
    });
    setStep(0);
    setSelected(null);
    setReviewed(false);
    setSection("details");
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const body = createChecklistRevisionSchema.parse({
        ...draft,
        items: draft.items.map((i, n) => ({ ...i, order: n + 1 })),
        commandId: randomUUID(),
      });
      const { commandId: _, ...payload } = body;
      const record = await sendCommand(
        owner,
        "checklist-revision",
        payload,
        (b) => api.createChecklistRevision(b),
      );
      await deleteLocal(owner, "checklist-editor-draft");
      setDraft(empty());
      setSelected(record);
      setReviewIndex(0);
      setReason("");
      setReviewed(false);
      setSection("versions");
      changed();
      resource.refresh();
    } catch (e) {
      setError(
        (e as Error).name === "ZodError"
          ? tr(
              "Fill the name, revision reason and both languages for every check.",
              "नाम, बदलाव का कारण और हर जाँच में दोनों भाषाएँ भरें।",
            )
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!selected) return;
    const agreed = await new Promise<boolean>((resolve) =>
      Alert.alert(
        tr("Approve this checklist version?", "यह जाँच सूची मंज़ूर करें?"),
        `${selected.template.name} · v${selected.template.version}\n${tr("Your owner approval and name will be recorded. Existing inspections keep their assigned version.", "आपकी मालिक की मंज़ूरी और नाम दर्ज होंगे। पुरानी जाँच में पहले दी गई सूची रहेगी।")}`,
        [
          {
            text: tr("Cancel", "रद्द"),
            onPress: () => resolve(false),
            style: "cancel",
          },
          { text: tr("Approve", "मंज़ूर"), onPress: () => resolve(true) },
        ],
        { cancelable: false },
      ),
    );
    if (!agreed) return;
    setBusy(true);
    setError("");
    try {
      const record = await sendCommand(
        owner,
        `checklist-approve:${selected.template.id}`,
        {
          expectedVersion: selected.template.version,
          reason,
          instructionsReviewed: reviewed,
        },
        (body) => api.approveChecklist(selected.template.id, body),
      );
      setSelected(record);
      changed();
      resource.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const latest = new Map<string, number>();
  for (const record of resource.data?.items ?? [])
    latest.set(
      record.template.name.toLowerCase(),
      Math.max(
        latest.get(record.template.name.toLowerCase()) ?? 0,
        record.template.version,
      ),
    );
  return (
    <Workspace
      title={tr("Inspection checklists", "जाँच की सूचियाँ")}
      selected={section}
      onChange={(value) => {
        if (!busy) setSection(value);
      }}
      items={[
        {
          id: "versions",
          label: tr("Versions", "संस्करण"),
          icon: "documents-outline",
        },
        {
          id: "details",
          label: tr("Details", "विवरण"),
          icon: "create-outline",
        },
        { id: "checks", label: tr("Checks", "जाँच"), icon: "checkbox-outline" },
        {
          id: "review",
          label: tr("Review", "देखें"),
          icon: "checkmark-circle-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={`${section}:${selected?.template.id ?? ""}:${step}:${reviewIndex}`}
        footer={
          section === "checks" ? (
            <ActionRow>
              <Button
                secondary
                style={{ flex: 1 }}
                label={tr("Previous", "पिछला")}
                disabled={busy || step === 0}
                onPress={() => setStep((v) => v - 1)}
              />
              <Button
                secondary
                style={{ flex: 1 }}
                label={tr("Next", "अगला")}
                disabled={busy || step >= (draft?.items.length ?? 0) - 1}
                onPress={() => setStep((v) => v + 1)}
              />
            </ActionRow>
          ) : section === "review" ? (
            <Button
              label={tr(
                "Save a new draft version",
                "नया ड्राफ्ट संस्करण सेव करें",
              )}
              busy={busy}
              disabled={!draft}
              onPress={() => void save()}
            />
          ) : section === "versions" && selected ? (
            <ActionRow>
              <Button
                secondary
                style={{ flex: 1 }}
                label={tr("Previous check", "पिछली जाँच")}
                disabled={busy || reviewIndex === 0}
                onPress={() => setReviewIndex((n) => n - 1)}
              />
              <Button
                secondary
                style={{ flex: 1 }}
                label={tr("Next check", "अगली जाँच")}
                disabled={
                  busy || reviewIndex >= selected.template.items.length - 1
                }
                onPress={() => setReviewIndex((n) => n + 1)}
              />
            </ActionRow>
          ) : undefined
        }
      >
        {error ? <ErrorNotice message={error} /> : null}
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading ? <ActivityIndicator color="#fff" /> : null}
        {section === "versions" ? (
          <>
            {selected ? (
              <>
                <Button
                  secondary
                  label={tr("Back to all versions", "सभी संस्करणों पर लौटें")}
                  onPress={() => {
                    setSelected(null);
                    setReason("");
                    setReviewed(false);
                  }}
                />
                <Panel>
                  <Text style={s.title}>{selected.template.name}</Text>
                  <Pill
                    label={`${selected.template.approved ? tr("Approved", "मंज़ूर") : tr("Draft", "ड्राफ्ट")} · v${selected.template.version}`}
                  />
                  <Text>
                    {kinds.find((k) => k.id === selected.template.kind)?.label}
                  </Text>
                  <Text>
                    {selected.revisionReason ||
                      tr(
                        "Starter template — review before use.",
                        "शुरुआती सूची — इस्तेमाल से पहले देखें।",
                      )}
                  </Text>
                  <Text>
                    {selected.creatorName ??
                      tr("Training setup", "प्रशिक्षण की तैयारी")}{" "}
                    · {formatDateTime(selected.createdAt, language)}
                  </Text>
                </Panel>
                <Text>
                  {tr("Check", "जाँच")} {reviewIndex + 1} /{" "}
                  {selected.template.items.length}
                </Text>
                {selected.template.items
                  .slice(reviewIndex, reviewIndex + 1)
                  .map((check) => (
                    <Panel key={check.id}>
                      <Text style={s.label}>
                        {reviewIndex + 1}. {check.title}
                      </Text>
                      <Text>{check.instruction}</Text>
                      <Text style={s.label}>{check.titleHi}</Text>
                      <Text>{check.instructionHi}</Text>
                      <Text>
                        {check.required
                          ? tr(
                              "Photo and result required",
                              "फोटो और परिणाम ज़रूरी",
                            )
                          : tr("Optional check", "वैकल्पिक जाँच")}
                      </Text>
                      <Text>
                        {check.zone} · {check.componentId} · {check.method}
                      </Text>
                      {check.critical ? (
                        <Pill
                          label={tr(
                            "Safety-critical finding → urgent issue",
                            "सुरक्षा की समस्या → ज़रूरी काम",
                          )}
                        />
                      ) : null}
                      {check.requiresClip ? (
                        <Text>
                          {tr(
                            "Video proof also required",
                            "वीडियो प्रमाण भी ज़रूरी",
                          )}
                        </Text>
                      ) : null}
                      {check.measurementUnit ? (
                        <Text>
                          {tr("Measurement required", "माप ज़रूरी")} ·{" "}
                          {check.measurementUnit}
                        </Text>
                      ) : null}
                      {check.applicability.fuels.length ||
                      check.applicability.transmissions.length ||
                      check.applicability.feature ? (
                        <Text>
                          {tr("Applies to", "लागू होगा")}:{" "}
                          {[
                            ...check.applicability.fuels,
                            ...check.applicability.transmissions,
                            check.applicability.feature,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      ) : null}
                      <Button
                        secondary
                        icon="volume-high-outline"
                        label={tr("Listen", "सुनें")}
                        onPress={() => {
                          void Speech.stop();
                          Speech.speak(
                            hi ? check.instructionHi : check.instruction,
                            { language: hi ? "hi-IN" : "en-IN" },
                          );
                        }}
                      />
                    </Panel>
                  ))}
                {selected.approval ? (
                  <Panel>
                    <Text>
                      {tr("Approved by", "मंज़ूरी दी")}:{" "}
                      {selected.approval.reviewerName}
                    </Text>
                    <Text>{selected.approval.reason}</Text>
                    <Text>
                      {formatDateTime(selected.approval.createdAt, language)}
                    </Text>
                  </Panel>
                ) : !selected.template.approved &&
                  latest.get(selected.template.name.toLowerCase()) ===
                    selected.template.version ? (
                  <Panel>
                    <Field
                      label={tr("Approval reason", "मंज़ूरी का कारण")}
                      value={reason}
                      onChangeText={setReason}
                      editable={!busy}
                      maxLength={1000}
                      multiline
                    />
                    <Choice
                      label={tr(
                        "I reviewed every check and both language instructions",
                        "मैंने हर जाँच और दोनों भाषाओं के निर्देश देखे हैं",
                      )}
                      selected={reviewed}
                      onPress={() => {
                        if (!busy) setReviewed((v) => !v);
                      }}
                    />
                    <Button
                      label={tr(
                        "Approve this version",
                        "यह संस्करण मंज़ूर करें",
                      )}
                      busy={busy}
                      disabled={!reviewed || !reason.trim()}
                      onPress={() => void approve()}
                    />
                  </Panel>
                ) : null}
                {latest.get(selected.template.name.toLowerCase()) ===
                selected.template.version ? (
                  <Button
                    secondary
                    label={tr("Create next revision", "अगला संस्करण बनाएँ")}
                    disabled={busy}
                    onPress={() => revise(selected)}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Text>
                  {tr(
                    "Approved versions can be assigned to new inspections. Existing inspections retain their original checklist.",
                    "मंज़ूर सूची नई जाँच को दी जा सकती है। पुरानी जाँच में उसकी मूल सूची रहेगी।",
                  )}
                </Text>
                <Button
                  label={tr("Continue editing draft", "ड्राफ्ट आगे भरें")}
                  onPress={() => setSection("details")}
                />
                <Button
                  secondary
                  label={tr("Start a new checklist", "नई सूची शुरू करें")}
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      tr("Start a new checklist?", "नई सूची शुरू करें?"),
                      tr(
                        "The current unsaved editor draft will be replaced. Saved versions remain available.",
                        "अभी का बिना सेव किया एडिटर ड्राफ्ट बदल जाएगा। सेव संस्करण उपलब्ध रहेंगे।",
                      ),
                      [
                        { text: tr("Cancel", "रद्द"), style: "cancel" },
                        {
                          text: tr("Start new", "नई शुरू करें"),
                          onPress: () => {
                            void update(empty());
                            setStep(0);
                            setSection("details");
                          },
                        },
                      ],
                    )
                  }
                />
                {(resource.data?.items ?? []).map((record) => (
                  <Panel key={record.template.id}>
                    <Text style={s.label}>{record.template.name}</Text>
                    <Text>
                      {kinds.find((k) => k.id === record.template.kind)?.label}{" "}
                      · v{record.template.version} ·{" "}
                      {record.template.items.length} {tr("checks", "जाँच")}
                    </Text>
                    <Pill
                      label={
                        record.template.approved
                          ? tr("Approved", "मंज़ूर")
                          : tr("Draft", "ड्राफ्ट")
                      }
                      warning={!record.template.approved}
                    />
                    <Button
                      secondary
                      label={tr(
                        "View checks & approval",
                        "जाँच और मंज़ूरी देखें",
                      )}
                      onPress={() => {
                        setSelected(record);
                        setReviewIndex(0);
                        setReason("");
                        setReviewed(false);
                      }}
                    />
                  </Panel>
                ))}
              </>
            )}
          </>
        ) : null}
        {section === "details" && draft ? (
          <>
            <Text style={s.title}>
              {draft.basedOnId
                ? tr("Revise the checklist", "सूची का नया संस्करण")
                : tr("Create a checklist", "जाँच सूची बनाएँ")}
            </Text>
            <Field
              label={tr("Checklist name", "सूची का नाम")}
              value={draft.name}
              onChangeText={(name) => void update({ ...draft, name })}
              editable={!busy && !draft.basedOnId}
              maxLength={120}
            />
            <SelectField
              label={tr("Inspection stage", "जाँच का चरण")}
              value={draft.kind}
              options={kinds}
              disabled={busy || !!draft.basedOnId}
              onChange={(kind) =>
                void update({ ...draft, kind: kind as Draft["kind"] })
              }
            />
            <Field
              label={tr(
                "Why create or revise this checklist?",
                "इस सूची को बनाने या बदलने का कारण?",
              )}
              value={draft.reason}
              onChangeText={(reason) => void update({ ...draft, reason })}
              editable={!busy}
              multiline
              maxLength={1000}
            />
            <Button
              label={tr("Write the checks", "जाँच भरें")}
              onPress={() => setSection("checks")}
            />
          </>
        ) : null}
        {section === "checks" && draft && item ? (
          <>
            <Text style={s.title}>
              {tr("Check", "जाँच")} {step + 1} / {draft.items.length}
            </Text>
            {(
              [
                ["title", "Short title · English"],
                ["titleHi", "छोटा नाम · हिंदी"],
                ["instruction", "What to check and photograph · English"],
                ["instructionHi", "क्या जाँचना और फोटो लेना है · हिंदी"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={item[key]}
                editable={!busy}
                multiline={key.startsWith("instruction")}
                maxLength={key.startsWith("instruction") ? 1000 : 160}
                onChangeText={(text) =>
                  void update({
                    ...draft,
                    items: draft.items.map((check, n) =>
                      n === step ? { ...check, [key]: text } : check,
                    ),
                  })
                }
              />
            ))}
            <Choice
              label={tr("Photo and result required", "फोटो और परिणाम ज़रूरी")}
              selected={item.required}
              onPress={() => {
                if (!busy)
                  void update({
                    ...draft,
                    items: draft.items.map((check, n) =>
                      n === step
                        ? { ...check, required: !check.required }
                        : check,
                    ),
                  });
              }}
            />
            <Button
              secondary
              label={tr("Add another check", "एक और जाँच जोड़ें")}
              disabled={busy || draft.items.length >= 1000}
              onPress={() => {
                void update({ ...draft, items: [...draft.items, emptyItem()] });
                setStep(draft.items.length);
              }}
            />
            {draft.items.length > 1 ? (
              <Button
                secondary
                label={tr("Remove this draft check", "यह ड्राफ्ट जाँच हटाएँ")}
                disabled={busy}
                onPress={() => {
                  void update({
                    ...draft,
                    items: draft.items.filter((_, n) => n !== step),
                  });
                  setStep(Math.max(0, step - 1));
                }}
              />
            ) : null}
          </>
        ) : null}
        {section === "review" && draft ? (
          <>
            <Text style={s.title}>
              {draft.name || tr("Untitled checklist", "बिना नाम की सूची")}
            </Text>
            <Text>{kinds.find((k) => k.id === draft.kind)?.label}</Text>
            <Text>{draft.reason}</Text>
            <Text>
              {tr(
                "Saving creates an unapproved version. Review all checks before owner approval.",
                "सेव करने से बिना मंज़ूरी का संस्करण बनेगा। मालिक की मंज़ूरी से पहले सभी जाँच देखें।",
              )}
            </Text>
            {draft.items.map((check, n) => (
              <Panel key={check.id}>
                <Text style={s.label}>
                  {n + 1}. {check.title}
                </Text>
                <Text>{check.instruction}</Text>
                <Text style={s.label}>{check.titleHi}</Text>
                <Text>{check.instructionHi}</Text>
                <Pill
                  label={
                    check.required
                      ? tr("Required", "ज़रूरी")
                      : tr("Optional", "वैकल्पिक")
                  }
                />
                <Button
                  secondary
                  label={tr("Edit this check", "यह जाँच बदलें")}
                  onPress={() => {
                    setStep(n);
                    setSection("checks");
                  }}
                />
              </Panel>
            ))}
          </>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
