import { formatDateTime } from "../components/date-format";
import React, { useEffect, useState } from "react";
import { Alert, AppState, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import {
  canPrepareVideo,
  prepareVideo,
  preserveVideoSource,
  cancelVideoPreparation,
  type PreparedVideo,
} from "../adapters/video";
import { Workspace, FocusPage } from "../components/workspace";
import { Button, ErrorNotice, Panel, Pill, Text, s } from "../components/ui";
import { VideoCamera } from "../components/video-camera";
type ClipDraft = { id: string; source: string; prepared: PreparedVideo | null };
function Player({
  source,
}: {
  source: { uri: string; headers?: Record<string, string> };
}) {
  const player = useVideoPlayer(source);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 240 }}
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}
export function ClipsScreen({ route }: ScreenProps<"Clips">) {
  const { api, session, language, changed } = useApp(),
    user = session!.actor,
    hi = language === "hi",
    tr = (en: string, hn: string) => (hi ? hn : en),
    { taskId, itemId } = route.params,
    key = `clip-draft:${taskId}:${itemId}`;
  const [draft, setDraft] = useState<ClipDraft | null>(null),
    [view, setView] = useState<"saved" | "add">(
      route.params.initialView || "saved",
    ),
    [camera, setCamera] = useState(false),
    [operation, setOperation] = useState<"preparing" | "uploading" | null>(
      null,
    ),
    [error, setError] = useState("");
  const busy = operation !== null;
  const resource = useResource(
    `clip-context:${taskId}:${itemId}`,
    async () => ({
      task: await api.task(taskId),
      clips: await api.clips(taskId),
    }),
  );
  const editable =
    resource.data?.task.assignedTo === user.id &&
    !["submitted", "completed"].includes(resource.data.task.status);
  useEffect(() => {
    setView(route.params.initialView || "saved");
  }, [taskId, itemId, route.params.initialView]);
  useEffect(() => {
    let active = true;
    void loadLocal<ClipDraft>(user.id, key)
      .then(async (saved) => {
        const prior =
          saved ??
          (await loadLocal<ClipDraft>(user.id, `clip:${taskId}:${itemId}`));
        const v =
          prior &&
          typeof prior.source === "string" &&
          typeof prior.id === "string"
            ? prior
            : null;
        if (active) {
          setDraft(v);
          if (v) setView("add");
        }
        if (!saved && v) await saveLocal(user.id, key, v);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [key, user.id]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void cancelVideoPreparation();
    });
    return () => {
      subscription.remove();
      void cancelVideoPreparation();
    };
  }, []);
  async function prepare(value: ClipDraft) {
    setOperation("preparing");
    setError("");
    try {
      const prepared = await prepareVideo(value.source, user.id),
        next = { ...value, prepared };
      await saveLocal(user.id, key, next);
      setDraft(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function selected(uri: string) {
    setOperation("preparing");
    setError("");
    try {
      const source = await preserveVideoSource(uri, user.id),
        next = { id: Crypto.randomUUID(), source, prepared: null };
      await saveLocal(user.id, key, next);
      const previous = draft;
      setDraft(next);
      setView("add");
      if (previous)
        await Promise.allSettled([
          FileSystem.deleteAsync(previous.source, { idempotent: true }),
          ...(previous.prepared
            ? [
                FileSystem.deleteAsync(previous.prepared.uri, {
                  idempotent: true,
                }),
              ]
            : []),
        ]);
      if (AppState.currentState === "active") await prepare(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function gallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets[0])
        await selected(result.assets[0].uri);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function replaceClip(action: () => void) {
    Alert.alert(
      tr("Replace the unsent clip?", "बिना भेजा वीडियो बदलें?"),
      tr(
        "The current clip stays saved until you finish choosing or recording its replacement.",
        "नया वीडियो चुनने या रिकॉर्ड करने तक अभी का वीडियो सेव रहेगा।",
      ),
      [
        { text: tr("Keep clip", "अभी का रखें"), style: "cancel" },
        { text: tr("Choose replacement", "नया लें"), onPress: action },
      ],
    );
  }
  async function discard() {
    if (!draft) return;
    setOperation("preparing");
    setError("");
    try {
      await deleteLocal(user.id, key);
      await deleteLocal(user.id, `clip:${taskId}:${itemId}`);
      const previous = draft;
      setDraft(null);
      await Promise.allSettled([
        FileSystem.deleteAsync(previous.source, { idempotent: true }),
        ...(previous.prepared
          ? [
              FileSystem.deleteAsync(previous.prepared.uri, {
                idempotent: true,
              }),
            ]
          : []),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function upload() {
    if (!draft?.prepared) return;
    setOperation("uploading");
    setError("");
    try {
      await api.uploadClip(taskId, itemId, draft.id, draft.prepared.uri);
      await deleteLocal(user.id, key);
      await deleteLocal(user.id, `clip:${taskId}:${itemId}`);
      await Promise.allSettled([
        FileSystem.deleteAsync(draft.source, { idempotent: true }),
        FileSystem.deleteAsync(draft.prepared.uri, { idempotent: true }),
      ]);
      setDraft(null);
      setView("saved");
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  return (
    <Workspace
      title={tr("Check video clips", "जाँच के वीडियो")}
      selected={view}
      busy={busy}
      onChange={setView}
      items={[
        { id: "saved", label: tr("Uploaded", "भेजे गए"), icon: "film-outline" },
        {
          id: "add",
          label: tr("Add clip", "वीडियो जोड़ें"),
          icon: "videocam-outline",
        },
      ]}
    >
      <VideoCamera
        visible={camera}
        onClose={() => setCamera(false)}
        onVideo={selected}
      />
      <FocusPage
        scrollKey={view}
        footer={
          view === "add" && draft?.prepared ? (
            <Button
              label={tr("Upload prepared clip", "तैयार वीडियो भेजें")}
              busy={busy}
              disabled={!editable}
              onPress={() => void upload()}
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
        <Text style={s.muted}>
          {resource.data?.task.car.registration} ·{" "}
          {
            resource.data?.task.items.find((i) => i.id === itemId)?.[
              hi ? "titleHi" : "title"
            ]
          }
        </Text>
        {view === "add" ? (
          <>
            <Text style={s.title}>
              {tr("Show it. Explain it.", "दिखाएँ। समझाएँ।")}
            </Text>
            <Text>
              {tr(
                "Clips support the check. The required photo and your result are still needed.",
                "वीडियो जाँच में मदद करता है। ज़रूरी फोटो और आपका नतीजा भी चाहिए।",
              )}
            </Text>
            {!canPrepareVideo ? (
              <Panel>
                <Text>
                  {tr(
                    "Video preparation needs the Arihant development build. Expo Go can play uploaded clips; it cannot upload original videos.",
                    "वीडियो तैयार करने के लिए Arihant डेवलपमेंट बिल्ड चाहिए। Expo Go भेजे वीडियो चला सकता है; मूल वीडियो नहीं भेजता।",
                  )}
                </Text>
              </Panel>
            ) : null}
            {draft ? (
              <>
                <Pill
                  label={
                    operation === "uploading"
                      ? tr(
                          "Sending for verification…",
                          "जाँच के लिए भेज रहे हैं…",
                        )
                      : busy
                        ? tr("Preparing on phone…", "फोन पर तैयार हो रहा…")
                        : draft.prepared
                          ? tr(
                              "Prepared on phone · not uploaded",
                              "फोन पर तैयार · अभी भेजा नहीं",
                            )
                          : tr(
                              "Saved on phone · preparation needed",
                              "फोन पर सेव · तैयार करना बाकी",
                            )
                  }
                  warning
                />
                {draft.prepared ? (
                  <Player source={{ uri: draft.prepared.uri }} />
                ) : (
                  <Button
                    label={tr("Retry preparation", "फिर तैयार करें")}
                    disabled={!canPrepareVideo || busy}
                    onPress={() => void prepare(draft)}
                  />
                )}
                {operation === "preparing" ? (
                  <Button
                    secondary
                    label={tr("Stop preparation", "तैयार करना रोकें")}
                    onPress={() => void cancelVideoPreparation()}
                  />
                ) : null}
                {!busy ? (
                  <>
                    <Button
                      secondary
                      label={tr(
                        "Record a replacement",
                        "नया वीडियो रिकॉर्ड करें",
                      )}
                      disabled={!canPrepareVideo || !editable}
                      onPress={() => replaceClip(() => setCamera(true))}
                    />
                    <Button
                      secondary
                      label={tr("Choose a replacement", "दूसरा वीडियो चुनें")}
                      disabled={!canPrepareVideo || !editable}
                      onPress={() => replaceClip(() => void gallery())}
                    />
                    <Button
                      secondary
                      label={tr("Remove unsent clip", "बिना भेजा वीडियो हटाएँ")}
                      onPress={() =>
                        Alert.alert(
                          tr(
                            "Remove this unsent clip?",
                            "यह बिना भेजा वीडियो हटाएँ?",
                          ),
                          tr(
                            "This removes only this phone draft. Uploaded clips remain in the check history.",
                            "इस फोन का यह ड्राफ्ट हटेगा। भेजे गए वीडियो जाँच के इतिहास में रहेंगे।",
                          ),
                          [
                            {
                              text: tr("Keep clip", "वीडियो रखें"),
                              style: "cancel",
                            },
                            {
                              text: tr("Remove", "हटाएँ"),
                              style: "destructive",
                              onPress: () => void discard(),
                            },
                          ],
                        )
                      }
                    />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Button
                  label={tr("Record a clip", "वीडियो लें")}
                  icon="videocam-outline"
                  disabled={!canPrepareVideo || !editable || busy}
                  onPress={() => setCamera(true)}
                />
                <Button
                  secondary
                  label={tr("Choose a video", "वीडियो चुनें")}
                  disabled={!canPrepareVideo || !editable || busy}
                  onPress={() => void gallery()}
                />
              </>
            )}
          </>
        ) : (
          <>
            {resource.data?.clips.items
              .filter((c) => c.itemId === itemId)
              .map((c) => (
                <Panel key={c.id}>
                  <Player source={api.clipUri(c.id)} />
                  <View style={s.row}>
                    <Pill label={tr("Server verified", "सर्वर पर जाँचा")} />
                    <Text>{(c.durationMs / 1000).toFixed(1)} s</Text>
                  </View>
                  <Text style={s.muted}>
                    {c.recordedByName} · {formatDateTime(c.createdAt, language)}
                  </Text>
                </Panel>
              ))}
            {!resource.loading &&
            !resource.data?.clips.items.some((c) => c.itemId === itemId) ? (
              <Text>
                {tr(
                  "No clips for this check yet.",
                  "इस जाँच के लिए अभी वीडियो नहीं।",
                )}
              </Text>
            ) : null}
          </>
        )}
      </FocusPage>
    </Workspace>
  );
}
