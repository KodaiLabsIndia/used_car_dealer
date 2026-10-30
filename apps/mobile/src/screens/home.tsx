import { RecordRow } from "../components/layout";
import { inspectionProgress } from "@arihant/contracts";
import { can } from "../application/access";
import { FocusPage, SectionTabs } from "../components/workspace";
import { Split } from "../components/layout";
import { useSection } from "../state/use-section";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import type { Stage, Task } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { GarageHeader, BottomNav } from "../components/header";
import { GarageRoute, stageKeys } from "../components/garage-motion";
import { CardGrid } from "../components/layout";
import { formatMoney } from "../application/money";
import {
  Button,
  CarThumb,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
export function HomeScreen({ navigation, route }: ScreenProps<"Home">) {
  const { session, api, t, language } = useApp(),
    owner = can(session!.actor, "overview"),
    financialOwner = session!.actor.role === "owner",
    resource = useResource("dashboard", () => api.dashboard());
  const purchaseInbox = useResource(`purchase-inbox:${owner}`, () =>
    financialOwner ? api.purchases(true) : Promise.resolve([]),
  );
  const [view, setView] = useSection(
    `home:${owner}`,
    owner ? "garage" : "work",
    ["garage", "work", "decisions"] as const,
  );
  const hi = language === "hi";
  const [scope, setScope] = useState<"all" | "mine" | "decisions">(
      route.params?.scope || "all",
    ),
    [stage, setStage] = useState<Stage | null>(null);
  useEffect(() => {
    if (route.params?.scope) {
      setScope(route.params.scope);
      setView(
        route.params.scope === "decisions"
          ? "decisions"
          : route.params.scope === "mine"
            ? "work"
            : "garage",
      );
    }
  }, [route.params?.scope]);
  const data = resource.data;
  const tasks = (data?.tasks || []).filter(
    (task) =>
      (scope !== "mine" || task.assignedTo === session!.actor.id) &&
      (view !== "decisions" || task.status === "submitted" || task.helpOpen) &&
      (!stage || task.car.stage === stage),
  );
  function help() {
    Alert.alert(t("help"), t("helpTask"), [
      ...tasks.slice(0, 3).map((task) => ({
        text: `${task.car.make} ${task.car.model}`,
        onPress: () => navigation.navigate("Task", { id: task.id }),
      })),
      { text: t("cancel"), style: "cancel" },
    ]);
  }
  const taskCard = (task: Task) => {
    const progress = inspectionProgress(task);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.car.make} ${task.car.model}, ${task.title}`}
        key={task.id}
        onPress={() => navigation.navigate("Task", { id: task.id })}
      >
        <Panel style={{ gap: 13 }}>
          <RecordRow>
            <CarThumb car={task.car} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>
                {task.car.make} {task.car.model}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                {task.car.registration}
              </Text>
              <Text style={{ fontSize: 12, marginTop: 5 }}>{task.title}</Text>
            </View>
            <Icon name="chevron-forward-outline" />
          </RecordRow>
          <View
            style={[
              s.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {progress.completed}/{progress.total} {t("progress")}
            </Text>
            <Pill
              label={
                task.status === "submitted"
                  ? t("pending")
                  : task.status === "completed"
                    ? t("completed")
                    : task.helpOpen
                      ? t("help")
                      : task.assigneeName
              }
              warning={task.helpOpen}
            />
          </View>
          <View
            style={{ height: 3, backgroundColor: colors.line, borderRadius: 3 }}
          >
            <View
              style={{
                height: 3,
                width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                backgroundColor: colors.red,
              }}
            />
          </View>
        </Panel>
      </Pressable>
    );
  };
  const proposals =
    purchaseInbox.data?.filter((p) => !stage || p.car.stage === stage) || [];
  const overview = owner && view === "garage";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader />
      <FocusPage
        scrollKey={`${view}:${scope}:${stage}`}
        top={
          !overview && owner ? (
            <>
              {view === "work" ? (
                <SectionTabs
                  items={[
                    {
                      id: "all",
                      label: hi ? "सभी काम" : "All business work",
                      icon: "business-outline",
                    },
                    {
                      id: "mine",
                      label: hi ? "मेरा काम" : "My work",
                      icon: "person-outline",
                    },
                  ]}
                  selected={scope === "mine" ? "mine" : "all"}
                  onChange={(value) => setScope(value)}
                />
              ) : (
                <Text
                  style={{ fontSize: 20, lineHeight: 28, fontWeight: "600" }}
                >
                  {t("attention")}
                </Text>
              )}
              {stage ? (
                <View style={s.row}>
                  <Pill label={t(stageKeys[stage])} />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setStage(null)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
                      justifyContent: "center",
                    }}
                  >
                    <Text>{hi ? "फ़िल्टर हटाएँ" : "Clear filter"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
      >
        {resource.error ? (
          <ErrorNotice
            message={resource.offline ? t("offline") : resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !data ? <ActivityIndicator color="#fff" /> : null}
        {overview && data ? (
          <>
            <View
              style={[
                s.row,
                { justifyContent: "space-between", flexWrap: "wrap" },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.label}>
                  {new Date()
                    .toLocaleDateString(hi ? "hi-IN" : "en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                    .toUpperCase()}
                </Text>
                <Text
                  style={[
                    s.title,
                    { marginTop: 6, fontSize: 27, lineHeight: 34 },
                  ]}
                >
                  {hi ? "हर गाड़ी पर नज़र।" : "Every car. Within reach."}
                </Text>
              </View>
              <Icon name="speedometer-outline" size={28} />
            </View>
            <Split
              first={
                <>
                  <Panel style={{ gap: 12 }}>
                    <View
                      style={[
                        s.row,
                        { justifyContent: "space-between", flexWrap: "wrap" },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("cars")}
                        onPress={() => navigation.navigate("Cars")}
                        style={{ minHeight: 70 }}
                      >
                        <Text
                          style={{
                            fontSize: 52,
                            lineHeight: 60,
                            fontWeight: "600",
                            letterSpacing: -3,
                          }}
                        >
                          {data.cars}
                        </Text>
                        <Text style={s.muted}>{t("stock")}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setView("decisions");
                          setScope("all");
                          setStage(null);
                        }}
                        style={{
                          minHeight: 60,
                          borderRadius: 12,
                          backgroundColor: colors.red,
                          padding: 14,
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontWeight: "600" }}>
                          {data.decisions} {t("decisions")}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={[s.row, { flexWrap: "wrap" }]}>
                      <Pill label={`${data.workshop} ${t("workshop")}`} />
                      <Pill label={`${data.booked} ${t("booked")}`} />
                    </View>
                  </Panel>
                  <GarageRoute
                    counts={data.stages}
                    selected={stage}
                    onSelect={setStage}
                  />
                  {stage ? (
                    <Button
                      label={`${t(stageKeys[stage])} · ${hi ? "काम खोलें" : "Open work"}`}
                      icon="arrow-forward-outline"
                      onPress={() => {
                        setView("work");
                        setScope("all");
                      }}
                    />
                  ) : null}
                </>
              }
              second={
                <>
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {[
                      {
                        label: hi ? "रिमाइंडर" : "Reminders",
                        icon: "notifications-outline" as const,
                        allowed: true,
                        go: () => navigation.navigate("Inbox"),
                      },
                      {
                        label: hi ? "पूछताछ" : "Enquiries",
                        icon: "people-outline" as const,
                        allowed: can(session!.actor, "leads"),
                        go: () => navigation.navigate("Enquiries"),
                      },
                      {
                        label: hi ? "गाड़ी जोड़ें" : "Add car",
                        icon: "add-outline" as const,
                        allowed: can(session!.actor, "intake"),
                        go: () => navigation.navigate("AddCar"),
                      },
                      {
                        label: hi ? "सर्विस" : "Service",
                        icon: "build-outline" as const,
                        allowed: can(session!.actor, "service"),
                        go: () => navigation.navigate("Jobs"),
                      },
                      {
                        label: hi ? "खरीद" : "Purchases",
                        icon: "wallet-outline" as const,
                        allowed: financialOwner,
                        go: () => navigation.navigate("Purchases"),
                      },
                      {
                        label: hi ? "बिक्री और सहायता" : "Sales & support",
                        icon: "briefcase-outline" as const,
                        allowed: financialOwner,
                        go: () => navigation.navigate("BusinessBoard"),
                      },
                    ]
                      .filter((action) => action.allowed)
                      .map((action) => (
                        <Pressable
                          key={action.label}
                          accessibilityRole="button"
                          accessibilityLabel={action.label}
                          onPress={action.go}
                          style={{
                            flexGrow: 1,
                            width: "45%",
                            minHeight: 84,
                            padding: 10,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.line,
                            backgroundColor: colors.card,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
                        >
                          <Icon name={action.icon} />
                          <Text
                            style={{
                              fontSize: 12,
                              lineHeight: 18,
                              textAlign: "center",
                              fontWeight: "600",
                            }}
                          >
                            {action.label}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                  {data.attention[0] ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        navigation.navigate("Car", {
                          id: data.attention[0]!.id,
                        })
                      }
                    >
                      <Panel style={{ gap: 8 }}>
                        <Pill
                          label={hi ? "पार्ट का इंतज़ार" : "Waiting for parts"}
                          warning
                        />
                        <Text style={{ fontWeight: "600" }}>
                          {data.attention[0].make} {data.attention[0].model}
                        </Text>
                        <Text style={s.muted}>
                          {data.attention[0].nextAction}
                        </Text>
                      </Panel>
                    </Pressable>
                  ) : (
                    <Panel>
                      <Text style={s.muted}>
                        {hi
                          ? "रुके हुए काम यहाँ दिखेंगे।"
                          : "Blocked work will appear here."}
                      </Text>
                    </Panel>
                  )}
                  {data.attention.length > 1 ? (
                    <Button
                      label={
                        hi ? "बाकी रुके काम देखें" : "View other blocked jobs"
                      }
                      secondary
                      onPress={() => navigation.navigate("Jobs")}
                    />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 10,
                      lineHeight: 16,
                      color: colors.muted,
                    }}
                  >
                    {t("training")}
                  </Text>
                </>
              }
            />
          </>
        ) : !overview ? (
          <>
            {!owner ? (
              <>
                <Text
                  style={{ fontSize: 24, lineHeight: 32, fontWeight: "600" }}
                >
                  {t("hello")}, {session!.actor.name}.
                </Text>
                <Button
                  label={hi ? "सर्विस के काम" : "Service bay"}
                  icon="build-outline"
                  secondary
                  onPress={() => navigation.navigate("Jobs")}
                />
              </>
            ) : null}
            {owner && view === "decisions" ? (
              <Button
                label={
                  hi
                    ? "सभी फैसले, खर्च और रोक देखें"
                    : "Review all decisions, quotes & holds"
                }
                icon="hand-left-outline"
                onPress={() => navigation.navigate("Decisions")}
              />
            ) : null}
            {owner && view === "decisions" && purchaseInbox.error ? (
              <ErrorNotice
                message={purchaseInbox.error}
                retry={purchaseInbox.refresh}
              />
            ) : null}
            {owner && view === "decisions" ? (
              <CardGrid>
                {proposals.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate("Purchase", { carId: p.carId })
                    }
                  >
                    <Panel style={{ gap: 12 }}>
                      <Pill
                        label={hi ? "खरीद की मंज़ूरी" : "Purchase approval"}
                        warning
                      />
                      <RecordRow>
                        <CarThumb car={p.car} size={48} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 17, fontWeight: "600" }}>
                            {p.car.make} {p.car.model}
                          </Text>
                          <Text>
                            {formatMoney(p.terms.purchasePricePaise, hi)}
                          </Text>
                        </View>
                        <Icon name="chevron-forward-outline" />
                      </RecordRow>
                    </Panel>
                  </Pressable>
                ))}
              </CardGrid>
            ) : null}
            <CardGrid>{tasks.map(taskCard)}</CardGrid>
            {!resource.loading &&
            !tasks.length &&
            !(owner && view === "decisions" && proposals.length) ? (
              <Panel>
                <Text style={s.muted}>{t("empty")}</Text>
              </Panel>
            ) : null}
          </>
        ) : null}
      </FocusPage>
      <BottomNav
        owner={owner}
        active={view}
        onGarage={() => setView("garage")}
        onWork={() => {
          setView("work");
          setScope("all");
        }}
        onDecisions={() => {
          setView("decisions");
          setScope("all");
          setStage(null);
        }}
        onHelp={help}
      />
    </View>
  );
}
