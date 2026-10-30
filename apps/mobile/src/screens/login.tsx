import { ContentScroll } from "../components/layout";
import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { colors } from "@arihant/design-tokens";
import { useApp } from "../state/app-context";
import { API_URL, ApiClient } from "../adapters/api";
import { Field } from "../components/forms";
import {
  ActionRow,
  Button,
  ErrorNotice,
  logo,
  Text,
  s,
} from "../components/ui";
export function LoginScreen() {
  const { t, signIn, signInPassword, language, setLanguage } = useApp(),
    [account, setAccount] = useState<"owner" | "employee">("owner"),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"staff" | "training">("staff"),
    [training, setTraining] = useState(false),
    [dealer, setDealer] = useState(process.env.EXPO_PUBLIC_DEALER_CODE || ""),
    [username, setUsername] = useState(""),
    [secret, setSecret] = useState("");
  useEffect(() => {
    void new ApiClient(null)
      .authOptions()
      .then((options) => setTraining(options.trainingLogin))
      .catch(() => {});
  }, []);
  async function enter() {
    setBusy(true);
    setError("");
    try {
      if (mode === "training") await signIn(code, account);
      else await signInPassword(dealer.trim(), username.trim(), secret);
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
          {mode === "training"
            ? t("signInHint")
            : language === "hi"
              ? "अपने नाम की पहचान से काम खोलें।"
              : "Open your work with your individual login."}
        </Text>
        {mode === "staff" ? (
          <>
            <Field
              label={language === "hi" ? "डीलर कोड" : "Dealer code"}
              value={dealer}
              onChangeText={setDealer}
              autoCapitalize="none"
              autoCorrect={false}
            />
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
        ) : (
          <>
            <ActionRow>
              {(["owner", "employee"] as const).map((a) => (
                <Button
                  key={a}
                  label={t(a)}
                  selected={account === a}
                  secondary={account !== a}
                  onPress={() => setAccount(a)}
                />
              ))}
            </ActionRow>
            <TextInput
              accessibilityLabel={t("accessCode")}
              placeholder={t("accessCode")}
              placeholderTextColor="#aaa"
              value={code}
              onChangeText={setCode}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (code.trim() && !busy) void enter();
              }}
              style={s.input}
            />
          </>
        )}
        {error ? <ErrorNotice message={error} /> : null}
        <Button
          label={t("signIn")}
          icon="arrow-forward-outline"
          busy={busy}
          disabled={
            mode === "training"
              ? !code.trim()
              : !dealer.trim() || !username.trim() || !secret
          }
          onPress={() => void enter()}
        />
        {training ? (
          <Button
            secondary
            label={
              mode === "staff"
                ? language === "hi"
                  ? "ट्रेनिंग प्रवेश"
                  : "Training workspace"
                : language === "hi"
                  ? "व्यक्तिगत प्रवेश"
                  : "Individual login"
            }
            onPress={() => {
              setMode(mode === "staff" ? "training" : "staff");
              setError("");
              setCode("");
              setSecret("");
            }}
          />
        ) : null}
        {mode === "training" ? (
          <Text style={{ fontSize: 10, color: "#999" }}>
            {t("training")} · {API_URL}
          </Text>
        ) : null}
      </ContentScroll>
    </KeyboardAvoidingView>
  );
}
