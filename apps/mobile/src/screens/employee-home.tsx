import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  RefreshControl,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Speech from "expo-speech";
import { colors } from "@arihant/design-tokens";
import {
  inspectionProgress,
  type Task,
  type RepairJob,
} from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useSection } from "../state/use-section";
import {
  personalInspectionWork,
  routinePhase,
} from "../application/work-overview";
import { formatMoney } from "../application/money";
import { GarageHeader } from "../components/header";
import { useReducedMotion } from "../components/garage-motion";
import { ContentScroll, useLayout } from "../components/layout";
import { SectionTabs } from "../components/workspace";
import { RoutineCard } from "../components/routine-card";
import {
  WorkHeading,
  WorkRow,
  WorkGrid,
  WorkEmpty,
  WorkNavigation,
  operationColors as c,
} from "../components/operations";
import { Button, CarThumb, ErrorNotice, Icon, Text } from "../components/ui";

type Area = "today" | "work" | "pay" | "help";
export function EmployeeHomeScreen({ navigation }: ScreenProps<"Home">) {
  const { api, session, language } = useApp();
  const actor = session!.actor;
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [area, setArea] = useSection<Area>("employee:area:v1", "today", [
    "today",
    "work",
    "pay",
    "help",
  ]);
  const [kind, setKind] = useSection("employee:work-kind:v1", "inspections", [
    "inspections",
    "routines",
    "service",
  ] as const);
  const [list, setList] = useSection("employee:work-list:v1", "todo", [
    "todo",
    "review",
    "finished",
  ] as const);
  const dashboard = useResource("dashboard", () => api.dashboard());
  const attendance = useResource("employee:personal-workforce", () =>
    api.workforce(actor.id),
  );
  const routines = useResource("employee:personal-routines", () =>
    api.routines(),
  );
  const repairs = useResource("employee:personal-jobs", () => api.jobs());
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const { width, height, fontScale } = useLayout();
  const rail = width >= 900 && height >= 600 && fontScale < 1.5;
  const refresh = () => {
    dashboard.refresh();
    attendance.refresh();
    routines.refresh();
    repairs.refresh();
  };
  useEffect(() => {
    if (!focused) return;
    const tick = () => {
      if (AppState.currentState === "active") refresh();
    };
    const timer = setInterval(tick, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      void Speech.stop();
    };
  }, [focused]);
  useEffect(() => {
    void Speech.stop();
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.6);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [area, reduced]);
  const wf = attendance.data;
  const ownStatus = wf?.people.find((p) => p.id === actor.id)?.attendanceStatus;
  const serverNow = wf?.serverNow ?? "";
  const tasks = personalInspectionWork(
    dashboard.data?.tasks ?? [],
    actor.id,
    serverNow,
  );
  const jobs = (repairs.data ?? []).filter((j) => j.assignedTo === actor.id);
  const activeJobs = jobs.filter((j) => j.status !== "completed");
  const due = (routines.data?.items ?? []).filter(
    (i) => i.definition.assignedTo === actor.id && i.dueToday,
  );
  const routineTodo = due.filter((i) => routinePhase(i) !== "finished");
  const routineDone = due.filter((i) => routinePhase(i) === "finished");
  const nextTask = tasks.todo[0];
  const nextRoutine = routineTodo.find((i) => i.started) ?? routineTodo[0];
  const nextJob =
    activeJobs.find((j) => j.status !== "waiting_parts") ?? activeJobs[0];
  const featuredRoutine =
    nextRoutine &&
    (!nextTask ||
      (nextRoutine.started &&
        nextTask.status !== "recheck" &&
        !nextTask.helpOpen));
  const published = wf?.salaries.filter((s) => s.status !== "void") ?? [];
  const latest = published[0];
  const todayDate = wf?.today;
  const dateLabel = todayDate
    ? new Date(`${todayDate}T12:00:00+05:30`).toLocaleDateString(
        language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "Asia/Kolkata",
        },
      )
    : tr("Your working day", "आपका काम का दिन", "तुमचा कामाचा दिवस");
  const statusLabel =
    ownStatus === "open"
      ? tr("You’re at work", "आप काम पर हैं", "तुम्ही कामावर आहात")
      : ownStatus === "closed"
        ? tr(
            "Your day is recorded",
            "आपका दिन दर्ज है",
            "तुमचा दिवस नोंदवला आहे",
          )
        : ownStatus === "missed_out"
          ? tr(
              "A punch needs review",
              "हाज़िरी की समीक्षा बाकी",
              "हजेरीची तपासणी बाकी",
            )
          : ownStatus === "off_day"
            ? tr(
                "Today is an off day",
                "आज छुट्टी का दिन है",
                "आज सुट्टीचा दिवस आहे",
              )
            : tr("Ready for your day?", "काम शुरू करें?", "काम सुरू करूया?");
  const taskCard = (task: Task) => {
    const p = inspectionProgress(task);
    const label =
      task.status === "recheck"
        ? tr("Changes requested", "बदलाव चाहिए", "बदल आवश्यक")
        : task.status === "submitted"
          ? tr("With supervisor", "सुपरवाइज़र के पास", "पर्यवेक्षकाकडे")
          : task.status === "completed"
            ? tr("Completed", "पूरा हुआ", "पूर्ण")
            : task.helpOpen
              ? tr("Help requested", "मदद माँगी गई", "मदत मागितली")
              : tr("Open inspection", "जाँच खोलें", "तपासणी उघडा");
    return (
      <View
        key={task.id}
        style={{
          borderRadius: 20,
          backgroundColor: c.card,
          padding: 18,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CarThumb car={task.car} size={60} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 19, fontWeight: "600", width: "100%" }}>
              {task.car.make} {task.car.model}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted }}>
              {task.car.registration}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, width: "100%" }}>{task.title}</Text>
        <View style={{ height: 4, backgroundColor: c.line, borderRadius: 4 }}>
          <View
            style={{
              height: 4,
              backgroundColor: colors.red,
              borderRadius: 4,
              width: `${p.total ? (p.completed / p.total) * 100 : 0}%`,
            }}
          />
        </View>
        <Text style={{ fontSize: 12, color: c.muted }}>
          {p.completed}/{p.total}{" "}
          {tr("checks recorded", "जाँच दर्ज", "तपासण्या नोंदवल्या")}
        </Text>
        <Button
          secondary={task.status === "completed" || task.status === "submitted"}
          label={label}
          icon={
            task.status === "completed"
              ? "checkmark-outline"
              : "arrow-forward-outline"
          }
          onPress={() => navigation.navigate("Task", { id: task.id })}
        />
      </View>
    );
  };
  const jobRow = (j: RepairJob) => (
    <WorkRow
      key={j.id}
      title={`${j.car.make} ${j.car.model}`}
      detail={j.title}
      icon="build-outline"
      stamp={
        j.status === "waiting_parts"
          ? tr("Waiting for parts", "पार्ट का इंतज़ार", "पार्टची प्रतीक्षा")
          : j.status === "awaiting_qc"
            ? tr(
                "Ready for quality check",
                "गुणवत्ता जाँच बाकी",
                "गुणवत्ता तपासणी बाकी",
              )
            : j.status === "completed"
              ? tr("Finished", "पूरा हुआ", "पूर्ण")
              : tr("Service work", "सर्विस का काम", "सर्विसचे काम")
      }
      tone={
        j.status === "waiting_parts"
          ? "warning"
          : j.status === "completed"
            ? "success"
            : "normal"
      }
      onPress={() => navigation.navigate("Job", { id: j.id })}
    />
  );
  const nav = (
    <WorkNavigation
      rail={rail}
      selected={area}
      onChange={setArea}
      items={[
        { id: "today", label: tr("Today", "आज", "आज"), icon: "sunny-outline" },
        {
          id: "work",
          label: tr("My work", "मेरा काम", "माझे काम"),
          icon: "clipboard-outline",
        },
        {
          id: "pay",
          label: tr("My pay", "मेरा वेतन", "माझा पगार"),
          icon: "wallet-outline",
        },
        {
          id: "help",
          label: tr("Help", "मदद", "मदत"),
          icon: "help-circle-outline",
        },
      ]}
    />
  );
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader />
      <View
        style={{
          flex: 1,
          flexDirection: rail ? "row" : "column",
          width: "100%",
          maxWidth: 1480,
          alignSelf: "center",
        }}
      >
        {rail ? nav : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ContentScroll
            key={area}
            refreshControl={
              <RefreshControl
                refreshing={
                  dashboard.loading ||
                  attendance.loading ||
                  routines.loading ||
                  repairs.loading
                }
                onRefresh={refresh}
                tintColor="#fff"
              />
            }
            contentContainerStyle={{ padding: rail ? 28 : 18, gap: 22 }}
          >
            <Animated.View style={{ opacity, gap: 22 }}>
              {dashboard.error ||
              attendance.error ||
              routines.error ||
              repairs.error ? (
                <ErrorNotice
                  message={
                    dashboard.error ||
                    attendance.error ||
                    routines.error ||
                    repairs.error
                  }
                  retry={refresh}
                />
              ) : null}
              {!dashboard.data && dashboard.loading ? (
                <ActivityIndicator color="#fff" />
              ) : null}
              {area === "today" ? (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, color: c.muted }}>
                      {dateLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 31,
                        lineHeight: 40,
                        fontWeight: "600",
                        width: "100%",
                      }}
                    >
                      {tr("Hello", "नमस्ते", "नमस्कार")}, {actor.name}.
                    </Text>
                    <Text style={{ fontSize: 14, color: c.muted }}>
                      {tr(
                        "One clear next step.",
                        "एक समय पर एक साफ़ काम।",
                        "एका वेळी एक स्पष्ट काम.",
                      )}
                    </Text>
                  </View>
                  <View
                    style={{
                      padding: 22,
                      borderRadius: 24,
                      backgroundColor:
                        ownStatus === "open" ? "#263E31" : "#322326",
                      borderWidth: 1,
                      borderColor: ownStatus === "open" ? "#43634E" : "#63323A",
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <Icon
                        name="time-outline"
                        color={ownStatus === "open" ? colors.green : "#FFB3B7"}
                        size={27}
                      />
                      <Text
                        style={{ fontSize: 20, fontWeight: "600", flex: 1 }}
                      >
                        {wf
                          ? statusLabel
                          : tr(
                              "Checking your attendance…",
                              "हाज़िरी देख रहे हैं…",
                              "हजेरी तपासत आहोत…",
                            )}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: c.muted }}>
                      {tr(
                        "Your attendance, shift and leave in one place.",
                        "आपकी हाज़िरी, शिफ्ट और छुट्टी एक जगह।",
                        "तुमची हजेरी, शिफ्ट व रजा एकाच ठिकाणी.",
                      )}
                    </Text>
                    <Button
                      secondary
                      label={
                        ownStatus === "not_punched"
                          ? tr("Mark attendance", "हाज़िरी लगाएँ", "हजेरी लावा")
                          : tr(
                              "View my attendance",
                              "मेरी हाज़िरी देखें",
                              "माझी हजेरी पाहा",
                            )
                      }
                      icon="finger-print-outline"
                      onPress={() =>
                        navigation.navigate("Workforce", {
                          userId: actor.id,
                          section: "attendance",
                        })
                      }
                    />
                  </View>
                  <WorkHeading
                    kicker={tr("NEXT UP", "अगला काम", "पुढचे काम")}
                    title={tr(
                      "What to do next",
                      "अब क्या करना है",
                      "पुढे काय करायचे",
                    )}
                    action={tr("All work", "सभी काम", "सर्व कामे")}
                    onPress={() => setArea("work")}
                  />
                  {featuredRoutine && nextRoutine ? (
                    <RoutineCard
                      item={nextRoutine}
                      onPress={() =>
                        navigation.navigate("Routines", {
                          routineId: nextRoutine.id,
                        })
                      }
                    />
                  ) : nextTask ? (
                    taskCard(nextTask)
                  ) : nextJob ? (
                    jobRow(nextJob)
                  ) : dashboard.loading ||
                    routines.loading ||
                    repairs.loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <WorkEmpty
                      title={tr(
                        "No unfinished work here",
                        "अभी कोई अधूरा काम नहीं",
                        "अपूर्ण काम नाही",
                      )}
                      detail={tr(
                        "Assigned work will appear here. Attendance is recorded separately.",
                        "आपको सौंपे काम यहाँ दिखेंगे। हाज़िरी अलग दर्ज होती है।",
                        "नेमलेली कामे येथे दिसतील. हजेरी वेगळी नोंदवली जाते.",
                      )}
                    />
                  )}
                  <WorkGrid>
                    <WorkRow
                      title={tr("Daily routines", "रोज़ के काम", "रोजची कामे")}
                      detail={`${routineDone.length}/${due.length} ${tr("finished today", "आज पूरे", "आज पूर्ण")}`}
                      icon="repeat-outline"
                      onPress={() => {
                        setKind("routines");
                        setList("todo");
                        setArea("work");
                      }}
                    />
                    <WorkRow
                      title={tr(
                        "Scan a car",
                        "गाड़ी स्कैन करें",
                        "गाडी स्कॅन करा",
                      )}
                      detail={tr(
                        "Open your car’s QR code",
                        "गाड़ी का QR कोड खोलें",
                        "गाडीचा QR कोड उघडा",
                      )}
                      icon="qr-code-outline"
                      onPress={() => navigation.navigate("Scan")}
                    />
                  </WorkGrid>
                </>
              ) : area === "work" ? (
                <>
                  <WorkHeading
                    kicker={tr("YOUR WORK", "आपके काम", "तुमची कामे")}
                    title={tr(
                      "Know what’s next.",
                      "अगला काम साफ़ है।",
                      "पुढचे काम स्पष्ट आहे.",
                    )}
                    action={tr(
                      "Scan car",
                      "गाड़ी स्कैन करें",
                      "गाडी स्कॅन करा",
                    )}
                    onPress={() => navigation.navigate("Scan")}
                  />
                  <SectionTabs
                    items={[
                      {
                        id: "inspections",
                        label: tr("Inspections", "जाँच", "तपासणी"),
                        icon: "scan-outline",
                        badge: String(tasks.todo.length),
                      },
                      {
                        id: "routines",
                        label: tr("Routines", "रोज़ के काम", "रोजची कामे"),
                        icon: "repeat-outline",
                        badge: String(routineTodo.length),
                      },
                      {
                        id: "service",
                        label: tr("Service", "सर्विस", "सर्विस"),
                        icon: "build-outline",
                        badge: String(activeJobs.length),
                      },
                    ]}
                    selected={kind}
                    onChange={(v) => {
                      setKind(v);
                      setList("todo");
                    }}
                  />
                  <SectionTabs
                    items={[
                      {
                        id: "todo",
                        label: tr("To do", "करना है", "करायचे"),
                        icon: "ellipse-outline",
                      },
                      ...(kind === "inspections"
                        ? [
                            {
                              id: "review" as const,
                              label: tr("In review", "समीक्षा में", "तपासणीत"),
                              icon: "hourglass-outline" as const,
                            },
                          ]
                        : []),
                      {
                        id: "finished",
                        label: tr("Finished", "पूरा हुआ", "पूर्ण"),
                        icon: "checkmark-done-outline",
                      },
                    ]}
                    selected={list}
                    onChange={setList}
                  />
                  {kind === "inspections" ? (
                    <>
                      <WorkGrid>
                        {(list === "finished"
                          ? tasks.finished
                          : list === "review"
                            ? tasks.review
                            : tasks.todo
                        ).map(taskCard)}
                      </WorkGrid>
                      {!(
                        list === "finished"
                          ? tasks.finished
                          : list === "review"
                            ? tasks.review
                            : tasks.todo
                      ).length ? (
                        <WorkEmpty
                          title={tr(
                            "Nothing in this list",
                            "इस सूची में काम नहीं",
                            "या यादीत काम नाही",
                          )}
                          detail={tr(
                            "Your assigned inspections appear in the right stage.",
                            "आपकी जाँच सही स्थिति में यहाँ दिखेगी।",
                            "तुमच्या तपासण्या योग्य स्थितीत येथे दिसतील.",
                          )}
                        />
                      ) : null}
                    </>
                  ) : kind === "routines" ? (
                    <>
                      <WorkGrid>
                        {(list === "finished" ? routineDone : routineTodo).map(
                          (i) => (
                            <RoutineCard
                              key={i.id}
                              item={i}
                              onPress={() =>
                                navigation.navigate("Routines", {
                                  routineId: i.id,
                                })
                              }
                            />
                          ),
                        )}
                      </WorkGrid>
                      {!(list === "finished" ? routineDone : routineTodo)
                        .length ? (
                        <WorkEmpty
                          title={tr(
                            "No routines in this list",
                            "इस सूची में रोज़ के काम नहीं",
                            "या यादीत रोजची कामे नाहीत",
                          )}
                          detail={tr(
                            "Only routines assigned to you and due today appear here.",
                            "सिर्फ़ आपके आज के रोज़ के काम यहाँ दिखेंगे।",
                            "फक्त तुम्हाला नेमलेली आजची कामे येथे दिसतील.",
                          )}
                        />
                      ) : null}
                      <WorkRow
                        title={tr(
                          "Saved routine history",
                          "रोज़ के काम का रिकॉर्ड",
                          "रोजच्या कामांची नोंद",
                        )}
                        detail={tr(
                          "Choose a day and see recorded steps",
                          "दिन चुनकर दर्ज चरण देखें",
                          "दिवस निवडा व नोंदवलेले टप्पे पाहा",
                        )}
                        icon="calendar-outline"
                        onPress={() =>
                          navigation.navigate("Routines", {
                            section: "history",
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <WorkGrid>
                        {(list === "finished"
                          ? jobs.filter((j) => j.status === "completed")
                          : activeJobs
                        ).map(jobRow)}
                      </WorkGrid>
                      {!(
                        list === "finished"
                          ? jobs.filter((j) => j.status === "completed")
                          : activeJobs
                      ).length ? (
                        <WorkEmpty
                          title={tr(
                            "No service work in this list",
                            "इस सूची में सर्विस का काम नहीं",
                            "या यादीत सर्विसचे काम नाही",
                          )}
                          detail={tr(
                            "Your repair assignments and parts updates appear here.",
                            "आपके मरम्मत के काम और पार्ट अपडेट यहाँ दिखेंगे।",
                            "तुमची दुरुस्तीची कामे व पार्टची माहिती येथे दिसेल.",
                          )}
                        />
                      ) : null}
                    </>
                  )}
                </>
              ) : area === "pay" ? (
                <>
                  <WorkHeading
                    kicker={tr("MY PAY", "मेरा वेतन", "माझा पगार")}
                    title={tr(
                      "Your pay, clearly.",
                      "आपके वेतन का साफ़ हिसाब।",
                      "तुमच्या पगाराचा स्पष्ट हिशेब.",
                    )}
                  />
                  <View
                    style={{
                      padding: 24,
                      borderRadius: 24,
                      backgroundColor: "#322A21",
                      gap: 12,
                      borderWidth: 1,
                      borderColor: "#51402C",
                    }}
                  >
                    <Icon name="wallet-outline" color="#EAC795" size={30} />
                    <Text style={{ fontSize: 12, color: "#D7BF9F" }}>
                      {tr(
                        "LATEST ISSUED SALARY",
                        "आख़िरी जारी वेतन",
                        "शेवटचा जारी पगार",
                      )}
                    </Text>
                    <Text style={{ fontSize: 34, fontWeight: "600" }}>
                      {latest
                        ? formatMoney(
                            latest.snapshot.netPaise,
                            language === "hi",
                          )
                        : "—"}
                    </Text>
                    <Text style={{ fontSize: 13, color: c.muted }}>
                      {latest
                        ? `${latest.start} → ${latest.end}`
                        : tr(
                            "Your issued statement appears after the owner confirms it.",
                            "मालिक की पुष्टि के बाद जारी वेतन यहाँ दिखेगा।",
                            "मालकाने निश्चित केल्यावर जारी पगार येथे दिसेल.",
                          )}
                    </Text>
                    {latest ? (
                      <Text style={{ fontSize: 13, color: c.muted }}>
                        {tr("Paid", "भुगतान हुआ", "दिलेले")}:{" "}
                        {formatMoney(latest.paidPaise, language === "hi")}
                      </Text>
                    ) : null}
                  </View>
                  <WorkRow
                    title={tr(
                      "Salary & advances",
                      "वेतन और एडवांस",
                      "पगार व आगाऊ रक्कम",
                    )}
                    detail={tr(
                      "Statements, payments and advance requests",
                      "हिसाब, भुगतान और एडवांस अनुरोध",
                      "हिशेब, देयके व आगाऊ रकमेच्या विनंत्या",
                    )}
                    icon="receipt-outline"
                    onPress={() =>
                      navigation.navigate("Workforce", {
                        userId: actor.id,
                        section: "pay",
                      })
                    }
                  />
                  <WorkRow
                    title={tr(
                      "Leave requests",
                      "छुट्टी के अनुरोध",
                      "रजेच्या विनंत्या",
                    )}
                    detail={tr(
                      "Request leave and view its decision",
                      "छुट्टी माँगें और फैसला देखें",
                      "रजा मागा व निर्णय पाहा",
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
                      "Updates & decisions",
                      "सूचनाएँ और फैसले",
                      "सूचना व निर्णय",
                    )}
                    detail={tr(
                      "Follow what the owner has reviewed",
                      "मालिक की समीक्षा का हाल देखें",
                      "मालकाच्या तपासणीची स्थिती पाहा",
                    )}
                    icon="notifications-outline"
                    onPress={() => navigation.navigate("Inbox")}
                  />
                </>
              ) : (
                <>
                  <WorkHeading
                    kicker={tr("HELP", "मदद", "मदत")}
                    title={tr(
                      "You don’t have to guess.",
                      "अंदाज़ा लगाने की ज़रूरत नहीं।",
                      "अंदाज लावायची गरज नाही.",
                    )}
                  />
                  <WorkRow
                    title={tr(
                      "Hear how to use the app",
                      "ऐप कैसे चलाएँ, सुनें",
                      "ॲप कसे वापरायचे ते ऐका",
                    )}
                    detail={tr(
                      "A short guide in your chosen language",
                      "आपकी भाषा में छोटी मदद",
                      "तुमच्या भाषेत थोडक्यात मदत",
                    )}
                    icon="volume-high-outline"
                    onPress={() => {
                      void Speech.stop();
                      Speech.speak(
                        tr(
                          "Start with Today for attendance and your next task. My work has inspections, routines and service. Open a routine, hear its next step, do it and mark it done. My pay has salary and leave. Ask your supervisor whenever you are unsure.",
                          "आज में हाज़िरी और अगला काम देखें। मेरा काम में जाँच, रोज़ के काम और सर्विस है। रोज़ का काम खोलें, चरण सुनें, काम करके पूरा चिह्नित करें। मेरा वेतन में वेतन और छुट्टी देखें। संदेह होने पर सुपरवाइज़र से पूछें।",
                          "आज मध्ये हजेरी आणि पुढचे काम पाहा. माझे काम मध्ये तपासणी, रोजची कामे व सर्विस आहे. रोजचे काम उघडा, टप्पा ऐका, काम करून पूर्ण नोंदवा. माझा पगार मध्ये पगार व रजा पाहा. शंका असल्यास पर्यवेक्षकाला विचारा.",
                        ),
                        {
                          language:
                            language === "mr"
                              ? "mr-IN"
                              : language === "hi"
                                ? "hi-IN"
                                : "en-IN",
                          rate: 0.85,
                        },
                      );
                    }}
                  />
                  <WorkRow
                    title={tr(
                      "Help with car work",
                      "गाड़ी के काम में मदद",
                      "गाडीच्या कामात मदत",
                    )}
                    detail={tr(
                      "Open an inspection, then use Need help",
                      "जाँच खोलें, फिर मदद चाहिए दबाएँ",
                      "तपासणी उघडा, मग मदत हवी दाबा",
                    )}
                    icon="hand-left-outline"
                    onPress={() => {
                      setKind("inspections");
                      setArea("work");
                      setList("todo");
                    }}
                  />
                  <WorkRow
                    title={tr(
                      "Language & my account",
                      "भाषा और मेरा खाता",
                      "भाषा व माझे खाते",
                    )}
                    detail={tr(
                      "English · हिन्दी · मराठी",
                      "English · हिन्दी · मराठी",
                      "English · हिन्दी · मराठी",
                    )}
                    icon="language-outline"
                    onPress={() => navigation.navigate("Settings")}
                  />
                  <WorkRow
                    title={tr(
                      "Updates & reminders",
                      "सूचनाएँ और रिमाइंडर",
                      "सूचना व आठवणी",
                    )}
                    detail={tr(
                      "Messages about your work and requests",
                      "आपके काम और अनुरोध की सूचनाएँ",
                      "तुमच्या कामाच्या व विनंत्यांच्या सूचना",
                    )}
                    icon="notifications-outline"
                    onPress={() => navigation.navigate("Inbox")}
                  />
                </>
              )}
            </Animated.View>
          </ContentScroll>
        </View>
        {!rail ? nav : null}
      </View>
    </View>
  );
}
