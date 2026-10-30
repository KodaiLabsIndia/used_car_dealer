import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import type { ScreenProps } from "../navigation";
import { FocusScreen, FocusPage, SelectField } from "../components/workspace";
import { Button, ErrorNotice, Panel, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { sendCommand } from "../application/send-command";
export function AssignRepairScreen({
  route,
  navigation,
}: ScreenProps<"AssignRepair">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    { carId, issueId } = route.params;
  const resource = useResource(`repair-options:${issueId}`, async () => ({
    issue: (await api.issues(carId)).find((i) => i.id === issueId),
    people: await api.people(),
    workshops: await api.workshops(),
  }));
  const [person, setPerson] = useState(session!.actor.id),
    [workshop, setWorkshop] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (!resource.data?.issue) return;
    setBusy(true);
    setError("");
    try {
      const job = await sendCommand(
        session!.actor.id,
        `create-job:${issueId}`,
        {
          expectedVersion: resource.data.issue.version,
          assignedTo: person,
          workshopId: workshop,
          dueAt: null,
        },
        (body) => api.createJob(issueId, body),
      );
      changed();
      navigation.replace("Job", { id: job.id });
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <FocusScreen title={hi ? "मरम्मत सौंपें" : "Assign a repair"}>
      <FocusPage
        footer={
          <Button
            label={hi ? "मरम्मत शुरू कराएँ" : "Create repair job"}
            icon="build-outline"
            busy={busy}
            disabled={!resource.data?.issue}
            onPress={() => void submit()}
          />
        }
      >
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        {resource.data?.issue ? (
          <Panel>
            <Text>{resource.data.issue.description}</Text>
          </Panel>
        ) : null}
        <SelectField
          label={hi ? "ज़िम्मेदार व्यक्ति" : "Responsible person"}
          value={person}
          options={
            resource.data?.people.map((p) => ({
              id: p.id,
              label: `${p.name}${p.id === session!.actor.id ? (hi ? " · मैं" : " · Me") : ""}`,
              icon: "person-outline",
            })) || []
          }
          onChange={setPerson}
          disabled={busy || !resource.data}
        />
        <SelectField
          label={hi ? "वर्कशॉप" : "Workshop"}
          value={workshop || "in_house"}
          options={[
            {
              id: "in_house",
              label: hi
                ? "अपनी सर्विस टीम / बाद में चुनें"
                : "In-house / choose later",
              icon: "build-outline",
            },
            ...(resource.data?.workshops.map((w) => ({
              id: w.id,
              label: w.name,
              icon: "build-outline" as const,
            })) || []),
          ]}
          onChange={(id) => setWorkshop(id === "in_house" ? null : id)}
          disabled={busy || !resource.data}
        />
        <Button
          label={hi ? "वर्कशॉप जोड़ें" : "Add a workshop"}
          secondary
          icon="add-outline"
          onPress={() => navigation.navigate("Workshops")}
        />
      </FocusPage>
    </FocusScreen>
  );
}
