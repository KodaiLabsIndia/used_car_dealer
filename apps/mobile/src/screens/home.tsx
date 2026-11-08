import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import { inspectionProgress, inspectionPortion } from "@arihant/contracts";
import { can } from "../application/access";
import type { Navigation, ScreenProps } from "../navigation";
import { GarageHeader, BottomNav } from "../components/header";
import { FocusPage, SectionTabs } from "../components/workspace";
import { CardGrid, RecordRow } from "../components/layout";
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
  return (
    <WorkBoard
      navigation={navigation}
      initialMine={route.params?.mine ?? false}
    />
  );
}
function WorkBoard({
  navigation,
  initialMine = false,
}: {
  navigation: Navigation;
  initialMine?: boolean;
}) {
  const { session, api, t, language } = useApp();
  const oversight = can(session!.actor, "overview");
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [scope, setScope] = useState(initialMine ? "mine" : "all");
  const resource = useResource("dashboard", () => api.dashboard());
  const tasks = (resource.data?.tasks ?? [])
    .filter(
      (task) =>
        scope !== "mine" ||
        (task.collaborative
          ? task.allocations.some((a) => a.assignedTo === session!.actor.id)
          : task.assignedTo === session!.actor.id),
    )
    .map((task) =>
      scope === "mine" ? inspectionPortion(task, session!.actor.id) : task,
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader
        back={oversight}
        {...(oversight
          ? { title: tr("Assigned car work", "सौंपे हुए काम", "नेमलेली कामे") }
          : {})}
      />
      <FocusPage
        scrollKey={scope}
        top={
          oversight ? (
            <SectionTabs
              items={[
                {
                  id: "all",
                  label: tr("All work", "सभी काम", "सर्व कामे"),
                  icon: "business-outline",
                },
                {
                  id: "mine",
                  label: tr("My work", "मेरा काम", "माझे काम"),
                  icon: "person-outline",
                },
              ]}
              selected={scope}
              onChange={setScope}
            />
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
        {!oversight ? (
          <>
            <Text style={{ fontSize: 26, fontWeight: "600" }}>
              {t("hello")}, {session!.actor.name}.
            </Text>
            <Button
              secondary
              label={tr(
                "My attendance & pay",
                "मेरी हाज़िरी और वेतन",
                "माझी हजेरी व पगार",
              )}
              icon="time-outline"
              onPress={() => navigation.navigate("Workforce")}
            />
            <Button
              secondary
              label={tr(
                "My daily routines",
                "मेरे रोज़ के काम",
                "माझी रोजची कामे",
              )}
              icon="repeat-outline"
              onPress={() => navigation.navigate("Routines")}
            />
            <Button
              secondary
              label={tr("Service bay", "सर्विस के काम", "सर्विसची कामे")}
              icon="build-outline"
              onPress={() => navigation.navigate("Jobs")}
            />
          </>
        ) : null}
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <CardGrid>
          {tasks.map((task) => {
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
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        {task.car.registration}
                      </Text>
                      <Text style={{ fontSize: 13, marginTop: 5 }}>
                        {task.title}
                      </Text>
                    </View>
                    <Icon name="chevron-forward-outline" />
                  </RecordRow>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.muted }}>
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
                    style={{
                      height: 3,
                      backgroundColor: colors.line,
                      borderRadius: 3,
                    }}
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
          })}
        </CardGrid>
        {!resource.loading && !tasks.length ? (
          <Panel>
            <Text style={s.muted}>{t("empty")}</Text>
          </Panel>
        ) : null}
      </FocusPage>
      {!oversight ? (
        <BottomNav
          owner={false}
          onHelp={() => {
            Alert.alert(t("help"), t("helpTask"), [
              ...tasks.slice(0, 3).map((task) => ({
                text: `${task.car.make} ${task.car.model}`,
                onPress: () => navigation.navigate("Task", { id: task.id }),
              })),
              { text: t("cancel"), style: "cancel" },
            ]);
          }}
        />
      ) : null}
    </View>
  );
}
