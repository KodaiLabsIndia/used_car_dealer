import React, { useState } from "react";
import { View } from "react-native";
import { FocusPage } from "../components/workspace";
import { Field } from "../components/forms";
import { Button, ErrorNotice, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";

export function ChangePasswordScreen({
  onComplete,
  onCancel,
}: { onComplete?: () => void; onCancel?: () => void } = {}) {
  const { session, language, changePassword, signOut } = useApp(),
    hi = language === "hi";
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
              hi ? "पासवर्ड बदलकर काम खोलें" : "Change password & open work"
            }
            busy={busy}
            disabled={
              !current ||
              next.length < (session!.actor.role === "owner" ? 12 : 8) ||
              !repeat
            }
            onPress={() => void save()}
          />
        }
      >
        <Text style={s.title}>
          {hi ? "अपना पासवर्ड चुनें।" : "Make this account yours."}
        </Text>
        {onCancel ? (
          <Button
            secondary
            label={hi ? "वापस जाएँ" : "Back"}
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
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label={hi ? "नया पासवर्ड" : "New password"}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label={hi ? "नया पासवर्ड फिर लिखें" : "Repeat new password"}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
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
