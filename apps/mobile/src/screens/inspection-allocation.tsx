import { uxText } from "../state/ux-copy";
import { Field } from "../components/forms";
import React, { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { checkRevision, can, type CheckAllocation } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useSection } from "../state/use-section";
import { sendCommand } from "../application/send-command";
import { zones } from "../application/inspection-index";
import {
  CarIdentity,
  FocusPage,
  SelectField,
  Workspace,
} from "../components/workspace";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Icon,
  Panel,
  Text,
  s,
} from "../components/ui";
import { WorkHeading } from "../components/operations";

type Area = "assign" | "review" | "coverage";
export function InspectionAllocationScreen({
  route,
  navigation,
}: ScreenProps<"InspectionAllocation">) {
  const { api, session, language, changed } = useApp();
  const actor = session!.actor;
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const resource = useResource(
    `allocation:${route.params.taskId}`,
    async () => ({
      task: await api.task(route.params.taskId),
      people: await api.people(),
    }),
  );
  const task = resource.data?.task;
  const [area, setArea] = useSection<Area>(
    `allocation:${route.params.taskId}:area`,
    route.params.section ?? "assign",
    ["assign", "review", "coverage"],
  );
  const [zone, setZone] = useState("");
  const [person, setPerson] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [coverage, setCoverage] = useState("all");
  const [page, setPage] = useState(0);
  const [reviewScope, setReviewScope] = useState("submitted");
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || busy || selected.length || reason.trim()) return;
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
  }, [focused, busy, selected.length, reason]);
  useEffect(() => {
    if (area === "review") setZone("");
  }, [area]);
  useEffect(() => {
    setSelected([]);
  }, [area, zone, task?.version]);
  useEffect(() => {
    if (task) setZone(area === "review" ? "" : (task.items[0]?.zone ?? ""));
  }, [task?.id]);
  const states = (state: CheckAllocation["state"]) =>
    ({
      unassigned: tr(
        "Unallocated",
        "किसी को नहीं सौंपा",
        "कोणालाही नेमले नाही",
      ),
      assigned: tr("To do", "करना है", "करायचे"),
      in_progress: tr("In progress", "काम जारी", "काम सुरू"),
      submitted: tr("In review", "समीक्षा में", "तपासणीत"),
      accepted: tr("Accepted", "स्वीकृत", "स्वीकारले"),
      recheck: tr("Redo requested", "दोबारा जाँच", "पुन्हा तपासा"),
      waived: tr("Optional · omitted", "वैकल्पिक · छोड़ा", "ऐच्छिक · वगळले"),
    })[state];
  const allocations = task?.allocations ?? [];
  const get = (id: string) => allocations.find((a) => a.itemId === id);
  const shown =
    task?.items.filter(
      (i) =>
        (!zone || i.zone === zone) &&
        (area !== "review" ||
          reviewScope === "all" ||
          (reviewScope === "optional"
            ? !i.required &&
              (!task.answers.some((a) => a.itemId === i.id) ||
                task.answers.some(
                  (a) => a.itemId === i.id && a.result === "unable",
                ))
            : get(i.id)?.state === reviewScope)) &&
        (area !== "coverage" ||
          coverage === "all" ||
          get(i.id)?.state === coverage),
    ) ?? [];
  useEffect(() => {
    setPage(0);
  }, [area, zone, coverage, reviewScope]);
  const pageCount = Math.max(1, Math.ceil(shown.length / 6));
  const visible = shown.slice(
    Math.min(page, pageCount - 1) * 6,
    (Math.min(page, pageCount - 1) + 1) * 6,
  );
  const editable = (id: string) =>
    !task?.collaborative ||
    ["assigned", "unassigned", "in_progress", "recheck"].includes(
      get(id)?.state ?? "",
    );
  const choose = (id: string) =>
    setSelected((prior) =>
      prior.includes(id) ? prior.filter((v) => v !== id) : [...prior, id],
    );
  async function allocate() {
    if (!task) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendCommand(
        actor.id,
        `allocate:${task.id}`,
        {
          expectedVersion: task.version,
          changes: [{ itemIds: selected, assignedTo: person || null }],
          reason: reason.trim(),
          unallocateUnmentioned: true,
        },
        (body) => api.allocateChecks(task.id, body),
      );
      changed(uxText(language, "Checks assigned", "जाँच सौंपी गई"));
      resource.refresh();
      setSelected([]);
      setReason("");
      setMessage(
        tr(
          "Allocation saved. Assigned work stays open until it is reviewed.",
          "ज़िम्मेदारी सेव हुई। समीक्षा तक काम खुला रहेगा।",
          "नेमणूक सेव्ह झाली. तपासणी होईपर्यंत काम खुले राहील.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function review(decision: "accept" | "recheck" | "waive") {
    if (!task) return;
    const checks = selected
      .map((id) => get(id))
      .filter((a): a is CheckAllocation => !!a)
      .map(checkRevision);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendCommand(
        actor.id,
        `portion-review:${task.id}`,
        {
          action: "review_checks" as const,
          expectedVersion: task.version,
          checks,
          decision,
          note: reason.trim(),
        },
        (body) => api.command(task.id, body),
      );
      changed(uxText(language, "Review recorded", "समीक्षा दर्ज हुई"));
      resource.refresh();
      setSelected([]);
      setReason("");
      setMessage(
        tr(
          "Decision recorded. Other employees can continue their work.",
          "निर्णय दर्ज हुआ। बाकी कर्मचारी काम जारी रख सकते हैं।",
          "निर्णय नोंदला. इतर कर्मचारी काम पुढे करू शकतात.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
    } finally {
      setBusy(false);
    }
  }
  function confirm(decision: "accept" | "recheck" | "waive") {
    const own = selected.some((id) => get(id)?.answeredBy === actor.id);
    Alert.alert(
      tr(
        "Record this decision?",
        "यह निर्णय दर्ज करें?",
        "हा निर्णय नोंदवायचा?",
      ),
      `${selected.length} ${tr("selected checks", "चुनी जाँच", "निवडलेल्या तपासण्या")}${own ? ` · ${tr("Includes your recorded work", "आपका दर्ज काम भी शामिल", "तुमचे नोंदलेले काम समाविष्ट")}` : ""}`,
      [
        { text: tr("Cancel", "रद्द", "रद्द"), style: "cancel" },
        {
          text: tr("Confirm", "पुष्टि", "पुष्टी"),
          onPress: () => void review(decision),
        },
      ],
    );
  }
  const selectedGrants = selected
    .map(get)
    .filter((a): a is CheckAllocation => !!a);
  const canAccept =
    selectedGrants.length > 0 &&
    selectedGrants.every((g) => g.state === "submitted");
  const canReturn =
    selectedGrants.length > 0 &&
    selectedGrants.every((g) =>
      ["submitted", "accepted", "waived"].includes(g.state),
    );
  const canOmit =
    selected.length > 0 &&
    selected.every(
      (id) =>
        !task?.items.find((i) => i.id === id)?.required &&
        (!task?.answers.find((a) => a.itemId === id) ||
          task.answers.find((a) => a.itemId === id)?.result === "unable"),
    );
  if (!can(actor, "assign_inspection"))
    return (
      <Text>
        {tr(
          "A supervisor allocates this work.",
          "सुपरवाइज़र यह काम सौंपता है।",
          "पर्यवेक्षक हे काम नेमतो.",
        )}
      </Text>
    );
  return (
    <Workspace
      title={tr("Inspection team", "जाँच टीम", "तपासणी संघ")}
      selected={area}
      onChange={setArea}
      busy={busy}
      context={task ? <CarIdentity car={task.car} /> : undefined}
      items={[
        {
          id: "assign",
          label: tr("Allocate", "काम बाँटें", "काम नेमा"),
          icon: "people-outline",
        },
        {
          id: "review",
          label: tr("Review", "समीक्षा", "तपासा"),
          icon: "checkmark-done-outline",
          badge: String(
            allocations.filter((g) => g.state === "submitted").length,
          ),
        },
        {
          id: "coverage",
          label: tr("Coverage", "पूरी स्थिति", "पूर्ण स्थिती"),
          icon: "grid-outline",
        },
      ]}
    >
      <FocusPage
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
        scrollKey={`${area}:${zone}:${coverage}:${reviewScope}:${page}`}
        footer={
          task?.status !== "completed" && area === "assign" ? (
            <Button
              label={`${tr("Save allocation", "ज़िम्मेदारी सेव करें", "नेमणूक सेव्ह करा")} · ${selected.length}`}
              icon="people-outline"
              disabled={!selected.length || reason.trim().length < 3}
              busy={busy}
              onPress={() => void allocate()}
            />
          ) : area === "review" &&
            task?.collaborative &&
            task.status !== "completed" ? (
            <ActionRow>
              <Button
                label={tr(
                  "Accept selected",
                  "चुनी जाँच स्वीकारें",
                  "निवडलेल्या स्वीकारा",
                )}
                disabled={!canAccept}
                busy={busy}
                onPress={() => confirm("accept")}
              />
              <Button
                secondary
                label={tr(
                  "Return selected",
                  "चुनी जाँच लौटाएँ",
                  "निवडलेल्या परत करा",
                )}
                disabled={!canReturn || reason.trim().length < 5}
                busy={busy}
                onPress={() => confirm("recheck")}
              />
            </ActionRow>
          ) : undefined
        }
      >
        {resource.loading && !task ? <ActivityIndicator color="#fff" /> : null}
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {message ? (
          <Text accessibilityLiveRegion="polite">{message}</Text>
        ) : null}
        {task ? (
          <>
            <WorkHeading
              kicker={task.templateName}
              title={
                area === "assign"
                  ? tr(
                      "Allocate inspection checks",
                      "जाँच का काम बाँटें",
                      "तपासणीचे काम नेमा",
                    )
                  : area === "review"
                    ? tr(
                        "Review submitted checks",
                        "भेजी गई जाँच की समीक्षा",
                        "पाठवलेल्या तपासण्या तपासा",
                      )
                    : tr(
                        "Inspection status",
                        "जाँच की स्थिति",
                        "तपासणीची स्थिती",
                      )
              }
            />
            {task.collaborative && area !== "coverage" ? (
              <Text style={s.muted}>
                {allocations.filter((a) => a.state === "unassigned").length}{" "}
                {tr("unallocated", "बिना ज़िम्मेदारी", "अनियोजित")} ·{" "}
                {allocations.filter((a) => a.state === "submitted").length}{" "}
                {tr("in review", "समीक्षा में", "तपासणीत")} ·{" "}
                {
                  allocations.filter((a) =>
                    ["accepted", "waived"].includes(a.state),
                  ).length
                }
                /{task.items.length} {tr("resolved", "पूरी", "पूर्ण")}
              </Text>
            ) : task.collaborative ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  "unassigned",
                  "assigned",
                  "in_progress",
                  "submitted",
                  "accepted",
                  "recheck",
                  "waived",
                ].map((state) => {
                  const n = allocations.filter((g) => g.state === state).length;
                  return n || state === "unassigned" ? (
                    <Pressable
                      key={state}
                      accessibilityRole="button"
                      accessibilityLabel={`${states(state as CheckAllocation["state"])} ${n}`}
                      onPress={() => {
                        setCoverage(state);
                        setArea("coverage");
                        setZone("");
                      }}
                      style={{
                        padding: 12,
                        flexBasis: 130,
                        flexGrow: 1,
                        maxWidth: "100%",
                        borderRadius: 16,
                        backgroundColor: colors.card,
                        borderLeftWidth: 3,
                        borderColor:
                          state === "unassigned" || state === "recheck"
                            ? colors.amber
                            : state === "accepted"
                              ? colors.green
                              : colors.red,
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 24, fontWeight: "700" }}>
                        {n}
                      </Text>
                      <Text>{states(state as CheckAllocation["state"])}</Text>
                    </Pressable>
                  ) : null;
                })}
              </View>
            ) : (
              <Text style={s.muted}>
                {tr(
                  "Allocate selected checks to begin team work. Untouched, unselected checks become unallocated. Existing results and proof keep their authors.",
                  "चुनी जाँच सौंपकर टीम काम शुरू करें। बाकी बिना शुरू की जाँच असाइन नहीं रहेगी। पुराने नतीजे और सबूत अपने लेखक के साथ रहेंगे।",
                  "निवडलेल्या तपासण्या नेमून संघाचे काम सुरू करा. उरलेल्या न सुरू केलेल्या तपासण्या अनियोजित राहतील. जुने निकाल व पुरावे मूळ नोंदकर्त्यासह राहतील.",
                )}
              </Text>
            )}
            {task.status === "completed" ? (
              <Text>
                {tr(
                  "Inspection accepted. Its work and allocation history are retained.",
                  "जाँच स्वीकृत है। काम और ज़िम्मेदारी का इतिहास सुरक्षित है।",
                  "तपासणी स्वीकारली. काम व नेमणुकीचा इतिहास जतन केला आहे.",
                )}
              </Text>
            ) : null}
            {area === "review" && task.collaborative ? (
              <SelectField
                label={tr(
                  "Review status",
                  "समीक्षा की स्थिति",
                  "तपासणीची स्थिती",
                )}
                value={reviewScope}
                onChange={(value) => {
                  setReviewScope(value);
                  setSelected([]);
                }}
                options={[
                  {
                    id: "submitted",
                    label: tr(
                      "Submitted checks",
                      "भेजी गई जाँच",
                      "पाठवलेल्या तपासण्या",
                    ),
                  },
                  {
                    id: "accepted",
                    label: tr(
                      "Accepted checks",
                      "स्वीकृत जाँच",
                      "स्वीकारलेल्या तपासण्या",
                    ),
                  },
                  {
                    id: "optional",
                    label: tr(
                      "Optional omissions",
                      "वैकल्पिक जाँच छोड़ें",
                      "ऐच्छिक तपासण्या वगळा",
                    ),
                  },
                  {
                    id: "all",
                    label: tr("All checks", "सभी जाँच", "सर्व तपासण्या"),
                  },
                ]}
              />
            ) : null}
            <SelectField
              label={tr("Inspection section", "जाँच का हिस्सा", "तपासणी विभाग")}
              value={zone}
              onChange={setZone}
              options={[
                {
                  id: "",
                  label: tr("All sections", "सभी हिस्से", "सर्व विभाग"),
                },
                ...zones
                  .filter(([id]) => task.items.some((i) => i.zone === id))
                  .map(([id, en, hi]) => ({
                    id,
                    label:
                      language === "mr"
                        ? {
                            identity: "ओळख",
                            exterior: "बॉडी",
                            visibility: "काचा",
                            wheels: "चाके",
                            powertrain: "इंजिन / मोटर",
                            underbody: "खालचा भाग",
                            cabin: "केबिन",
                            electrical: "विद्युत",
                            safety: "सुरक्षा",
                            road_test: "चाचण्या",
                            general: "इतर",
                          }[id]
                        : language === "hi"
                          ? hi
                          : en,
                  })),
              ]}
            />
            {area === "coverage" ? (
              <SelectField
                label={tr("Show status", "स्थिति देखें", "स्थिती पाहा")}
                value={coverage}
                onChange={setCoverage}
                options={[
                  {
                    id: "all",
                    label: tr("All checks", "सभी जाँच", "सर्व तपासण्या"),
                  },
                  ...(
                    [
                      "unassigned",
                      "assigned",
                      "in_progress",
                      "submitted",
                      "accepted",
                      "recheck",
                      "waived",
                    ] as const
                  ).map((id) => ({ id, label: states(id) })),
                ]}
              />
            ) : null}
            {area === "assign" && task.status !== "completed" ? (
              <SelectField
                label={tr("Allocate to", "किसे सौंपें", "कोणाला नेमायचे")}
                value={person}
                onChange={setPerson}
                options={[
                  {
                    id: "",
                    label: tr(
                      "Leave unallocated",
                      "अभी किसी को नहीं",
                      "सध्या कोणालाही नाही",
                    ),
                  },
                  ...(resource.data?.people ?? []).map((p) => ({
                    id: p.id,
                    label:
                      p.id === actor.id
                        ? `${p.name} · ${tr("Me", "मैं", "मी")}`
                        : p.name,
                  })),
                ]}
                disabled={busy}
              />
            ) : null}
            {area !== "coverage" && task.status !== "completed" ? (
              <>
                <Field
                  label={tr(
                    "Reason / review note",
                    "कारण / समीक्षा नोट",
                    "कारण / तपासणी नोंद",
                  )}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  editable={!busy}
                />
                <ActionRow>
                  <Button
                    secondary
                    label={tr(
                      "Select filtered checks",
                      "दिखाई गई जाँच चुनें",
                      "दाखवलेल्या तपासण्या निवडा",
                    )}
                    disabled={
                      busy || (area === "review" && !task.collaborative)
                    }
                    onPress={() =>
                      setSelected(
                        shown
                          .filter((i) =>
                            area === "assign"
                              ? editable(i.id)
                              : reviewScope === "accepted" ||
                                reviewScope === "optional" ||
                                get(i.id)?.state === "submitted",
                          )
                          .map((i) => i.id),
                      )
                    }
                  />
                  <Button
                    secondary
                    label={`${tr("Clear", "हटाएँ", "काढा")} · ${selected.length}`}
                    disabled={busy}
                    onPress={() => setSelected([])}
                  />
                </ActionRow>
                {area === "review" ? (
                  <Button
                    secondary
                    label={tr(
                      "Omit optional selected checks",
                      "चुनी वैकल्पिक जाँच छोड़ें",
                      "निवडलेल्या ऐच्छिक तपासण्या वगळा",
                    )}
                    disabled={!canOmit || reason.trim().length < 5 || busy}
                    onPress={() => confirm("waive")}
                  />
                ) : null}
              </>
            ) : null}
            <View style={{ gap: 10 }}>
              {visible.map((i) => {
                const g = get(i.id);
                const checked = selected.includes(i.id);
                const selectable =
                  task.status !== "completed" &&
                  (area === "assign"
                    ? editable(i.id)
                    : area === "review" && task.collaborative);
                return (
                  <Panel
                    key={i.id}
                    style={{
                      gap: 10,
                      borderColor: checked ? colors.red : colors.line,
                    }}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={
                        language === "mr"
                          ? i.titleMr || i.titleHi
                          : language === "hi"
                            ? i.titleHi
                            : i.title
                      }
                      accessibilityState={{
                        checked,
                        disabled: !selectable || busy,
                      }}
                      disabled={!selectable || busy}
                      onPress={() => choose(i.id)}
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        minHeight: 48,
                        alignItems: "flex-start",
                      }}
                    >
                      {area !== "coverage" ? (
                        <Icon
                          name={checked ? "checkbox" : "square-outline"}
                          color={checked ? colors.red : colors.muted}
                        />
                      ) : null}
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <Text style={{ fontSize: 16, fontWeight: "600" }}>
                          {language === "mr"
                            ? i.titleMr || i.titleHi
                            : language === "hi"
                              ? i.titleHi
                              : i.title}
                        </Text>
                        <Text style={s.muted}>
                          {g
                            ? `${g.assigneeName ?? tr("Nobody allocated", "किसी को नहीं सौंपा", "कोणालाही नेमले नाही")} · ${states(g.state)}`
                            : task.assigneeName}
                          {i.required
                            ? ""
                            : ` · ${tr("Optional", "वैकल्पिक", "ऐच्छिक")}`}
                        </Text>
                        {g?.answeredByName ? (
                          <Text style={s.muted}>
                            {tr("Recorded by", "दर्ज करने वाले", "नोंद करणारे")}{" "}
                            {g.answeredByName}
                          </Text>
                        ) : null}
                        {g?.reviewNote ? <Text>{g.reviewNote}</Text> : null}
                      </View>
                    </Pressable>
                    <Button
                      secondary
                      label={tr(
                        "Open check and proof",
                        "जाँच और सबूत खोलें",
                        "तपासणी व पुरावा उघडा",
                      )}
                      icon="camera-outline"
                      onPress={() =>
                        navigation.navigate("Task", {
                          id: task.id,
                          itemId: i.id,
                        })
                      }
                    />
                  </Panel>
                );
              })}
            </View>
            {pageCount > 1 ? (
              <ActionRow>
                <Button
                  secondary
                  label={tr("Previous checks", "पिछली जाँच", "मागील तपासण्या")}
                  disabled={page === 0 || busy}
                  onPress={() => setPage((p) => p - 1)}
                />
                <Text style={{ alignSelf: "center" }}>
                  {page + 1}/{pageCount}
                </Text>
                <Button
                  secondary
                  label={tr("Next checks", "अगली जाँच", "पुढील तपासण्या")}
                  disabled={page >= pageCount - 1 || busy}
                  onPress={() => setPage((p) => p + 1)}
                />
              </ActionRow>
            ) : null}
            {!shown.length ? (
              <Text>
                {tr(
                  "No checks in this selection.",
                  "इस चयन में जाँच नहीं है।",
                  "या निवडीत तपासण्या नाहीत.",
                )}
              </Text>
            ) : null}
          </>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
