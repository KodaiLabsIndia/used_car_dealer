import React, { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { randomUUID } from "expo-crypto";
import type { Member, WorkRole } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage } from "../components/workspace";
import { Field } from "../components/forms";
import { Button, ErrorNotice, Panel, Pill, Text, s } from "../components/ui";
import { CardGrid } from "../components/layout";

export function TeamScreen({ navigation }: ScreenProps<"Team">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi";
  const resource = useResource("team", () => api.team());
  const [section, setSection] = useState<"people" | "add" | "login">("people"),
    [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [commandId, setCommandId] = useState(randomUUID());
  const [roles, setRoles] = useState<WorkRole[]>(["inspector"]);
  const [rolesFor, setRolesFor] = useState<Member | null>(null);
  const [resetFor, setResetFor] = useState<Member | null>(null);
  const tr = (en: string, hindi: string) => (hi ? hindi : en);
  async function create() {
    setBusy(true);
    setError("");
    try {
      if (rolesFor)
        await api.teamCommand(rolesFor.id, {
          action: "profile",
          commandId,
          expectedVersion: rolesFor.version,
          name: rolesFor.name,
          active: rolesFor.active,
          workRoles: roles,
        });
      else if (resetFor)
        await api.teamCommand(resetFor.id, {
          action: "reset_secret",
          commandId,
          expectedVersion: resetFor.version,
          temporarySecret: secret,
        });
      else if (section === "login")
        await api.setupLogin({ commandId, username, secret });
      else
        await api.createStaff({
          commandId,
          name,
          username,
          temporarySecret: secret,
          workRoles: roles,
        });
      setRolesFor(null);
      setRoles(["inspector"]);
      setName("");
      setUsername("");
      setSecret("");
      setResetFor(null);
      setCommandId(randomUUID());
      setSection("people");
      setNotice(
        tr(
          "Account saved. Give any temporary password directly to that person. They choose their own password on first login.",
          "पहचान सेव हुई। अस्थायी पासवर्ड उस व्यक्ति को सीधे बताएँ; पहले प्रवेश पर इसे बदलना होगा।",
        ),
      );
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function setActive(member: Member) {
    Alert.alert(
      member.active
        ? tr("Deactivate this account?", "यह पहचान बंद करें?")
        : tr("Reactivate this account?", "यह पहचान फिर खोलें?"),
      `${member.name}\n${tr("Existing sessions will be signed out. Work history remains attributed to this person.", "पुराने प्रवेश बंद होंगे। काम का इतिहास इसी व्यक्ति के नाम रहेगा।")}`,
      [
        { text: tr("Cancel", "रद्द"), style: "cancel" },
        {
          text: tr("Confirm", "पुष्टि"),
          onPress: () => {
            setBusy(true);
            setError("");
            void api
              .teamCommand(member.id, {
                action: "profile",
                commandId: randomUUID(),
                expectedVersion: member.version,
                name: member.name,
                active: !member.active,
              })
              .then(() => changed())
              .catch((e) => setError((e as Error).message))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  const own = resource.data?.items.find((m) => m.id === session!.actor.id);
  return (
    <Workspace
      title={tr("People & access", "लोग और प्रवेश")}
      selected={section}
      busy={busy}
      onChange={(v) => {
        setSection(v);
        setResetFor(null);
        setRolesFor(null);
        setRoles(["inspector"]);
        setSecret("");
        setError("");
        setCommandId(randomUUID());
      }}
      items={[
        { id: "people", label: tr("People", "लोग"), icon: "people-outline" },
        {
          id: "add",
          label: tr("Add staff", "व्यक्ति जोड़ें"),
          icon: "person-add-outline",
        },
        {
          id: "login",
          label: tr("My login", "मेरा प्रवेश"),
          icon: "lock-closed-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={`${section}:${resetFor?.id ?? ""}`}
        footer={
          (section !== "people" && !(section === "login" && own?.username)) ||
          resetFor ||
          rolesFor ? (
            <Button
              label={
                rolesFor
                  ? tr("Save responsibilities", "ज़िम्मेदारियाँ सेव करें")
                  : resetFor
                    ? tr("Reset temporary password", "अस्थायी पासवर्ड बदलें")
                    : section === "login"
                      ? tr("Set my individual login", "अपना प्रवेश बनाएँ")
                      : tr("Create individual account", "व्यक्तिगत पहचान बनाएँ")
              }
              busy={busy}
              disabled={
                rolesFor
                  ? roles.length === 0
                  : secret.length < (section === "login" ? 12 : 8) ||
                    (!resetFor && !username.trim()) ||
                    (!resetFor && section === "add" && !name.trim()) ||
                    (section === "login" && !!own?.username)
              }
              onPress={() => void create()}
            />
          ) : undefined
        }
      >
        {resource.data ? (
          <Panel style={{ gap: 5 }}>
            <Text style={s.muted}>{tr("Dealer code", "डीलर कोड")}</Text>
            <Text selectable style={{ fontSize: 20, fontWeight: "600" }}>
              {resource.data.dealerCode}
            </Text>
          </Panel>
        ) : null}
        {error || resource.error ? (
          <ErrorNotice
            message={error || resource.error}
            retry={resource.refresh}
          />
        ) : null}
        {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
        {resource.loading && !resource.data ? (
          <ActivityIndicator color="#fff" />
        ) : null}
        {rolesFor ? (
          <>
            <Text style={s.title}>{rolesFor.name}</Text>
            <Text style={s.muted}>
              {tr(
                "Choose the work they can oversee. Changing access signs out their current sessions.",
                "जो काम वे देख सकें उसे चुनें। पहुँच बदलने पर पुराना प्रवेश बंद होगा।",
              )}
            </Text>
            <RolePicker value={roles} onChange={setRoles} hi={hi} />
            <Button
              secondary
              label={tr("Cancel", "रद्द")}
              onPress={() => setRolesFor(null)}
            />
          </>
        ) : resetFor ? (
          <>
            <Text style={s.title}>{resetFor.name}</Text>
            <Text style={s.muted}>
              {tr(
                "Reset the password only after confirming the person's identity. Their sessions will be revoked.",
                "व्यक्ति की पहचान जाँचकर पासवर्ड बदलें। पुराने प्रवेश बंद होंगे।",
              )}
            </Text>
            <Field
              label={tr(
                "Temporary password · 8+ characters",
                "अस्थायी पासवर्ड · कम से कम 8 अक्षर",
              )}
              value={secret}
              onChangeText={setSecret}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              secondary
              label={tr("Cancel", "रद्द करें")}
              disabled={busy}
              onPress={() => {
                setResetFor(null);
                setSecret("");
              }}
            />
          </>
        ) : section === "people" ? (
          <CardGrid>
            {resource.data?.items.map((member) => (
              <Panel key={member.id} style={{ gap: 12 }}>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text style={{ fontSize: 20, fontWeight: "600", flex: 1 }}>
                    {member.name}
                  </Text>
                  <Pill
                    label={
                      member.role === "owner"
                        ? tr("Owner", "मालिक")
                        : member.active
                          ? tr("Active", "सक्रिय")
                          : tr("Inactive", "बंद")
                    }
                    warning={!member.active}
                  />
                </View>
                <Text style={s.muted}>
                  {member.username ??
                    tr(
                      "Training identity · no individual login",
                      "ट्रेनिंग पहचान · व्यक्तिगत प्रवेश नहीं",
                    )}
                  {member.mustChangeSecret
                    ? ` · ${tr("Password change required", "पासवर्ड बदलना होगा")}`
                    : ""}
                </Text>
                {member.role !== "owner" ? (
                  <>
                    <Text style={s.muted}>
                      {member.workRoles.map((role) => role).join(" · ")}
                    </Text>
                    <Button
                      secondary
                      disabled={busy}
                      label={tr("Responsibilities", "ज़िम्मेदारियाँ")}
                      onPress={() => {
                        setRolesFor(member);
                        setRoles(member.workRoles);
                        setCommandId(randomUUID());
                        setSecret("");
                      }}
                    />
                    <Button
                      secondary
                      disabled={busy}
                      label={
                        member.active
                          ? tr("Deactivate", "बंद करें")
                          : tr("Reactivate", "फिर खोलें")
                      }
                      onPress={() => setActive(member)}
                    />
                    {member.username ? (
                      <Button
                        secondary
                        disabled={busy}
                        label={tr("Reset password", "पासवर्ड बदलें")}
                        onPress={() => {
                          setResetFor(member);
                          setSecret("");
                          setCommandId(randomUUID());
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </Panel>
            ))}
          </CardGrid>
        ) : section === "login" && own?.username ? (
          <Panel style={{ gap: 15 }}>
            <Text>{own.username}</Text>
            <Button
              label={tr("Change my password", "अपना पासवर्ड बदलें")}
              onPress={() => navigation.navigate("Security")}
            />
          </Panel>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: "600" }}>
              {section === "login"
                ? tr(
                    "Your owner identity stays the same.",
                    "मालिक की आपकी पहचान वही रहेगी।",
                  )
                : tr(
                    "One person. Their own record.",
                    "हर व्यक्ति की अपनी पहचान।",
                  )}
            </Text>
            {section === "add" ? (
              <Field
                label={tr("Name", "नाम")}
                value={name}
                onChangeText={setName}
              />
            ) : null}
            {section === "add" ? (
              <RolePicker value={roles} onChange={setRoles} hi={hi} />
            ) : null}
            <Field
              label={tr(
                "Username · letters/numbers",
                "यूज़र नाम · अंग्रेज़ी अक्षर / अंक",
              )}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label={
                section === "login"
                  ? tr(
                      "Your password · 12+ characters",
                      "अपना पासवर्ड · कम से कम 12 अक्षर",
                    )
                  : tr(
                      "Temporary password · 8+ characters",
                      "अस्थायी पासवर्ड · कम से कम 8 अक्षर",
                    )
              }
              value={secret}
              onChangeText={setSecret}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.muted}>
              {section === "login"
                ? tr(
                    "All business access and your earlier work remain attached to this identity.",
                    "सभी गाड़ियों की पहुँच और पुराना काम इसी पहचान से जुड़ा रहेगा।",
                  )
                : tr(
                    "Help the employee sign in with this dealer code and username, then choose their own password.",
                    "कर्मचारी को डीलर कोड और यूज़र नाम से प्रवेश करने में मदद करें। फिर वे अपना पासवर्ड चुनें।",
                  )}
            </Text>
          </>
        )}
      </FocusPage>
    </Workspace>
  );
}

function RolePicker({
  value,
  onChange,
  hi,
}: {
  value: WorkRole[];
  onChange: (value: WorkRole[]) => void;
  hi: boolean;
}) {
  const options: [WorkRole, string, string, string, string][] = [
    [
      "inspector",
      "Inspector",
      "जाँच कर्मचारी",
      "Assigned inspections and repairs",
      "सौंपी हुई जाँच और मरम्मत",
    ],
    [
      "coordinator",
      "Service coordinator",
      "सर्विस समन्वयक",
      "All cars, workshops and repair assignment",
      "सभी गाड़ियाँ, वर्कशॉप और मरम्मत सौंपना",
    ],
    [
      "supervisor",
      "Supervisor",
      "सुपरवाइज़र",
      "Assign and review inspections; coordinate repairs",
      "जाँच सौंपना, समीक्षा और मरम्मत समन्वय",
    ],
    [
      "manager",
      "Operations manager",
      "संचालन प्रबंधक",
      "All operations and car intake",
      "सभी संचालन और गाड़ी का प्रवेश",
    ],
    [
      "sales",
      "Sales / enquiries",
      "बिक्री / पूछताछ",
      "Assigned buyer and seller enquiries and visits",
      "सौंपी हुई ग्राहक पूछताछ और मुलाकात",
    ],
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.muted}>
        {hi
          ? "एक से अधिक ज़िम्मेदारी चुन सकते हैं। वित्त और लोगों का प्रबंधन मालिक के पास है।"
          : "Select one or more responsibilities. Financial records and staff administration remain with the owner."}
      </Text>
      {options.map(([id, en, hindi, desc, descHi]) => (
        <Panel key={id} style={{ gap: 8 }}>
          <Button
            secondary={!value.includes(id)}
            label={`${value.includes(id) ? "✓ " : ""}${hi ? hindi : en}`}
            onPress={() =>
              onChange(
                value.includes(id)
                  ? value.filter((v) => v !== id)
                  : [...value, id],
              )
            }
          />
          <Text style={s.muted}>{hi ? descHi : desc}</Text>
        </Panel>
      ))}
    </View>
  );
}
