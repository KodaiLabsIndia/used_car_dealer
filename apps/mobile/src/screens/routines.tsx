import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import type { RoutineItem, SaveRoutine } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { can } from "../application/access";
import { sendCommand } from "../application/send-command";
import { Workspace, FocusPage, ChoiceModal } from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
} from "../components/business-form";
import { DateField } from "../components/date-field";
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
import { CardGrid } from "../components/layout";

export function RoutinesScreen() {
  const { api, session, language, changed } = useApp();
  const actor = session!.actor;
  const manager = can(actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [section, setSection] = useState<"today" | "manage" | "history">(
    "today",
  );
  const [day, setDay] = useState("");
  const resource = useResource(
    `routines:${section === "history" ? day : "today"}`,
    () => api.routines(section === "history" && day ? day : undefined),
  );
  const people = useResource(`routine-people:${manager}`, () =>
    manager ? api.people() : Promise.resolve([]),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    id: string;
    item: RoutineItem | null;
  } | null>(null);
  const [reopen, setReopen] = useState<{
    item: RoutineItem;
    step: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduleMore, setScheduleMore] = useState(false);
  const focused = useIsFocused();
  useEffect(() => {
    if (resource.data && !day) setDay(resource.data.today);
  }, [resource.data?.today]);
  useEffect(() => {
    if (!focused || edit || reopen) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") resource.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [focused, edit, reopen]);
  const templates = resource.data?.items ?? [];
  const due = templates.filter((i) => i.dueToday);
  const completed = due.filter(
    (i) => i.completedSteps.length === i.definition.steps.length,
  ).length;
  const item = templates.find((i) => i.id === selected);
  const cycleOptions = [
    { id: "0,1,2,3,4,5,6", label: tr("Every day", "हर दिन", "दररोज") },
    {
      id: "0,1,2,3,4,5",
      label: tr("Monday–Saturday", "सोमवार–शनिवार", "सोमवार–शनिवार"),
    },
    {
      id: "0,1,2,3,4",
      label: tr("Monday–Friday", "सोमवार–शुक्रवार", "सोमवार–शुक्रवार"),
    },
    ...[
      tr("Monday", "सोमवार", "सोमवार"),
      tr("Tuesday", "मंगलवार", "मंगळवार"),
      tr("Wednesday", "बुधवार", "बुधवार"),
      tr("Thursday", "गुरुवार", "गुरुवार"),
      tr("Friday", "शुक्रवार", "शुक्रवार"),
      tr("Saturday", "शनिवार", "शनिवार"),
      tr("Sunday", "रविवार", "रविवार"),
    ].map((label, i) => ({ id: String(i), label })),
  ];
  const previous = edit?.item?.currentDefinition;
  const savedDays = previous?.weekdays.join(",");
  if (savedDays && !cycleOptions.some((o) => o.id === savedDays))
    cycleOptions.push({
      id: savedDays,
      label: tr("Current repeat days", "वर्तमान दिन", "सध्याचे दिवस"),
    });
  const spec: BusinessFormSpec = edit
    ? {
        key: edit.item ? `routine:${edit.id}` : "routine:new",
        title: edit.item
          ? tr("Edit routine", "काम बदलें", "काम बदला")
          : tr(
              "Create daily routine",
              "रोज़ का काम बनाएँ",
              "रोजचे काम तयार करा",
            ),
        note: tr(
          "Each started day keeps its original person and steps. Changes apply to the next unstarted day.",
          "शुरू किए दिन का व्यक्ति और सूची सुरक्षित रहती है। बदलाव अगले शुरू न हुए काम पर लागू होते हैं।",
          "सुरू झालेल्या दिवसाची व्यक्ती व यादी जतन राहते. बदल पुढील न सुरू झालेल्या कामाला लागू होतात.",
        ),
        submitLabel: tr("Save routine", "काम सेव करें", "काम जतन करा"),
        steps: [
          {
            label: tr("Who & when", "किसको और कब", "कोणाला व कधी"),
            fields: [
              {
                key: "title",
                label: tr("Routine name", "काम का नाम", "कामाचे नाव"),
                initial: previous?.title,
              },
              {
                key: "person",
                label: tr(
                  "Responsible person",
                  "ज़िम्मेदार व्यक्ति",
                  "जबाबदार व्यक्ती",
                ),
                kind: "select",
                initial: previous?.assignedTo,
                options:
                  people.data?.map((p) => ({ id: p.id, label: p.name })) ?? [],
              },
              {
                key: "days",
                label: tr(
                  "Repeat on",
                  "इन दिनों दोहराएँ",
                  "या दिवशी पुन्हा करा",
                ),
                kind: "select",
                initial: savedDays ?? "0,1,2,3,4,5,6",
                options: cycleOptions,
              },
            ],
          },
          {
            label: tr("Steps & record", "चरण और रिकॉर्ड", "टप्पे व नोंद"),
            fields: [
              {
                key: "steps",
                label: tr(
                  "Steps — one clear instruction per line",
                  "चरण — हर लाइन में एक काम",
                  "टप्पे — प्रत्येक ओळीत एक सूचना",
                ),
                multiline: true,
                initial: previous?.steps.join("\n"),
              },
              {
                key: "active",
                label: tr("Routine status", "काम की स्थिति", "कामाची स्थिती"),
                kind: "select",
                initial: previous?.active === false ? "paused" : "active",
                options: [
                  { id: "active", label: tr("Active", "चालू", "सुरू") },
                  {
                    id: "paused",
                    label: tr("Paused", "रुका हुआ", "थांबवलेले"),
                  },
                ],
              },
              {
                key: "reason",
                label: tr(
                  "Reason for this setup/change",
                  "बनाने या बदलने का कारण",
                  "तयार किंवा बदल करण्याचे कारण",
                ),
              },
            ],
          },
        ],
      }
    : {
        key: `routine-reopen:${reopen?.item.id}:${reopen?.step}`,
        title: tr("Reopen a step", "चरण फिर खोलें", "टप्पा पुन्हा उघडा"),
        submitLabel: tr("Reopen step", "फिर खोलें", "पुन्हा उघडा"),
        steps: [
          {
            label: tr("Reason", "कारण", "कारण"),
            fields: [
              {
                key: "reason",
                label: tr(
                  "Why does it need doing again?",
                  "यह फिर क्यों करना है?",
                  "हे पुन्हा का करायचे आहे?",
                ),
              },
            ],
          },
        ],
      };
  async function mark(i: RoutineItem, step: number, note?: string) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        actor.id,
        `routine-step:${i.id}:${i.workDate}`,
        {
          expectedVersion: i.runVersion,
          definitionVersion: i.version,
          workDate: i.workDate,
          step,
          action: note ? ("reopen" as const) : ("done" as const),
          ...(note ? { note } : {}),
        },
        (b) => api.routineStep(i.id, b),
      );
      changed();
      resource.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title={
        manager
          ? tr("Daily routines", "रोज़ के काम", "रोजची कामे")
          : tr("My daily routines", "मेरे रोज़ के काम", "माझी रोजची कामे")
      }
      selected={section}
      busy={busy || !!edit || !!reopen}
      onChange={(v) => {
        setSection(v);
        setError("");
      }}
      items={[
        { id: "today", label: tr("Today", "आज", "आज"), icon: "sunny-outline" },
        ...(manager
          ? [
              {
                id: "manage" as const,
                label: tr("Manage routines", "काम सँभालें", "कामे सांभाळा"),
                icon: "repeat-outline" as const,
              },
            ]
          : []),
        {
          id: "history",
          label: tr("Saved history", "पुराना रिकॉर्ड", "जुनी नोंद"),
          icon: "time-outline",
        },
      ]}
    >
      {edit || reopen ? (
        <BusinessForm
          spec={spec}
          serverError={error}
          version={edit?.item?.templateVersion ?? reopen?.item.runVersion ?? 0}
          summary={
            edit
              ? tr(
                  "Saved with the responsible person and repeat days.",
                  "ज़िम्मेदार व्यक्ति और दिनों के साथ सेव होगा।",
                  "जबाबदार व्यक्ती व दिवसांसह जतन होईल.",
                )
              : reopen!.item.definition.steps[reopen!.step]!
          }
          onBusyChange={setBusy}
          onCancel={() => {
            setEdit(null);
            setReopen(null);
            setError("");
          }}
          onSubmit={async (v, version) => {
            if (reopen) {
              const ok = await mark(reopen.item, reopen.step, v.reason);
              if (ok) setReopen(null);
              return ok;
            }
            try {
              const definition = {
                title: v.title!.trim(),
                assignedTo: v.person!,
                weekdays: v.days!.split(",").map(Number),
                steps: v
                  .steps!.split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                active: v.active === "active",
              };
              await sendCommand(
                actor.id,
                `routine-save:${edit!.item ? edit!.id : "new"}`,
                {
                  routineId: edit!.id,
                  expectedVersion: version,
                  definition,
                  reason: v.reason!,
                },
                ({ routineId, ...body }) =>
                  api.saveRoutine(routineId, body as SaveRoutine),
              );
              setEdit(null);
              changed();
              resource.refresh();
              return true;
            } catch (e) {
              setError((e as Error).message);
              resource.refresh();
              return false;
            }
          }}
        />
      ) : (
        <FocusPage
          scrollKey={`${section}:${day}`}
          refreshControl={
            <RefreshControl
              refreshing={resource.loading}
              onRefresh={resource.refresh}
              tintColor="#fff"
            />
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
          {section === "history" ? (
            <DateField
              label={tr(
                "Saved work date",
                "पुराने काम की तारीख",
                "जुन्या कामाचा दिवस",
              )}
              value={day}
              onChange={setDay}
            />
          ) : section === "today" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 28, fontWeight: "600" }}>
                {tr(
                  "The everyday work\nthat keeps cars moving.",
                  "रोज़ के काम,\nजो यार्ड चलाते हैं।",
                  "रोजची कामे,\nजी यार्ड चालवतात.",
                )}
              </Text>
              <Text style={s.muted}>
                {`${completed} / ${due.length} `}
                {tr("routines finished today", "काम आज पूरे", "कामे आज पूर्ण")}
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.title}>
                {tr(
                  "Repeat the right work.",
                  "ज़रूरी काम दोहराएँ।",
                  "योग्य काम पुन्हा करा.",
                )}
              </Text>
              <Button
                label={tr("Create routine", "काम बनाएँ", "काम तयार करा")}
                icon="add-outline"
                onPress={() => setEdit({ id: randomUUID(), item: null })}
              />
              <Button
                secondary
                label={tr(
                  "Yard routine ideas",
                  "यार्ड के काम के सुझाव",
                  "यार्डच्या कामांच्या कल्पना",
                )}
                icon="bulb-outline"
                onPress={() => setScheduleMore((v) => !v)}
              />
              {scheduleMore ? (
                <Panel>
                  <Text>
                    {tr(
                      "Opening: check keys, gates and parked cars.\nYard care: cleaning, battery and tyre checks.\nClosing: reconcile keys and secure the yard.\nCreate only the routines your team agrees to follow.",
                      "खोलना: चाबी, गेट और गाड़ियाँ जाँचें।\nदेखभाल: सफ़ाई, बैटरी और टायर।\nबंद करना: चाबी मिलाएँ और यार्ड सुरक्षित करें।\nटीम के साथ तय किए काम ही बनाएँ।",
                      "उघडताना: चाव्या, गेट व गाड्या तपासा.\nदेखभाल: स्वच्छता, बॅटरी व टायर.\nबंद करताना: चाव्या मोजा व यार्ड सुरक्षित करा.\nटीमने मान्य केलेलीच कामे तयार करा.",
                    )}
                  </Text>
                </Panel>
              ) : null}
            </>
          )}
          <CardGrid>
            {(section === "today" ? due : templates).map((i) => {
              const finished =
                i.completedSteps.length === i.definition.steps.length;
              return (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.definition.title}, ${i.assigneeName}`}
                  onPress={() => setSelected(i.id)}
                >
                  <Panel
                    style={{
                      gap: 15,
                      borderColor: finished ? "#42624E" : colors.line,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 45,
                          height: 45,
                          borderRadius: 15,
                          backgroundColor: finished ? "#253E2D" : "#372A25",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={
                            finished ? "checkmark-outline" : "repeat-outline"
                          }
                          color={finished ? colors.green : "#EAC1A5"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: "600" }}>
                          {section === "manage"
                            ? i.currentDefinition.title
                            : i.definition.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          {section === "manage"
                            ? (people.data?.find(
                                (p) => p.id === i.currentDefinition.assignedTo,
                              )?.name ?? i.assigneeName)
                            : i.assigneeName}
                        </Text>
                      </View>
                      <Icon name="chevron-forward-outline" />
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: colors.line,
                        borderRadius: 4,
                      }}
                    >
                      <View
                        style={{
                          height: 4,
                          borderRadius: 4,
                          width: `${(i.completedSteps.length / i.definition.steps.length) * 100}%`,
                          backgroundColor: finished ? colors.green : colors.red,
                        }}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {i.completedSteps.length}/{i.definition.steps.length}{" "}
                      {tr("steps logged", "चरण दर्ज", "टप्पे नोंदवले")}
                      {!i.currentDefinition.active
                        ? ` · ${tr("Paused for new starts", "नए काम रुके", "नवीन काम थांबवले")}`
                        : ""}
                    </Text>
                    {section === "manage" ? (
                      <Button
                        secondary
                        label={tr("Edit routine", "काम बदलें", "काम बदला")}
                        onPress={() => setEdit({ id: i.id, item: i })}
                      />
                    ) : null}
                  </Panel>
                </Pressable>
              );
            })}
          </CardGrid>
          {!resource.loading &&
          !(section === "today" ? due : templates).length ? (
            <Panel style={{ gap: 8 }}>
              <Icon name="repeat-outline" size={30} />
              <Text style={{ fontWeight: "600" }}>
                {section === "history"
                  ? tr(
                      "No saved work on this date",
                      "इस दिन कोई दर्ज काम नहीं",
                      "या दिवशी नोंदवलेले काम नाही",
                    )
                  : tr(
                      "No routines due",
                      "अभी कोई रोज़ का काम नहीं",
                      "सध्या रोजचे काम नाही",
                    )}
              </Text>
              <Text style={s.muted}>
                {manager
                  ? tr(
                      "Create and assign a routine under Manage routines.",
                      "काम सँभालें में रोज़ का काम बनाकर सौंपें।",
                      "कामे सांभाळा मध्ये रोजचे काम तयार करून नेमा.",
                    )
                  : tr(
                      "Your assigned routines appear here on their repeat days.",
                      "आपको सौंपे काम तय दिनों पर यहाँ दिखेंगे।",
                      "तुम्हाला नेमलेली कामे ठरलेल्या दिवशी येथे दिसतील.",
                    )}
              </Text>
            </Panel>
          ) : null}
        </FocusPage>
      )}
      <ChoiceModal
        visible={!!item && !edit && !reopen}
        title={item?.definition.title ?? ""}
        onClose={() => setSelected(null)}
      >
        {item ? (
          <>
            <Text style={s.muted}>
              {item.assigneeName} · {item.workDate}
            </Text>
            {item.definition.steps.map((step, index) => {
              const done = item.completedSteps.includes(index);
              const own = item.definition.assignedTo === actor.id;
              const editable = own && section !== "history" && item.dueToday;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="checkbox"
                  accessibilityLabel={step}
                  accessibilityState={{
                    checked: done,
                    disabled: !editable || busy,
                  }}
                  disabled={!editable || busy}
                  onPress={() => {
                    if (done) {
                      setReopen({ item, step: index });
                      setSelected(null);
                    } else void mark(item, index);
                  }}
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    padding: 16,
                    minHeight: 70,
                    backgroundColor: done ? "#25382B" : colors.card,
                    borderRadius: 14,
                  }}
                >
                  <Icon
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    color={done ? colors.green : colors.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16 }}>{step}</Text>
                    {done ? (
                      <Text style={{ fontSize: 11, color: colors.green }}>
                        {tr("Logged", "दर्ज किया", "नोंदवले")}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {!item.events.length ? (
              <Text style={s.muted}>
                {tr(
                  "No steps logged yet.",
                  "अभी कोई चरण दर्ज नहीं।",
                  "अद्याप टप्पे नोंदवलेले नाहीत.",
                )}
              </Text>
            ) : (
              <>
                <Text style={s.label}>
                  {tr("Activity record", "काम का रिकॉर्ड", "कामाची नोंद")}
                </Text>
                {item.events.map((event) => (
                  <View
                    key={event.version}
                    style={{
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>
                      {event.byName} ·{" "}
                      {event.done
                        ? tr("Done", "पूरा", "पूर्ण")
                        : tr("Reopened", "फिर खोला", "पुन्हा उघडले")}{" "}
                      · {item.definition.steps[event.step]}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {new Date(event.createdAt).toLocaleString(
                        language === "hi"
                          ? "hi-IN"
                          : language === "mr"
                            ? "mr-IN"
                            : "en-IN",
                      )}
                      {event.note ? `\n${event.note}` : ""}
                    </Text>
                  </View>
                ))}
              </>
            )}
            {error ? <ErrorNotice message={error} /> : null}
          </>
        ) : null}
      </ChoiceModal>
    </Workspace>
  );
}
