import { formatDateTime } from "../components/date-format";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import * as Speech from "expo-speech";
import type {
  AICapability,
  AssistantDraft,
  AssistantInput,
  CarDocument,
  Task,
} from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, type PhotoDraft } from "../adapters/local-store";
import { draftKey } from "../application/inspection-sync";
import { can } from "../application/access";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Choice, Field } from "../components/forms";

const names: Record<AICapability, [string, string]> = {
  voice_log: ["Write an inspection note", "जाँच का नोट लिखें"],
  scan_fields: ["Read a photo / document", "फोटो या कागज़ात पढ़ें"],
  evidence_guide: ["Check photo coverage", "जाँच की फोटो पर सुझाव"],
  owner_brief: ["Explain current records", "अभी के रिकॉर्ड समझें"],
  quote_review: ["Read a quote / bill", "कोटेशन या बिल पढ़ें"],
  voice_task: ["Draft a task", "काम का ड्राफ्ट बनाएँ"],
  repair_compare: ["Compare before & after", "पहले और बाद की तुलना"],
  handover_brief: ["Explain customer handover", "ग्राहक हैंडओवर समझाएँ"],
};
const fieldNames: Record<string, [string, string]> = {
  note: ["Note", "नोट"],
  symptom: ["Reported problem", "बताई समस्या"],
  partName: ["Part", "पुर्जा"],
  registration: ["Registration number", "गाड़ी नंबर"],
  odometerKm: ["Odometer", "मीटर रीडिंग"],
  make: ["Make", "कंपनी"],
  model: ["Model", "मॉडल"],
  year: ["Year", "वर्ष"],
  documentReference: ["Document reference", "कागज़ात का संदर्भ"],
  invoiceReference: ["Bill reference", "बिल का संदर्भ"],
  supplier: ["Supplier", "सप्लायर"],
  amountRupees: ["Amount in rupees", "रुपये में रकम"],
  quantity: ["Quantity", "संख्या"],
  taskTitle: ["Task", "काम"],
  assigneeId: ["Assigned person", "ज़िम्मेदार व्यक्ति"],
  dueAt: ["Due date", "तारीख"],
  checklistKind: ["Checklist", "जाँच सूची"],
  buyerBrief: ["Customer explanation", "ग्राहक को जानकारी"],
  warrantyBrief: ["Warranty explanation", "वारंटी की जानकारी"],
};
type Saved = {
  text: string;
  capability: AICapability;
  evidenceIds: string[];
  documentIds: string[];
  commandId: string;
  runId: string | null;
  pendingBody?: AssistantInput | null;
};
export function AssistantScreen({
  route,
  navigation,
}: ScreenProps<"Assistant">) {
  const { api, session, language, changed } = useApp(),
    user = session!.actor,
    hi = language === "hi",
    tr = (en: string, hn: string) => (hi ? hn : en);
  const params = route.params,
    focused = useIsFocused(),
    key = `assistant:${params?.taskId ?? params?.carId ?? "company"}:${params?.itemId ?? "all"}`;
  const [saved, setSaved] = useState<Saved | null>(null),
    [section, setSection] = useState<"request" | "sources" | "draft">(
      "request",
    ),
    [draft, setDraft] = useState<AssistantDraft | null>(null),
    [task, setTask] = useState<Task | null>(null),
    [pages, setPages] = useState<CarDocument[]>([]),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const capabilities = (Object.keys(names) as AICapability[]).filter((c) => {
    if (["voice_log", "evidence_guide"].includes(c) && !params?.taskId)
      return false;
    if (
      ["owner_brief", "quote_review", "handover_brief"].includes(c) &&
      user.role !== "owner"
    )
      return false;
    if (c === "voice_task" && !can(user, "assign_inspection")) return false;
    if (!params?.carId && !params?.taskId && c !== "owner_brief") return false;
    return true;
  });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [prior, options, t, p] = await Promise.all([
          loadLocal<Saved>(user.id, key),
          api.assistantOptions(),
          params?.taskId ? api.task(params.taskId) : Promise.resolve(null),
          params?.carId && user.role === "owner"
            ? api.documents(params.carId)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setEnabled(options.enabled);
        setTask(t);
        setPages(p?.items ?? []);
        setSaved(
          prior ?? {
            text: "",
            capability:
              params?.capability ??
              (params?.taskId ? "voice_log" : "owner_brief"),
            evidenceIds: [],
            documentIds: [],
            commandId: Crypto.randomUUID(),
            runId: null,
          },
        );
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
      void Speech.stop();
    };
  }, [key, user.id]);
  useEffect(() => {
    if (!focused || !saved?.runId) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await api.assistantDraft(saved.runId!);
        if (!active) return;
        setDraft(value);
        if (value.status === "queued" || value.status === "running")
          timer = setTimeout(() => void poll(), 2500);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [saved?.runId, focused]);
  async function update(next: Saved) {
    setSaved(next);
    try {
      await saveLocal(user.id, key, next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function generate() {
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      const body: AssistantInput = saved.pendingBody ?? {
        commandId: saved.commandId,
        capability: saved.capability,
        language,
        text: saved.text,
        evidenceIds: saved.evidenceIds,
        documentIds: saved.documentIds,
        ...(params?.carId ? { carId: params.carId } : {}),
        ...(params?.taskId ? { taskId: params.taskId } : {}),
        ...(params?.itemId ? { itemId: params.itemId } : {}),
      };
      if (!(await update({ ...saved, pendingBody: body }))) return;
      const value = await api.createAssistantDraft(body);
      await update({ ...saved, pendingBody: body, runId: value.id });
      setDraft(value);
      setConfirmed(false);
      setSection("draft");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(decision: "accepted" | "rejected") {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      setDraft(await api.reviewAssistant(draft.id, decision, confirmed));
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function useNote() {
    if (!draft?.content || !params?.taskId || !params?.itemId) return;
    setBusy(true);
    try {
      const localKey = draftKey(params.taskId, params.itemId),
        photo = await loadLocal<PhotoDraft>(user.id, localKey);
      if (!photo)
        throw Error(
          tr(
            "Take a check photo first. The reviewed note stays here.",
            "पहले जाँच की फोटो लें। समीक्षा किया नोट यहाँ रहेगा।",
          ),
        );
      const note =
        draft.content.fields.find((f) => f.name === "note")?.value ??
        draft.content.summary;
      if (note.length > 1000)
        throw Error(
          tr(
            "The note is too long. Copy a shorter note into the check.",
            "नोट लंबा है। जाँच में छोटा नोट लिखें।",
          ),
        );
      const { commandId: _command, expectedVersion: _version, ...rest } = photo;
      await saveLocal(user.id, localKey, { ...rest, note, synced: false });
      navigation.goBack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function select(id: string, type: "evidenceIds" | "documentIds") {
    if (!saved || saved.runId || busy) return;
    const list = saved[type],
      exists = list.includes(id);
    if (!exists && saved.evidenceIds.length + saved.documentIds.length >= 2) {
      setError(tr("Choose at most two photos.", "अधिकतम दो फोटो चुनें।"));
      return;
    }
    void update({
      ...saved,
      [type]: exists ? list.filter((v) => v !== id) : [...list, id],
    });
  }
  const pending = draft?.status === "queued" || draft?.status === "running",
    locked = busy || !!saved?.runId || !!saved?.pendingBody;
  return (
    <Workspace
      title={tr("Draft assistant", "ड्राफ्ट सहायक")}
      selected={section}
      busy={busy}
      onChange={setSection}
      items={[
        {
          id: "request",
          label: tr("Ask", "पूछें"),
          icon: "chatbubble-outline",
        },
        { id: "sources", label: tr("Photos", "फोटो"), icon: "images-outline" },
        {
          id: "draft",
          label: tr("Review", "समीक्षा"),
          icon: "checkmark-done-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={section}
        footer={
          section === "draft" && draft ? (
            <View style={{ gap: 10 }}>
              {draft.status === "completed" && !draft.review ? (
                <ActionRow>
                  <Button
                    secondary
                    label={tr("Reject", "अस्वीकार")}
                    disabled={busy}
                    onPress={() => void review("rejected")}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={tr("Accept draft", "ड्राफ्ट स्वीकार")}
                    disabled={busy || !confirmed || draft.stale}
                    onPress={() => void review("accepted")}
                    style={{ flex: 2 }}
                  />
                </ActionRow>
              ) : null}
              {draft.review === "accepted" &&
              !draft.stale &&
              draft.capability === "voice_log" &&
              params?.itemId ? (
                <Button
                  label={tr("Use note in check", "जाँच में नोट लें")}
                  disabled={busy}
                  onPress={() => void useNote()}
                />
              ) : null}
              {!pending ? (
                <Button
                  secondary
                  label={tr("New draft", "नया ड्राफ्ट")}
                  disabled={busy}
                  onPress={() => {
                    if (saved)
                      void update({
                        ...saved,
                        commandId: Crypto.randomUUID(),
                        runId: null,
                        pendingBody: null,
                      });
                    setDraft(null);
                    setConfirmed(false);
                    setError("");
                    setSection("request");
                  }}
                />
              ) : null}
            </View>
          ) : (
            <Button
              label={tr("Prepare draft", "ड्राफ्ट तैयार करें")}
              icon="sparkles-outline"
              busy={busy}
              disabled={!enabled || !saved || !!saved.runId}
              onPress={() => void generate()}
            />
          )
        }
      >
        {error ? <ErrorNotice message={error} /> : null}
        {!saved ? <ActivityIndicator color="#fff" /> : null}
        {!enabled ? (
          <Panel>
            <Text>
              {tr(
                "The assistant is unavailable. All normal work forms remain available.",
                "सहायक अभी उपलब्ध नहीं है। सामान्य काम के फॉर्म चल रहे हैं।",
              )}
            </Text>
          </Panel>
        ) : null}
        {section === "request" && saved ? (
          <>
            <Text style={s.muted}>
              {tr(
                "Assistant preview. Photo and document reading is still being evaluated. Check every suggested number against its source.",
                "सहायक का शुरुआती संस्करण। फोटो और कागज़ात पढ़ने की जाँच जारी है। हर सुझाई संख्या को मूल रिकॉर्ड से मिलाएँ।",
              )}
            </Text>
            <Text style={s.title}>
              {tr("Tell it what you need.", "बताएँ क्या चाहिए।")}
            </Text>
            <SelectField
              label={tr("Help with", "इसमें मदद")}
              value={saved.capability}
              options={capabilities.map((id) => ({
                id,
                label: names[id][hi ? 1 : 0],
              }))}
              disabled={locked}
              onChange={(v) =>
                void update({ ...saved, capability: v as AICapability })
              }
            />
            <Field
              label={tr("Your report or question", "आपकी बात या सवाल")}
              multiline
              maxLength={4000}
              value={saved.text}
              editable={!locked}
              onChangeText={(text) => void update({ ...saved, text })}
            />
            <Text style={s.muted}>
              {tr(
                "You can use the microphone on your phone keyboard to dictate. A person must check every draft before using it.",
                "फोन के कीबोर्ड का माइक दबाकर बोल सकते हैं। हर ड्राफ्ट इस्तेमाल करने से पहले व्यक्ति को जाँचना है।",
              )}
            </Text>
            {saved.runId ? (
              <Button
                secondary
                label={tr("Open saved draft", "सेव ड्राफ्ट खोलें")}
                onPress={() => setSection("draft")}
              />
            ) : null}
            {saved.pendingBody && !saved.runId ? (
              <>
                <Text>
                  {tr(
                    "This request is saved. Retry sends the same request.",
                    "यह अनुरोध सेव है। फिर भेजने पर वही अनुरोध जाएगा।",
                  )}
                </Text>
                <Button
                  secondary
                  label={tr("Start another request", "दूसरा अनुरोध शुरू करें")}
                  disabled={busy}
                  onPress={() => {
                    void update({
                      ...saved,
                      commandId: Crypto.randomUUID(),
                      pendingBody: null,
                    });
                    setError("");
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}
        {section === "sources" && saved ? (
          <>
            <Text>
              {tr(
                "Choose uploaded check photos or private document pages. The first selected image is the before photo for a comparison.",
                "भेजी जाँच की फोटो या निजी कागज़ात चुनें। तुलना में पहली चुनी फोटो पहले की होगी।",
              )}
            </Text>
            <Text style={s.muted}>
              {tr(
                "Up to two photos; the current page shows the latest 30 documents. Original records stay unchanged.",
                "दो फोटो तक; यहाँ नए 30 कागज़ात हैं। मूल रिकॉर्ड बदले नहीं जाते।",
              )}
            </Text>
            {(task?.evidence ?? []).map((e) => (
              <Panel key={e.id}>
                <Image
                  source={api.evidenceUri(e.id)}
                  style={{ width: "100%", height: 150 }}
                  resizeMode="contain"
                />
                <Choice
                  label={
                    task!.items.find((i) => i.id === e.itemId)?.title ??
                    e.itemId
                  }
                  selected={saved.evidenceIds.includes(e.id)}
                  onPress={() => select(e.id, "evidenceIds")}
                />
              </Panel>
            ))}
            {pages.map((p) => (
              <Panel key={p.id}>
                <Image
                  source={api.documentUri(p.id)}
                  style={{ width: "100%", height: 150 }}
                  resizeMode="contain"
                />
                <Choice
                  label={p.title}
                  selected={saved.documentIds.includes(p.id)}
                  onPress={() => select(p.id, "documentIds")}
                />
              </Panel>
            ))}
            {!pages.length && !task?.evidence.length ? (
              <Text>
                {tr(
                  "Upload a prepared photo from the inspection or Documents first.",
                  "पहले जाँच या कागज़ात में तैयार फोटो भेजें।",
                )}
              </Text>
            ) : null}
          </>
        ) : null}
        {section === "draft" ? (
          draft ? (
            <>
              {pending ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text>
                    {tr(
                      "Preparing your draft. You may return to work; this request is saved.",
                      "ड्राफ्ट बन रहा है। काम पर लौट सकते हैं; यह अनुरोध सेव है।",
                    )}
                  </Text>
                </>
              ) : null}
              {draft.stale ? (
                <ErrorNotice
                  message={tr(
                    "Source records changed. Generate a fresh draft before using this one.",
                    "मूल रिकॉर्ड बदल गए। इस्तेमाल से पहले नया ड्राफ्ट बनाएँ।",
                  )}
                />
              ) : null}
              {draft.status === "failed" || draft.status === "stale" ? (
                <ErrorNotice
                  message={tr(
                    "The assistant could not prepare this draft. Continue with the normal form, or start a new draft.",
                    "सहायक यह ड्राफ्ट नहीं बना पाया। सामान्य फॉर्म से काम करें या नया ड्राफ्ट लें।",
                  )}
                />
              ) : null}
              {draft.content ? (
                <>
                  <Pill
                    label={
                      draft.review
                        ? tr(
                            `Draft ${draft.review}`,
                            draft.review === "accepted"
                              ? "ड्राफ्ट स्वीकार"
                              : "ड्राफ्ट अस्वीकार",
                          )
                        : tr("Needs your review", "आपकी समीक्षा चाहिए")
                    }
                    warning={!draft.review}
                  />
                  <Text style={{ fontSize: 21, lineHeight: 31 }}>
                    {draft.content.summary}
                  </Text>
                  {draft.content.fields.map((f, i) => (
                    <Panel key={`${f.name}:${i}`}>
                      <Text style={s.label}>
                        {fieldNames[f.name]?.[hi ? 1 : 0] ?? f.name}
                      </Text>
                      <Text>
                        {f.value ??
                          tr(
                            "Unknown — check original",
                            "अज्ञात — मूल से जाँचें",
                          )}
                      </Text>
                      <Text style={s.muted}>
                        {f.basis === "observed"
                          ? tr("Read from photo", "फोटो से पढ़ा")
                          : f.basis === "reported"
                            ? tr("Reported by you", "आपने बताया")
                            : tr("Needs checking", "जाँचना है")}{" "}
                        ·{" "}
                        {f.sourceIds
                          .map(
                            (id) =>
                              draft.sources.find((v) => v.id === id)?.label ??
                              id,
                          )
                          .join(", ")}
                      </Text>
                    </Panel>
                  ))}
                  {draft.content.unknowns.length ? (
                    <Panel>
                      <Text style={s.label}>
                        {tr("Still unknown", "अभी पता नहीं")}
                      </Text>
                      {draft.content.unknowns.map((v, i) => (
                        <Text key={i}>{v}</Text>
                      ))}
                    </Panel>
                  ) : null}
                  {draft.content.checks.length ? (
                    <Panel>
                      <Text style={s.label}>
                        {tr("Check next", "अगली जाँच")}
                      </Text>
                      {draft.content.checks.map((v, i) => (
                        <Text key={i}>{v}</Text>
                      ))}
                    </Panel>
                  ) : null}
                  <Button
                    secondary
                    label={tr("Read aloud", "सुनें")}
                    icon="volume-high-outline"
                    onPress={() => {
                      void Speech.stop().then(() =>
                        Speech.speak(
                          [
                            draft.content!.summary,
                            ...draft.content!.fields.map(
                              (field) =>
                                `${fieldNames[field.name]?.[hi ? 1 : 0] ?? field.name}: ${field.value ?? tr("Unknown", "अज्ञात")}`,
                            ),
                            ...draft.content!.unknowns,
                            ...draft.content!.checks,
                          ].join(". "),
                          { language: hi ? "hi-IN" : "en-IN", rate: 0.88 },
                        ),
                      );
                    }}
                  />
                  <Text style={s.muted}>
                    {tr("Records as of", "रिकॉर्ड का समय")}{" "}
                    {formatDateTime(draft.cutoff, language)}
                  </Text>
                  {draft.sources.map((source) =>
                    source.targetType === "input" ||
                    source.targetType === "dashboard" ? (
                      <Text key={source.id} style={s.muted}>
                        {source.label}
                      </Text>
                    ) : (
                      <Button
                        key={source.id}
                        secondary
                        label={source.label}
                        onPress={() => {
                          if (source.targetType === "task" && source.targetId)
                            navigation.navigate("Task", {
                              id: source.targetId,
                            });
                          else if (
                            (source.targetType === "car" ||
                              source.targetType === "business") &&
                            source.targetId
                          )
                            navigation.navigate("Car", { id: source.targetId });
                          else if (
                            source.targetType === "document" &&
                            params?.carId
                          )
                            navigation.navigate("Documents", {
                              carId: params.carId,
                            });
                        }}
                      />
                    ),
                  )}
                  {!draft.review ? (
                    <Choice
                      label={tr(
                        "I checked this draft against the original information",
                        "मैंने मूल जानकारी से यह ड्राफ्ट जाँचा",
                      )}
                      selected={confirmed}
                      onPress={() => {
                        if (!busy) setConfirmed(!confirmed);
                      }}
                    />
                  ) : null}
                  <Text style={s.muted}>
                    {tr(
                      "Accepting records your review only. Save any note or work change through its normal form.",
                      "स्वीकार करने से केवल समीक्षा दर्ज होती है। नोट या काम का बदलाव सामान्य फॉर्म से सेव करें।",
                    )}
                  </Text>
                </>
              ) : null}
            </>
          ) : (
            <Text>
              {tr("Ask for a draft first.", "पहले ड्राफ्ट के लिए पूछें।")}
            </Text>
          )
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
