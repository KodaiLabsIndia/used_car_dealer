import { can } from "../application/access";
import { ContentScroll } from "../components/layout";
import React, { useState } from "react";
import { Alert, View } from "react-native";
import { colors } from "@arihant/design-tokens";
import { GarageHeader } from "../components/header";
import { ActionRow, Button, Panel, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { API_URL } from "../adapters/api";
import type { ScreenProps } from "../navigation";
export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const { session, language, setLanguage, t, signOut } = useApp();
  const [connectionDetails, setConnectionDetails] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader back title={t("settings")} />
      <ContentScroll narrow>
        <Text style={s.title}>{session?.actor.name}</Text>
        <Text style={s.muted}>
          {t(session?.actor.role === "owner" ? "owner" : "employee")}
        </Text>
        {session && can(session.actor, "overview") ? (
          <Button
            secondary
            label={
              language === "hi" ? "सभी बाकी फैसले" : "All pending decisions"
            }
            icon="hand-left-outline"
            onPress={() => navigation.navigate("Decisions")}
          />
        ) : null}
        {session?.actor.role === "owner" ? (
          <Button
            secondary
            label={
              language === "hi"
                ? "स्टॉक और रकम की रिपोर्ट"
                : "Stock & money reports"
            }
            icon="bar-chart-outline"
            onPress={() => navigation.navigate("Reports")}
          />
        ) : null}
        {session?.actor.role === "owner" ? (
          <Button
            secondary
            label={
              language === "hi" ? "AI से संक्षेप लें" : "Ask the assistant"
            }
            icon="sparkles-outline"
            onPress={() => navigation.navigate("Assistant")}
          />
        ) : null}
        <Button
          label={
            language === "hi" ? "सूचनाएँ और रिमाइंडर" : "Updates & reminders"
          }
          icon="notifications-outline"
          onPress={() => navigation.navigate("Inbox")}
        />
        {session && can(session.actor, "leads") ? (
          <Button
            label={
              language === "hi"
                ? "खरीदार और विक्रेता पूछताछ"
                : "Buyer & seller enquiries"
            }
            icon="people-outline"
            onPress={() => navigation.navigate("Enquiries")}
          />
        ) : null}
        {session?.actor.role === "owner" ? (
          <Button
            label={language === "hi" ? "लोग और प्रवेश" : "People & access"}
            icon="people-outline"
            onPress={() => navigation.navigate("Team")}
          />
        ) : null}
        {session?.actor.role === "owner" ? (
          <Button
            secondary
            label={
              language === "hi" ? "जाँच की सूची बनाएँ" : "Inspection checklists"
            }
            icon="checkbox-outline"
            onPress={() => navigation.navigate("Checklists")}
          />
        ) : null}
        {session?.authentication === "password" ? (
          <Button
            secondary
            label={language === "hi" ? "पासवर्ड बदलें" : "Change password"}
            icon="lock-closed-outline"
            onPress={() => navigation.navigate("Security")}
          />
        ) : null}
        <Panel style={{ gap: 15 }}>
          <Text>{t("language")}</Text>
          <ActionRow>
            {(["en", "hi"] as const).map((l) => (
              <Button
                key={l}
                label={l === "en" ? "English" : "हिंदी"}
                selected={language === l}
                secondary={language !== l}
                onPress={() => setLanguage(l)}
              />
            ))}
          </ActionRow>
        </Panel>
        <Panel style={{ gap: 9 }}>
          <Text style={s.label}>
            {language === "hi" ? "कार्यक्षेत्र" : "Workspace"}
          </Text>
          {session?.actor.role === "owner" ? (
            <Button
              secondary
              label={
                language === "hi" ? "कनेक्शन का विवरण" : "Connection details"
              }
              onPress={() => setConnectionDetails((value) => !value)}
            />
          ) : null}
          {session?.actor.role === "owner" && connectionDetails ? (
            <Text selectable style={{ fontSize: 12 }}>
              {API_URL}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {session?.authentication === "training"
              ? t("training")
              : language === "hi"
                ? "व्यक्तिगत प्रवेश"
                : "Individual account"}
          </Text>
        </Panel>
        <Button
          label={t("signOut")}
          icon="log-out-outline"
          secondary
          onPress={() =>
            Alert.alert(t("signOut"), t("signOutNote"), [
              { text: t("cancel"), style: "cancel" },
              {
                text: t("signOut"),
                style: "destructive",
                onPress: () => void signOut(),
              },
            ])
          }
        />
      </ContentScroll>
    </View>
  );
}
