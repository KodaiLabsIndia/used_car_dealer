import { uxText } from "../state/ux-copy";
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
  const [search, setSearch] = useState("");
  const visible = resource.data?.filter((w) =>
    `${w.name} ${w.phone ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
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
      changed(uxText(language, "Workshop saved", "वर्कशॉप सेव हुई"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title={uxText(language, "Workshops", "वर्कशॉप")}
      items={[
        {
          id: "directory",
          label: uxText(language, "Partners", "साथी"),
          icon: "business-outline",
        },
        {
          id: "add",
          label: uxText(language, "Add partner", "नया साथी"),
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
              label={uxText(language, "Save workshop", "सेव करें")}
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
              label={uxText(language, "Name", "नाम")}
              value={name}
              onChangeText={setName}
              maxLength={120}
              editable={!busy}
            />
            <Field
              label={uxText(language, "Phone (optional)", "फ़ोन (वैकल्पिक)")}
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
            <Field
              label={
                language === "mr"
                  ? "नाव किंवा फोन शोधा"
                  : hi
                    ? "नाम या फ़ोन खोजें"
                    : "Find name or phone"
              }
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {visible?.map((w) => (
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
            {!resource.loading && !resource.error && !visible?.length ? (
              <Text style={s.muted}>
                {search.trim()
                  ? language === "mr"
                    ? "जुळणारा संपर्क नाही. शोध बदला."
                    : hi
                      ? "संपर्क नहीं मिला। खोज बदलें।"
                      : "No matching contact. Try another search."
                  : uxText(
                      language,
                      "Add your first service partner.",
                      "अभी कोई वर्कशॉप नहीं है।",
                    )}
              </Text>
            ) : null}
          </>
        )}
      </FocusPage>
    </Workspace>
  );
}
