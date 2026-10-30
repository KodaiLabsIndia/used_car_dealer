import { can } from "../application/access";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { Car } from "@arihant/contracts";
import type { Navigation } from "../navigation";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "./ui";
import { Field, Choice } from "./forms";
import { JobCard } from "./job-card";
import { FocusPage, StepHeader } from "./workspace";
import { useSection } from "../state/use-section";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { sendCommand } from "../application/send-command";
export function CarWork({
  car,
  section,
  onOpenIssues,
}: {
  car: Car;
  section: "work" | "issues" | "history";
  onOpenIssues: () => void;
}) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    owner = can(session!.actor, "service"),
    nav = useNavigation<Navigation>();
  const tab = section;
  const [workType, setWorkType] = useSection(`car-work:${car.id}`, "checks", [
    "checks",
    "repairs",
  ] as const);
  const [expanded, setExpanded] = useState("");
  const [adding, setAdding] = useState(false),
    [description, setDescription] = useState(""),
    [urgent, setUrgent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const tasks = useResource(`car-tasks:${car.id}`, async () =>
    (await api.tasks()).filter((t) => t.carId === car.id),
  );
  const issues = useResource(`issues:${car.id}`, () => api.issues(car.id));
  const jobs = useResource(`car-jobs:${car.id}`, () => api.jobs(car.id));
  const history = useResource(`history:${car.id}`, () => api.history(car.id));
  async function saveIssue() {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        session!.actor.id,
        `issue:${car.id}`,
        {
          expectedVersion: car.version,
          description: description.trim(),
          severity: urgent ? ("urgent" as const) : ("normal" as const),
        },
        (b) => api.createIssue(car.id, b),
      );
      setAdding(false);
      setDescription("");
      setUrgent(false);
      changed();
    } catch (e) {
      setError((e as Error).message);
      changed();
    } finally {
      setBusy(false);
    }
  }
  const active = tab === "work" ? tasks : tab === "issues" ? issues : history;
  return (
    <FocusPage
      scrollKey={`${tab}:${workType}:${adding}`}
      top={
        tab === "work" ? (
          <StepHeader
            labels={[hi ? "जाँच" : "Inspections", hi ? "मरम्मत" : "Repairs"]}
            current={workType === "checks" ? 0 : 1}
            onSelect={(i) => setWorkType(i === 0 ? "checks" : "repairs")}
          />
        ) : undefined
      }
      footer={
        tab === "work" &&
        (workType === "checks"
          ? can(session!.actor, "assign_inspection")
          : owner) ? (
          workType === "checks" ? (
            <Button
              label={hi ? "जाँच सौंपें" : "Assign an inspection"}
              icon="clipboard-outline"
              onPress={() =>
                nav.navigate("AssignInspection", { carId: car.id })
              }
            />
          ) : (
            <Button
              label={hi ? "समस्याएँ खोलें" : "Open issues to plan a repair"}
              icon="build-outline"
              onPress={onOpenIssues}
            />
          )
        ) : tab === "issues" ? (
          adding ? (
            <ActionRow>
              <Button
                label={hi ? "रद्द करें" : "Cancel"}
                secondary
                disabled={busy}
                onPress={() => setAdding(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={hi ? "समस्या सेव करें" : "Save issue"}
                busy={busy}
                disabled={!description.trim()}
                onPress={() => void saveIssue()}
                style={{ flex: 2 }}
              />
            </ActionRow>
          ) : (
            <Button
              label={hi ? "समस्या दर्ज करें" : "Report an issue"}
              icon="alert-circle-outline"
              onPress={() => setAdding(true)}
            />
          )
        ) : undefined
      }
    >
      {error || active.error ? (
        <ErrorNotice message={error || active.error} retry={active.refresh} />
      ) : null}
      {active.loading && !active.data ? (
        <ActivityIndicator color="#fff" />
      ) : null}
      {tab === "work" ? (
        workType === "checks" ? (
          <>
            {tasks.data?.map((task) => (
              <Pressable
                accessibilityRole="button"
                key={task.id}
                onPress={() => nav.navigate("Task", { id: task.id })}
              >
                <Panel style={{ gap: 10 }}>
                  <View style={s.row}>
                    <Icon name="clipboard-outline" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600" }}>{task.title}</Text>
                      <Text style={s.muted}>
                        {task.assigneeName} ·{" "}
                        {task.answers.length -
                          task.recheckItems.filter((id) =>
                            task.answers.some((a) => a.itemId === id),
                          ).length}
                        /{task.items.length}
                      </Text>
                    </View>
                    <Icon name="chevron-forward-outline" />
                  </View>
                  <Pill
                    label={
                      task.status === "completed"
                        ? hi
                          ? "पूरा हुआ"
                          : "Completed"
                        : task.status === "submitted"
                          ? hi
                            ? "मंज़ूरी बाकी"
                            : "Awaiting review"
                          : task.status === "recheck"
                            ? hi
                              ? "दोबारा जाँचें"
                              : "Recheck"
                            : hi
                              ? "काम बाकी"
                              : "In progress"
                    }
                  />
                </Panel>
              </Pressable>
            ))}
            {!tasks.loading && !tasks.data?.length ? (
              <Text style={s.muted}>
                {hi ? "कोई जाँच नहीं है।" : "No inspections assigned."}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {jobs.error ? (
              <ErrorNotice message={jobs.error} retry={jobs.refresh} />
            ) : null}
            {jobs.data?.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                hi={hi}
                onPress={() => nav.navigate("Job", { id: job.id })}
              />
            ))}
            {!jobs.loading && !jobs.data?.length ? (
              <Text style={s.muted}>
                {hi ? "अभी कोई मरम्मत नहीं है।" : "No repairs assigned."}
              </Text>
            ) : null}
          </>
        )
      ) : tab === "issues" ? (
        adding ? (
          <>
            <Text style={{ fontSize: 20, fontWeight: "600" }}>
              {hi ? "क्या ठीक करना है?" : "What needs attention?"}
            </Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {[
                ["Tyre / wheel", "टायर / पहिया"],
                ["Lights", "लाइट"],
                ["Brakes", "ब्रेक"],
                ["AC", "AC"],
                ["Body / paint", "बॉडी / पेंट"],
              ].map(([en, hindi]) => (
                <Pressable
                  key={en}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setDescription(hi ? hindi! : en!)}
                  style={{
                    padding: 12,
                    minHeight: 48,
                    backgroundColor: "#393939",
                    borderRadius: 12,
                  }}
                >
                  <Text>{hi ? hindi : en}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={hi ? "विवरण" : "Description"}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
              editable={!busy}
            />
            <Choice
              label={hi ? "ज़रूरी · पहले ठीक करें" : "Urgent · needs priority"}
              selected={urgent}
              onPress={() => {
                if (!busy) setUrgent((v) => !v);
              }}
              icon="alert-circle-outline"
            />
          </>
        ) : (
          <>
            {issues.data?.map((issue) => (
              <Panel key={issue.id} style={{ gap: 12 }}>
                <Pill
                  label={
                    issue.status === "resolved"
                      ? hi
                        ? "ठीक हुआ"
                        : "Resolved"
                      : issue.status === "in_repair"
                        ? hi
                          ? "मरम्मत में"
                          : "In repair"
                        : issue.severity === "urgent"
                          ? hi
                            ? "ज़रूरी"
                            : "Urgent"
                          : hi
                            ? "खुली समस्या"
                            : "Open issue"
                  }
                  warning={
                    issue.status !== "resolved" && issue.severity === "urgent"
                  }
                />
                <Text
                  style={{ fontSize: 17, lineHeight: 26, fontWeight: "600" }}
                >
                  {issue.description}
                </Text>
                {issue.evidenceId ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: expanded === issue.id }}
                      onPress={() =>
                        setExpanded((v) => (v === issue.id ? "" : issue.id))
                      }
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ color: "#ff9fa6" }}>
                        {expanded === issue.id
                          ? hi
                            ? "फोटो बंद करें"
                            : "Hide photo"
                          : hi
                            ? "फोटो देखें"
                            : "View photo"}
                      </Text>
                    </Pressable>
                    {expanded === issue.id ? (
                      <Image
                        source={api.evidenceUri(issue.evidenceId)}
                        accessibilityLabel={
                          hi ? "समस्या की फोटो" : "Issue evidence"
                        }
                        style={{
                          width: "100%",
                          height: 190,
                          resizeMode: "contain",
                          backgroundColor: "#242424",
                          borderRadius: 10,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                {issue.jobId && jobs.data?.some((j) => j.id === issue.jobId) ? (
                  <Button
                    label={hi ? "मरम्मत खोलें" : "Open repair"}
                    secondary
                    icon="build-outline"
                    onPress={() => nav.navigate("Job", { id: issue.jobId! })}
                  />
                ) : owner && issue.status === "open" ? (
                  <Button
                    label={hi ? "मरम्मत सौंपें" : "Assign repair"}
                    icon="build-outline"
                    onPress={() =>
                      nav.navigate("AssignRepair", {
                        carId: car.id,
                        issueId: issue.id,
                      })
                    }
                  />
                ) : null}
              </Panel>
            ))}
            {!issues.loading && !issues.data?.length ? (
              <Text style={s.muted}>
                {hi ? "अभी कोई समस्या दर्ज नहीं है।" : "No issues reported."}
              </Text>
            ) : null}
          </>
        )
      ) : (
        <>
          {history.data?.map((entry) => (
            <Panel key={entry.id} style={{ gap: 6 }}>
              <Text style={{ fontWeight: "600" }}>{entry.summary}</Text>
              <Text style={s.muted}>
                {entry.actorName} ·{" "}
                {new Date(entry.createdAt).toLocaleString(
                  hi ? "hi-IN" : "en-IN",
                )}
              </Text>
            </Panel>
          ))}
          {!history.loading && !history.data?.length ? (
            <Text style={s.muted}>
              {hi
                ? "आगे के काम यहाँ दिखेंगे।"
                : "Recorded actions will appear here."}
            </Text>
          ) : null}
        </>
      )}
    </FocusPage>
  );
}
