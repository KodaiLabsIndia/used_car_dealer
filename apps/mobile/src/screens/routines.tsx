import { uxText } from "../state/ux-copy";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import type { RoutineItem, SaveRoutine } from "@arihant/contracts";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { can } from "../application/access";
import { sendCommand } from "../application/send-command";
import { Workspace, FocusPage } from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
} from "../components/business-form";
import { DateField } from "../components/date-field";
import { ErrorNotice } from "../components/ui";
import type { ScreenProps } from "../navigation";
import { RoutineFocus } from "../components/routine-focus";
import { RoutineBoard } from "../components/routine-board";

export function RoutinesScreen({ navigation, route }: ScreenProps<"Routines">) {
  const { api, session, language, changed } = useApp();
  const actor = session!.actor;
  const manager = can(actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [section, setSection] = useState<"today" | "manage" | "history">(
    route.params?.section === "manage" && !manager
      ? "today"
      : (route.params?.section ?? "today"),
  );
  const [day, setDay] = useState(route.params?.day ?? "");
  const resource = useResource(
    `routines:${manager ? "team" : "self"}:${section === "history" ? day : "today"}`,
    () => api.routines(section === "history" && day ? day : undefined),
  );
  const people = useResource(`routine-people:${manager}`, () =>
    manager ? api.people() : Promise.resolve([]),
  );
  const [selected, setSelected] = useState<string | null>(
    route.params?.routineId ?? null,
  );
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
  const focused = useIsFocused();
  useEffect(() => {
    if (route.params?.routineId) setSelected(route.params.routineId);
    if (route.params?.section)
      setSection(
        route.params.section === "manage" && !manager
          ? "today"
          : route.params.section,
      );
  }, [route.params?.routineId, route.params?.section, manager]);
  const closeDetail = useCallback(() => {
    if (route.params?.routineId && navigation.canGoBack()) navigation.goBack();
    else {
      setSelected(null);
      navigation.setParams({ routineId: undefined });
    }
  }, [navigation, route.params?.routineId]);
  useFocusEffect(
    useCallback(() => {
      if (!selected || edit || reopen) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        closeDetail();
        return true;
      });
      return () => sub.remove();
    }, [selected, edit, reopen, closeDetail]),
  );
  useEffect(() => {
    if (resource.data && !day) setDay(resource.data.today);
  }, [resource.data?.today]);
  useEffect(() => {
    if (!focused || edit || reopen) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") resource.refreshQuiet();
    }, 30000);
    return () => clearInterval(timer);
  }, [focused, edit, reopen]);
  const templates = (resource.data?.items ?? []).filter(
    (i) => manager || i.definition.assignedTo === actor.id,
  );
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
      changed(uxText(language, "Routine step updated", "काम का चरण दर्ज हुआ"));
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
  if (item && !edit && !reopen)
    return (
      <RoutineFocus
        item={item}
        busy={busy || resource.loading}
        error={error}
        canLog={
          item.definition.assignedTo === actor.id &&
          section !== "history" &&
          item.dueToday
        }
        onBack={closeDetail}
        onDone={(index) => {
          void mark(item, index);
        }}
        onReopen={(index) => setReopen({ item, step: index })}
        {...(manager ? { onEdit: () => setEdit({ id: item.id, item }) } : {})}
      />
    );
  return (
    <Workspace
      title={
        manager
          ? tr("Daily routines", "रोज़ के काम", "रोजची कामे")
          : tr("My daily routines", "मेरे रोज़ के काम", "माझी रोजची कामे")
      }
      selected={section}
      busy={busy}
      sectionLocked={!!edit || !!reopen}
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
              changed(uxText(language, "Routine saved", "रोज़ का काम सेव हुआ"));
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
          ) : null}
          <RoutineBoard
            items={templates}
            names={Object.fromEntries(
              (people.data ?? []).map((p) => [p.id, p.name]),
            )}
            manager={manager}
            section={section}
            onOpen={(id) =>
              navigation.push("Routines", {
                routineId: id,
                section,
                day: section === "history" ? day : undefined,
              })
            }
            onEdit={(item) => setEdit({ id: item.id, item })}
            onCreate={() => setEdit({ id: randomUUID(), item: null })}
          />
        </FocusPage>
      )}
    </Workspace>
  );
}
