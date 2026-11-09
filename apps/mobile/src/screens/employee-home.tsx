import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useLiveRefresh } from "../state/use-live-refresh";
import {
  personalInspectionWork,
  routinePhase,
} from "../application/work-overview";
import { formatMoney } from "../application/money";
import { GarageHeader } from "../components/header";
import { FocusPage } from "../components/workspace";
import {
  WorkHeading,
  WorkRow,
  WorkEmpty,
  WorkGrid,
} from "../components/operations";
import {
  InspectionWorkItem,
  RoutineWorkItem,
  ServiceWorkItem,
} from "../components/work-item";
import { Button, ErrorNotice, Icon, Text } from "../components/ui";
export function EmployeeHomeScreen({ navigation, route }: ScreenProps<"Home">) {
  const { api, session, language } = useApp(),
    actor = session!.actor,
    me = route.params?.employeeArea === "me";
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const dashboard = useResource("dashboard", () => api.dashboard()),
    attendance = useResource("employee:personal-workforce", () =>
      api.workforce(actor.id),
    ),
    routines = useResource("employee:personal-routines", () => api.routines()),
    repairs = useResource("employee:personal-jobs", () => api.jobs());
  const refresh = () => {
    dashboard.refresh();
    attendance.refresh();
    routines.refresh();
    repairs.refresh();
  };
  useLiveRefresh(() => {
    dashboard.refreshQuiet();
    attendance.refreshQuiet();
    routines.refreshQuiet();
    repairs.refreshQuiet();
  });
  const wf = attendance.data,
    status = wf?.people.find((p) => p.id === actor.id)?.attendanceStatus,
    atWork = ["open", "at_work"].includes(status ?? ""),
    tasks = personalInspectionWork(
      dashboard.data?.tasks ?? [],
      actor.id,
      wf?.serverNow ?? "",
    );
  const daily = (routines.data?.items ?? []).filter(
    (i) =>
      i.dueToday &&
      i.definition.assignedTo === actor.id &&
      routinePhase(i) !== "finished",
  );
  const jobs = (repairs.data ?? []).filter(
    (j) => j.assignedTo === actor.id && j.status !== "completed",
  );
  const error =
    dashboard.error || attendance.error || routines.error || repairs.error;
  const firstRoutine = daily.find((i) => i.started),
    firstTask = tasks.todo[0],
    firstJob = jobs[0];
  const latest = wf?.salaries.find((s) => s.status !== "void");
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader title={me ? tr("Me", "मैं", "मी") : actor.name} />
      <FocusPage
        scrollKey={me ? "me" : "home"}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.loading || attendance.loading}
            onRefresh={refresh}
            tintColor="#fff"
          />
        }
      >
        {me ? (
          <>
            <WorkHeading title={actor.name} />
            <WorkRow
              title={tr("Attendance", "हाज़िरी", "हजेरी")}
              detail={tr(
                "My punches, shifts and corrections",
                "मेरी हाज़िरी, शिफ्ट और सुधार",
                "माझी हजेरी, शिफ्ट व दुरुस्त्या",
              )}
              icon="time-outline"
              onPress={() =>
                navigation.navigate("Workforce", {
                  userId: actor.id,
                  section: "attendance",
                })
              }
            />
            <WorkRow
              title={tr(
                "Pay and advances",
                "वेतन और एडवांस",
                "पगार व आगाऊ रक्कम",
              )}
              detail={
                latest
                  ? tr(
                      `Latest statement: ${formatMoney(latest.snapshot.netPaise, language === "hi")}`,
                      `आख़िरी हिसाब: ${formatMoney(latest.snapshot.netPaise, true)}`,
                      `शेवटचा हिशेब: ${formatMoney(latest.snapshot.netPaise, false)}`,
                    )
                  : tr(
                      "Statements, payments and requests",
                      "हिसाब, भुगतान और अनुरोध",
                      "हिशेब, देयके व विनंत्या",
                    )
              }
              icon="wallet-outline"
              onPress={() =>
                navigation.navigate("Workforce", {
                  userId: actor.id,
                  section: "pay",
                })
              }
            />
            <WorkRow
              title={tr("Leave", "छुट्टी", "रजा")}
              detail={tr(
                "Request leave and see its status",
                "छुट्टी माँगें और स्थिति देखें",
                "रजा मागा व स्थिती पाहा",
              )}
              icon="calendar-outline"
              onPress={() =>
                navigation.navigate("Workforce", {
                  userId: actor.id,
                  section: "leave",
                })
              }
            />
            <WorkRow
              title={tr(
                "Routine history",
                "रोज़ के काम का रिकॉर्ड",
                "रोजच्या कामांचा इतिहास",
              )}
              detail={tr(
                "Choose a day and see recorded work",
                "दिन चुनकर दर्ज काम देखें",
                "दिवस निवडून नोंदवलेली कामे पाहा",
              )}
              icon="calendar-outline"
              onPress={() =>
                navigation.navigate("Routines", { section: "history" })
              }
            />
            <WorkRow
              title={tr("Language and account", "भाषा और खाता", "भाषा व खाते")}
              detail="English · हिन्दी · मराठी"
              icon="language-outline"
              onPress={() => navigation.navigate("Settings")}
            />
            <WorkRow
              title={tr("Updates", "सूचनाएँ", "सूचना")}
              detail={tr(
                "Work and request updates",
                "काम और अनुरोध की सूचनाएँ",
                "काम व विनंतीच्या सूचना",
              )}
              icon="notifications-outline"
              onPress={() => navigation.navigate("Inbox")}
            />
          </>
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 13,
                borderRadius: 16,
                backgroundColor: atWork ? "#24382C" : "#322326",
              }}
            >
              <Icon
                name="time-outline"
                color={atWork ? "#92C9A6" : "#FFAFB4"}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 14, fontWeight: "600" }}>
                  {wf
                    ? atWork
                      ? tr("At work", "काम पर हैं", "कामावर आहात")
                      : status === "missed_out"
                        ? tr(
                            "Attendance needs review",
                            "हाज़िरी जाँच बाकी",
                            "हजेरी तपासणी बाकी",
                          )
                        : status === "closed"
                          ? tr("Day recorded", "दिन दर्ज है", "दिवस नोंदवला")
                          : status === "off_day"
                            ? tr("Off day", "छुट्टी का दिन", "सुट्टीचा दिवस")
                            : tr(
                                "Mark your attendance",
                                "हाज़िरी लगाएँ",
                                "हजेरी लावा",
                              )
                    : tr(
                        "Checking attendance…",
                        "हाज़िरी देख रहे हैं…",
                        "हजेरी पाहत आहोत…",
                      )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  status === "not_punched"
                    ? tr("Mark attendance", "हाज़िरी लगाएँ", "हजेरी लावा")
                    : tr("View attendance", "हाज़िरी देखें", "हजेरी पाहा")
                }
                onPress={() =>
                  navigation.navigate("Workforce", {
                    userId: actor.id,
                    section: "attendance",
                  })
                }
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ color: "#FFC5C8", fontWeight: "600" }}>
                  {status === "not_punched"
                    ? tr("Mark in", "हाज़िरी", "हजेरी")
                    : tr("View", "देखें", "पाहा")}{" "}
                  →
                </Text>
              </Pressable>
            </View>
            <WorkHeading
              title={tr("Your next work", "आपका अगला काम", "तुमचे पुढचे काम")}
              action={tr("All work", "सभी काम", "सर्व कामे")}
              onPress={() => navigation.navigate("Work")}
            />
            {firstTask?.status === "recheck" ? (
              <InspectionWorkItem task={firstTask} navigation={navigation} />
            ) : firstRoutine ? (
              <RoutineWorkItem item={firstRoutine} navigation={navigation} />
            ) : firstTask ? (
              <InspectionWorkItem task={firstTask} navigation={navigation} />
            ) : daily[0] ? (
              <RoutineWorkItem item={daily[0]} navigation={navigation} />
            ) : firstJob ? (
              <ServiceWorkItem job={firstJob} navigation={navigation} />
            ) : dashboard.loading || routines.loading || repairs.loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <WorkEmpty
                title={tr(
                  "No unfinished work",
                  "अधूरा काम नहीं",
                  "अपूर्ण काम नाही",
                )}
                detail={tr(
                  "New assignments appear here.",
                  "नए सौंपे काम यहाँ दिखेंगे।",
                  "नवीन नेमलेली कामे येथे दिसतील.",
                )}
              />
            )}
            <WorkGrid>
              <WorkRow
                title={tr("Daily routines", "रोज़ के काम", "रोजची कामे")}
                detail={tr(
                  `${daily.length} left today`,
                  `${daily.length} आज बाकी`,
                  `${daily.length} आज बाकी`,
                )}
                icon="repeat-outline"
                onPress={() =>
                  navigation.navigate("Work", {
                    category: "routines",
                    phase: "todo",
                  })
                }
              />
              <WorkRow
                title={tr("Scan a car", "गाड़ी स्कैन करें", "गाडी स्कॅन करा")}
                detail={tr(
                  "Use the car QR code",
                  "गाड़ी का QR कोड देखें",
                  "गाडीचा QR कोड वापरा",
                )}
                icon="qr-code-outline"
                onPress={() => navigation.navigate("Scan")}
              />
            </WorkGrid>
            {tasks.review.length ? (
              <WorkRow
                title={tr(
                  "Sent for review",
                  "समीक्षा को भेजा",
                  "तपासणीसाठी पाठवले",
                )}
                detail={tr(
                  `${tasks.review.length} waiting with your supervisor`,
                  `${tasks.review.length} जाँच सुपरवाइज़र के पास`,
                  `${tasks.review.length} तपासण्या पर्यवेक्षकाकडे`,
                )}
                icon="hourglass-outline"
                onPress={() => navigation.navigate("Work", { phase: "review" })}
              />
            ) : null}
          </>
        )}
        {error ? <ErrorNotice message={error} retry={refresh} /> : null}
      </FocusPage>
    </View>
  );
}
