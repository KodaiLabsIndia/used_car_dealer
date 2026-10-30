import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import type { ScreenProps } from "../navigation";
import { Workspace, FocusPage } from "../components/workspace";
import { useSection } from "../state/use-section";
import { Button, ErrorNotice, Panel, Text, s } from "../components/ui";
import { Field } from "../components/forms";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { sendCommand } from "../application/send-command";
export function WorkshopsScreen(_props: ScreenProps<"Workshops">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi";
  const resource = useResource("workshops", () => api.workshops());
  const [section, setSection] = useSection("workshops", "directory", [
    "directory",
    "add",
  ] as const);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        session!.actor.id,
        "create-workshop",
        { name: name.trim(), phone: phone.trim() },
        (b) => api.createWorkshop(b),
      );
      setName("");
      setPhone("");
      setSection("directory");
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title={hi ? "वर्कशॉप" : "Workshops"}
      items={[
        {
          id: "directory",
          label: hi ? "साथी" : "Partners",
          icon: "business-outline",
        },
        {
          id: "add",
          label: hi ? "नया साथी" : "Add partner",
          icon: "add-outline",
        },
      ]}
      selected={section}
      onChange={setSection}
      busy={busy}
    >
      <FocusPage
        scrollKey={section}
        footer={
          section === "add" ? (
            <Button
              label={hi ? "सेव करें" : "Save workshop"}
              icon="checkmark-outline"
              busy={busy}
              disabled={!name.trim()}
              onPress={() => void save()}
            />
          ) : undefined
        }
      >
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {section === "add" ? (
          <>
            <Field
              label={hi ? "नाम" : "Name"}
              value={name}
              onChangeText={setName}
              maxLength={120}
              editable={!busy}
            />
            <Field
              label={hi ? "फ़ोन (वैकल्पिक)" : "Phone (optional)"}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={30}
              editable={!busy}
            />
          </>
        ) : (
          <>
            {resource.loading && !resource.data ? (
              <ActivityIndicator color="#fff" />
            ) : null}
            {resource.data?.map((w) => (
              <Panel key={w.id} style={{ gap: 5 }}>
                <Text style={{ fontSize: 17, fontWeight: "600" }}>
                  {w.name}
                </Text>
                {w.phone ? (
                  <Text selectable style={s.muted}>
                    {w.phone}
                  </Text>
                ) : null}
              </Panel>
            ))}
            {!resource.loading && !resource.data?.length ? (
              <Text style={s.muted}>
                {hi
                  ? "अभी कोई वर्कशॉप नहीं है।"
                  : "Add your first service partner."}
              </Text>
            ) : null}
          </>
        )}
      </FocusPage>
    </Workspace>
  );
}
