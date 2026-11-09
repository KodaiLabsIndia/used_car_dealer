import { uxText } from "../state/ux-copy";
import { can } from "../application/access";
import React, { useState } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import type { ScreenProps } from "../navigation";
import { ContentScroll, CardGrid } from "../components/layout";
import { GarageHeader } from "../components/header";
import { Choice, Field } from "../components/forms";
import { JobCard } from "../components/job-card";
import { Button, ErrorNotice, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
export function JobsScreen({ navigation }: ScreenProps<"Jobs">) {
  const { api, language, session } = useApp(),
    hi = language === "hi",
    resource = useResource("jobs", () => api.jobs());
  const [showDone, setShowDone] = useState(false),
    [search, setSearch] = useState("");
  const visible = resource.data?.filter(
    (job) =>
      (showDone || job.status !== "completed") &&
      [
        job.car.make,
        job.car.model,
        job.car.registration,
        job.title,
        job.assigneeName,
        job.workshopName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <View style={{ flex: 1 }}>
      <GarageHeader back title={uxText(language, "Service bay", "सर्विस")} />
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
          {language === "mr"
            ? "दुरुस्तीची कामे"
            : uxText(language, "Repair work", "मरम्मत के काम")}
        </Text>
        {session && can(session.actor, "service") ? (
          <Button
            label={uxText(language, "Workshops", "वर्कशॉप")}
            icon="construct-outline"
            secondary
            onPress={() => navigation.navigate("Workshops")}
          />
        ) : null}
        <Field
          label={
            language === "mr"
              ? "गाडी, कर्मचारी किंवा वर्कशॉप शोधा"
              : hi
                ? "गाड़ी, कर्मचारी या वर्कशॉप खोजें"
                : "Find car, person or workshop"
          }
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <Choice
          label={uxText(
            language,
            "Include completed work",
            "पूरे हुए काम भी दिखाएँ",
          )}
          selected={showDone}
          onPress={() => setShowDone((v) => !v)}
          icon="checkmark-done-outline"
        />
        {resource.error ? (
          <ErrorNotice
            message={
              resource.offline
                ? uxText(
                    language,
                    "Saved data · offline",
                    "सहेजा हुआ डेटा · ऑफ़लाइन",
                  )
                : resource.error
            }
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        <CardGrid>
          {visible?.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              hi={hi}
              onPress={() => navigation.navigate("Job", { id: j.id })}
            />
          ))}
        </CardGrid>
        {!resource.loading && !resource.error && !visible?.length ? (
          <Text style={s.muted}>
            {search.trim()
              ? language === "mr"
                ? "जुळणारे काम नाही. शोध बदला."
                : hi
                  ? "कोई काम नहीं मिला। खोज बदलें।"
                  : "No matching work. Try another search."
              : uxText(
                  language,
                  "No repair jobs here yet.",
                  "कोई काम बाकी नहीं है।",
                )}
          </Text>
        ) : null}
      </ContentScroll>
    </View>
  );
}
