import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import type { ScreenProps } from "../navigation";
import { FocusScreen, FocusPage, SelectField } from "../components/workspace";
import { Button, ErrorNotice, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { sendCommand } from "../application/send-command";
import { vehicleConfigurationSchema } from "@arihant/contracts";
import { VehicleConfigurationFields } from "../components/vehicle-configuration";
export function AssignInspectionScreen({
  route,
  navigation,
}: ScreenProps<"AssignInspection">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    ownerId = session!.actor.id;
  const { carId, taskId } = route.params;
  const catalog = useResource(
    `inspection-options:${carId}:${taskId || "new"}`,
    async () => ({
      people: await api.people(),
      templates: (await api.templates()).filter((t) => t.kind !== "repair_qc"),
      task: taskId ? await api.task(taskId) : null,
    }),
  );
  const [person, setPerson] = useState(ownerId),
    [template, setTemplate] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [configuration, setConfiguration] = useState(() =>
    vehicleConfigurationSchema.parse({}),
  );
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const task = catalog.data?.task;
      const result = task
        ? await sendCommand(
            ownerId,
            `assign-task:${task.id}`,
            {
              action: "assign" as const,
              assignedTo: person,
              expectedVersion: task.version,
            },
            (body) => api.command(task.id, body),
          )
        : await sendCommand(
            ownerId,
            `inspection:${carId}`,
            {
              templateId: template,
              assignedTo: person,
              dueAt: null,
              configuration,
            },
            (body) => api.createInspection(carId, body),
          );
      changed();
      navigation.replace("Task", { id: result.id });
    } catch (e) {
      setError((e as Error).message);
      catalog.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <FocusScreen
      title={
        taskId
          ? hi
            ? "ज़िम्मेदारी बदलें"
            : "Assign inspection"
          : hi
            ? "नई जाँच"
            : "New inspection"
      }
    >
      <FocusPage
        footer={
          <Button
            label={hi ? "ज़िम्मेदारी दें" : "Assign inspection"}
            icon="checkmark-outline"
            busy={busy}
            disabled={!catalog.data || (!taskId && !template)}
            onPress={() => void submit()}
          />
        }
      >
        {error || catalog.error ? (
          <ErrorNotice
            message={error || catalog.error}
            retry={catalog.refresh}
          />
        ) : null}
        {catalog.loading && !catalog.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        {taskId ? (
          <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "600" }}>
            {catalog.data?.task?.title}
          </Text>
        ) : null}
        <SelectField
          label={hi ? "कौन जाँच करेगा?" : "Who will inspect?"}
          value={person}
          options={
            catalog.data?.people.map((p) => ({
              id: p.id,
              label: `${p.name}${p.id === ownerId ? (hi ? " · मैं" : " · Me") : ""}`,
              icon: "person-outline",
            })) || []
          }
          onChange={setPerson}
          disabled={busy || !catalog.data}
        />
        {!taskId ? (
          <SelectField
            label={hi ? "चेकलिस्ट" : "Checklist"}
            value={template}
            options={
              catalog.data?.templates.map((t) => ({
                id: t.id,
                label: t.name,
                detail: `v${t.version} · ${t.items.length} ${hi ? "फोटो" : "photos"} · ${t.approved ? (hi ? "स्वीकृत" : "Approved") : hi ? "ड्राफ्ट" : "Draft"}`,
                icon: "clipboard-outline",
              })) || []
            }
            onChange={setTemplate}
            disabled={busy || !catalog.data}
          />
        ) : null}
        {!taskId && template ? (
          <VehicleConfigurationFields
            value={configuration}
            onChange={setConfiguration}
            hi={hi}
            disabled={busy}
          />
        ) : null}
        <Text style={s.muted}>
          {hi
            ? "मालिक भी यह ज़िम्मेदारी ले सकता है। वास्तविक कर्मचारी का नाम काम के साथ दर्ज रहेगा।"
            : "The owner can take this responsibility too. Work is attributed to the person who performs it."}
        </Text>
      </FocusPage>
    </FocusScreen>
  );
}
