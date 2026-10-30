import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { randomUUID } from "expo-crypto";
import type { DocumentPolicy, DocumentRule } from "@arihant/contracts";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import { Field, Choice } from "../components/forms";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Text,
  s,
} from "../components/ui";

type Draft = {
  version: number;
  rules: DocumentRule[];
  reason: string;
  commandId: string;
};
const stages = ["purchase", "intake", "sale", "delivery"] as const;
export function CompanySettingsScreen() {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi";
  const tr = (en: string, h: string, mr: string) =>
    language === "mr" ? mr : hi ? h : en;
  const resource = useResource("company-document-policy", () =>
    api.documentPolicy(),
  );
  const [draft, setDraft] = useState<Draft | null>(null),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [section, setSection] = useState<"policy" | "edit">("policy");
  const draftWrites = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void loadLocal<Draft>(session!.actor.id, "company-document-policy-draft")
      .then((v) => {
        if (active && v) setDraft(v);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  function update(next: Draft) {
    next = { ...next, commandId: randomUUID() };
    setDraft(next);
    draftWrites.current = draftWrites.current
      .catch(() => {})
      .then(() =>
        saveLocal(session!.actor.id, "company-document-policy-draft", next),
      );
    void draftWrites.current.catch((e) => setError(e.message));
  }
  function edit(policy: DocumentPolicy) {
    update({
      version: policy.version,
      rules: policy.rules.map((r) => ({ ...r })),
      reason: "",
      commandId: randomUUID(),
    });
    setIndex(0);
    setSection("edit");
  }
  const [stageFilter, setStageFilter] =
    useState<DocumentRule["stage"]>("purchase");
  const stageNames = {
    purchase: tr("Purchase", "खरीद", "खरेदी"),
    intake: tr("Intake", "प्राप्ति", "ताब्यात घेणे"),
    sale: tr("Sale", "बिक्री", "विक्री"),
    delivery: tr("Delivery", "डिलीवरी", "डिलिव्हरी"),
  };
  const item = draft?.rules[index];
  function patch(value: Partial<DocumentRule>) {
    if (draft && item)
      update({
        ...draft,
        rules: draft.rules.map((r, n) =>
          n === index ? { ...r, ...value } : r,
        ),
      });
  }
  async function publish() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await api.publishDocumentPolicy({
        commandId: draft.commandId,
        expectedVersion: draft.version,
        rules: draft.rules,
        reason: draft.reason,
      });
      await draftWrites.current.catch(() => {});
      await deleteLocal(session!.actor.id, "company-document-policy-draft");
      setDraft(null);
      setSection("policy");
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    setBusy(true);
    setError("");
    try {
      // Finish older saves before deleting, so they cannot restore a stale draft.
      await draftWrites.current.catch(() => {});
      await deleteLocal(session!.actor.id, "company-document-policy-draft");
      setDraft(null);
      setIndex(0);
      setSection("policy");
      resource.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title={tr("Company documents", "कंपनी के दस्तावेज़", "कंपनीची कागदपत्रे")}
      selected={section}
      onChange={setSection}
      busy={busy}
      items={[
        {
          id: "policy",
          label: tr("Published rules", "जारी नियम", "प्रकाशित नियम"),
          icon: "document-text-outline",
        },
        {
          id: "edit",
          label: tr("Edit draft", "ड्राफ्ट बदलें", "मसुदा बदला"),
          icon: "create-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={`${section}:${index}`}
        footer={
          section === "edit" && draft ? (
            <Button
              label={tr(
                "Review & publish",
                "जाँचकर जारी करें",
                "तपासून प्रकाशित करा",
              )}
              busy={busy}
              disabled={!draft.reason.trim() || !draft.rules.length}
              onPress={() =>
                Alert.alert(
                  tr(
                    "Publish this policy?",
                    "ये नियम जारी करें?",
                    "हे नियम प्रकाशित करायचे?",
                  ),
                  tr(
                    "New transactions use this version. Existing assigned requirements retain their original rules.",
                    "नई प्रक्रिया में यह संस्करण होगा। पहले सौंपी सूची के नियम नहीं बदलेंगे।",
                    "नवीन व्यवहारांना ही आवृत्ती लागू होईल. आधीच्या याद्यांचे नियम कायम राहतील.",
                  ),
                  [
                    { text: tr("Cancel", "रद्द", "रद्द"), style: "cancel" },
                    {
                      text: tr("Publish", "जारी करें", "प्रकाशित करा"),
                      onPress: () => void publish(),
                    },
                  ],
                )
              }
            />
          ) : undefined
        }
      >
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {draft ? (
          <View style={{ gap: 10 }}>
            {resource.data && draft.version !== resource.data.version ? (
              <Text style={s.muted}>
                {tr(
                  "The published rules changed. Discard this draft to start again from the latest version.",
                  "जारी नियम बदल गए हैं। नया संस्करण लेने के लिए यह ड्राफ्ट हटाकर फिर शुरू करें।",
                  "प्रकाशित नियम बदलले आहेत. नवीन आवृत्तीपासून सुरू करण्यासाठी हा मसुदा काढा.",
                )}
              </Text>
            ) : null}
            <Button
              secondary
              disabled={busy}
              label={tr("Discard draft", "ड्राफ्ट हटाएँ", "मसुदा काढा")}
              onPress={() =>
                Alert.alert(
                  tr(
                    "Discard this draft?",
                    "यह ड्राफ्ट हटाएँ?",
                    "हा मसुदा काढायचा?",
                  ),
                  tr(
                    "Your unpublished changes will be removed. Published rules and assigned checklists stay saved.",
                    "बिना जारी किए बदलाव हटेंगे। जारी नियम और सौंपी गई सूची सुरक्षित रहेंगे।",
                    "अप्रकाशित बदल काढले जातील. प्रकाशित नियम आणि नेमलेल्या याद्या जतन राहतील.",
                  ),
                  [
                    {
                      text: tr(
                        "Keep editing",
                        "बदलना जारी रखें",
                        "बदल सुरू ठेवा",
                      ),
                      style: "cancel",
                    },
                    {
                      text: tr("Discard", "हटाएँ", "काढा"),
                      style: "destructive",
                      onPress: () => void discard(),
                    },
                  ],
                )
              }
            />
          </View>
        ) : null}
        {!resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : section === "policy" ? (
          <>
            <Text style={s.title}>
              {resource.data.version
                ? `${tr("Version", "संस्करण", "आवृत्ती")} ${resource.data.version}`
                : tr(
                    "Editable starter checklist",
                    "बदलने योग्य शुरुआती सूची",
                    "बदलता येणारी सुरुवातीची यादी",
                  )}
            </Text>
            <Text>
              {tr(
                "These are company document rules. Starter items need your review before publishing.",
                "ये कंपनी के दस्तावेज़ नियम हैं। जारी करने से पहले शुरुआती सूची की समीक्षा करें।",
                "हे कंपनीच्या कागदपत्रांचे नियम आहेत. प्रकाशित करण्यापूर्वी सुरुवातीची यादी तपासा.",
              )}
            </Text>
            {resource.data.publishedByName ? (
              <Text>
                {resource.data.publishedByName} · {resource.data.reason}
              </Text>
            ) : null}
            <Button
              label={
                draft
                  ? tr("Continue draft", "ड्राफ्ट जारी रखें", "मसुदा पुढे भरा")
                  : tr("Configure checklist", "सूची तय करें", "यादी ठरवा")
              }
              onPress={() =>
                draft ? setSection("edit") : edit(resource.data!)
              }
            />
            <SelectField
              label={tr("Stage", "चरण", "टप्पा")}
              value={stageFilter}
              options={stages.map((id) => ({ id, label: stageNames[id] }))}
              onChange={(id) => setStageFilter(id as typeof stageFilter)}
            />
            {resource.data.rules
              .filter((r) => r.stage === stageFilter)
              .map((r) => (
                <Panel key={r.id}>
                  <Text style={s.label}>
                    {language === "mr" ? r.titleMr : hi ? r.titleHi : r.title}
                  </Text>
                  <Text>
                    {stageNames[r.stage]} ·{" "}
                    {r.required
                      ? tr("Required", "ज़रूरी", "आवश्यक")
                      : tr("Optional", "वैकल्पिक", "ऐच्छिक")}
                  </Text>
                  {r.applicability ? <Text>{r.applicability}</Text> : null}
                </Panel>
              ))}
          </>
        ) : !draft ? (
          <Button
            label={tr("Start editing", "बदलना शुरू करें", "बदल सुरू करा")}
            onPress={() => edit(resource.data!)}
          />
        ) : (
          <>
            <Field
              label={tr(
                "Reason for this version",
                "इस संस्करण का कारण",
                "या आवृत्तीचे कारण",
              )}
              value={draft.reason}
              onChangeText={(reason) =>
                update({ ...draft, reason, commandId: randomUUID() })
              }
              maxLength={1000}
              editable={!busy}
            />
            {item ? (
              <>
                <Text style={s.label}>
                  {index + 1} / {draft.rules.length}
                </Text>
                <ActionRow>
                  <Button
                    secondary
                    label={tr("Previous", "पिछला", "मागील")}
                    disabled={!index || busy}
                    onPress={() => setIndex(index - 1)}
                  />
                  <Button
                    secondary
                    label={tr("Next", "अगला", "पुढील")}
                    disabled={index === draft.rules.length - 1 || busy}
                    onPress={() => setIndex(index + 1)}
                  />
                </ActionRow>
                <SelectField
                  label={tr("Stage", "चरण", "टप्पा")}
                  value={item.stage}
                  options={stages.map((id) => ({ id, label: stageNames[id] }))}
                  disabled={busy}
                  onChange={(stage) =>
                    patch({ stage: stage as DocumentRule["stage"] })
                  }
                />
                <Field
                  label="English"
                  value={item.title}
                  onChangeText={(title) => patch({ title })}
                  maxLength={160}
                  editable={!busy}
                />
                <Field
                  label="हिंदी"
                  value={item.titleHi}
                  onChangeText={(titleHi) => patch({ titleHi })}
                  maxLength={160}
                  editable={!busy}
                />
                <Field
                  label="मराठी"
                  value={item.titleMr}
                  onChangeText={(titleMr) => patch({ titleMr })}
                  maxLength={160}
                  editable={!busy}
                />
                <Choice
                  label={tr(
                    "Required before this stage completes",
                    "चरण पूरा होने से पहले ज़रूरी",
                    "टप्पा पूर्ण होण्यापूर्वी आवश्यक",
                  )}
                  selected={item.required}
                  onPress={() => !busy && patch({ required: !item.required })}
                />
                <Field
                  label={tr(
                    "Applicability / staff instructions",
                    "कब लागू है / कर्मचारी के निर्देश",
                    "कधी लागू / कर्मचाऱ्यांसाठी सूचना",
                  )}
                  value={item.applicability}
                  onChangeText={(applicability) => patch({ applicability })}
                  multiline
                  maxLength={500}
                  editable={!busy}
                />
                <Text style={s.muted}>
                  {tr(
                    "Required items need an accepted document. Mark conditional items optional until the condition is confirmed.",
                    "ज़रूरी दस्तावेज़ की समीक्षा मंज़ूर होनी चाहिए। शर्त की पुष्टि तक शर्त वाले दस्तावेज़ वैकल्पिक रखें।",
                    "आवश्यक कागदपत्र तपासून स्वीकारलेले हवे. अट निश्चित होईपर्यंत सशर्त कागदपत्र ऐच्छिक ठेवा.",
                  )}
                </Text>
                <ActionRow>
                  {[-1, 1].map((dir) => (
                    <Button
                      key={dir}
                      secondary
                      label={
                        dir === -1
                          ? tr("Move up", "ऊपर करें", "वर हलवा")
                          : tr("Move down", "नीचे करें", "खाली हलवा")
                      }
                      disabled={
                        busy ||
                        index + dir < 0 ||
                        index + dir >= draft.rules.length
                      }
                      onPress={() => {
                        const rules = [...draft.rules];
                        [rules[index], rules[index + dir]] = [
                          rules[index + dir]!,
                          rules[index]!,
                        ];
                        update({ ...draft, rules });
                        setIndex(index + dir);
                      }}
                    />
                  ))}
                </ActionRow>
                <Button
                  secondary
                  label={tr("Remove item", "दस्तावेज़ हटाएँ", "कागदपत्र काढा")}
                  disabled={busy || draft.rules.length === 1}
                  onPress={() => {
                    update({
                      ...draft,
                      rules: draft.rules.filter((_, n) => n !== index),
                    });
                    setIndex(Math.max(0, index - 1));
                  }}
                />
              </>
            ) : null}
            <Button
              secondary
              label={tr("Add item", "दस्तावेज़ जोड़ें", "कागदपत्र जोडा")}
              disabled={busy || draft.rules.length >= 100}
              onPress={() => {
                update({
                  ...draft,
                  rules: [
                    ...draft.rules,
                    {
                      id: randomUUID(),
                      stage: "purchase",
                      title: "",
                      titleHi: "",
                      titleMr: "",
                      required: true,
                      applicability: "",
                    },
                  ],
                });
                setIndex(draft.rules.length);
              }}
            />
          </>
        )}
      </FocusPage>
    </Workspace>
  );
}
