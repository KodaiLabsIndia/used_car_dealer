import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native";
import type { ScreenProps } from "../navigation";
import { GarageHeader } from "../components/header";
import { FocusPage, ChoiceModal } from "../components/workspace";
import { WorkHeading, WorkRow, WorkGrid } from "../components/operations";
import { Button, CarThumb, ErrorNotice, Icon, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useLiveRefresh } from "../state/use-live-refresh";
import { personalInspectionWork } from "../application/work-overview";
import { openDecision } from "./decisions";
export function OwnerHomeScreen({ navigation, route }: ScreenProps<"Home">) {
  const { api, session, language } = useApp(),
    actor = session!.actor;
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const staffPage = route.params?.area === "people";
  const [search, setSearch] = useState(""),
    [manage, setManage] = useState(false);
  const dashboard = useResource("dashboard", () => api.dashboard()),
    workforce = useResource("owner-people-overview", () => api.workforce()),
    routines = useResource("owner-routines-overview", () => api.routines()),
    decisions = useResource("owner-home:reviews", () => api.decisions(0));
  const jobs = useResource("owner:staff-jobs", () => api.jobs());
  const refresh = () => {
    dashboard.refresh();
    workforce.refresh();
    routines.refresh();
    decisions.refresh();
    jobs.refresh();
  };
  useLiveRefresh(() => {
    dashboard.refreshQuiet();
    workforce.refreshQuiet();
    routines.refreshQuiet();
    decisions.refreshQuiet();
    jobs.refreshQuiet();
  });
  useEffect(() => {
    if (route.params?.area === "dealership") navigation.replace("Cars");
    else if (
      route.params?.area === "decisions" ||
      route.params?.scope === "decisions"
    )
      navigation.replace("Decisions");
    else if (route.params?.scope === "mine")
      navigation.replace("Work", { mine: true, phase: "todo" });
  }, [route.params?.area, route.params?.scope]);
  useEffect(() => setSearch(""), [staffPage]);
  const d = dashboard.data,
    people = workforce.data?.people.filter((p) => p.active) ?? [],
    atWork = people.filter((p) =>
      ["open", "at_work"].includes(p.attendanceStatus),
    ).length;
  const error =
    dashboard.error ||
    workforce.error ||
    routines.error ||
    decisions.error ||
    jobs.error;
  const status = (value: string) =>
    ["open", "at_work"].includes(value)
      ? tr("At work", "काम पर", "कामावर")
      : ["closed", "finished"].includes(value)
        ? tr("Day finished", "दिन पूरा", "दिवस पूर्ण")
        : value === "missed_out"
          ? tr(
              "Attendance needs review",
              "हाज़िरी जाँच बाकी",
              "हजेरी तपासणी बाकी",
            )
          : value === "off_day"
            ? tr("Off day", "छुट्टी", "सुट्टी")
            : tr("Not marked in", "हाज़िरी बाकी", "हजेरी बाकी");
  const mine = personalInspectionWork(
    d?.tasks ?? [],
    actor.id,
    workforce.data?.serverNow ?? "",
  );
  const todayRoutines =
      routines.data?.items.filter((item) => item.dueToday) ?? [],
    completedRoutines = todayRoutines.filter(
      (item) => item.completedSteps.length === item.definition.steps.length,
    ).length;
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader
        title={
          staffPage
            ? tr("Staff", "कर्मचारी", "कर्मचारी")
            : tr("Home", "होम", "मुख्य")
        }
      />
      <FocusPage
        scrollKey={staffPage ? "staff" : "home"}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.loading || workforce.loading}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
      >
        <WorkHeading
          title={
            staffPage
              ? tr("Your staff", "आपके कर्मचारी", "तुमचे कर्मचारी")
              : tr(
                  `Hello, ${actor.name.split(" ")[0]}`,
                  `नमस्ते, ${actor.name.split(" ")[0]}`,
                  `नमस्कार, ${actor.name.split(" ")[0]}`,
                )
          }
          action={
            staffPage
              ? tr("Manage", "व्यवस्था", "व्यवस्था")
              : tr("My work", "मेरा काम", "माझे काम")
          }
          onPress={() =>
            staffPage
              ? setManage(true)
              : navigation.navigate("Work", { mine: true, phase: "todo" })
          }
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            accessibilityLabel={
              staffPage
                ? tr("Find staff", "कर्मचारी खोजें", "कर्मचारी शोधा")
                : tr(
                    "Find car number or model",
                    "गाड़ी नंबर या मॉडल खोजें",
                    "गाडी नंबर किंवा मॉडेल शोधा",
                  )
            }
            placeholder={
              staffPage
                ? tr("Find staff", "कर्मचारी खोजें", "कर्मचारी शोधा")
                : tr(
                    "Car number or model",
                    "गाड़ी नंबर या मॉडल",
                    "गाडी नंबर किंवा मॉडेल",
                  )
            }
            placeholderTextColor="#AAA7A2"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => {
              if (!staffPage) {
                Keyboard.dismiss();
                navigation.navigate("Cars", { query: search.trim() });
              }
            }}
            returnKeyType="search"
            style={[s.input, { flex: 1, minWidth: 0 }]}
          />
          {!staffPage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr("Find car", "गाड़ी खोजें", "गाडी शोधा")}
              onPress={() => {
                Keyboard.dismiss();
                navigation.navigate("Cars", { query: search.trim() });
              }}
              style={s.iconButton}
            >
              <Icon name="search-outline" />
            </Pressable>
          ) : null}
        </View>
        {error ? <ErrorNotice message={error} retry={refresh} /> : null}
        {staffPage ? (
          <>
            <Text style={{ color: "#AAA7A2", fontSize: 12 }}>
              {atWork}/{people.length}{" "}
              {tr("at work now", "अभी काम पर", "सध्या कामावर")}
            </Text>
            {!workforce.data && workforce.loading ? (
              <ActivityIndicator color="#fff" />
            ) : null}
            <WorkGrid>
              {people
                .filter((p) =>
                  p.name
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
                )
                .map((person) => {
                  const work = personalInspectionWork(
                    d?.tasks ?? [],
                    person.id,
                    workforce.data?.serverNow ?? "",
                  );
                  const daily = (routines.data?.items ?? []).filter(
                    (i) =>
                      i.dueToday &&
                      i.definition.assignedTo === person.id &&
                      i.completedSteps.length < i.definition.steps.length,
                  );
                  return (
                    <View
                      key={person.id}
                      style={{
                        padding: 14,
                        borderRadius: 17,
                        backgroundColor: "#222221",
                        gap: 10,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${person.name}, ${tr("assigned work", "सौंपे काम", "नेमलेली कामे")}`}
                        onPress={() =>
                          navigation.navigate("Work", {
                            personId: person.id,
                            phase: "todo",
                          })
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          minHeight: 48,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "#3C2B2C",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: "600" }}>
                            {person.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={{ fontSize: 17, fontWeight: "600" }}>
                            {person.name}
                            {person.id === actor.id
                              ? ` · ${tr("Me", "मैं", "मी")}`
                              : ""}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#AAA7A2" }}>
                            {status(person.attendanceStatus)} ·{" "}
                            {work.todo.length +
                              daily.length +
                              (jobs.data ?? []).filter(
                                (job) =>
                                  job.assignedTo === person.id &&
                                  !["completed", "awaiting_qc"].includes(
                                    job.status,
                                  ),
                              ).length}{" "}
                            {tr("work items left", "काम बाकी", "कामे बाकी")}
                          </Text>
                        </View>
                        <Icon name="chevron-forward-outline" color="#EF9CA0" />
                      </Pressable>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <Button
                          secondary
                          label={tr("Work", "काम", "काम")}
                          onPress={() =>
                            navigation.navigate("Work", {
                              personId: person.id,
                              phase: "todo",
                            })
                          }
                        />
                        <Button
                          secondary
                          label={tr("Attendance", "हाज़िरी", "हजेरी")}
                          onPress={() =>
                            navigation.navigate("Workforce", {
                              userId: person.id,
                              section: "attendance",
                            })
                          }
                        />
                        <Button
                          secondary
                          label={tr("Pay", "वेतन", "पगार")}
                          onPress={() =>
                            navigation.navigate("Workforce", {
                              userId: person.id,
                              section: "pay",
                            })
                          }
                        />
                      </View>
                    </View>
                  );
                })}
            </WorkGrid>
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                {
                  label: tr("Booked", "बुक", "बुक"),
                  value: d?.booked,
                  go: () =>
                    navigation.navigate("BusinessBoard", { scope: "booked" }),
                },
                {
                  label: tr("In repair", "मरम्मत में", "दुरुस्तीत"),
                  value: d?.workshop,
                  go: () => navigation.navigate("Jobs"),
                },
                {
                  label: tr(
                    "Staff at work",
                    "काम पर कर्मचारी",
                    "कामावर कर्मचारी",
                  ),
                  value: workforce.data ? atWork : undefined,
                  go: () => navigation.navigate("Home", { area: "people" }),
                },
              ].map((metric) => (
                <Pressable
                  key={metric.label}
                  accessibilityRole="button"
                  accessibilityLabel={metric.label}
                  onPress={metric.go}
                  style={{
                    flexGrow: 1,
                    flexBasis: "30%",
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: "#292321",
                    gap: 3,
                    minWidth: 0,
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: "600" }}>
                    {metric.value ?? "—"}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#CCC3B9" }}>
                    {metric.label} ↗
                  </Text>
                </Pressable>
              ))}
            </View>
            <WorkRow
              title={tr("Needs review", "समीक्षा बाकी", "तपासणी बाकी")}
              detail={
                decisions.data
                  ? tr(
                      `${decisions.data.total} requests waiting`,
                      `${decisions.data.total} अनुरोध बाकी`,
                      `${decisions.data.total} विनंत्या बाकी`,
                    )
                  : tr(
                      "Loading requests",
                      "अनुरोध देख रहे हैं",
                      "विनंत्या पाहत आहोत",
                    )
              }
              icon="hand-left-outline"
              onPress={() => navigation.navigate("Decisions")}
            />
            <WorkHeading
              title={tr("Needs attention", "ध्यान दें", "लक्ष द्या")}
            />
            {(d?.attention ?? []).slice(0, 3).map((car) => (
              <Pressable
                key={car.id}
                accessibilityRole="button"
                accessibilityLabel={`${car.make} ${car.model}, ${car.registration}`}
                onPress={() => navigation.navigate("Car", { id: car.id })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: "#222221",
                  gap: 12,
                }}
              >
                <CarThumb car={car} size={45} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {car.make} {car.model} · {car.registration}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#CCC3B9" }}>
                    {car.nextAction}
                  </Text>
                </View>
                <Icon name="chevron-forward-outline" />
              </Pressable>
            ))}
            {!dashboard.loading && d && !d.attention.length ? (
              <Text style={{ color: "#AAA7A2" }}>
                {tr(
                  "No flagged car work.",
                  "गाड़ी का रुका काम नहीं।",
                  "गाडीची अडलेली कामे नाहीत.",
                )}
              </Text>
            ) : null}
            {mine.todo.length > 0 ? (
              <WorkRow
                title={tr(
                  "My assigned work",
                  "मेरे सौंपे काम",
                  "माझी नेमलेली कामे",
                )}
                detail={tr(
                  `${mine.todo.length} inspections to continue`,
                  `${mine.todo.length} जाँच आगे करनी हैं`,
                  `${mine.todo.length} तपासण्या करायच्या आहेत`,
                )}
                icon="person-outline"
                onPress={() =>
                  navigation.navigate("Work", { mine: true, phase: "todo" })
                }
              />
            ) : null}
            <WorkGrid>
              <WorkRow
                title={tr("Daily routines", "रोज़ के काम", "रोजची कामे")}
                detail={
                  todayRoutines.length
                    ? tr(
                        `${completedRoutines}/${todayRoutines.length} finished today`,
                        `${completedRoutines}/${todayRoutines.length} आज पूरे`,
                        `${completedRoutines}/${todayRoutines.length} आज पूर्ण`,
                      )
                    : tr(
                        "See and assign daily tasks",
                        "रोज़ के काम देखें और सौंपें",
                        "रोजची कामे पाहा व नेमा",
                      )
                }
                icon="repeat-outline"
                onPress={() => navigation.navigate("Routines")}
              />
              <WorkRow
                title={tr("Reports", "रिपोर्ट", "अहवाल")}
                detail={tr("Stock and money", "स्टॉक और पैसे", "साठा व पैसे")}
                icon="stats-chart-outline"
                onPress={() => navigation.navigate("Reports")}
              />
            </WorkGrid>
            <Button
              secondary
              label={tr(
                "Updates and reminders",
                "सूचनाएँ और याद दिलाना",
                "सूचना व आठवणी",
              )}
              onPress={() => navigation.navigate("Inbox")}
            />
          </>
        )}
      </FocusPage>
      <ChoiceModal
        visible={manage}
        title={tr(
          "Staff management",
          "कर्मचारी व्यवस्था",
          "कर्मचारी व्यवस्थापन",
        )}
        onClose={() => setManage(false)}
      >
        {[
          {
            label: tr("Team attendance", "टीम की हाज़िरी", "संघाची हजेरी"),
            go: () =>
              navigation.navigate("Workforce", { section: "attendance" }),
          },
          {
            label: tr("Payroll", "वेतन", "पगार"),
            go: () => navigation.navigate("Workforce", { section: "pay" }),
          },
          {
            label: tr(
              "Assign daily routines",
              "रोज़ के काम सौंपें",
              "रोजची कामे नेमा",
            ),
            go: () => navigation.navigate("Routines", { section: "manage" }),
          },
          ...(actor.role === "owner"
            ? [
                {
                  label: tr("Staff accounts", "कर्मचारी खाते", "कर्मचारी खाती"),
                  go: () => navigation.navigate("Team"),
                },
                {
                  label: tr("Staff rules", "कर्मचारी नियम", "कर्मचारी नियम"),
                  go: () =>
                    navigation.navigate("Workforce", { section: "rules" }),
                },
              ]
            : []),
        ].map((action) => (
          <Button
            key={action.label}
            secondary
            label={action.label}
            onPress={() => {
              setManage(false);
              action.go();
            }}
          />
        ))}
      </ChoiceModal>
    </View>
  );
}
