import { formatDateTime } from "../components/date-format";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { DecisionItem } from "@arihant/contracts";
import type { Navigation, ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { GarageHeader } from "../components/header";
import { WorkHeading } from "../components/operations";
import { useLiveRefresh } from "../state/use-live-refresh";
import { Workspace, FocusPage } from "../components/workspace";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
const labels: Record<DecisionItem["kind"], [string, string]> = {
  inspection: ["Inspection review", "जाँच समीक्षा"],
  help: ["Employee needs help", "कर्मचारी को मदद चाहिए"],
  purchase: ["Purchase approval", "खरीद की मंज़ूरी"],
  quote: ["Repair quote approval", "मरम्मत खर्च की मंज़ूरी"],
  document: ["Document review", "कागज़ात की समीक्षा"],
  claim: ["Warranty complaint", "वारंटी की शिकायत"],
  hold: ["Car hold", "कार पर रोक"],
  workforce_leave: ["Leave request", "छुट्टी की माँग"],
  workforce_advance: ["Advance request", "अग्रिम की माँग"],
  attendance: ["Attendance review", "हाज़िरी की समीक्षा"],
};
export function DecisionsScreen({ navigation }: ScreenProps<"Decisions">) {
  const { api, language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [offset, setOffset] = useState(0);
  const resource = useResource(`decisions:${offset}`, () =>
    api.decisions(offset),
  );
  useLiveRefresh(resource.refresh);
  const moneyKinds = ["purchase", "quote", "workforce_advance"];
  const pending = [...(resource.data?.items ?? [])].sort(
    (a, b) =>
      Number(b.kind === "help" || b.kind === "hold") -
        Number(a.kind === "help" || a.kind === "hold") ||
      a.createdAt.localeCompare(b.createdAt),
  );
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader back title={tr("Review", "समीक्षा", "तपासा")} />
      <FocusPage>
        <WorkHeading
          title={tr("Needs review", "समीक्षा बाकी", "तपासणी बाकी")}
        />
        <Text style={s.muted}>
          {resource.data
            ? tr(
                `${resource.data.total} requests waiting`,
                `${resource.data.total} अनुरोध बाकी`,
                `${resource.data.total} विनंत्या बाकी`,
              )
            : tr(
                "Loading requests…",
                "अनुरोध देख रहे हैं…",
                "विनंत्या पाहत आहोत…",
              )}
        </Text>
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        {pending.map((item) => (
          <Pressable
            key={`${item.kind}:${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.subjectLabel || item.carLabel}, ${item.title}`}
            onPress={() => openDecision(navigation, item)}
            style={{
              padding: 15,
              borderRadius: 17,
              backgroundColor: "#222221",
              borderWidth: 1,
              borderColor:
                item.kind === "help" || item.kind === "hold"
                  ? "#795239"
                  : "#383836",
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              {item.subjectLabel || item.carLabel}
            </Text>
            <Text style={{ fontSize: 14 }}>{item.title}</Text>
            <Text style={{ fontSize: 11, color: "#AAA7A2" }}>
              {formatDateTime(item.createdAt, language)}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "space-between",
              }}
            >
              {moneyKinds.includes(item.kind) ? (
                <Text style={{ fontSize: 12, color: "#F3C38B" }}>
                  {tr(
                    "Payment needs approval",
                    "भुगतान से पहले मंज़ूरी",
                    "पैसे देण्यापूर्वी मंजुरी",
                  )}
                </Text>
              ) : null}
              <Text
                style={{ fontSize: 13, color: "#FF9FA4", fontWeight: "600" }}
              >
                {tr("Review", "समीक्षा करें", "तपासा")} →
              </Text>
            </View>
          </Pressable>
        ))}
        {!resource.loading && !resource.error && !pending.length ? (
          <Text>
            {tr(
              "No requests waiting.",
              "कोई अनुरोध बाकी नहीं।",
              "विनंत्या बाकी नाहीत.",
            )}
          </Text>
        ) : null}
        {resource.data && resource.data.total > resource.data.limit ? (
          <ActionRow>
            <Button
              secondary
              label={tr("Previous", "पिछला", "मागील")}
              disabled={!offset || resource.loading}
              onPress={() => setOffset((n) => Math.max(0, n - 30))}
            />
            <Text>
              {offset + 1}–{Math.min(offset + 30, resource.data.total)} /{" "}
              {resource.data.total}
            </Text>
            <Button
              secondary
              label={tr("Next", "अगला", "पुढील")}
              disabled={resource.loading || offset + 30 >= resource.data.total}
              onPress={() => setOffset((n) => n + 30)}
            />
          </ActionRow>
        ) : null}
      </FocusPage>
    </View>
  );
}

export function openDecision(
  navigation: Pick<Navigation, "navigate">,
  v: DecisionItem,
) {
  if (v.targetType === "workforce")
    navigation.navigate("Workforce", {
      userId: v.targetId,
      section:
        v.kind === "workforce_leave"
          ? "leave"
          : v.kind === "workforce_advance"
            ? "pay"
            : "attendance",
    });
  else if (v.targetType === "task")
    navigation.navigate("Task", { id: v.targetId });
  else if (v.targetType === "purchase")
    navigation.navigate("Purchase", { carId: v.targetId });
  else if (v.targetType === "service_finance")
    navigation.navigate("ServiceFinance", { jobId: v.targetId });
  else if (v.targetType === "documents")
    navigation.navigate("Documents", { carId: v.targetId });
  else if (v.targetType === "stock")
    navigation.navigate("Stock", { carId: v.targetId });
  else navigation.navigate("Business", { carId: v.targetId });
}
