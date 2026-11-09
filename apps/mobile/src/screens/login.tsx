import { ContentScroll } from "../components/layout";
import React, { useRef, useState } from "react";
import {
  Image,
  Keyboard,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { Field } from "../components/forms";
import { Button, ErrorNotice, logo, Text, s } from "../components/ui";
export function LoginScreen() {
  const { t, signInPassword, language, setLanguage } = useApp(),
    tr = (en: string, hi: string, mr: string) =>
      language === "mr" ? mr : language === "hi" ? hi : en,
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [username, setUsername] = useState(""),
    [secret, setSecret] = useState("");
  const passwordInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  async function enter() {
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    try {
      await signInPassword(username.trim(), secret);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ContentScroll
        narrow
        contentContainerStyle={[
          { flexGrow: 1, justifyContent: "center", paddingVertical: 36 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Image
            source={logo}
            style={{ width: 98, height: 63, resizeMode: "contain" }}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["en", "English"],
              ["hi", "हिन्दी"],
              ["mr", "मराठी"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: language === id, disabled: busy }}
              disabled={busy}
              onPress={() => setLanguage(id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                minHeight: 46,
                borderRadius: 12,
                backgroundColor: language === id ? "#652F38" : "#282623",
                borderWidth: 1,
                borderColor: language === id ? "#D77A88" : "#44403B",
              }}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.title, { fontSize: 32 }]}>
          {tr("Sign in", "प्रवेश करें", "प्रवेश करा")}
        </Text>
        <Text style={s.muted}>
          {tr(
            "Use your Arihant Cars account.",
            "अपने अरिहंत कार्स खाते से प्रवेश करें।",
            "तुमच्या अरिहंत कार्स खात्यात प्रवेश करा.",
          )}
        </Text>
        <>
          <Field
            label={tr("Username", "यूज़र नाम", "वापरकर्तानाव")}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordInput.current?.focus()}
            autoComplete="username"
          />
          <Field
            label={tr("Password", "पासवर्ड", "पासवर्ड")}
            inputRef={passwordInput}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!busy && username.trim() && secret) void enter();
            }}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.muted}>
            {tr(
              "Ask the owner for an account or a password reset.",
              "खाते या पासवर्ड रीसेट के लिए मालिक से मदद लें।",
              "खात्यासाठी किंवा पासवर्ड बदलण्यासाठी मालकाची मदत घ्या.",
            )}
          </Text>
        </>
        {error ? <ErrorNotice message={error} /> : null}
        <Button
          label={t("signIn")}
          icon="arrow-forward-outline"
          busy={busy}
          disabled={!username.trim() || !secret}
          onPress={() => void enter()}
        />
      </ContentScroll>
    </KeyboardAvoidingView>
  );
}
