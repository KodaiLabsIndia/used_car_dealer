import React, { useState } from "react";
import { Alert } from "react-native";
import { can, workingLevel } from "../application/access";
import { languageNames } from "../state/copy";
import { Workspace, FocusPage } from "../components/workspace";
import { ActionRow, Button, Panel, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
import { API_URL } from "../adapters/api";
import type { ScreenProps } from "../navigation";

export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const { session, language, setLanguage, t, signOut } = useApp();
  const [section, setSection] = useState<"account" | "work" | "company">(
      "account",
    ),
    [connectionDetails, setConnectionDetails] = useState(false);
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const owner = session?.actor.role === "owner",
    supervisor = !!session && can(session.actor, "overview");
  return (
    <Workspace
      title={t("settings")}
      selected={section}
      onChange={setSection}
      items={[
        {
          id: "account",
          label: tr("Account", "मेरा खाता", "माझे खाते"),
          icon: "person-outline",
        },
        {
          id: "work",
          label: tr("Work tools", "काम के साधन", "कामाची साधने"),
          icon: "construct-outline",
        },
        ...(supervisor
          ? [
              {
                id: "company" as const,
                label: tr("Company", "कंपनी", "कंपनी"),
                icon: "business-outline" as const,
              },
            ]
          : []),
      ]}
    >
      <FocusPage scrollKey={section} widthLimit={800}>
        {section === "account" ? (
          <>
            <Text style={s.title}>{session?.actor.name}</Text>
            <Text style={s.muted}>
              {t(session ? workingLevel(session.actor) : "employee")}
            </Text>
            <Panel style={{ gap: 12 }}>
              <Text style={s.label}>{t("language")}</Text>
              <ActionRow>
                {(["en", "hi", "mr"] as const).map((id) => (
                  <Button
                    key={id}
                    label={languageNames[id]}
                    selected={language === id}
                    secondary={language !== id}
                    onPress={() => setLanguage(id)}
                  />
                ))}
              </ActionRow>
            </Panel>
            {session?.authentication === "password" ? (
              <Button
                secondary
                label={tr("Change password", "पासवर्ड बदलें", "पासवर्ड बदला")}
                icon="lock-closed-outline"
                onPress={() => navigation.navigate("Security")}
              />
            ) : null}
            <Panel style={{ gap: 9 }}>
              <Text style={s.label}>
                {tr("Workspace", "कार्यक्षेत्र", "कार्यक्षेत्र")}
              </Text>
              <Text style={s.muted}>
                {session?.authentication === "training"
                  ? t("training")
                  : tr(
                      "Individual account",
                      "व्यक्तिगत प्रवेश",
                      "वैयक्तिक खाते",
                    )}
              </Text>
              {owner ? (
                <Button
                  secondary
                  label={tr(
                    "Connection details",
                    "कनेक्शन का विवरण",
                    "कनेक्शनची माहिती",
                  )}
                  onPress={() => setConnectionDetails((v) => !v)}
                />
              ) : null}
              {owner && connectionDetails ? (
                <Text selectable>{API_URL}</Text>
              ) : null}
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
          </>
        ) : section === "work" ? (
          <>
            {supervisor ? (
              <Button
                secondary
                label={tr(
                  "All pending decisions",
                  "सभी बाकी फैसले",
                  "सर्व प्रलंबित निर्णय",
                )}
                icon="hand-left-outline"
                onPress={() => navigation.navigate("Decisions")}
              />
            ) : null}
            <Button
              label={tr(
                "Updates & reminders",
                "सूचनाएँ और रिमाइंडर",
                "सूचना आणि आठवणी",
              )}
              icon="notifications-outline"
              onPress={() => navigation.navigate("Inbox")}
            />
            {session && can(session.actor, "leads") ? (
              <Button
                label={tr(
                  "Buyer & seller enquiries",
                  "खरीदार और विक्रेता पूछताछ",
                  "खरेदीदार व विक्रेत्यांची चौकशी",
                )}
                icon="people-outline"
                onPress={() => navigation.navigate("Enquiries")}
              />
            ) : null}
            {owner ? (
              <Button
                secondary
                label={tr(
                  "Ask the assistant",
                  "AI से संक्षेप लें",
                  "AI सहाय्यकाला विचारा",
                )}
                icon="sparkles-outline"
                onPress={() => navigation.navigate("Assistant")}
              />
            ) : null}
          </>
        ) : supervisor ? (
          <>
            <Button
              secondary
              label={tr(
                "Stock & money reports",
                "स्टॉक और रकम की रिपोर्ट",
                "स्टॉक आणि रकमेचे अहवाल",
              )}
              icon="bar-chart-outline"
              onPress={() => navigation.navigate("Reports")}
            />
            {owner ? (
              <>
                <Button
                  label={tr(
                    "People & access",
                    "लोग और प्रवेश",
                    "लोक आणि प्रवेश",
                  )}
                  icon="people-outline"
                  onPress={() => navigation.navigate("Team")}
                />
                <Button
                  secondary
                  label={tr(
                    "Inspection checklists",
                    "जाँच की सूची बनाएँ",
                    "तपासणीच्या याद्या",
                  )}
                  icon="checkbox-outline"
                  onPress={() => navigation.navigate("Checklists")}
                />
                <Button
                  secondary
                  label={tr(
                    "Company document rules",
                    "कंपनी के दस्तावेज़",
                    "कंपनीची कागदपत्रे",
                  )}
                  icon="documents-outline"
                  onPress={() => navigation.navigate("CompanySettings")}
                />
              </>
            ) : null}
          </>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
