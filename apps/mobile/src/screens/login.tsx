import { ContentScroll } from "../components/layout";
import React, { useState } from "react";
import {
  Image,
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [username, setUsername] = useState(""),
    [secret, setSecret] = useState("");
  async function enter() {
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("language")}
            onPress={() => setLanguage(language === "en" ? "hi" : "en")}
            style={s.iconButton}
          >
            <Text>{language === "en" ? "हिं" : "EN"}</Text>
          </Pressable>
        </View>
        <Text
          style={{
            fontSize: 44,
            lineHeight: 50,
            letterSpacing: -2,
            fontWeight: "600",
          }}
        >
          Welcome to{`\n`}the{" "}
          <Text style={{ fontSize: 44, lineHeight: 50, color: "#ef5961" }}>
            Garage.
          </Text>
        </Text>
        <Text style={s.muted}>
          {language === "hi"
            ? "अपने नाम की पहचान से काम खोलें।"
            : "Open your work with your individual login."}
        </Text>
        <>
          <Field
            label={language === "hi" ? "यूज़र नाम" : "Username"}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
          <Field
            label={language === "hi" ? "पासवर्ड" : "Password"}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.muted}>
            {language === "hi"
              ? "पहली बार प्रवेश या पासवर्ड बदलने के लिए मालिक से मदद लें।"
              : "Ask the owner for first-time access or a password reset."}
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
