import React, { useEffect, useState } from "react";
import { View } from "react-native";
import * as Speech from "expo-speech";
import type { RoutineItem } from "@arihant/contracts";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { nextRoutineStep } from "../application/work-overview";
import { FocusScreen, FocusPage, SectionTabs } from "./workspace";
import { formatDateTime } from "./date-format";
import {
  WorkEmpty,
  WorkHeading,
  WorkRow,
  operationColors as c,
} from "./operations";
import { ActionRow, Button, ErrorNotice, Icon, Text } from "./ui";
export function RoutineFocus({
  item,
  canLog,
  busy,
  error,
  onBack,
  onDone,
  onReopen,
  onEdit,
}: {
  item: RoutineItem;
  canLog: boolean;
  busy: boolean;
  error: string;
  onBack: () => void;
  onDone: (step: number) => void;
  onReopen: (step: number) => void;
  onEdit?: () => void;
}) {
  const { language } = useApp();
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [section, setSection] = useState<"steps" | "activity">("steps");
  const [allSteps, setAllSteps] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const next = nextRoutineStep(item);
  const step = item.definition.steps[next];
  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, [next, section]);
  return (
    <FocusScreen busy={busy} title={item.definition.title} onBack={onBack}>
      <FocusPage
        scrollKey={`${item.id}:${section}`}
        widthLimit={1000}
        top={
          <SectionTabs
            disabled={busy}
            selected={section}
            onChange={setSection}
            items={[
              {
                id: "steps",
                label: tr("Steps", "चरण", "टप्पे"),
                icon: "list-outline",
              },
              {
                id: "activity",
                label: tr("Activity", "रिकॉर्ड", "नोंद"),
                icon: "time-outline",
              },
            ]}
          />
        }
      >
        <View style={{ gap: 7 }}>
          <Text style={{ fontSize: 12, color: c.muted }}>
            {item.assigneeName} ·{" "}
            {new Date(`${item.workDate}T12:00:00+05:30`).toLocaleDateString(
              language === "hi"
                ? "hi-IN"
                : language === "mr"
                  ? "mr-IN"
                  : "en-IN",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              },
            )}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "600", flexShrink: 1 }}>
              {item.completedSteps.length}/{item.definition.steps.length}{" "}
              {tr("steps recorded", "चरण दर्ज", "टप्पे नोंदवले")}
            </Text>
            <Icon
              name={
                next < 0 ? "checkmark-done-circle-outline" : "repeat-outline"
              }
              color={next < 0 ? colors.green : "#EAC1A5"}
            />
          </View>
          <View style={{ height: 5, borderRadius: 5, backgroundColor: c.line }}>
            <View
              style={{
                height: 5,
                borderRadius: 5,
                backgroundColor: next < 0 ? colors.green : colors.red,
                width: `${(item.completedSteps.length / item.definition.steps.length) * 100}%`,
              }}
            />
          </View>
        </View>
        {error || speechError ? (
          <ErrorNotice message={error || speechError} />
        ) : null}
        {section === "steps" ? (
          <>
            {next < 0 ? (
              <WorkEmpty
                title={tr(
                  "All steps recorded",
                  "सभी चरण दर्ज हैं",
                  "सर्व टप्पे नोंदवले",
                )}
                detail={tr(
                  "The activity record shows who logged each step and when. Attendance and pay stay separate.",
                  "रिकॉर्ड में हर चरण का नाम और समय है। हाज़िरी और वेतन अलग रहते हैं।",
                  "नोंदीत प्रत्येक टप्प्याचे नाव व वेळ आहे. हजेरी व पगार वेगळे राहतात.",
                )}
              />
            ) : (
              <View
                style={{
                  padding: 24,
                  borderRadius: 24,
                  backgroundColor: "#302725",
                  borderWidth: 1,
                  borderColor: "#5C4034",
                  gap: 18,
                }}
              >
                <Text
                  style={{ fontSize: 12, color: "#E8BCA1", fontWeight: "600" }}
                >
                  {tr("NEXT STEP", "अगला चरण", "पुढचा टप्पा")} · {next + 1}/
                  {item.definition.steps.length}
                </Text>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "600",
                    width: "100%",
                    flexShrink: 1,
                  }}
                >
                  {step}
                </Text>
                <ActionRow>
                  <Button
                    secondary
                    label={tr("Hear this step", "यह चरण सुनें", "हा टप्पा ऐका")}
                    icon="volume-high-outline"
                    onPress={() => {
                      setSpeechError("");
                      void Speech.stop();
                      Speech.speak(step!, {
                        language: /[\u0900-\u097f]/u.test(step!)
                          ? language === "mr"
                            ? "mr-IN"
                            : "hi-IN"
                          : "en-IN",
                        rate: 0.82,
                        onError: () =>
                          setSpeechError(
                            tr(
                              "Voice is unavailable. Read the step or ask your supervisor.",
                              "आवाज़ उपलब्ध नहीं। चरण पढ़ें या सुपरवाइज़र से पूछें।",
                              "आवाज उपलब्ध नाही. टप्पा वाचा किंवा पर्यवेक्षकाला विचारा.",
                            ),
                          ),
                      });
                    }}
                  />
                  {canLog ? (
                    <Button
                      label={tr(
                        "Mark step done",
                        "चरण पूरा दर्ज करें",
                        "टप्पा पूर्ण नोंदवा",
                      )}
                      icon="checkmark-outline"
                      busy={busy}
                      onPress={() => onDone(next)}
                    />
                  ) : null}
                </ActionRow>
                {!canLog ? (
                  <Text style={{ fontSize: 13, color: c.muted }}>
                    {tr(
                      `${item.assigneeName} records their own work.`,
                      `${item.assigneeName} अपना काम खुद दर्ज करेंगे।`,
                      `${item.assigneeName} स्वतःचे काम नोंदवतील.`,
                    )}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: c.muted }}>
                    {tr(
                      "Do the work first, then mark it done.",
                      "पहले काम करें, फिर पूरा दर्ज करें।",
                      "आधी काम करा, मग पूर्ण नोंदवा.",
                    )}
                  </Text>
                )}
              </View>
            )}
            <Button
              secondary
              label={
                allSteps
                  ? tr("Hide checklist", "सूची छिपाएँ", "यादी लपवा")
                  : tr("View all steps", "सभी चरण देखें", "सर्व टप्पे पाहा")
              }
              icon="list-outline"
              onPress={() => setAllSteps((v) => !v)}
            />
            {allSteps ? (
              <View style={{ gap: 8 }}>
                {item.definition.steps.map((label, index) => (
                  <View
                    key={index}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: c.card,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Icon
                        name={
                          item.completedSteps.includes(index)
                            ? "checkmark-circle-outline"
                            : "ellipse-outline"
                        }
                        color={
                          item.completedSteps.includes(index)
                            ? colors.green
                            : c.muted
                        }
                      />
                      <Text style={{ fontSize: 16, flex: 1, minWidth: 0 }}>
                        {index + 1}. {label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: c.muted }}>
                      {item.completedSteps.includes(index)
                        ? tr("Recorded", "दर्ज किया", "नोंदवले")
                        : tr("Still to do", "करना बाकी", "करायचे बाकी")}
                    </Text>
                    {canLog && item.completedSteps.includes(index) ? (
                      <Button
                        secondary
                        label={tr(
                          "Reopen this step",
                          "यह चरण फिर खोलें",
                          "हा टप्पा पुन्हा उघडा",
                        )}
                        onPress={() => onReopen(index)}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {canLog && item.completedSteps.length ? (
              <Text style={{ fontSize: 12, color: c.muted }}>
                {tr(
                  "To correct a completed step, open all steps and choose it. A reason is required and the original record stays.",
                  "पूरा चरण बदलना हो तो सभी चरण खोलकर उसे चुनें। कारण दर्ज होगा और पुराना रिकॉर्ड सुरक्षित रहेगा।",
                  "पूर्ण टप्पा बदलायचा असल्यास सर्व टप्पे उघडून तो निवडा. कारण नोंदवले जाईल व जुनी नोंद जतन राहील.",
                )}
              </Text>
            ) : null}
            {onEdit ? (
              <WorkRow
                title={tr(
                  "Edit routine setup",
                  "काम की सेटिंग बदलें",
                  "कामाची मांडणी बदला",
                )}
                detail={tr(
                  "Assignment, repeat days and future steps",
                  "ज़िम्मेदारी, दिन और आगे के चरण",
                  "जबाबदारी, दिवस व पुढील टप्पे",
                )}
                icon="options-outline"
                onPress={onEdit}
              />
            ) : null}
          </>
        ) : (
          <>
            <WorkHeading
              title={tr(
                "Who did what, and when",
                "किसने क्या, कब किया",
                "कोणी काय व कधी केले",
              )}
            />
            {item.events.length ? (
              item.events
                .slice()
                .reverse()
                .map((event) => (
                  <View
                    key={event.version}
                    style={{
                      padding: 17,
                      borderRadius: 17,
                      backgroundColor: c.card,
                      gap: 5,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600" }}>
                      {event.byName} ·{" "}
                      {event.done
                        ? tr("Done", "पूरा", "पूर्ण")
                        : tr("Reopened", "फिर खोला", "पुन्हा उघडले")}
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      {item.definition.steps[event.step]}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.muted }}>
                      {formatDateTime(event.createdAt, language)}
                    </Text>
                    {event.note ? (
                      <Text style={{ fontSize: 13, color: c.muted }}>
                        {event.note}
                      </Text>
                    ) : null}
                  </View>
                ))
            ) : (
              <WorkEmpty
                title={tr(
                  "No steps recorded yet",
                  "अभी कोई चरण दर्ज नहीं",
                  "अद्याप टप्पे नोंदवले नाहीत",
                )}
                detail={tr(
                  "Named activity appears here after a step is saved.",
                  "चरण सेव होने पर नाम और समय यहाँ दिखेगा।",
                  "टप्पा जतन झाल्यावर नाव व वेळ येथे दिसेल.",
                )}
                icon="time-outline"
              />
            )}
          </>
        )}
      </FocusPage>
    </FocusScreen>
  );
}
