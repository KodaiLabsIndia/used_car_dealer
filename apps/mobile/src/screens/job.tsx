import { can } from "../application/access";
import React, { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import type { JobCommand } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import {
  Workspace,
  FocusPage,
  CarIdentity,
  SelectField,
} from "../components/workspace";
import { useSection } from "../state/use-section";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Field } from "../components/forms";
import { jobLabel } from "../components/job-card";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { sendCommand } from "../application/send-command";
type JobPayload = JobCommand extends infer C
  ? C extends JobCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
export function JobScreen({ route, navigation }: ScreenProps<"Job">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    owner = can(session!.actor, "service");
  const resource = useResource(`job:${route.params.id}`, () =>
    api.job(route.params.id),
  );
  const people = useResource(`job-people:${owner}`, () =>
    owner ? api.people() : Promise.resolve([]),
  );
  const [section, setSection] = useSection(`job:${route.params.id}`, "work", [
    "work",
    "parts",
    "team",
  ] as const);
  const [person, setPerson] = useState("");
  const [part, setPart] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [addingPart, setAddingPart] = useState(false);
  const job = resource.data,
    own = job?.assignedTo === session!.actor.id;
  async function run(payload: JobPayload) {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        session!.actor.id,
        `job:${job.id}:${payload.action}`,
        { ...payload, expectedVersion: job.version },
        (body) => api.jobCommand(job.id, body as JobCommand),
      );
      setPart("");
      setAddingPart(false);
      if (payload.action === "assign") setSection("work");
      changed();
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
    } finally {
      setBusy(false);
    }
  }
  function submitRepair() {
    Alert.alert(
      hi ? "काम पूरा है?" : "Repair finished?",
      hi
        ? "अगला कदम फोटो के साथ क्वालिटी जाँच और मालिक की मंज़ूरी है।"
        : "Non-financial work can continue during review. Spending needs an approved quote; repair completion still needs photo QC.",
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "जाँच बनाएँ" : "Create quality check",
          onPress: () => void run({ action: "submit_repair" }),
        },
      ],
    );
  }
  function reopen() {
    Alert.alert(
      hi ? "फिर खोलें?" : "Reopen this repair?",
      hi
        ? "पुरानी जाँच और मंज़ूरी रिकॉर्ड में रहेंगी।"
        : "Previous checks and approvals stay in the history.",
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "फिर खोलें" : "Reopen",
          onPress: () => void run({ action: "reopen" }),
        },
      ],
    );
  }
  const activeWork =
    job && ["assigned", "in_progress", "waiting_parts"].includes(job.status);
  const hasPendingParts = job?.parts.some((p) => p.status === "requested");
  const workAction =
    job?.qcTaskId && !activeWork ? (
      <Button
        label={hi ? "क्वालिटी जाँच खोलें" : "Open quality check"}
        icon="clipboard-outline"
        onPress={() => navigation.navigate("Task", { id: job.qcTaskId! })}
      />
    ) : own && activeWork ? (
      hasPendingParts ? (
        <Button
          label={hi ? "पार्ट की स्थिति खोलें" : "Track waiting parts"}
          icon="cube-outline"
          onPress={() => setSection("parts")}
        />
      ) : job?.status !== "in_progress" ? (
        <Button
          label={hi ? "काम चालू करें" : "Start / resume work"}
          icon="play-outline"
          busy={busy}
          onPress={() => void run({ action: "start" })}
        />
      ) : (
        <Button
          label={hi ? "मरम्मत पूरी · जाँच करें" : "Repair finished · check it"}
          icon="checkmark-done-outline"
          busy={busy}
          onPress={submitRepair}
        />
      )
    ) : owner && job?.status === "completed" ? (
      <Button
        label={hi ? "काम फिर खोलें" : "Reopen repair"}
        icon="refresh-outline"
        busy={busy}
        onPress={reopen}
      />
    ) : owner && job?.status !== "completed" ? (
      <Button
        label={hi ? "ज़िम्मेदारी दें" : "Assign this work"}
        icon="people-outline"
        onPress={() => setSection("team")}
      />
    ) : undefined;
  return (
    <Workspace
      title={hi ? "सर्विस का काम" : "Repair job"}
      context={
        job ? (
          <CarIdentity
            car={job.car}
            detail={jobLabel(job.status, hi)}
            onPress={() => navigation.navigate("Car", { id: job.carId })}
          />
        ) : undefined
      }
      items={[
        { id: "work", label: hi ? "काम" : "Work", icon: "build-outline" },
        {
          id: "parts",
          label: hi ? "पार्ट" : "Parts",
          icon: "cube-outline",
          badge: String(
            job?.parts.filter((p) => p.status === "requested").length || 0,
          ),
        },
        { id: "team", label: hi ? "टीम" : "Team", icon: "people-outline" },
      ]}
      selected={section}
      onChange={setSection}
      busy={busy}
    >
      <FocusPage
        scrollKey={`${section}:${addingPart}`}
        footer={
          !job ? undefined : section === "work" ? (
            <View style={{ gap: 10 }}>
              {workAction}
              {owner && job.status === "completed" && job.qcTaskId ? (
                <Button
                  label={hi ? "काम फिर खोलें" : "Reopen repair"}
                  secondary
                  icon="refresh-outline"
                  busy={busy}
                  onPress={reopen}
                />
              ) : null}
            </View>
          ) : section === "parts" && own && activeWork ? (
            addingPart ? (
              <ActionRow>
                <Button
                  label={hi ? "रद्द करें" : "Cancel"}
                  secondary
                  disabled={busy}
                  onPress={() => setAddingPart(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label={hi ? "पार्ट माँगें" : "Request part"}
                  icon="time-outline"
                  busy={busy}
                  disabled={!part.trim()}
                  onPress={() =>
                    void run({
                      action: "wait_parts",
                      partName: part.trim(),
                      expectedAt: null,
                    })
                  }
                  style={{ flex: 2 }}
                />
              </ActionRow>
            ) : (
              <Button
                label={hi ? "पार्ट चाहिए" : "Request a part"}
                icon="add-outline"
                onPress={() => setAddingPart(true)}
              />
            )
          ) : section === "team" && owner && job.status !== "completed" ? (
            <ActionRow>
              {!own ? (
                <Button
                  label={hi ? "मैं संभालूँगा" : "I'll handle it"}
                  secondary
                  icon="person-outline"
                  busy={busy}
                  onPress={() =>
                    void run({
                      action: "assign",
                      assignedTo: session!.actor.id,
                    })
                  }
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                label={hi ? "ज़िम्मेदारी सेव करें" : "Save assignment"}
                icon="checkmark-outline"
                busy={busy}
                disabled={!person || person === job.assignedTo}
                onPress={() =>
                  void run({ action: "assign", assignedTo: person })
                }
                style={{ flex: 1 }}
              />
            </ActionRow>
          ) : undefined
        }
      >
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {resource.loading && !job ? <ActivityIndicator color="#fff" /> : null}
        {job ? (
          section === "work" ? (
            <>
              <Panel style={{ gap: 14 }}>
                <Pill
                  label={jobLabel(job.status, hi)}
                  warning={job.status === "waiting_parts"}
                />
                <Text
                  style={{ fontSize: 23, lineHeight: 31, fontWeight: "600" }}
                >
                  {job.title}
                </Text>
                {can(session!.actor, "finance") || own ? (
                  <Button
                    secondary
                    label={
                      hi
                        ? "कोटेशन, बिल और भुगतान"
                        : "Quotes, invoices & payments"
                    }
                    icon="receipt-outline"
                    onPress={() =>
                      navigation.navigate("ServiceFinance", { jobId: job.id })
                    }
                  />
                ) : null}
                <Text style={s.muted}>
                  {job.assigneeName} ·{" "}
                  {job.workshopName || (hi ? "अपनी टीम" : "In-house")}
                </Text>
                {job.blocker ? <Text>{job.blocker}</Text> : null}
              </Panel>
              <Button
                label={hi ? "पार्ट देखें" : "View parts"}
                secondary
                icon="cube-outline"
                onPress={() => setSection("parts")}
              />
              {!own && !owner ? (
                <Text style={s.muted}>
                  {hi
                    ? "इस काम की ज़िम्मेदारी दूसरे व्यक्ति के पास है।"
                    : "This work is assigned to another person."}
                </Text>
              ) : null}
            </>
          ) : section === "parts" ? (
            addingPart ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: "600" }}>
                  {hi
                    ? "काम किस पार्ट के लिए रुका है?"
                    : "Which part is holding up the work?"}
                </Text>
                <Field
                  label={hi ? "कौन सा पार्ट चाहिए?" : "Which part is needed?"}
                  placeholder={hi ? "जैसे ब्रेक पैड" : "e.g. Brake pads"}
                  value={part}
                  onChangeText={setPart}
                  maxLength={160}
                  editable={!busy}
                />
                <Text style={s.muted}>
                  {hi
                    ? "पार्ट मिलने तक काम इंतज़ार में दिखेगा।"
                    : "The job will show as waiting until the part is received."}
                </Text>
              </>
            ) : (
              <>
                {job.parts.map((p) => (
                  <Panel key={p.id} style={{ gap: 12 }}>
                    <Text style={{ fontWeight: "600", fontSize: 17 }}>
                      {p.name}
                    </Text>
                    <Pill
                      label={
                        p.status === "received"
                          ? hi
                            ? "मिल गया"
                            : "Received"
                          : hi
                            ? "आना बाकी है"
                            : "Requested"
                      }
                      warning={p.status === "requested"}
                    />
                    {p.expectedAt ? (
                      <Text style={s.muted}>
                        {new Date(p.expectedAt).toLocaleDateString(
                          hi ? "hi-IN" : "en-IN",
                        )}
                      </Text>
                    ) : null}
                    {own && p.status === "requested" ? (
                      <Button
                        label={hi ? "पार्ट मिल गया" : "Part received"}
                        icon="checkmark-outline"
                        secondary
                        busy={busy}
                        onPress={() =>
                          void run({ action: "receive_part", partId: p.id })
                        }
                      />
                    ) : null}
                  </Panel>
                ))}
                {!job.parts.length ? (
                  <Text style={s.muted}>
                    {hi ? "अभी कोई पार्ट दर्ज नहीं है।" : "No parts recorded."}
                  </Text>
                ) : null}
              </>
            )
          ) : (
            <>
              <Panel style={{ gap: 10 }}>
                <Text style={{ fontWeight: "600", fontSize: 18 }}>
                  {job.assigneeName}
                </Text>
                <Text style={s.muted}>
                  {job.workshopName ||
                    (hi ? "अपनी सर्विस टीम" : "In-house service team")}
                </Text>
              </Panel>
              {people.error ? (
                <ErrorNotice message={people.error} retry={people.refresh} />
              ) : null}
              {owner && job.status !== "completed" ? (
                <SelectField
                  label={hi ? "ज़िम्मेदार व्यक्ति" : "Responsible person"}
                  value={person || job.assignedTo}
                  options={
                    people.data?.map((p) => ({
                      id: p.id,
                      label: `${p.name}${p.id === session!.actor.id ? (hi ? " · मैं" : " · Me") : ""}`,
                      icon: "person-outline",
                    })) || []
                  }
                  onChange={setPerson}
                  disabled={busy || !people.data}
                />
              ) : null}
            </>
          )
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
