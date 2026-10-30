import { formatDateTime } from "../components/date-format";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { DecisionItem } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
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
};
export function DecisionsScreen({ navigation }: ScreenProps<"Decisions">) {
  const { api, language } = useApp(),
    hi = language === "hi",
    [offset, setOffset] = useState(0),
    resource = useResource(`decisions:${offset}`, () => api.decisions(offset));
  function open(v: DecisionItem) {
    if (v.targetType === "task")
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
  return (
    <Workspace
      title={hi ? "सभी बाकी फैसले" : "All pending decisions"}
      selected="pending"
      onChange={() => {}}
      items={[
        {
          id: "pending",
          label: hi ? "बाकी" : "Pending",
          icon: "hand-left-outline",
          badge: String(resource.data?.total ?? 0),
        },
      ]}
    >
      <FocusPage
        footer={
          <ActionRow>
            <Button
              secondary
              label={hi ? "पिछला" : "Previous"}
              style={{ flex: 1 }}
              disabled={!offset || resource.loading}
              onPress={() => setOffset(Math.max(0, offset - 30))}
            />
            <Button
              secondary
              label={hi ? "अगला" : "Next"}
              style={{ flex: 1 }}
              disabled={
                resource.loading || offset + 30 >= (resource.data?.total ?? 0)
              }
              onPress={() => setOffset(offset + 30)}
            />
          </ActionRow>
        }
      >
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading ? <ActivityIndicator color="#fff" /> : null}
        {resource.data?.items.map((v) => (
          <Panel key={`${v.kind}:${v.id}`} style={{ gap: 12 }}>
            <Pill label={labels[v.kind][hi ? 1 : 0]} warning />
            <Text style={{ fontSize: 21, fontWeight: "600" }}>
              {v.carLabel}
            </Text>
            <Text>{v.title}</Text>
            <Text style={s.muted}>{formatDateTime(v.createdAt, language)}</Text>
            <Button
              label={hi ? "देखें और फैसला लें" : "Open & review"}
              onPress={() => open(v)}
            />
          </Panel>
        ))}
        {!resource.loading &&
        !resource.error &&
        !resource.data?.items.length ? (
          <Text>
            {hi
              ? "अभी कोई फैसला बाकी नहीं।"
              : "No decisions waiting right now."}
          </Text>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
