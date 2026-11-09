import { uxText } from "../state/ux-copy";
import React, { useState } from "react";
import { View } from "react-native";
import { FocusPage } from "../components/workspace";
import { Field } from "../components/forms";
import { Button, ErrorNotice, Text, s } from "../components/ui";
import { useInteractionLock } from "../state/use-interaction-lock";
import { useApp } from "../state/app-context";

export function ChangePasswordScreen({
  onComplete,
  onCancel,
}: { onComplete?: () => void; onCancel?: () => void } = {}) {
  const { session, language, changePassword, signOut } = useApp(),
    hi = language === "hi",
    tr = (en: string, h: string, mr: string) =>
      language === "mr" ? mr : hi ? h : en,
    minimum = session!.actor.role === "owner" ? 12 : 8;
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useInteractionLock(busy);
  async function save() {
    if (next !== repeat) {
      setError(
        hi ? "नए पासवर्ड मेल नहीं खाते।" : "The new passwords do not match.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
      onComplete?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <FocusPage
        footer={
          <Button
            label={
              session!.mustChangeSecret
                ? tr(
                    "Save password & open work",
                    "पासवर्ड सेव कर काम खोलें",
                    "पासवर्ड जतन करून काम उघडा",
                  )
                : tr("Save password", "पासवर्ड सेव करें", "पासवर्ड जतन करा")
            }
            busy={busy}
            disabled={!current || next.length < minimum || !repeat}
            onPress={() => void save()}
          />
        }
      >
        <Text style={s.title}>
          {tr("Change password", "पासवर्ड बदलें", "पासवर्ड बदला")}
        </Text>
        {onCancel ? (
          <Button
            secondary
            label={uxText(language, "Back", "वापस जाएँ")}
            disabled={busy}
            onPress={onCancel}
          />
        ) : null}
        <Text>{session!.actor.name}</Text>
        <Text style={s.muted}>
          {hi
            ? "पहले प्रवेश पर या मालिक के रीसेट के बाद पासवर्ड बदलें।"
            : "Choose your own password after first sign-in or an owner-assisted reset."}
        </Text>
        {error ? <ErrorNotice message={error} /> : null}
        <Field
          label={
            hi ? "अभी का / अस्थायी पासवर्ड" : "Current / temporary password"
          }
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label={tr("New password", "नया पासवर्ड", "नवीन पासवर्ड")}
          helper={tr(
            `At least ${minimum} characters.`,
            `कम से कम ${minimum} अक्षर।`,
            `किमान ${minimum} अक्षरे.`,
          )}
          autoComplete="new-password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label={tr(
            "Repeat new password",
            "नया पासवर्ड फिर लिखें",
            "नवीन पासवर्ड पुन्हा लिहा",
          )}
          error={
            repeat && next !== repeat
              ? tr(
                  "Passwords do not match yet.",
                  "पासवर्ड अभी मेल नहीं खाते।",
                  "पासवर्ड जुळत नाहीत.",
                )
              : undefined
          }
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          secondary
          label={hi ? "बाहर निकलें" : "Sign out"}
          disabled={busy}
          onPress={() => void signOut()}
        />
      </FocusPage>
    </View>
  );
}
