import React, { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import type { Task } from "@arihant/contracts";
import { can } from "../application/access";
import {
  personalInspectionWork,
  routinePhase,
} from "../application/work-overview";
import type { ScreenProps } from "../navigation";
import { GarageHeader } from "../components/header";
import { FocusPage, SectionTabs, SelectField } from "../components/workspace";
import { WorkGrid, WorkHeading, WorkEmpty } from "../components/operations";
import {
  InspectionWorkItem,
  RoutineWorkItem,
  ServiceWorkItem,
} from "../components/work-item";
import { Button, ErrorNotice, Text } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useLiveRefresh } from "../state/use-live-refresh";
import { useSection } from "../state/use-section";
import { EmployeeHomeScreen } from "./employee-home";
import { OwnerHomeScreen } from "./owner-home";
export function HomeScreen(props: ScreenProps<"Home">) {
  const { session } = useApp();
  return can(session!.actor, "overview") ? (
    <OwnerHomeScreen {...props} />
  ) : (
    <EmployeeHomeScreen {...props} />
  );
}
export function WorkScreen({ navigation, route }: ScreenProps<"Work">) {
  const { session, api, language } = useApp(),
    actor = session!.actor,
    oversight = can(actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [person, setPerson] = useState(
    route.params?.personId ??
      (route.params?.mine || !oversight ? actor.id : "all"),
  );
  const [phase, setPhase] = useSection("work:phase:v2", "todo", [
    "todo",
    "review",
    "finished",
  ] as const);
  const [category, setCategory] = useState<
    "all" | "inspections" | "routines" | "service"
  >(route.params?.category ?? "all");
  useEffect(() => {
    setPerson(
      route.params?.personId ??
        (route.params?.mine || !oversight ? actor.id : "all"),
    );
    setCategory(route.params?.category ?? "all");
    if (route.params?.phase) setPhase(route.params.phase);
  }, [
    route.params?.personId,
    route.params?.mine,
    route.params?.category,
    route.params?.phase,
    actor.id,
    oversight,
  ]);
  const dashboard = useResource("dashboard", () => api.dashboard()),
    routines = useResource("work:routines", () => api.routines()),
    jobs = useResource("work:jobs", () => api.jobs()),
    people = useResource(`work:people:${oversight}`, () =>
      oversight ? api.people() : Promise.resolve([]),
    );
  const refresh = () => {
    dashboard.refresh();
    routines.refresh();
    jobs.refresh();
    people.refresh();
  };
  useLiveRefresh(() => {
    dashboard.refreshQuiet();
    routines.refreshQuiet();
    jobs.refreshQuiet();
    people.refreshQuiet();
  });
  const all = dashboard.data?.tasks ?? [],
    now = new Date().toISOString();
  const portions =
    person === "all"
      ? {
          todo: all.filter(
            (t) => !["completed", "submitted"].includes(t.status),
          ),
          review: all.filter(
            (t) =>
              t.status === "submitted" ||
              t.allocations?.some((a) => a.state === "submitted"),
          ),
          finished: all.filter((t) => t.status === "completed"),
        }
      : personalInspectionWork(all, person, now);
  const taskRows = (
    phase === "todo"
      ? portions.todo
      : phase === "review"
        ? portions.review
        : portions.finished
  ) as Task[];
  const routineRows = (routines.data?.items ?? []).filter(
    (i) =>
      (person === "all" || i.definition.assignedTo === person) &&
      i.dueToday &&
      phase !== "review" &&
      (phase === "finished"
        ? routinePhase(i) === "finished"
        : routinePhase(i) !== "finished"),
  );
  const jobRows = (jobs.data ?? []).filter(
    (j) =>
      (person === "all" || j.assignedTo === person) &&
      (phase === "review"
        ? j.status === "awaiting_qc"
        : phase === "finished"
          ? j.status === "completed"
          : !["completed", "awaiting_qc"].includes(j.status)),
  );
  const tasks =
      category === "all" || category === "inspections" ? taskRows : [],
    daily = category === "all" || category === "routines" ? routineRows : [],
    service = category === "all" || category === "service" ? jobRows : [];
  const selected = people.data?.find((p) => p.id === person),
    error = dashboard.error || routines.error || jobs.error || people.error;
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader
        title={
          oversight
            ? tr("Work", "काम", "काम")
            : tr("My work", "मेरा काम", "माझे काम")
        }
        back
      />
      <FocusPage
        scrollKey={`${person}:${phase}:${category}`}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.loading || routines.loading || jobs.loading}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
      >
        <WorkHeading
          title={
            selected?.name ??
            (person === actor.id
              ? tr("My work", "मेरा काम", "माझे काम")
              : tr("Team work", "टीम का काम", "संघाचे काम"))
          }
          action={tr("Scan car", "गाड़ी स्कैन करें", "गाडी स्कॅन करा")}
          onPress={() => navigation.navigate("Scan")}
        />
        {oversight ? (
          <SelectField
            label={tr("Whose work?", "किसका काम?", "कोणाचे काम?")}
            value={person}
            onChange={setPerson}
            options={[
              {
                id: "all",
                label: tr("All staff", "सभी कर्मचारी", "सर्व कर्मचारी"),
              },
              ...(people.data ?? []).map((p) => ({
                id: p.id,
                label:
                  p.id === actor.id
                    ? `${p.name} · ${tr("My work", "मेरा काम", "माझे काम")}`
                    : p.name,
              })),
            ]}
          />
        ) : null}
        {oversight && person !== "all" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              secondary
              label={tr("Attendance", "हाज़िरी", "हजेरी")}
              onPress={() =>
                navigation.navigate("Workforce", {
                  userId: person,
                  section: "attendance",
                })
              }
            />
            <Button
              secondary
              label={tr("Pay", "वेतन", "पगार")}
              onPress={() =>
                navigation.navigate("Workforce", {
                  userId: person,
                  section: "pay",
                })
              }
            />
          </View>
        ) : null}
        <SectionTabs
          selected={phase}
          onChange={setPhase}
          items={[
            {
              id: "todo",
              label: tr("To do", "करना है", "करायचे"),
              icon: "ellipse-outline",
            },
            {
              id: "review",
              label: tr("Sent for review", "समीक्षा को भेजा", "तपासणीसाठी"),
              icon: "hourglass-outline",
            },
            {
              id: "finished",
              label: tr("Done", "पूरा", "पूर्ण"),
              icon: "checkmark-done-outline",
            },
          ]}
        />
        <SelectField
          label={tr("Show", "दिखाएँ", "दाखवा")}
          value={category}
          onChange={(v) => setCategory(v as typeof category)}
          options={[
            { id: "all", label: tr("All work", "सभी काम", "सर्व कामे") },
            {
              id: "inspections",
              label: tr("Car checks", "गाड़ी की जाँच", "गाडीची तपासणी"),
            },
            {
              id: "routines",
              label: tr("Daily routines", "रोज़ के काम", "रोजची कामे"),
            },
            { id: "service", label: tr("Repairs", "मरम्मत", "दुरुस्ती") },
          ]}
        />
        {error ? <ErrorNotice message={error} retry={refresh} /> : null}
        {dashboard.loading && !dashboard.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <WorkGrid>
          {tasks.map((t) => (
            <InspectionWorkItem
              key={t.id}
              task={t}
              review={phase === "review"}
              navigation={navigation}
              personName={
                person === "all"
                  ? t.collaborative
                    ? tr("Team", "टीम", "संघ")
                    : t.assigneeName
                  : undefined
              }
            />
          ))}
          {daily.map((i) => (
            <RoutineWorkItem
              key={i.id}
              item={i}
              navigation={navigation}
              showPerson={person === "all"}
            />
          ))}
          {service.map((j) => (
            <ServiceWorkItem key={j.id} job={j} navigation={navigation} />
          ))}
        </WorkGrid>
        {!dashboard.loading &&
        !routines.loading &&
        !jobs.loading &&
        !tasks.length &&
        !daily.length &&
        !service.length ? (
          <WorkEmpty
            title={tr(
              "No work in this list",
              "इस सूची में काम नहीं",
              "या यादीत काम नाही",
            )}
            detail={tr(
              "Choose another status or work type.",
              "दूसरी स्थिति या काम चुनें।",
              "दुसरी स्थिती किंवा काम निवडा.",
            )}
          />
        ) : null}
        {oversight ? (
          <View style={{ gap: 8 }}>
            <Button
              secondary
              label={tr(
                "Assign daily routine",
                "रोज़ का काम सौंपें",
                "रोजचे काम नेमा",
              )}
              onPress={() =>
                navigation.navigate("Routines", { section: "manage" })
              }
            />
            <Button
              secondary
              label={tr(
                "Workshops and mechanics",
                "वर्कशॉप और मैकेनिक",
                "वर्कशॉप व मेकॅनिक",
              )}
              onPress={() => navigation.navigate("Workshops")}
            />
          </View>
        ) : null}
      </FocusPage>
    </View>
  );
}
