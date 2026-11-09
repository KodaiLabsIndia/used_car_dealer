import { uxText } from "../state/ux-copy";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Speech from "expo-speech";
import type { Task } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useInteractionLock } from "../state/use-interaction-lock";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useLiveRefresh } from "../state/use-live-refresh";
import { helpChecks, helpPayload } from "../application/help-request";
import { personalInspectionWork } from "../application/work-overview";
import { sendTaskCommand } from "../application/inspection-sync";
import { GarageHeader } from "../components/header";
import { FocusPage, SelectField } from "../components/workspace";
import { WorkHeading } from "../components/operations";
import { Field } from "../components/forms";
import { Button, ErrorNotice, Text } from "../components/ui";
export function HelpScreen({ navigation, route }: ScreenProps<"Help">) {
  const { api, session, language, changed } = useApp(),
    actor = session!.actor;
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const [selected, setSelected] = useState(route.params?.taskId ?? ""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  useInteractionLock(busy);
  const dashboard = useResource("dashboard", () => api.dashboard());
  const task = useResource(`help:task:${selected}`, () =>
    selected ? api.task(selected) : Promise.resolve(null),
  );
  useLiveRefresh(() => {
    dashboard.refreshQuiet();
    task.refreshQuiet();
  });
  const own = personalInspectionWork(
    dashboard.data?.tasks ?? [],
    actor.id,
    new Date().toISOString(),
  ).todo;
  useFocusEffect(
    useCallback(
      () => () => {
        void Speech.stop();
      },
      [],
    ),
  );
  const master = task.data;
  const choices = helpChecks(master, actor.id);
  const [check, setCheck] = useState(route.params?.itemId ?? "");
  useEffect(() => {
    setSelected(route.params?.taskId ?? "");
    setCheck(route.params?.itemId ?? "");
    setNote("");
    setSent(false);
  }, [route.params?.taskId, route.params?.itemId]);
  const selectedCheck = choices.find((item) => item.id === check);
  async function request() {
    if (!master || !selectedCheck) return;
    setBusy(true);
    setError("");
    try {
      const payload = helpPayload(master, actor.id, selectedCheck.id, note);
      if (!payload)
        throw new Error(
          tr(
            "This check changed. Choose your current check.",
            "जाँच बदल गई। अपनी अभी की जाँच चुनें।",
            "तपासणी बदलली. सध्याची तपासणी निवडा.",
          ),
        );
      await sendTaskCommand(api, actor.id, master, payload);
      changed(uxText(language, "Help request sent", "मदद का अनुरोध भेज दिया"));
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
      task.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#181817" }}>
      <GarageHeader back title={tr("Help", "मदद", "मदत")} />
      <FocusPage widthLimit={800}>
        <WorkHeading
          title={tr(
            "Ask your supervisor",
            "सुपरवाइज़र से मदद माँगें",
            "पर्यवेक्षकाची मदत मागा",
          )}
        />
        <Button
          secondary
          icon="volume-high-outline"
          label={tr("Hear instructions", "निर्देश सुनें", "सूचना ऐका")}
          onPress={() => {
            Speech.stop();
            Speech.speak(
              tr(
                "Choose the car and the check you need help with. Add a note if you want, then send the request. Your supervisor will see it.",
                "गाड़ी और जिस जाँच में मदद चाहिए वह चुनें। चाहें तो बात लिखें, फिर मदद माँगें। सुपरवाइज़र को अनुरोध दिखेगा।",
                "गाडी व मदत हवी असलेली तपासणी निवडा. हवे असल्यास नोंद लिहा आणि विनंती पाठवा. पर्यवेक्षकाला ती दिसेल.",
              ),
              {
                language:
                  language === "mr"
                    ? "mr-IN"
                    : language === "hi"
                      ? "hi-IN"
                      : "en-IN",
                rate: 0.85,
              },
            );
          }}
        />
        {sent ? (
          <>
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontSize: 20, color: "#9ACBA8" }}
            >
              {tr(
                "Help request sent",
                "मदद का अनुरोध भेज दिया",
                "मदतीची विनंती पाठवली",
              )}
            </Text>
            <Button
              label={tr(
                "Back to my work",
                "मेरे काम पर वापस",
                "माझ्या कामाकडे परत",
              )}
              onPress={() => navigation.navigate("Work")}
            />
          </>
        ) : (
          <>
            <SelectField
              label={tr("Which car?", "कौन सी गाड़ी?", "कोणती गाडी?")}
              value={selected}
              onChange={(id) => {
                setSelected(id);
                setCheck("");
                setSent(false);
              }}
              options={own.map((t) => ({
                id: t.id,
                label: `${t.car.make} ${t.car.model} · ${t.car.registration}`,
              }))}
            />
            {task.loading && selected ? (
              <ActivityIndicator color="#fff" />
            ) : null}
            {selected && choices.length ? (
              <>
                <SelectField
                  label={tr("Which check?", "कौन सी जाँच?", "कोणती तपासणी?")}
                  value={selectedCheck?.id ?? ""}
                  onChange={setCheck}
                  options={choices.map((i) => ({
                    id: i.id,
                    label:
                      language === "mr"
                        ? i.titleMr || i.titleHi || i.title
                        : language === "hi"
                          ? i.titleHi || i.title
                          : i.title,
                  }))}
                />
                <Field
                  label={tr(
                    "What help do you need? · optional",
                    "क्या मदद चाहिए? · चाहें तो लिखें",
                    "काय मदत हवी? · ऐच्छिक",
                  )}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                <Button
                  label={tr(
                    "Send help request",
                    "मदद का अनुरोध भेजें",
                    "मदतीची विनंती पाठवा",
                  )}
                  busy={busy}
                  disabled={!selectedCheck || busy}
                  onPress={() => void request()}
                />
              </>
            ) : null}
            {!dashboard.loading && !own.length ? (
              <Text>
                {tr(
                  "No unfinished car checks are assigned to you. Speak to your owner or supervisor for other help.",
                  "आपको अधूरी गाड़ी जाँच नहीं सौंपी है। दूसरी मदद के लिए मालिक या सुपरवाइज़र से बात करें।",
                  "तुम्हाला अपूर्ण गाडी तपासणी नेमलेली नाही. इतर मदतीसाठी मालक किंवा पर्यवेक्षकाशी बोला.",
                )}
              </Text>
            ) : null}
            {selected && !task.loading && !choices.length ? (
              <Text>
                {tr(
                  "These checks are already sent or accepted. Speak to your supervisor about changes.",
                  "ये जाँच भेज दी गई हैं या मंज़ूर हैं। बदलाव के लिए सुपरवाइज़र से बात करें।",
                  "या तपासण्या पाठवलेल्या किंवा मंजूर आहेत. बदलांसाठी पर्यवेक्षकाशी बोला.",
                )}
              </Text>
            ) : null}
          </>
        )}
        {error || dashboard.error || task.error ? (
          <ErrorNotice
            message={error || dashboard.error || task.error}
            retry={() => {
              dashboard.refresh();
              task.refresh();
            }}
          />
        ) : null}
      </FocusPage>
    </View>
  );
}
