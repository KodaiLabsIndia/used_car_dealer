import { can } from "../application/access";
import { randomUUID } from "expo-crypto";
import { DocumentRequirements } from "../components/document-requirements";
import { formatDateTime } from "../components/date-format";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { CarDocument } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage, CarIdentity } from "../components/workspace";
import { BusinessForm } from "../components/business-form";
import { PhotoCamera } from "../components/photo-camera";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { preparePhoto } from "../adapters/photo";
import {
  loadLocal,
  saveLocal,
  deleteLocal,
  type PhotoDraft,
} from "../adapters/local-store";
import { sendCommand } from "../application/send-command";
const categories = [
  ["registration", "Registration"],
  ["purchase", "Purchase"],
  ["invoice", "Invoice"],
  ["payment", "Payment receipt"],
  ["sale", "Sale / handover"],
  ["warranty", "Warranty"],
  ["transfer", "Ownership transfer"],
  ["other", "Other"],
] as const;
const hindi = [
  "पंजीकरण",
  "खरीद",
  "बिल",
  "भुगतान रसीद",
  "बिक्री / डिलीवरी",
  "वारंटी",
  "मालिकाना ट्रांसफर",
  "अन्य",
];
export function DocumentsScreen({ route }: ScreenProps<"Documents">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    tr = (en: string, h: string) => (hi ? h : en),
    key = `document-photo:${route.params.carId}`;
  const [section, setSection] = useState<"pages" | "add" | "requirements">(
      "pages",
    ),
    [offset, setOffset] = useState(0),
    [photo, setPhoto] = useState<PhotoDraft | null>(null),
    [camera, setCamera] = useState(false),
    [labeling, setLabeling] = useState(false),
    [review, setReview] = useState<CarDocument | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const resource = useResource(
    `documents:${route.params.carId}:${offset}`,
    () => api.documents(route.params.carId, offset),
  );
  const requirements = useResource(
    `document-requirements:${route.params.carId}`,
    () => api.documentRequirements(route.params.carId),
  );
  const [binding, setBinding] = useState("");
  async function link(setId: string, ruleId: string, documentId: string) {
    setBusy(true);
    setError("");
    try {
      await api.linkDocumentRequirement(route.params.carId, setId, {
        commandId: randomUUID(),
        requirementId: ruleId,
        documentId,
      });
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void loadLocal<PhotoDraft>(session!.actor.id, key)
      .then((value) => {
        if (active) setPhoto(value);
      })
      .catch(() =>
        setError(
          tr("Could not restore the page draft.", "पेज का ड्राफ्ट नहीं खुला।"),
        ),
      );
    return () => {
      active = false;
    };
  }, [key]);
  async function prepared(source: {
    uri: string;
    width: number;
    height: number;
  }) {
    const next = await preparePhoto(source, session!.actor.id);
    await saveLocal(session!.actor.id, key, next);
    setPhoto(next);
  }
  async function gallery() {
    setBusy(true);
    setError("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw Error(
          tr(
            "Allow photo access to choose a page.",
            "पेज चुनने के लिए फोटो की अनुमति दें।",
          ),
        );
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!result.canceled && result.assets[0])
        await prepared(result.assets[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title={tr("Private documents", "निजी कागज़ात")}
      context={
        resource.data ? <CarIdentity car={resource.data.car} /> : undefined
      }
      selected={section}
      busy={busy || labeling || !!review}
      onChange={setSection}
      items={[
        {
          id: "requirements",
          label: tr("Checklist", "ज़रूरी सूची"),
          icon: "checkbox-outline",
        },
        { id: "pages", label: tr("Pages", "पेज"), icon: "documents-outline" },
        {
          id: "add",
          label: tr("Add page", "पेज जोड़ें"),
          icon: "camera-outline",
        },
      ]}
    >
      <PhotoCamera
        visible={camera}
        onClose={() => setCamera(false)}
        onPhoto={prepared}
      />
      {review ? (
        <BusinessForm
          key={review.id}
          spec={{
            key: `document-review:${review.id}`,
            title: tr("Review this page", "पेज की समीक्षा करें"),
            submitLabel: tr("Record review", "समीक्षा दर्ज करें"),
            steps: [
              {
                label: tr("Review", "समीक्षा"),
                fields: [
                  {
                    key: "decision",
                    label: tr("Decision", "फैसला"),
                    kind: "select",
                    initial: "accepted",
                    options: [
                      { id: "accepted", label: tr("Accept", "मंज़ूर") },
                      {
                        id: "rejected",
                        label: tr("Reject / retake", "अस्वीकार / फिर लें"),
                      },
                    ],
                  },
                  { key: "reason", label: tr("Review note", "समीक्षा का नोट") },
                  {
                    key: "original",
                    label: tr(
                      "I checked against original information",
                      "मैंने मूल जानकारी से जाँच की",
                    ),
                    kind: "choice",
                  },
                ],
              },
            ],
          }}
          version={review.version}
          summary={review.title}
          onBusyChange={setBusy}
          onCancel={() => setReview(null)}
          onSubmit={async (v, version) => {
            await sendCommand(
              session!.actor.id,
              `document-review:${review.id}`,
              {
                expectedVersion: version,
                decision:
                  v.decision === "rejected"
                    ? ("rejected" as const)
                    : ("accepted" as const),
                reason: v.reason || "",
                originalChecked: v.original === "yes",
              },
              (body) => api.reviewDocument(review.id, body),
            );
            setReview(null);
            changed();
            return true;
          }}
        />
      ) : labeling && photo ? (
        <BusinessForm
          key={`${photo.id}:${binding}`}
          spec={{
            key: `document-label:${photo.id}:${binding}`,
            title: tr("Label this page", "इस पेज का नाम दें"),
            submitLabel: tr("Upload prepared page", "तैयार पेज भेजें"),
            steps: [
              {
                label: tr("Details", "विवरण"),
                fields: [
                  { key: "title", label: tr("Page title", "पेज का नाम") },
                  {
                    key: "category",
                    label: tr("Document type", "कागज़ात का प्रकार"),
                    kind: "select",
                    initial: "registration",
                    options: categories.map(([id, label], i) => ({
                      id,
                      label: hi ? hindi[i]! : label,
                    })),
                  },
                  {
                    key: "requirement",
                    label: tr(
                      "Document requirement · optional",
                      "ज़रूरी सूची से जोड़ें · वैकल्पिक",
                    ),
                    kind: "select",
                    initial: binding,
                    options: [
                      {
                        id: "",
                        label: tr("General document", "सामान्य दस्तावेज़"),
                      },
                      ...(requirements.data?.sets
                        .filter((set) => !set.locked)
                        .flatMap((set) =>
                          set.items.map((item) => ({
                            id: `${set.id}::${item.rule.id}`,
                            label: `${set.stage} · ${language === "mr" ? item.rule.titleMr : hi ? item.rule.titleHi : item.rule.title}`,
                          })),
                        ) ?? []),
                    ],
                  },
                  {
                    key: "reference",
                    label: tr(
                      "Bill / document reference (optional)",
                      "बिल / कागज़ात संदर्भ (वैकल्पिक)",
                    ),
                  },
                ],
              },
            ],
          }}
          version={1}
          summary={resource.data?.car.registration ?? ""}
          onBusyChange={setBusy}
          onCancel={() => setLabeling(false)}
          onSubmit={async (v) => {
            await api.uploadDocument(route.params.carId, photo.id, photo.uri, {
              title: v.title || "",
              category: v.category || "other",
              reference: v.reference || "",
            });
            if (v.requirement) {
              const [setId, requirementId] = v.requirement.split("::");
              if (setId && requirementId)
                await api.linkDocumentRequirement(route.params.carId, setId, {
                  commandId: photo.id,
                  requirementId,
                  documentId: photo.id,
                });
            }
            setBinding("");
            await deleteLocal(session!.actor.id, key);
            void FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
              () => {},
            );
            setPhoto(null);
            setLabeling(false);
            setSection("pages");
            changed();
            return true;
          }}
        />
      ) : (
        <FocusPage
          scrollKey={`${section}:${offset}`}
          footer={
            section === "add" ? (
              photo ? (
                <Button
                  label={tr("Use this page", "यह पेज लें")}
                  disabled={busy}
                  onPress={() => setLabeling(true)}
                />
              ) : (
                <Button
                  label={tr("Photograph a page", "पेज की फोटो लें")}
                  icon="camera-outline"
                  disabled={busy}
                  onPress={() => setCamera(true)}
                />
              )
            ) : (
              <ActionRow>
                <Button
                  secondary
                  label={tr("Previous", "पिछला")}
                  disabled={!offset || resource.loading}
                  onPress={() => setOffset(Math.max(0, offset - 30))}
                  style={{ flex: 1 }}
                />
                <Button
                  label={tr("Add page", "पेज जोड़ें")}
                  onPress={() => setSection("add")}
                  style={{ flex: 2 }}
                />
                <Button
                  secondary
                  label={tr("Next", "अगला")}
                  disabled={
                    resource.loading || (resource.data?.items.length ?? 0) < 30
                  }
                  onPress={() => setOffset(offset + 30)}
                  style={{ flex: 1 }}
                />
              </ActionRow>
            )
          }
        >
          {error || resource.error ? (
            <ErrorNotice
              message={error || resource.error}
              retry={resource.refresh}
            />
          ) : null}
          {resource.loading && !resource.data ? (
            <ActivityIndicator color="#fff" />
          ) : null}
          {section === "requirements" ? (
            requirements.data ? (
              <DocumentRequirements
                data={requirements.data}
                pages={resource.data?.items ?? []}
                busy={busy}
                onLink={link}
                onAdd={(value) => {
                  setBinding(value);
                  setSection("add");
                }}
                onAssign={async (stage) => {
                  setBusy(true);
                  setError("");
                  try {
                    await api.assignDocumentRequirements(route.params.carId, {
                      commandId: randomUUID(),
                      stage,
                    });
                    changed();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : requirements.error ? (
              <ErrorNotice
                message={requirements.error}
                retry={requirements.refresh}
              />
            ) : (
              <ActivityIndicator color="#fff" />
            )
          ) : section === "add" ? (
            <>
              <Text style={s.title}>
                {tr(
                  "One page. Clear and readable.",
                  "एक पेज। साफ़ और पढ़ने योग्य।",
                )}
              </Text>
              <Text style={s.muted}>
                {tr(
                  "Fit all edges in the frame. Avoid glare. Add a separate close-up if small print is unreadable.",
                  "पूरे पेज को फ्रेम में रखें। चमक से बचें। छोटे अक्षर न दिखें तो अलग पास की फोटो लें।",
                )}
              </Text>
              {photo ? (
                <Image
                  source={{ uri: photo.uri }}
                  accessibilityLabel={tr(
                    "Prepared page preview",
                    "तैयार पेज की झलक",
                  )}
                  resizeMode="contain"
                  style={{ width: "100%", height: 320 }}
                />
              ) : null}
              <Button
                secondary
                label={tr("Choose a photo", "फोटो चुनें")}
                disabled={busy}
                onPress={() => void gallery()}
              />
              {photo ? (
                <Button
                  secondary
                  label={tr("Retake page", "पेज फिर लें")}
                  disabled={busy}
                  onPress={() => setCamera(true)}
                />
              ) : null}
            </>
          ) : (
            <>
              {resource.data?.items.map((d) => (
                <Panel key={d.id} style={{ gap: 14 }}>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <Text style={{ fontSize: 21, fontWeight: "600", flex: 1 }}>
                      {d.title}
                    </Text>
                    <Pill label={d.status} warning={d.status !== "accepted"} />
                  </View>
                  <Image
                    source={api.documentUri(d.id)}
                    resizeMode="contain"
                    accessibilityLabel={d.title}
                    style={{ width: "100%", height: 250 }}
                  />
                  <Text style={s.muted}>
                    {categories.find((c) => c[0] === d.category)?.[1]} ·{" "}
                    {d.reference}
                  </Text>
                  <Text style={s.muted}>
                    {d.recordedByName} · {formatDateTime(d.createdAt, language)}
                  </Text>
                  {d.reviewedByName ? (
                    <Text>
                      {d.reviewedByName} · {d.reviewReason}
                      {d.selfReview
                        ? ` · ${tr("same person reviewed", "उसी व्यक्ति ने समीक्षा की")}`
                        : ""}
                    </Text>
                  ) : can(session!.actor, "finance") ? (
                    <Button
                      secondary
                      label={tr("Review page", "पेज की समीक्षा करें")}
                      onPress={() => setReview(d)}
                    />
                  ) : null}
                </Panel>
              ))}
              {!resource.loading &&
              !resource.error &&
              !resource.data?.items.length ? (
                <Text>
                  {tr(
                    "No document pages uploaded yet.",
                    "अभी कागज़ात के पेज नहीं भेजे गए।",
                  )}
                </Text>
              ) : null}
            </>
          )}
        </FocusPage>
      )}
    </Workspace>
  );
}
