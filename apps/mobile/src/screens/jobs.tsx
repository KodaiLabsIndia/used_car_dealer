import { can } from "../application/access";
import React, { useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import type { ScreenProps } from "../navigation";
import { ContentScroll, CardGrid } from "../components/layout";
import { GarageHeader } from "../components/header";
import { Choice } from "../components/forms";
import { JobCard } from "../components/job-card";
import { Button, ErrorNotice, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
export function JobsScreen({ navigation }: ScreenProps<"Jobs">) {
  const { api, language, session } = useApp(),
    hi = language === "hi",
    resource = useResource("jobs", () => api.jobs());
  const [showDone, setShowDone] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <GarageHeader back title={hi ? "सर्विस" : "Service bay"} />
      <ContentScroll
        refreshControl={
          <RefreshControl
            refreshing={resource.loading}
            onRefresh={resource.refresh}
            tintColor="#fff"
          />
        }
      >
        <Text style={s.title}>
          {hi ? "हर काम पर नज़र।" : "Keep things moving."}
        </Text>
        {session && can(session.actor, "service") ? (
          <Button
            label={hi ? "वर्कशॉप" : "Workshops"}
            icon="construct-outline"
            secondary
            onPress={() => navigation.navigate("Workshops")}
          />
        ) : null}
        <Choice
          label={hi ? "पूरे हुए काम भी दिखाएँ" : "Include completed work"}
          selected={showDone}
          onPress={() => setShowDone((v) => !v)}
          icon="checkmark-done-outline"
        />
        {resource.error ? (
          <ErrorNotice
            message={
              resource.offline
                ? hi
                  ? "सहेजा हुआ डेटा · ऑफ़लाइन"
                  : "Saved data · offline"
                : resource.error
            }
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <CardGrid>
          {resource.data
            ?.filter((j) => showDone || j.status !== "completed")
            .map((j) => (
              <JobCard
                key={j.id}
                job={j}
                hi={hi}
                onPress={() => navigation.navigate("Job", { id: j.id })}
              />
            ))}
        </CardGrid>
        {!resource.loading &&
        !resource.data?.some((j) => showDone || j.status !== "completed") ? (
          <Text style={s.muted}>
            {hi ? "कोई काम बाकी नहीं है।" : "No repair jobs here yet."}
          </Text>
        ) : null}
      </ContentScroll>
    </View>
  );
}
