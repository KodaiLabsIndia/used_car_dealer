import { uxText } from "../state/ux-copy";
import { useLayout } from "../components/layout";
import { InspectionSections } from "../components/inspection-sections";
import { useIsFocused } from "@react-navigation/native";
import { can } from "../application/access";
import { Workspace, FocusPage, CarIdentity } from "../components/workspace";
import { useSection } from "../state/use-section";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
  Image,
  Pressable,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import {
  inspectionPortion,
  allocationFor,
  checkRevision,
  writableChecks,
  type Task,
} from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { PhotoCamera } from "../components/photo-camera";
import {
  AllChecks,
  CheckStepper,
  InspectionNavigation,
} from "../components/inspection-navigation";
import {
  inspectionProgress,
  nextInspectionCheck,
} from "../application/inspection-index";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { loadLocal, saveLocal, type PhotoDraft } from "../adapters/local-store";
import { preparePhoto } from "../adapters/photo";
import {
  draftKey,
  sendTaskCommand,
  syncAnswer,
} from "../application/inspection-sync";
export function TaskScreen({ route, navigation }: ScreenProps<"Task">) {
  const { api, session, t, language, changed } = useApp(),
    ownerId = session!.actor.id,
    owner = can(session!.actor, "review_inspection");
  const resource = useResource(`task:${route.params.id}`, () =>
    api.task(route.params.id),
  );
  const [phase, setPhase] = useSection(
    `inspection:${route.params.id}`,
    "sections",
    ["sections", "map", "photo", "result"] as const,
  );
  const [masterTask, setTask] = useState<Task | null>(null),
    [index, setIndex] = useState(0),
    [draft, setDraft] = useState<PhotoDraft | null>(null),
    [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [recheckSelection, setRecheckSelection] = useState<string[]>([]),
    [reviewNote, setReviewNote] = useState(""),
    [message, setMessage] = useState("");
  const task =
    masterTask && masterTask.collaborative && !owner
      ? inspectionPortion(masterTask, ownerId)
      : masterTask;
  const capture = useRef<{
    allocationVersion?: number;
    itemVersion?: number;
    itemId?: string;
    taskId?: string;
  }>({});
  const [allChecks, setAllChecks] = useState(false);
  const [inspectionSection, setInspectionSection] = useState<string | null>(
      null,
    ),
    [inspectionPart, setInspectionPart] = useState("");
  const [checkScope, setCheckScope] = useState<{
    zone?: string;
    componentId?: string;
  }>({});
  function showAllChecks() {
    setCheckScope({});
    setAllChecks(true);
  }
  useEffect(() => {
    let active = true;
    void loadLocal<number>(ownerId, `step:${route.params.id}`)
      .then((saved) => {
        if (active && !route.params.itemId)
          setIndex(
            Number.isInteger(saved) && saved !== null && saved >= 0 ? saved : 0,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ownerId, route.params.id]);
  function chooseStep(value: number) {
    if (busy) return;
    setPhase("photo");
    setIndex(value);
    void saveLocal(ownerId, `step:${route.params.id}`, value).catch(() => {});
  }
  useEffect(() => {
    setTask(resource.data);
  }, [resource.data]);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || busy || camera || (draft && !draft.synced)) return;
    const tick = () => {
      if (AppState.currentState === "active") resource.refreshQuiet();
    };
    tick();
    const timer = setInterval(tick, 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [focused, busy, camera, !!draft && !draft.synced]);
  const layout = useLayout();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  useEffect(() => {
    if (!task) return;
    const target = route.params.itemId
      ? task.items.findIndex((i) => i.id === route.params.itemId)
      : -1;
    setIndex((prior) =>
      target >= 0
        ? target
        : Math.min(prior, Math.max(0, task.items.length - 1)),
    );
    if (target >= 0) setPhase("photo");
  }, [task?.id, task?.items.map((i) => i.id).join("|"), route.params.itemId]);
  const item = task?.items[index],
    allocation = allocationFor(task, item?.id),
    answer = task?.answers.find((a) => a.itemId === item?.id),
    own = task?.collaborative
      ? allocation?.assignedTo === ownerId
      : task?.assignedTo === ownerId,
    readOnly = task?.collaborative
      ? !own ||
        !["assigned", "in_progress", "recheck"].includes(
          allocation?.state ?? "",
        ) ||
        masterTask?.status === "completed"
      : !own || task?.status === "submitted" || task?.status === "completed";
  function pinCapture() {
    capture.current = {
      ...(task?.collaborative && allocation
        ? {
            allocationVersion: allocation.assignmentVersion,
            itemVersion: allocation.version,
          }
        : {}),
      ...(item && task ? { itemId: item.id, taskId: task.id } : {}),
    };
  }
  function openCamera() {
    pinCapture();
    setCamera(true);
  }
  const preview =
    draft?.uri && !readOnly
      ? { uri: draft.uri }
      : answer
        ? api.evidenceUri(answer.evidenceId)
        : null;
  useEffect(() => {
    let active = true;
    setInstructionsOpen(false);
    setDraft(null);
    setMessage("");
    if (item)
      void loadLocal<PhotoDraft>(
        ownerId,
        draftKey(route.params.id, item.id),
      ).then((saved) => {
        if (active) setDraft(saved);
      });
    return () => {
      active = false;
    };
  }, [item?.id, ownerId, focused]);
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
  async function prepared(photo: {
    uri: string;
    width: number;
    height: number;
  }) {
    if (!item) return;
    setBusy(true);
    try {
      const {
        itemId: capturedItem,
        taskId: capturedTask,
        ...pinned
      } = { ...capture.current };
      if (!capturedItem || !capturedTask)
        throw new Error("Open a check before taking its proof.");
      const next = { ...(await preparePhoto(photo, ownerId)), ...pinned };
      await saveLocal(ownerId, draftKey(capturedTask, capturedItem), next);
      if (capturedItem !== item.id || capturedTask !== route.params.id) {
        resource.refresh();
        return;
      }
      setDraft(next);
      setPhase("result");
      setMessage(t("savedPhone"));
    } finally {
      setBusy(false);
    }
  }
  async function gallery() {
    pinCapture();
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) {
      setMessage(t("noCamera"));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0])
        await prepared(result.assets[0]);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function editDraft(patch: Partial<PhotoDraft>) {
    if (!draft || !item) return;
    const { commandId: _command, expectedVersion: _version, ...fresh } = draft;
    const next = {
      ...fresh,
      ...patch,
      ...(draft.synced && task?.collaborative
        ? { itemVersion: allocation?.version ?? null }
        : {}),
      synced: false,
    };
    setDraft(next);
    await saveLocal(ownerId, draftKey(route.params.id, item.id), next);
  }
  async function saved() {
    if (!task || !item || !draft?.result) {
      setMessage(t("photoRequired"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const updated = await syncAnswer(
        api,
        ownerId,
        masterTask!,
        item.id,
        draft,
      );
      setTask(updated.task);
      setDraft(updated.draft);
      setMessage(
        uxText(
          language,
          "Check saved. Send ready checks for review.",
          "जाँच सेव हुई। तैयार जाँच समीक्षा को भेजें।",
        ),
      );
      changed(uxText(language, "Check saved", "जाँच सेव हुई"));
      const scoped =
        updated.task.collaborative && !owner
          ? inspectionPortion(updated.task, ownerId)
          : updated.task;
      const next = nextInspectionCheck(scoped, ownerId, index);
      if (next === null) setPhase("sections");
      else if (scoped.items[next]?.id !== item.id) {
        setIndex(next);
        setPhase("photo");
        void saveLocal(ownerId, `step:${route.params.id}`, next).catch(
          () => {},
        );
      } else setPhase("result");
    } catch (e) {
      const err = e as { code?: string; message: string };
      setMessage(
        err.code === "VERSION_CONFLICT" ? t("changeNotice") : err.message,
      );
      if (
        [
          "VERSION_CONFLICT",
          "ALLOCATION_CHANGED",
          "CHECK_NOT_ASSIGNED",
          "READ_ONLY",
          "NOT_FOUND",
        ].includes(err.code ?? "")
      ) {
        const { commandId: _c, expectedVersion: _v, ...clean } = draft;
        await saveLocal(ownerId, draftKey(task.id, item.id), clean);
        setDraft(clean);
        resource.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  async function run(
    action: "submit" | "takeover" | "help" | "accept" | "recheck",
  ) {
    if (!task) return;
    setBusy(true);
    setMessage("");
    try {
      const payload =
        action === "submit" && task.collaborative
          ? {
              action: "submit_checks" as const,
              checks: readyChecks.map(checkRevision),
            }
          : action === "accept" || action === "recheck"
            ? {
                action: "review" as const,
                decision:
                  action === "accept"
                    ? ("accept" as const)
                    : ("recheck" as const),
                ...(action === "recheck"
                  ? { recheckItemIds: recheckSelection }
                  : {}),
                note: reviewNote,
              }
            : action === "help"
              ? {
                  action: "help" as const,
                  ...(item ? { itemId: item.id } : {}),
                  note: "",
                  allocationVersion: allocation?.assignmentVersion ?? null,
                }
              : { action };
      const updated = await sendTaskCommand(api, ownerId, masterTask!, payload);
      setTask(updated);
      changed(
        action === "submit"
          ? t("submitted")
          : action === "accept"
            ? t("completed")
            : action === "recheck"
              ? t("recheck")
              : action === "help"
                ? t("helpSent")
                : t("received"),
      );
      setMessage(
        action === "help"
          ? t("helpSent")
          : action === "submit"
            ? t("submitted")
            : action === "accept"
              ? t("completed")
              : action === "recheck"
                ? t("recheck")
                : t("received"),
      );
    } catch (e) {
      setMessage((e as Error).message);
      resource.refresh();
    } finally {
      setBusy(false);
    }
  }
  function confirmReview(action: "accept" | "recheck") {
    Alert.alert(
      t("review"),
      (task?.submittedBy || task?.assignedTo) === ownerId
        ? t("reviewSelf")
        : action === "recheck"
          ? `${recheckSelection.length || task?.items.length} ${language === "hi" ? "जाँच दोबारा करनी हैं" : "checks will need new photos"}`
          : t("accept"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), onPress: () => void run(action) },
      ],
    );
  }
  function reconfirmDraft() {
    if (!draft || !allocation || readOnly) return;
    Alert.alert(
      language === "hi"
        ? "नया नतीजा देखें"
        : language === "mr"
          ? "नवीन निकाल तपासा"
          : "Review the latest result",
      language === "hi"
        ? "पहले मौजूदा नतीजा और फोटो देखें। पुष्टि के बाद आपका ड्राफ्ट इसी जाँच के नए संस्करण पर भेजा जा सकेगा।"
        : language === "mr"
          ? "आधी सध्याचा निकाल व फोटो तपासा. पुष्टीनंतर हा मसुदा नवीन आवृत्तीवर पाठवता येईल."
          : "Read the current result and photo first. Confirming prepares this draft to replace the latest result; you still need to press Save.",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: () => {
            const { commandId: _c, expectedVersion: _v, ...rest } = draft;
            const next = {
              ...rest,
              itemVersion: allocation.version,
              synced: false,
            };
            setDraft(next);
            void saveLocal(
              ownerId,
              draftKey(route.params.id, allocation.itemId),
              next,
            );
          },
        },
      ],
    );
  }
  function submit() {
    Alert.alert(t("send"), t("sendConfirmation"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("confirm"), onPress: () => void run("submit") },
    ]);
  }
  const complete = task ? inspectionProgress(task).missing.length === 0 : false;
  const readyChecks = masterTask?.collaborative
    ? writableChecks(masterTask, ownerId).filter((a) => {
        const check = masterTask.items.find((i) => i.id === a.itemId)!;
        const result = masterTask.answers.find((v) => v.itemId === a.itemId);
        return (
          !!result &&
          result.result !== "unable" &&
          inspectionProgress({
            ...masterTask,
            items: [{ ...check, required: true }],
          }).missing.length === 0
        );
      })
    : [];
  const readyToSubmit =
    (task?.collaborative ? readyChecks.length > 0 : complete) &&
    (!draft || draft.synced === true);
  const sendLabel = task?.collaborative
    ? `${language === "mr" ? "तयार तपासण्या पाठवा" : language === "hi" ? "तैयार जाँच भेजें" : "Send ready checks"} · ${readyChecks.length}`
    : t("send");
  const nextWork = task
    ? nextInspectionCheck(task, ownerId, index, !!draft && !draft.synced)
    : null;
  const footer =
    task && item ? (
      phase === "map" || phase === "sections" ? (
        <ActionRow>
          <Button
            label={uxText(
              language,
              nextWork === null ? "View checks" : "Continue inspection",
              nextWork === null ? "जाँच देखें" : "जाँच जारी रखें",
            )}
            icon="clipboard-outline"
            secondary={nextWork === null && !!own && readyToSubmit}
            disabled={busy}
            onPress={() => chooseStep(nextWork ?? index)}
          />
          {own && readyToSubmit ? (
            <Button
              label={sendLabel}
              secondary={nextWork !== null}
              icon="arrow-forward-outline"
              busy={busy}
              onPress={submit}
            />
          ) : null}
        </ActionRow>
      ) : phase === "photo" ? (
        <ActionRow>
          {!readOnly ? (
            <Button
              label={
                language === "mr"
                  ? "गॅलरी"
                  : uxText(language, "Gallery", "गैलरी")
              }
              accessibilityLabel={t("choosePhoto")}
              icon="images-outline"
              secondary
              disabled={busy}
              onPress={() => void gallery()}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={
              language === "mr"
                ? "निष्कर्ष"
                : language === "hi"
                  ? "नतीजा"
                  : "Result"
            }
            icon="arrow-forward-outline"
            disabled={busy || (!readOnly && !preview)}
            onPress={() => setPhase("result")}
            style={{ flex: 1 }}
          />
        </ActionRow>
      ) : !readOnly ? (
        <ActionRow>
          <Button
            label={uxText(language, "Photo", "फोटो")}
            secondary
            disabled={busy}
            onPress={() => setPhase("photo")}
            style={{ flex: 1 }}
          />
          {own && readyToSubmit ? (
            <Button
              label={sendLabel}
              icon="arrow-forward-outline"
              onPress={submit}
              busy={busy}
              style={{ flex: 2 }}
            />
          ) : (
            <Button
              label={
                index < task.items.length - 1
                  ? language === "hi"
                    ? "सेव करें और आगे"
                    : "Save & next"
                  : t("save")
              }
              icon="checkmark-outline"
              busy={busy}
              disabled={
                !draft?.result ||
                (["unable", "not_applicable"].includes(draft?.result || "") &&
                  (draft?.note.trim().length || 0) < 5) ||
                (["ok", "problem"].includes(draft?.result || "") &&
                  ((!!item.measurementUnit && draft?.reading == null) ||
                    (item.configurationPending &&
                      !draft?.applicabilityConfirmed))) ||
                (task.recheckItems.includes(item.id) &&
                  draft.id === answer?.evidenceId)
              }
              onPress={() => void saved()}
              style={{ flex: 2 }}
            />
          )}
        </ActionRow>
      ) : task.collaborative && owner ? (
        <Button
          label={
            language === "mr"
              ? "नेमणूक व तपासणी"
              : language === "hi"
                ? "काम बाँटें और समीक्षा"
                : "Allocation & review"
          }
          icon="people-outline"
          onPress={() =>
            navigation.navigate("InspectionAllocation", {
              taskId: task.id,
              section: allocation?.state === "submitted" ? "review" : "assign",
            })
          }
        />
      ) : owner && !task.collaborative && task.status === "submitted" ? (
        <ActionRow>
          <Button
            label={t("askRecheck")}
            secondary
            onPress={() => confirmReview("recheck")}
            busy={busy}
            style={{ flex: 1 }}
          />
          <Button
            label={t("accept")}
            icon="checkmark-done-outline"
            onPress={() => confirmReview("accept")}
            busy={busy}
            style={{ flex: 1 }}
          />
        </ActionRow>
      ) : owner && !["submitted", "completed"].includes(task.status) && !own ? (
        <Button
          label={t("takeover")}
          icon="person-outline"
          onPress={() => void run("takeover")}
          busy={busy}
        />
      ) : undefined
    ) : undefined;
  return (
    <>
      <Workspace
        title={
          task
            ? language === "hi"
              ? "गाड़ी की जाँच"
              : "Vehicle inspection"
            : t("work")
        }
        items={[
          {
            id: "sections",
            label:
              language === "mr"
                ? "विभाग"
                : language === "hi"
                  ? "हिस्से"
                  : "Sections",
            icon: "grid-outline",
          },
          {
            id: "map",
            label: language === "hi" ? "3D कार" : "3D car",
            icon: "car-outline",
          },
          {
            id: "photo",
            label:
              language === "mr"
                ? "पुरावा"
                : language === "hi"
                  ? "सबूत"
                  : "Proof",
            icon: "camera-outline",
          },
          {
            id: "result",
            label:
              language === "mr"
                ? "निष्कर्ष"
                : language === "hi"
                  ? "नतीजा"
                  : "Result",
            icon: "checkbox-outline",
          },
        ]}
        selected={phase}
        onChange={setPhase}
        busy={busy}
        context={
          task ? (
            <View style={{ gap: 5 }}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <CarIdentity
                    car={task.car}
                    onPress={() =>
                      navigation.navigate("Car", { id: task.carId })
                    }
                  />
                </View>
                {!readOnly ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("requestHelp")}
                    disabled={busy}
                    onPress={() =>
                      navigation.navigate("Help", {
                        taskId: task.id,
                        ...(item ? { itemId: item.id } : {}),
                      })
                    }
                    style={{
                      minWidth: 52,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="help-circle-outline" />
                    <Text style={{ fontSize: 11, lineHeight: 17 }}>
                      {language === "mr"
                        ? "मदत"
                        : language === "hi"
                          ? "मदद"
                          : "Help"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {phase === "sections" || phase === "map" ? (
                <Text
                  style={{ fontSize: 10, lineHeight: 16, color: colors.muted }}
                >
                  {task.kind === "reference"
                    ? t("checklistSample")
                    : `${task.templateName} · v${task.templateVersion}${task.templateApproved ? "" : language === "hi" ? " · ड्राफ्ट · प्रशिक्षण" : " · Draft · training"}`}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
      >
        <FocusPage
          refreshControl={
            <RefreshControl
              refreshing={resource.loading}
              onRefresh={resource.refresh}
              tintColor="#fff"
            />
          }
          widthLimit={phase === "photo" || phase === "result" ? 800 : 1280}
          scrollKey={`${index}:${phase}`}
          top={
            task && item ? (
              <CheckStepper
                index={index}
                total={task.items.length}
                hi={language === "hi"}
                disabled={busy}
                onSelect={chooseStep}
                onOpen={showAllChecks}
              />
            ) : undefined
          }
          footer={footer}
        >
          {resource.error ? (
            <ErrorNotice
              message={resource.offline ? t("offline") : resource.error}
              retry={resource.refresh}
            />
          ) : null}
          {task?.collaborative ? (
            <Panel style={{ gap: 10 }}>
              <Text style={{ fontWeight: "600" }}>
                {language === "mr"
                  ? "नेमलेल्या तपासण्या"
                  : language === "hi"
                    ? "सौंपी गई जाँच"
                    : owner
                      ? "Inspection progress"
                      : "Allocated checks"}
              </Text>
              <Text style={s.muted}>
                {task.items.length} / {masterTask?.items.length}{" "}
                {language === "mr"
                  ? "तपासण्या येथे दिसतात"
                  : language === "hi"
                    ? "जाँच यहाँ दिखती हैं"
                    : "checks shown here"}{" "}
                ·{" "}
                {
                  masterTask?.allocations.filter(
                    (a) => a.state === "accepted" || a.state === "waived",
                  ).length
                }{" "}
                {language === "mr"
                  ? "एकूण पूर्ण"
                  : language === "hi"
                    ? "कुल पूरी"
                    : "resolved overall"}
              </Text>
              {readyToSubmit ? (
                <Button label={sendLabel} disabled={busy} onPress={submit} />
              ) : null}
              {owner ? (
                <Button
                  secondary
                  label={
                    language === "mr"
                      ? "नेमणूक व तपासणी"
                      : language === "hi"
                        ? "काम बाँटें और समीक्षा"
                        : "Allocation & review"
                  }
                  icon="people-outline"
                  onPress={() =>
                    navigation.navigate("InspectionAllocation", {
                      taskId: task.id,
                      section: masterTask?.allocations.some(
                        (a) => a.state === "submitted",
                      )
                        ? "review"
                        : "assign",
                    })
                  }
                />
              ) : null}
              {masterTask?.answers.some(
                (a) =>
                  a.result === "problem" &&
                  masterTask.items.find((i) => i.id === a.itemId)?.critical,
              ) ? (
                <Text style={{ color: colors.amber }}>
                  {language === "mr"
                    ? "सुरक्षेची समस्या नोंदली आहे. वाहन चालवण्यापूर्वी पर्यवेक्षकाला विचारा."
                    : language === "hi"
                      ? "सुरक्षा की समस्या दर्ज है। गाड़ी चलाने से पहले सुपरवाइज़र से पूछें।"
                      : "A safety issue is recorded on this car. Check with your supervisor before driving."}
                </Text>
              ) : null}
            </Panel>
          ) : owner && task && task.status !== "completed" ? (
            <Button
              secondary
              label={
                language === "mr"
                  ? "विभाग संघाला नेमा"
                  : language === "hi"
                    ? "टीम को हिस्से सौंपें"
                    : "Allocate sections to team"
              }
              icon="people-outline"
              onPress={() =>
                navigation.navigate("InspectionAllocation", { taskId: task.id })
              }
            />
          ) : null}
          {task && item ? (
            <>
              {phase === "photo" || phase === "result" ? (
                <View style={{ gap: 10 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      lineHeight: 26,
                      fontWeight: "600",
                    }}
                  >
                    {language === "mr" && item.titleMr
                      ? item.titleMr
                      : language === "hi"
                        ? item.titleHi
                        : item.title}
                  </Text>

                  <Text style={s.muted}>
                    {language === "hi"
                      ? `${preview ? "फोटो जुड़ी है" : "फोटो ज़रूरी है"} · ${task.clipItemIds.includes(item.id) ? "वीडियो जुड़ा है" : item.requiresClip ? "वीडियो ज़रूरी है" : "वीडियो जोड़ सकते हैं"}`
                      : `${preview ? "Photo attached" : "Photo required"} · ${task.clipItemIds.includes(item.id) ? "Video attached" : item.requiresClip ? "Video required" : "Video optional"}`}
                  </Text>
                  <ActionRow>
                    <Button
                      icon="camera-outline"
                      label={uxText(language, "Photo", "फोटो")}
                      accessibilityLabel={
                        readOnly
                          ? language === "hi"
                            ? "फोटो देखें"
                            : "View photo"
                          : preview
                            ? t("retake")
                            : t("takePhoto")
                      }
                      secondary
                      disabled={busy}
                      onPress={() =>
                        readOnly ? setPhase("photo") : openCamera()
                      }
                    />
                    <Button
                      icon="videocam-outline"
                      label={uxText(language, "Video", "वीडियो")}
                      accessibilityLabel={
                        language === "hi"
                          ? readOnly
                            ? "वीडियो देखें"
                            : "वीडियो जोड़ें"
                          : readOnly
                            ? "View videos"
                            : "Add video"
                      }
                      secondary
                      disabled={busy}
                      onPress={() =>
                        navigation.navigate("Clips", {
                          taskId: task.id,
                          itemId: item.id,
                          initialView: readOnly ? "saved" : "add",
                        })
                      }
                    />
                  </ActionRow>
                </View>
              ) : null}
              {task.recheckItems.includes(item.id) ? (
                <ErrorNotice
                  message={
                    (language === "hi"
                      ? "दोबारा जाँच · नई फोटो लें। पिछली फोटो सुरक्षित है।"
                      : "Recheck · take a new photo. The previous submission is retained.") +
                    (allocation?.reviewNote || task.recheckNote
                      ? ` ${allocation?.reviewNote || task.recheckNote}`
                      : "")
                  }
                />
              ) : null}
              {owner &&
              !task.collaborative &&
              task.status === "submitted" &&
              phase === "result" ? (
                <Panel>
                  <Button
                    secondary
                    label={
                      recheckSelection.includes(item.id)
                        ? language === "hi"
                          ? "इस जाँच को दोबारा जाँच से हटाएँ"
                          : "Remove this check from recheck"
                        : language === "hi"
                          ? "यह जाँच दोबारा करवाएँ"
                          : "Return this check"
                    }
                    onPress={() =>
                      setRecheckSelection((ids) =>
                        ids.includes(item.id)
                          ? ids.filter((id) => id !== item.id)
                          : [...ids, item.id],
                      )
                    }
                  />
                  <Text>
                    {recheckSelection.length
                      ? `${recheckSelection.length} ${language === "hi" ? "जाँच चुनी हैं" : "checks selected"}`
                      : language === "hi"
                        ? "कोई जाँच नहीं चुनी: सभी जाँच दोबारा जाएँगी।"
                        : "No selection: a recheck returns every check."}
                  </Text>
                  <TextInput
                    accessibilityLabel={
                      language === "hi"
                        ? "समीक्षा का कारण"
                        : "Review explanation"
                    }
                    placeholder={
                      language === "hi"
                        ? "कारण (वैकल्पिक)"
                        : "Reason / instructions (optional)"
                    }
                    placeholderTextColor={colors.muted}
                    value={reviewNote}
                    onChangeText={setReviewNote}
                    maxLength={1000}
                    style={s.input}
                  />
                </Panel>
              ) : null}
              {phase === "sections" ? (
                <InspectionSections
                  task={task}
                  index={index}
                  onOpen={chooseStep}
                  onFind={showAllChecks}
                  onFocus={(i) => {
                    chooseStep(i);
                    setPhase("sections");
                  }}
                  zone={inspectionSection}
                  part={inspectionPart}
                  setZone={setInspectionSection}
                  setPart={setInspectionPart}
                  hi={language === "hi"}
                />
              ) : phase === "map" ? (
                <InspectionNavigation
                  task={task}
                  index={index}
                  onSelect={(i) => {
                    chooseStep(i);
                    setPhase("map");
                  }}
                  onAll={showAllChecks}
                  onPart={(componentId) => {
                    setCheckScope({ zone: item.zone, componentId });
                    setAllChecks(true);
                  }}
                  hi={language === "hi"}
                />
              ) : phase === "photo" ? (
                <>
                  <View style={{ gap: 8 }}>
                    <View style={s.row}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: instructionsOpen }}
                        onPress={() => setInstructionsOpen((v) => !v)}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Icon name="information-circle-outline" size={20} />
                        <Text style={{ flex: 1, color: colors.muted }}>
                          {language === "mr"
                            ? "कसे तपासायचे"
                            : language === "hi"
                              ? "कैसे जाँचें"
                              : "How to inspect"}
                        </Text>
                        <Icon
                          name={
                            instructionsOpen
                              ? "chevron-up-outline"
                              : "chevron-down-outline"
                          }
                          size={18}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("listen")}
                        onPress={() => {
                          void Speech.stop();
                          Speech.speak(
                            language === "mr" && item.instructionMr
                              ? item.instructionMr
                              : language === "hi"
                                ? item.instructionHi
                                : item.instruction,
                            {
                              language:
                                language === "mr" && item.instructionMr
                                  ? "mr-IN"
                                  : language === "hi"
                                    ? "hi-IN"
                                    : "en-IN",
                              rate: 0.85,
                            },
                          );
                        }}
                        style={s.iconButton}
                      >
                        <Icon name="volume-high-outline" />
                      </Pressable>
                    </View>
                    {instructionsOpen ? (
                      <Text style={{ fontSize: 15, lineHeight: 24 }}>
                        {language === "mr" && item.instructionMr
                          ? item.instructionMr
                          : language === "hi"
                            ? item.instructionHi
                            : item.instruction}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole={!readOnly ? "button" : "image"}
                    accessibilityLabel={
                      !readOnly
                        ? preview
                          ? t("retake")
                          : t("takePhoto")
                        : language === "hi"
                          ? "जाँच की फोटो"
                          : "Inspection evidence"
                    }
                    disabled={readOnly || busy}
                    onPress={openCamera}
                    style={{
                      height: Math.max(
                        140,
                        Math.min(240, layout.height * 0.25),
                      ),
                      borderRadius: 14,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#555",
                      backgroundColor: "#252525",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                    }}
                  >
                    {preview ? (
                      <Image
                        source={preview}
                        style={{
                          width: "100%",
                          height: "100%",
                          resizeMode: "contain",
                        }}
                      />
                    ) : (
                      <>
                        <Icon name="camera-outline" size={48} />
                        <Text style={s.muted}>{t("takePhoto")}</Text>
                      </>
                    )}
                  </Pressable>
                  {preview ? (
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {!readOnly ? `${t("retake")} · ` : ""}
                      {draft && !readOnly
                        ? draft.synced
                          ? t("received")
                          : t("savedPhone")
                        : t("received")}
                    </Text>
                  ) : null}
                </>
              ) : !readOnly ? (
                <>
                  {preview ? (
                    <View style={s.row}>
                      <Image
                        source={preview}
                        style={{
                          width: 76,
                          height: 76,
                          resizeMode: "contain",
                          borderRadius: 8,
                          backgroundColor: "#252525",
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "600" }}>
                          {language === "mr" && item.titleMr
                            ? item.titleMr
                            : language === "hi"
                              ? item.titleHi
                              : item.title}
                        </Text>
                        <Text style={s.muted}>
                          {draft?.synced ? t("received") : t("savedPhone")}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: "#ffc283" }}>
                      {t("photoRequired")}
                    </Text>
                  )}
                  {item.configurationPending ? (
                    <Button
                      label={
                        draft?.applicabilityConfirmed
                          ? language === "hi"
                            ? "यह उपकरण मौजूद है ✓"
                            : "Equipment confirmed fitted ✓"
                          : language === "hi"
                            ? "पुष्टि करें: यह उपकरण मौजूद है"
                            : "Confirm: this equipment is fitted"
                      }
                      secondary
                      onPress={() =>
                        draft
                          ? void editDraft({
                              applicabilityConfirmed:
                                !draft.applicabilityConfirmed,
                            })
                          : setMessage(t("photoRequired"))
                      }
                    />
                  ) : null}
                  {item.measurementUnit ? (
                    <TextInput
                      accessibilityLabel={`${language === "hi" ? "माप" : "Measurement"} (${item.measurementUnit})`}
                      placeholder={`${language === "hi" ? "माप" : "Measured value"} · ${item.measurementUnit}`}
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      value={
                        draft?.reading == null ? "" : String(draft.reading)
                      }
                      onChangeText={(value) => {
                        const n = value.trim()
                          ? Number(value.replace(",", "."))
                          : null;
                        if (n === null || Number.isFinite(n))
                          void editDraft({ reading: n });
                      }}
                      style={s.input}
                    />
                  ) : null}
                  {item.requiresClip ? (
                    <Text style={{ color: colors.amber }}>
                      {language === "hi"
                        ? "जाँच भेजने से पहले 720p वीडियो भी ज़रूरी है।"
                        : "A verified 720p clip is also required before submission."}
                    </Text>
                  ) : null}
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {(
                      [
                        "ok",
                        "problem",
                        "unable",
                        ...(item.configurationPending
                          ? ["not_applicable" as const]
                          : []),
                      ] as const
                    ).map((result) => (
                      <Pressable
                        key={result}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: draft?.result === result,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() =>
                          draft
                            ? void editDraft({ result })
                            : setMessage(t("photoRequired"))
                        }
                        style={{
                          flexGrow: 1,
                          flexBasis: "44%",
                          minHeight: 80,
                          padding: 12,
                          backgroundColor:
                            draft?.result === result ? colors.red : colors.card,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.line,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                        }}
                      >
                        <Icon
                          name={
                            result === "ok"
                              ? "checkmark-circle-outline"
                              : "alert-circle-outline"
                          }
                          size={26}
                        />
                        <Text>
                          {result === "unable"
                            ? language === "hi"
                              ? "जाँच नहीं हो सकी"
                              : "Cannot inspect"
                            : result === "not_applicable"
                              ? language === "hi"
                                ? "लागू नहीं"
                                : "Not fitted / N/A"
                              : t(result)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {draft ? (
                    <TextInput
                      accessibilityLabel={t("note")}
                      value={draft.note}
                      placeholder={t("note")}
                      placeholderTextColor="#999"
                      onChangeText={(note) => void editDraft({ note })}
                      multiline
                      maxLength={1000}
                      editable={!busy}
                      style={s.input}
                    />
                  ) : null}
                  <Button
                    secondary
                    label={
                      language === "hi"
                        ? "AI से नोट लिखें"
                        : "Draft note with AI"
                    }
                    icon="sparkles-outline"
                    disabled={busy}
                    onPress={() =>
                      navigation.navigate("Assistant", {
                        taskId: task.id,
                        carId: task.carId,
                        itemId: item.id,
                        capability: "voice_log",
                      })
                    }
                  />
                  {readyToSubmit ? (
                    <Pill
                      label={
                        language === "hi"
                          ? "जाँच भेजने के लिए तैयार"
                          : "Inspection ready to send"
                      }
                    />
                  ) : null}
                </>
              ) : (
                <Panel style={{ gap: 12 }}>
                  <Pill
                    label={
                      task.collaborative
                        ? allocation?.state === "accepted"
                          ? language === "mr"
                            ? "तपासणी स्वीकारली"
                            : language === "hi"
                              ? "जाँच स्वीकृत"
                              : "Check accepted"
                          : allocation?.state === "submitted"
                            ? language === "mr"
                              ? "तपासणी बाकी"
                              : language === "hi"
                                ? "समीक्षा बाकी"
                                : "Awaiting review"
                            : allocation?.state === "waived"
                              ? language === "mr"
                                ? "ऐच्छिक तपासणी वगळली"
                                : language === "hi"
                                  ? "वैकल्पिक जाँच छोड़ी गई"
                                  : "Optional check omitted"
                              : (allocation?.assigneeName ??
                                (language === "mr"
                                  ? "अनियोजित"
                                  : language === "hi"
                                    ? "बिना ज़िम्मेदारी"
                                    : "Unallocated"))
                        : task.status === "completed"
                          ? t("completed")
                          : task.status === "submitted"
                            ? t("pending")
                            : task.assigneeName
                    }
                  />
                  <Text style={{ fontSize: 19, fontWeight: "600" }}>
                    {language === "mr" && item.titleMr
                      ? item.titleMr
                      : language === "hi"
                        ? item.titleHi
                        : item.title}
                  </Text>
                  {answer ? (
                    <Text>
                      {answer.result === "unable"
                        ? language === "hi"
                          ? "जाँच नहीं हो सकी"
                          : "Cannot inspect"
                        : answer.result === "not_applicable"
                          ? language === "hi"
                            ? "लागू नहीं · समीक्षा"
                            : "Not applicable · reviewed with inspection"
                          : t(answer.result)}
                      {answer.note ? ` · ${answer.note}` : ""}
                    </Text>
                  ) : (
                    <Text style={s.muted}>{t("pending")}</Text>
                  )}
                  <Button
                    secondary
                    label={
                      language === "hi"
                        ? "जाँच के वीडियो देखें"
                        : "Review check video clips"
                    }
                    icon="videocam-outline"
                    onPress={() =>
                      navigation.navigate("Clips", {
                        taskId: task.id,
                        itemId: item.id,
                      })
                    }
                  />
                  <Text style={s.muted}>
                    {allocation?.assigneeName ?? task.assigneeName}
                  </Text>
                  {allocation?.answeredByName ? (
                    <Text style={s.muted}>
                      {language === "mr"
                        ? "नोंद करणारे"
                        : language === "hi"
                          ? "दर्ज करने वाले"
                          : "Recorded by"}{" "}
                      · {allocation.answeredByName}
                    </Text>
                  ) : null}
                  {owner &&
                  !task.collaborative &&
                  task.status === "submitted" ? (
                    <Text style={s.muted}>
                      {language === "hi"
                        ? "नीचे का निर्णय पूरी जाँच के लिए है।"
                        : "The decision below applies to the whole inspection."}
                    </Text>
                  ) : null}
                </Panel>
              )}
              {phase === "result" &&
              owner &&
              !["submitted", "completed"].includes(task.status) ? (
                <Button
                  label={uxText(
                    language,
                    "Assign inspection",
                    "ज़िम्मेदारी बदलें",
                  )}
                  secondary
                  icon="people-outline"
                  disabled={busy}
                  onPress={() =>
                    navigation.navigate("InspectionAllocation", {
                      taskId: task.id,
                    })
                  }
                />
              ) : null}
              {task.collaborative &&
              draft &&
              !draft.synced &&
              allocation &&
              allocation.assignmentVersion === draft.allocationVersion &&
              allocation.version !== draft.itemVersion &&
              !readOnly ? (
                <Panel style={{ gap: 10 }}>
                  <Text>
                    {language === "hi"
                      ? "इस जाँच का नतीजा बदल गया है।"
                      : language === "mr"
                        ? "या तपासणीचा निकाल बदलला आहे."
                        : "The result for this check changed."}{" "}
                    {answer ? `${answer.result} · ${answer.note}` : ""}
                  </Text>
                  <Button
                    secondary
                    label={
                      language === "hi"
                        ? "नया नतीजा देखकर ड्राफ्ट रखें"
                        : language === "mr"
                          ? "नवीन निकाल तपासून मसुदा ठेवा"
                          : "Review latest result and keep draft"
                    }
                    onPress={reconfirmDraft}
                  />
                </Panel>
              ) : null}
              {message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: "#e4d3d5" }}
                >
                  {message}
                </Text>
              ) : null}
            </>
          ) : resource.loading ? (
            <ActivityIndicator color="#fff" />
          ) : null}
        </FocusPage>
      </Workspace>
      {task ? (
        <AllChecks
          task={task}
          index={index}
          open={allChecks}
          initialScope={checkScope}
          onClose={() => setAllChecks(false)}
          onSelect={chooseStep}
          hi={language === "hi"}
        />
      ) : null}
      <PhotoCamera
        visible={camera}
        onClose={() => setCamera(false)}
        onPhoto={prepared}
      />
    </>
  );
}
