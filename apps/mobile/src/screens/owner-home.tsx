import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors } from "@arihant/design-tokens";
import type { Dashboard, WorkforceView } from "@arihant/contracts";
import type { Navigation, ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useSection } from "../state/use-section";
import { GarageHeader } from "../components/header";
import { GarageRoute, useReducedMotion } from "../components/garage-motion";
import { ContentScroll, useLayout } from "../components/layout";
import {
  Button,
  CarThumb,
  ErrorNotice,
  Icon,
  Text,
  s,
  type IconName,
} from "../components/ui";
import { openDecision } from "./decisions";
import { can } from "../application/access";

type Area = "today" | "dealership" | "people" | "decisions";
type Lane = "stock" | "buy" | "prepare" | "sell" | "support";
const ink = "#F6F3EE",
  muted = "#A6A39F",
  accent = "#F0676C";

function Entry({
  title,
  detail,
  icon,
  onPress,
  count,
  featured = false,
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
  count?: number | undefined;
  featured?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 104,
        minWidth: 0,
        width: "100%",
        padding: 18,
        borderRadius: 20,
        backgroundColor: featured ? "#322024" : "#222221",
        borderWidth: 1,
        borderColor: featured ? "#653039" : "#383836",
        opacity: pressed ? 0.78 : 1,
        gap: 15,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: featured ? "#54272D" : "#30302E",
          }}
        >
          <Icon name={icon} color={featured ? "#FF9FA2" : ink} size={21} />
        </View>
        {count !== undefined ? (
          <Text style={{ fontSize: 26, fontWeight: "600", color: ink }}>
            {count}
          </Text>
        ) : (
          <Icon name="arrow-forward-outline" size={18} color={muted} />
        )}
      </View>
      <View style={{ gap: 3, minWidth: 0, width: "100%" }}>
        <Text
          textBreakStrategy="simple"
          style={{
            fontSize: 17,
            fontWeight: "600",
            color: ink,
            width: "100%",
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{ fontSize: 12, color: muted, width: "100%", flexShrink: 1 }}
        >
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useLayout();
  const columns = fontScale >= 1.3 || width < 360 ? 1 : width >= 1100 ? 3 : 2;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {React.Children.toArray(children).map((child, i) => (
        <View
          key={i}
          style={{
            flexGrow: 1,
            flexBasis: columns === 1 ? "100%" : columns === 3 ? "30%" : "46%",
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
function Heading({
  eyebrow,
  title,
  action,
  onPress,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ gap: 5 }}>
      {eyebrow ? (
        <Text
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: accent,
            fontWeight: "600",
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "600",
            color: ink,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {title}
        </Text>
        {action && onPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 12, color: "#E8ACA8" }}>{action} →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function Row({
  title,
  detail,
  icon,
  onPress,
  badge,
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 17,
        minHeight: 80,
        backgroundColor: pressed ? "#302A29" : "#222221",
        borderRadius: 17,
      })}
    >
      <Icon name={icon} color="#E7B3AB" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: "600", fontSize: 15, color: ink }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: muted }}>{detail}</Text>
      </View>
      {badge ? (
        <Text style={{ fontSize: 20, color: ink, fontWeight: "600" }}>
          {badge}
        </Text>
      ) : null}
      <Icon name="chevron-forward-outline" size={16} color={muted} />
    </Pressable>
  );
}
function Staff({
  data,
  navigation,
}: {
  data: WorkforceView;
  navigation: Navigation;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const active = data.people.filter((p) => p.active);
  const status = (value: string) =>
    value === "at_work" || value === "open"
      ? tr("At work", "काम पर", "कामावर")
      : value === "finished" || value === "closed"
        ? tr("Day finished", "काम पूरा", "दिवस पूर्ण")
        : value === "off_day"
          ? tr("Off day", "छुट्टी", "सुट्टी")
          : value === "missed_out"
            ? tr("Needs review", "समीक्षा बाकी", "तपासणी आवश्यक")
            : tr("Not punched in", "हाज़िरी बाकी", "हजेरी बाकी");
  return (
    <View style={{ gap: 8 }}>
      {active.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${status(p.attendanceStatus)}`}
          onPress={() =>
            navigation.navigate("Workforce", {
              userId: p.id,
              section: "attendance",
            })
          }
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            paddingVertical: 13,
            borderBottomWidth: 1,
            borderColor: "#30302E",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: "#34312F",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 19, color: ink, fontWeight: "600" }}>
              {p.name.slice(0, 1).toLocaleUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600", color: ink }}>{p.name}</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor:
                    p.attendanceStatus === "at_work" ||
                    p.attendanceStatus === "open"
                      ? colors.green
                      : muted,
                }}
              />
              <Text style={{ fontSize: 12, color: muted }}>
                {status(p.attendanceStatus)}
              </Text>
            </View>
          </View>
          <Icon name="chevron-forward-outline" color={muted} size={17} />
        </Pressable>
      ))}
    </View>
  );
}
export function OwnerHomeScreen({ navigation, route }: ScreenProps<"Home">) {
  const { api, session, language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [area, setArea] = useSection<Area>("owner:area:v2", "today", [
    "today",
    "dealership",
    "people",
    "decisions",
  ]);
  const [lane, setLane] = useSection<Lane>("owner:lane:v2", "stock", [
    "stock",
    "buy",
    "prepare",
    "sell",
    "support",
  ]);
  const dashboard = useResource("dashboard", () => api.dashboard());
  const workforce = useResource("owner-people-overview", () => api.workforce());
  const routines = useResource("owner-routines-overview", () => api.routines());
  const { width, height, fontScale } = useLayout();
  const rail = width >= 900 && height >= 600 && fontScale < 1.5;
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (route.params?.area) setArea(route.params.area);
    else if (route.params?.scope === "decisions") setArea("decisions");
    else if (route.params?.scope === "mine")
      navigation.navigate("Work", { mine: true });
    if (route.params?.area || route.params?.scope)
      navigation.setParams({ area: undefined, scope: undefined });
  }, [route.params?.area, route.params?.scope]);
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.6);
    const a = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [area, reduced]);
  useEffect(() => {
    if (!focused) return;
    const tick = () => {
      if (AppState.currentState === "active") {
        dashboard.refresh();
        workforce.refresh();
        routines.refresh();
      }
    };
    const timer = setInterval(tick, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [focused]);
  const refresh = () => {
    dashboard.refresh();
    workforce.refresh();
    routines.refresh();
  };
  const d = dashboard.data;
  const staff = workforce.data?.people.filter((p) => p.active) ?? [];
  const atWork = staff.filter((p) =>
    ["at_work", "open"].includes(p.attendanceStatus),
  ).length;
  const due = routines.data?.items.filter((i) => i.dueToday) ?? [];
  const done = due.filter(
    (i) => i.completedSteps.length === i.definition.steps.length,
  ).length;
  const entries: { id: Area | "decisions"; label: string; icon: IconName }[] = [
    { id: "today", label: tr("Today", "आज", "आज"), icon: "sunny-outline" },
    {
      id: "dealership",
      label: tr("Dealership", "डीलरशिप", "डीलरशिप"),
      icon: "car-sport-outline",
    },
    {
      id: "people",
      label: tr("People", "कर्मचारी", "कर्मचारी"),
      icon: "people-outline",
    },
    {
      id: "decisions",
      label: tr("Decisions", "फैसले", "निर्णय"),
      icon: "checkmark-done-circle-outline",
    },
  ];
  const navigate = (id: Area | "decisions") => setArea(id);
  const nav = (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: rail ? "column" : "row",
        flexWrap: rail ? "nowrap" : "wrap",
        gap: rail ? 8 : 4,
        padding: rail ? 14 : 8,
        backgroundColor: "#101010",
        borderColor: "#30302E",
        borderTopWidth: rail ? 0 : 1,
        borderRightWidth: rail ? 1 : 0,
        ...(rail ? { width: 196 } : {}),
      }}
    >
      {entries.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="tab"
          accessibilityLabel={e.label}
          accessibilityState={{ selected: area === e.id }}
          onPress={() => navigate(e.id)}
          style={{
            flex: rail || fontScale >= 1.3 ? undefined : 1,
            ...(!rail && fontScale >= 1.3
              ? { flexBasis: "46%" as const, flexGrow: 1 }
              : {}),
            minWidth: 0,
            minHeight: rail ? 66 : 64,
            gap: 6,
            flexDirection: rail || fontScale >= 1.3 ? "row" : "column",
            justifyContent: rail ? "flex-start" : "center",
            alignItems: "center",
            padding: rail ? 12 : 4,
            borderRadius: 16,
            backgroundColor: area === e.id ? "#342024" : "transparent",
          }}
        >
          <View style={{ position: "relative" }}>
            <Icon
              name={e.icon}
              color={area === e.id ? "#FF9598" : muted}
              size={23}
            />
            {e.id === "decisions" && !!d?.decisions ? (
              <View
                style={{
                  position: "absolute",
                  right: -4,
                  top: -3,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.red,
                }}
              />
            ) : null}
          </View>
          <Text
            style={{
              color: area === e.id ? ink : muted,
              fontSize: 12,
              fontWeight: area === e.id ? "600" : "400",
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            {e.label}
          </Text>
        </Pressable>
      ))}
      {rail ? (
        <View style={{ marginTop: "auto", padding: 12, gap: 6 }}>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: muted }}>
            ARIHANT CARS
          </Text>
          <Text style={{ fontSize: 12, color: ink }}>
            {session!.actor.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader />
      <View
        style={{
          flex: 1,
          flexDirection: rail ? "row" : "column",
          maxWidth: 1480,
          width: "100%",
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
                  dashboard.loading || workforce.loading || routines.loading
                }
                onRefresh={refresh}
                tintColor="#fff"
              />
            }
            contentContainerStyle={{ padding: rail ? 28 : 18, gap: 24 }}
          >
            <Animated.View style={{ opacity, gap: 24 }}>
              {dashboard.error || workforce.error || routines.error ? (
                <ErrorNotice
                  message={dashboard.error || workforce.error || routines.error}
                  retry={refresh}
                />
              ) : null}
              {!d && dashboard.loading ? (
                <ActivityIndicator color="#fff" />
              ) : null}
              {area === "today" ? (
                <>
                  <View style={{ gap: 8 }}>
                    <Text
                      style={{ color: muted, fontSize: 11, letterSpacing: 1 }}
                    >
                      {new Date().toLocaleDateString(
                        language === "mr"
                          ? "mr-IN"
                          : language === "hi"
                            ? "hi-IN"
                            : "en-IN",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                    </Text>
                    <Text
                      style={{
                        fontSize: 32,
                        lineHeight: 40,
                        letterSpacing: -1,
                        fontWeight: "600",
                        color: ink,
                      }}
                    >
                      {tr("Today’s operations", "आज के काम", "आजची कामे")}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.red,
                      borderRadius: 24,
                      padding: 22,
                      gap: 18,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            letterSpacing: 2,
                            color: "#FFD0D2",
                          }}
                        >
                          {tr(
                            "THE FLOOR",
                            "डीलरशिप का हाल",
                            "डीलरशिपची स्थिती",
                          )}
                        </Text>
                        <Text
                          style={{
                            fontSize: 46,
                            lineHeight: 58,
                            fontWeight: "600",
                            letterSpacing: -2,
                          }}
                        >
                          {d?.cars ?? "—"}
                        </Text>
                        <Text style={{ fontSize: 14 }}>
                          {tr(
                            "cars in your operation",
                            "गाड़ियाँ आपके संचालन में",
                            "गाड्या तुमच्या कामात",
                          )}
                        </Text>
                      </View>
                      <View
                        style={{
                          padding: 13,
                          borderRadius: 50,
                          backgroundColor: "#A91920",
                        }}
                      >
                        <Icon name="car-sport-outline" size={35} />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 12,
                        borderTopWidth: 1,
                        borderColor: "#DA5156",
                        paddingTop: 16,
                      }}
                    >
                      {[
                        {
                          v: d?.workshop,
                          label: tr("in preparation", "तैयारी में", "तयारीत"),
                        },
                        {
                          v: d?.booked,
                          label: tr("booked", "बुक की गई", "बुक केलेल्या"),
                        },
                        {
                          v: workforce.data ? atWork : undefined,
                          label: tr(
                            "people at work",
                            "कर्मचारी काम पर",
                            "कर्मचारी कामावर",
                          ),
                        },
                      ].map((x) => (
                        <View key={x.label} style={{ flex: 1, minWidth: 80 }}>
                          <Text style={{ fontSize: 23, fontWeight: "600" }}>
                            {x.v ?? "—"}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#FFD8DA" }}>
                            {x.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Heading
                    eyebrow={tr(
                      "YOUR NEXT MOVE",
                      "आपका अगला कदम",
                      "तुमचे पुढचे पाऊल",
                    )}
                    title={tr(
                      "Needs your attention",
                      "आपका ध्यान चाहिए",
                      "तुमचे लक्ष हवे",
                    )}
                  />
                  <View style={{ gap: 9 }}>
                    <Row
                      title={tr(
                        "Review decisions",
                        "फैसले देखें",
                        "निर्णय तपासा",
                      )}
                      detail={tr(
                        "Approvals, requests & exceptions",
                        "मंज़ूरी, अनुरोध और रुका काम",
                        "मंजुरी, विनंत्या आणि अडलेले काम",
                      )}
                      icon="hand-left-outline"
                      badge={d ? String(d.decisions) : "—"}
                      onPress={() => setArea("decisions")}
                    />
                    {d?.attention[0] ? (
                      <Row
                        title={`${d.attention[0].make} ${d.attention[0].model}`}
                        detail={d.attention[0].nextAction}
                        icon="build-outline"
                        onPress={() =>
                          navigation.navigate("Car", { id: d.attention[0]!.id })
                        }
                      />
                    ) : null}
                    <Row
                      title={tr("Daily routines", "रोज़ के काम", "रोजची कामे")}
                      detail={
                        due.length
                          ? tr(
                              `${done} of ${due.length} finished today`,
                              `${due.length} में से ${done} पूरे`,
                              `${due.length} पैकी ${done} पूर्ण`,
                            )
                          : tr(
                              "Assign opening, showroom care & closing checks",
                              "शोरूम खोलने, देखभाल और बंद करने के काम",
                              "शोरूम उघडणे, देखभाल व बंद करण्याची कामे",
                            )
                      }
                      icon="repeat-outline"
                      onPress={() => navigation.navigate("Routines")}
                    />
                  </View>
                  <Heading
                    title={tr(
                      "Run the business",
                      "कारोबार चलाएँ",
                      "व्यवसाय चालवा",
                    )}
                  />
                  <Grid>
                    <Entry
                      title={tr("Dealership", "डीलरशिप", "डीलरशिप")}
                      detail={tr(
                        "Buy · prepare · sell · support",
                        "खरीद · तैयारी · बिक्री · सहायता",
                        "खरेदी · तयारी · विक्री · मदत",
                      )}
                      icon="car-sport-outline"
                      onPress={() => setArea("dealership")}
                    />
                    <Entry
                      title={tr(
                        "Employee management",
                        "कर्मचारी प्रबंधन",
                        "कर्मचारी व्यवस्थापन",
                      )}
                      detail={tr(
                        "People · attendance · pay · routines",
                        "कर्मचारी · हाज़िरी · वेतन · रोज़ के काम",
                        "कर्मचारी · हजेरी · पगार · रोजची कामे",
                      )}
                      icon="people-outline"
                      onPress={() => setArea("people")}
                    />
                  </Grid>
                  <Row
                    title={tr("My work", "मेरा काम", "माझे काम")}
                    detail={tr(
                      "Work personally without changing your account",
                      "इसी खाते से अपना काम करें",
                      "याच खात्यातून स्वतःचे काम करा",
                    )}
                    icon="person-outline"
                    onPress={() => navigation.navigate("Work", { mine: true })}
                  />
                </>
              ) : area === "people" ? (
                <>
                  <Heading
                    eyebrow={tr("PEOPLE", "कर्मचारी", "कर्मचारी")}
                    title={tr(
                      "Employee management",
                      "कर्मचारी प्रबंधन",
                      "कर्मचारी व्यवस्थापन",
                    )}
                  />
                  <View
                    style={{
                      borderRadius: 22,
                      padding: 22,
                      backgroundColor: "#292522",
                      borderWidth: 1,
                      borderColor: "#43382F",
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 15,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 30,
                            fontWeight: "600",
                            color: ink,
                          }}
                        >
                          {workforce.data ? `${atWork} / ${staff.length}` : "—"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#CFB7A2" }}>
                          {tr(
                            "people at work now",
                            "कर्मचारी अभी काम पर",
                            "कर्मचारी सध्या कामावर",
                          )}
                        </Text>
                      </View>
                      <Icon name="people-outline" size={32} color="#E7B796" />
                    </View>
                    <Text style={{ fontSize: 12, color: muted }}>
                      {tr(
                        "Attendance, assigned work and payroll",
                        "हाज़िरी, सौंपे काम और वेतन",
                        "हजेरी, नेमलेली कामे व पगार",
                      )}
                    </Text>
                  </View>
                  <Grid>
                    <Entry
                      title={tr("Attendance", "हाज़िरी", "हजेरी")}
                      detail={tr(
                        "Team presence, shifts & leave",
                        "हाज़िरी, शिफ्ट और छुट्टी",
                        "हजेरी, शिफ्ट व रजा",
                      )}
                      icon="time-outline"
                      featured
                      onPress={() =>
                        navigation.navigate("Workforce", {
                          section: "attendance",
                        })
                      }
                    />
                    <Entry
                      title={tr("Payroll", "वेतन", "पगार")}
                      detail={tr(
                        "Rates, advances & statements",
                        "वेतन दर, एडवांस और हिसाब",
                        "वेतन दर, आगाऊ रक्कम व हिशेब",
                      )}
                      icon="wallet-outline"
                      onPress={() =>
                        navigation.navigate("Workforce", { section: "pay" })
                      }
                    />
                    <Entry
                      title={tr("Daily routines", "रोज़ के काम", "रोजची कामे")}
                      detail={tr(
                        "Assign, repeat & track real work",
                        "काम सौंपें, दोहराएँ और देखें",
                        "काम द्या, पुन्हा करा व प्रगती पाहा",
                      )}
                      icon="repeat-outline"
                      onPress={() => navigation.navigate("Routines")}
                    />
                    <Entry
                      title={tr(
                        "Leave requests",
                        "छुट्टी के अनुरोध",
                        "रजेच्या विनंत्या",
                      )}
                      detail={tr(
                        "Review leave & balances",
                        "छुट्टी और बाकी दिन देखें",
                        "रजा व शिल्लक दिवस तपासा",
                      )}
                      icon="calendar-outline"
                      onPress={() =>
                        navigation.navigate("Workforce", { section: "leave" })
                      }
                    />
                  </Grid>
                  <Heading
                    title={tr("Your team", "आपकी टीम", "तुमची टीम")}
                    {...(session!.actor.role === "owner"
                      ? {
                          action: tr(
                            "Manage accounts",
                            "खाते सँभालें",
                            "खाती सांभाळा",
                          ),
                          onPress: () => navigation.navigate("Team"),
                        }
                      : {})}
                  />
                  {workforce.data ? (
                    <Staff data={workforce.data} navigation={navigation} />
                  ) : null}
                  <Row
                    title={tr(
                      "Assigned car work",
                      "गाड़ी के सौंपे हुए काम",
                      "गाड्यांची नेमलेली कामे",
                    )}
                    detail={tr(
                      "Inspections, progress & employee help",
                      "जाँच, प्रगति और कर्मचारी की मदद",
                      "तपासणी, प्रगती व कर्मचाऱ्यांना मदत",
                    )}
                    icon="clipboard-outline"
                    onPress={() => navigation.navigate("Work")}
                  />
                  {session!.actor.role === "owner" ? (
                    <Row
                      title={tr(
                        "Staff rules",
                        "कर्मचारी नियम",
                        "कर्मचारी नियम",
                      )}
                      detail={tr(
                        "Shifts, holidays, leave & attendance proof",
                        "शिफ्ट, छुट्टी और हाज़िरी प्रमाण",
                        "शिफ्ट, सुट्ट्या, रजा व हजेरी पुरावा",
                      )}
                      icon="options-outline"
                      onPress={() =>
                        navigation.navigate("Workforce", { section: "rules" })
                      }
                    />
                  ) : null}
                </>
              ) : area === "decisions" ? (
                <OwnerDecisions navigation={navigation} />
              ) : (
                <>
                  <Heading
                    eyebrow={tr("DEALERSHIP", "डीलरशिप", "डीलरशिप")}
                    title={tr(
                      "Vehicle operations",
                      "गाड़ियों के काम",
                      "गाड्यांची कामे",
                    )}
                  />
                  <View
                    accessibilityRole="tablist"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {(
                      [
                        { id: "stock", label: tr("Garage", "गैराज", "गॅरेज") },
                        { id: "buy", label: tr("Buying", "खरीद", "खरेदी") },
                        {
                          id: "prepare",
                          label: tr("Preparation", "तैयारी", "तयारी"),
                        },
                        {
                          id: "sell",
                          label: tr("Selling", "बिक्री", "विक्री"),
                        },
                        {
                          id: "support",
                          label: tr(
                            "After-sales",
                            "बिक्री के बाद",
                            "विक्रीनंतर",
                          ),
                        },
                      ] as const
                    ).map((e) => (
                      <Pressable
                        key={e.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: lane === e.id }}
                        onPress={() => setLane(e.id)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          minHeight: 46,
                          borderRadius: 30,
                          backgroundColor: lane === e.id ? ink : "#292928",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: lane === e.id ? "#181817" : muted,
                          }}
                        >
                          {e.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {lane === "stock" ? (
                    <>
                      <Grid>
                        <Entry
                          title={tr(
                            "Vehicle inventory",
                            "गाड़ियों का स्टॉक",
                            "गाड्यांचा साठा",
                          )}
                          detail={tr(
                            "Every car, its status & next step",
                            "हर गाड़ी, स्थिति और अगला काम",
                            "प्रत्येक गाडी, स्थिती व पुढचे काम",
                          )}
                          count={d?.cars}
                          icon="car-sport-outline"
                          featured
                          onPress={() => navigation.navigate("Cars")}
                        />
                        <Entry
                          title={tr(
                            "Operations reports",
                            "संचालन रिपोर्ट",
                            "कामकाज अहवाल",
                          )}
                          detail={tr(
                            "Costs, stock & follow-through",
                            "खर्च, स्टॉक और आगे का काम",
                            "खर्च, साठा व पुढील काम",
                          )}
                          icon="stats-chart-outline"
                          onPress={() => navigation.navigate("Reports")}
                        />
                      </Grid>
                      {d ? (
                        <GarageRoute
                          counts={d.stages}
                          selected={null}
                          onSelect={(stage) => {
                            setLane(
                              stage === "inspection" || stage === "purchase"
                                ? "buy"
                                : stage === "refurbishment"
                                  ? "prepare"
                                  : stage === "ready"
                                    ? "sell"
                                    : "support",
                            );
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <DealershipLane
                      lane={lane}
                      data={d}
                      navigation={navigation}
                    />
                  )}
                </>
              )}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  paddingTop: 6,
                  borderTopWidth: 1,
                  borderColor: "#30302E",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("Inbox")}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    flexGrow: 1,
                  }}
                >
                  <Text style={{ fontSize: 12, color: muted }}>
                    {tr(
                      "Updates & reminders",
                      "सूचनाएँ और रिमाइंडर",
                      "सूचना व आठवणी",
                    )}{" "}
                    ↗
                  </Text>
                </Pressable>
                {can(session!.actor, "finance") ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate("Assistant")}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 12, color: muted }}>
                      {tr("Ask Arihant AI", "AI से पूछें", "AI ला विचारा")} ✧
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          </ContentScroll>
        </View>
        {!rail ? nav : null}
      </View>
    </View>
  );
}
function DealershipLane({
  lane,
  data,
  navigation,
}: {
  lane: Exclude<Lane, "stock">;
  data: Dashboard | null;
  navigation: Navigation;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const cards =
    lane === "buy"
      ? [
          {
            title: tr(
              "Seller enquiries",
              "विक्रेता पूछताछ",
              "विक्रेत्यांची चौकशी",
            ),
            detail: tr(
              "Find, follow up & inspect",
              "संपर्क, फ़ॉलो-अप और जाँच",
              "संपर्क, पाठपुरावा व तपासणी",
            ),
            icon: "chatbubbles-outline" as const,
            go: () => navigation.navigate("Enquiries", { kind: "seller" }),
          },
          {
            title: tr(
              "Intake & inspection",
              "गाड़ी जोड़ें और जाँचें",
              "गाडी नोंदवा व तपासा",
            ),
            detail: tr(
              "Log the car, assign its inspection",
              "गाड़ी दर्ज करें और जाँच सौंपें",
              "गाडी नोंदवा व तपासणी नेमा",
            ),
            icon: "scan-outline" as const,
            go: () => navigation.navigate("AddCar"),
          },
          {
            title: tr("Purchases", "खरीद", "खरेदी"),
            detail: tr(
              "Terms, approval & seller settlement",
              "शर्तें, मंज़ूरी और भुगतान",
              "अटी, मंजुरी व विक्रेत्याचे देणे",
            ),
            icon: "wallet-outline" as const,
            go: () => navigation.navigate("Purchases"),
          },
        ]
      : lane === "prepare"
        ? [
            {
              title: tr("Service bay", "सर्विस के काम", "सर्विसची कामे"),
              detail: tr(
                "Repairs, parts & mechanic updates",
                "मरम्मत, पार्ट और मैकेनिक अपडेट",
                "दुरुस्ती, पार्ट व मेकॅनिकची माहिती",
              ),
              icon: "build-outline" as const,
              go: () => navigation.navigate("Jobs"),
            },
            {
              title: tr("Inspection work", "जाँच के काम", "तपासणीची कामे"),
              detail: tr(
                "Proof, findings & progress",
                "प्रमाण, समस्या और प्रगति",
                "पुरावे, निष्कर्ष व प्रगती",
              ),
              icon: "clipboard-outline" as const,
              go: () => navigation.navigate("Work"),
            },
            {
              title: tr("Workshop partners", "वर्कशॉप साथी", "वर्कशॉप भागीदार"),
              detail: tr(
                "Mechanics, contacts & capabilities",
                "मैकेनिक, संपर्क और काम",
                "मेकॅनिक, संपर्क व कामे",
              ),
              icon: "construct-outline" as const,
              go: () => navigation.navigate("Workshops"),
            },
          ]
        : lane === "sell"
          ? [
              {
                title: tr(
                  "Buyer enquiries",
                  "खरीदार पूछताछ",
                  "खरेदीदारांची चौकशी",
                ),
                detail: tr(
                  "Follow-ups, appointments & test drives",
                  "फ़ॉलो-अप, मुलाकात और टेस्ट ड्राइव",
                  "पाठपुरावा, भेटी व टेस्ट ड्राइव्ह",
                ),
                icon: "people-outline" as const,
                go: () => navigation.navigate("Enquiries", { kind: "buyer" }),
              },
              {
                title: tr(
                  "Bookings & delivery",
                  "बुकिंग और डिलीवरी",
                  "बुकिंग व डिलिव्हरी",
                ),
                detail: tr(
                  "Buyer payments, documents & handover",
                  "भुगतान, दस्तावेज़ और गाड़ी सौंपना",
                  "देयके, कागदपत्रे व गाडी देणे",
                ),
                icon: "key-outline" as const,
                go: () =>
                  navigation.navigate("BusinessBoard", { scope: "booked" }),
              },
              {
                title: tr(
                  "Ready to sell",
                  "बिक्री के लिए तैयार",
                  "विक्रीसाठी तयार",
                ),
                detail: tr(
                  "Available stock and sale details",
                  "उपलब्ध गाड़ियाँ और बिक्री विवरण",
                  "उपलब्ध गाड्या व विक्री माहिती",
                ),
                icon: "car-sport-outline" as const,
                go: () => navigation.navigate("Cars", { stage: "ready" }),
              },
            ]
          : [
              {
                title: tr(
                  "Warranty & support",
                  "वारंटी और सहायता",
                  "हमी व मदत",
                ),
                detail: tr(
                  "Complaints, promised cover & resolution",
                  "शिकायत, वारंटी और समाधान",
                  "तक्रारी, हमी व निराकरण",
                ),
                icon: "shield-checkmark-outline" as const,
                go: () =>
                  navigation.navigate("BusinessBoard", { scope: "support" }),
              },
              {
                title: tr(
                  "Delivered vehicles",
                  "सौंपी गई गाड़ियाँ",
                  "दिलेल्या गाड्या",
                ),
                detail: tr(
                  "Sale records & ownership paperwork",
                  "बिक्री रिकॉर्ड और मालिकाना दस्तावेज़",
                  "विक्री नोंदी व मालकीची कागदपत्रे",
                ),
                icon: "checkmark-circle-outline" as const,
                go: () => navigation.navigate("Cars", { stage: "delivered" }),
              },
            ];
  return (
    <View style={{ gap: 18 }}>
      <Grid>
        {cards.map((c, i) => (
          <Entry
            key={c.title}
            title={c.title}
            detail={c.detail}
            icon={c.icon}
            onPress={c.go}
            featured={i === 0}
          />
        ))}
      </Grid>
      {lane === "prepare" && data?.attention.length ? (
        <View style={{ gap: 12 }}>
          <Heading
            title={tr("Waiting on something", "रुके हुए काम", "अडलेली कामे")}
          />
          {data.attention.slice(0, 3).map((car) => (
            <Pressable
              key={car.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate("Car", { id: car.id })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 18,
                backgroundColor: "#222221",
              }}
            >
              <CarThumb car={car} size={50} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>
                  {car.make} {car.model}
                </Text>
                <Text style={{ fontSize: 12, color: muted }}>
                  {car.nextAction}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OwnerDecisions({ navigation }: { navigation: Navigation }) {
  const { api, language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [offset, setOffset] = useState(0);
  const resource = useResource(`owner-decisions:${offset}`, () =>
    api.decisions(offset),
  );
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") resource.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [focused]);
  return (
    <View style={{ gap: 20 }}>
      <Heading
        eyebrow={tr("DECISIONS", "फैसले", "निर्णय")}
        title={tr("Pending decisions", "लंबित निर्णय", "प्रलंबित निर्णय")}
      />
      <Text style={{ fontSize: 15, color: muted }}>
        {resource.data ? `${resource.data.total} ` : ""}
        {tr("pending reviews", "समीक्षा बाकी", "तपासणी बाकी")}
      </Text>
      {resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.refresh} />
      ) : null}
      {resource.loading && !resource.data ? (
        <ActivityIndicator color="#fff" />
      ) : null}
      <View style={{ gap: 9 }}>
        {resource.data?.items.map((v) => (
          <Row
            key={`${v.kind}:${v.id}`}
            title={v.subjectLabel || v.carLabel}
            detail={v.title}
            icon={
              v.targetType === "workforce"
                ? "person-outline"
                : v.kind === "quote"
                  ? "build-outline"
                  : "document-text-outline"
            }
            onPress={() => openDecision(navigation, v)}
          />
        ))}
      </View>
      {!resource.loading && resource.data?.total === 0 ? (
        <View
          style={{
            padding: 28,
            borderRadius: 22,
            backgroundColor: "#23332A",
            gap: 10,
          }}
        >
          <Icon
            name="checkmark-done-circle-outline"
            color={colors.green}
            size={34}
          />
          <Text style={{ fontSize: 22, fontWeight: "600" }}>
            {tr(
              "No pending decisions",
              "आपके फैसले बाकी नहीं।",
              "तुमच्याकडे निर्णय बाकी नाहीत.",
            )}
          </Text>
          <Text style={{ color: muted }}>
            {tr(
              "New requests and exceptions will appear here.",
              "नए अनुरोध और रुका काम यहाँ दिखेंगे।",
              "नवीन विनंत्या व अडलेले काम येथे दिसेल.",
            )}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button
          secondary
          label={tr("Previous", "पिछला", "मागील")}
          disabled={!offset || resource.loading}
          onPress={() => setOffset((n) => Math.max(0, n - 30))}
        />
        <Button
          secondary
          label={tr("Next", "अगला", "पुढील")}
          disabled={
            resource.loading || offset + 30 >= (resource.data?.total ?? 0)
          }
          onPress={() => setOffset((n) => n + 30)}
        />
      </View>
    </View>
  );
}
