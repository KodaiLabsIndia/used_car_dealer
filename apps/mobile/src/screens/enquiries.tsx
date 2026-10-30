import { formatDateTime } from "../components/date-format";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  View,
} from "react-native";
import type { EnquiryCommand } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
  type BusinessField,
} from "../components/business-form";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Field } from "../components/forms";
import { FormRow, CardGrid } from "../components/layout";
import { can } from "../application/access";
import { sendCommand } from "../application/send-command";
import {
  requireFutureDayTimestamp,
  futureLocalDateTimeTimestamp,
} from "../application/future-date";
import { localDateInput } from "../application/payment-date";

type Payload = EnquiryCommand extends infer C
  ? C extends EnquiryCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
export function EnquiriesScreen({ navigation }: ScreenProps<"Enquiries">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    tr = (en: string, hindi: string) => (hi ? hindi : en),
    admin = can(session!.actor, "lead_admin");
  const [scope, setScope] = useState<"due" | "mine" | "all">("due"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false);
  const resource = useResource(`enquiries:${scope}:${search}:${offset}`, () =>
      api.enquiries(scope, search, offset),
    ),
    people = useResource(`lead-people:${admin}`, () =>
      admin ? api.people() : Promise.resolve([]),
    );
  const personOptions =
    people.data?.map((p) => ({ id: p.id, label: p.name })) ?? [];
  const spec: BusinessFormSpec = {
    key: "new-enquiry",
    title: tr("New enquiry", "नई पूछताछ"),
    submitLabel: tr("Save enquiry", "पूछताछ सेव करें"),
    steps: [
      {
        label: tr("Contact", "संपर्क"),
        fields: [
          {
            key: "kind",
            label: tr("Buying or selling?", "खरीदना या बेचना?"),
            kind: "select",
            initial: "buyer",
            options: [
              { id: "buyer", label: tr("Wants to buy", "खरीदना चाहते हैं") },
              { id: "seller", label: tr("Wants to sell", "बेचना चाहते हैं") },
            ],
          },
          { key: "name", label: tr("Name", "नाम") },
          { key: "phone", label: tr("Phone", "फोन") },
        ],
      },
      {
        label: tr("Interest", "रुचि"),
        fields: [
          {
            key: "interest",
            label: tr("Car, budget or requirements", "गाड़ी, बजट या ज़रूरत"),
          },
          {
            key: "source",
            label: tr("How did they reach us?", "हमसे कैसे संपर्क हुआ?"),
          },
        ],
      },
      {
        label: tr("Next step", "अगला कदम"),
        fields: [
          {
            key: "due",
            label: tr("Follow up", "फिर संपर्क"),
            kind: "date",
            initial: localDateInput(),
          },
          ...(admin
            ? [
                {
                  key: "assigned",
                  label: tr("Responsible person", "ज़िम्मेदार व्यक्ति"),
                  kind: "select" as const,
                  initial: session!.actor.id,
                  options: personOptions,
                },
              ]
            : []),
        ],
      },
    ],
  };
  return (
    <Workspace
      title={tr("Buyer & seller enquiries", "खरीदार और विक्रेता पूछताछ")}
      selected={scope}
      busy={busy || adding}
      onChange={(v) => {
        setScope(v);
        setOffset(0);
      }}
      items={[
        {
          id: "due",
          label: tr("Follow up", "फिर संपर्क"),
          icon: "alarm-outline",
        },
        {
          id: "mine",
          label: tr("My enquiries", "मेरी पूछताछ"),
          icon: "person-outline",
        },
        {
          id: "all",
          label: tr("All visible", "सभी उपलब्ध"),
          icon: "people-outline",
        },
      ]}
    >
      {adding ? (
        <BusinessForm
          spec={spec}
          version={1}
          summary={tr(
            "Keep only useful contact and car details.",
            "सिर्फ उपयोगी संपर्क और गाड़ी की जानकारी रखें।",
          )}
          onBusyChange={setBusy}
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            const result = await sendCommand(
              session!.actor.id,
              "enquiry:create",
              {
                kind:
                  v.kind === "seller"
                    ? ("seller" as const)
                    : ("buyer" as const),
                name: v.name || "",
                phone: v.phone || "",
                source: v.source || "",
                interest: v.interest || "",
                assignedTo: admin
                  ? v.assigned || session!.actor.id
                  : session!.actor.id,
                nextFollowUpAt: requireFutureDayTimestamp(v.due || ""),
              },
              (body) => api.createEnquiry(body),
            );
            setAdding(false);
            changed();
            navigation.navigate("Enquiry", { id: result.enquiry.id });
            return true;
          }}
        />
      ) : (
        <FocusPage
          scrollKey={`${scope}:${offset}`}
          footer={
            <ActionRow>
              <Button
                secondary
                label={tr("Previous", "पिछला")}
                disabled={offset === 0 || resource.loading}
                onPress={() => setOffset(Math.max(0, offset - 30))}
                style={{ flex: 1 }}
              />
              <Button
                label={tr("New enquiry", "नई पूछताछ")}
                icon="add-outline"
                onPress={() => setAdding(true)}
                style={{ flex: 2 }}
              />
              <Button
                secondary
                label={tr("Next", "अगला")}
                disabled={
                  resource.loading || (resource.data?.items.length ?? 0) < 30
                }
                onPress={() => setOffset(offset + 30)}
                style={{ flex: 1 }}
              />
            </ActionRow>
          }
        >
          <FormRow>
            <View style={{ flex: 1 }}>
              <Field
                label={tr("Name, phone or car", "नाम, फोन या गाड़ी")}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => {
                  setSearch(query.trim());
                  setOffset(0);
                }}
                returnKeyType="search"
              />
            </View>
            <Button
              secondary
              label={tr("Search", "खोजें")}
              onPress={() => {
                setSearch(query.trim());
                setOffset(0);
              }}
            />
          </FormRow>
          {resource.error ? (
            <ErrorNotice message={resource.error} retry={resource.refresh} />
          ) : null}
          {resource.loading && !resource.data ? (
            <ActivityIndicator color="#fff" />
          ) : null}
          <CardGrid>
            {resource.data?.items.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`${e.name}, ${e.kind}, ${e.phone}`}
                onPress={() => navigation.navigate("Enquiry", { id: e.id })}
              >
                <Panel style={{ gap: 12 }}>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <Text style={{ fontSize: 22, fontWeight: "600", flex: 1 }}>
                      {e.name}
                    </Text>
                    <Pill
                      label={
                        e.kind === "buyer"
                          ? tr("Buyer", "खरीदार")
                          : tr("Seller", "विक्रेता")
                      }
                    />
                  </View>
                  <Text>{e.phone}</Text>
                  <Text numberOfLines={2} style={s.muted}>
                    {e.interest ||
                      tr("Open contact details", "संपर्क जानकारी खोलें")}
                  </Text>
                  <Text>
                    {e.assigneeName} · {e.status}
                  </Text>
                  {e.nextFollowUpAt ? (
                    <Pill
                      label={`${tr("Follow up", "फिर संपर्क")} · ${new Date(e.nextFollowUpAt).toLocaleDateString(hi ? "hi-IN" : "en-IN")}`}
                      warning={
                        new Date(e.nextFollowUpAt).getTime() < Date.now() &&
                        !["won", "lost"].includes(e.status)
                      }
                    />
                  ) : null}
                </Panel>
              </Pressable>
            ))}
          </CardGrid>
          {!resource.loading &&
          !resource.error &&
          !resource.data?.items.length ? (
            <Text style={s.muted}>
              {tr(
                "No enquiries in this view.",
                "इस सूची में कोई पूछताछ नहीं है।",
              )}
            </Text>
          ) : null}
        </FocusPage>
      )}
    </Workspace>
  );
}
export function EnquiryScreen({ route, navigation }: ScreenProps<"Enquiry">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    tr = (en: string, hindi: string) => (hi ? hindi : en),
    admin = can(session!.actor, "lead_admin");
  const resource = useResource(`enquiry:${route.params.id}`, () =>
      api.enquiry(route.params.id),
    ),
    people = useResource(`enquiry-people:${admin}`, () =>
      admin ? api.people() : Promise.resolve([]),
    ),
    cars = useResource("enquiry-car-options", () => api.cars());
  const [section, setSection] = useState<"next" | "visits" | "history">("next"),
    [form, setForm] = useState<Payload["action"] | null>(null),
    [appointmentId, setAppointmentId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const data = resource.data,
    e = data?.enquiry;
  const field = (
    key: string,
    en: string,
    hindi: string,
    kind: BusinessField["kind"] = "text",
    initial?: string,
    options?: BusinessField["options"],
  ): BusinessField => ({
    key,
    label: tr(en, hindi),
    kind,
    ...(initial !== undefined ? { initial } : {}),
    ...(options ? { options } : {}),
  });
  const fields: BusinessField[] =
    form === "contact"
      ? [
          field(
            "channel",
            "Contact type",
            "संपर्क का तरीका",
            "select",
            "call",
            [
              { id: "call", label: tr("Call", "फोन") },
              { id: "visit", label: tr("Visit", "मुलाकात") },
              { id: "message", label: tr("Message", "संदेश") },
              { id: "other", label: tr("Other", "अन्य") },
            ],
          ),
          field("note", "What happened?", "क्या हुआ?"),
          field(
            "due",
            "Next follow up",
            "अगला संपर्क",
            "date",
            localDateInput(),
          ),
        ]
      : form === "appointment"
        ? [
            field(
              "kind",
              "Visit type",
              "मुलाकात का प्रकार",
              "select",
              "viewing",
              [
                { id: "viewing", label: tr("View a car", "गाड़ी देखें") },
                {
                  id: "inspection",
                  label: tr("Seller inspection", "विक्रेता की गाड़ी जाँचें"),
                },
                { id: "test_drive", label: tr("Test drive", "टेस्ट ड्राइव") },
              ],
            ),
            field("at", "Visit date", "मुलाकात की तारीख", "datetime"),
            field(
              "driver",
              "Driver name · test drive only",
              "चालक का नाम · टेस्ट ड्राइव",
            ),
            field(
              "license",
              "Driver's licence checked · test drive",
              "चालक का लाइसेंस जाँचा · टेस्ट ड्राइव",
              "choice",
            ),
          ]
        : form === "finish_appointment"
          ? [
              field(
                "status",
                "Visit outcome",
                "मुलाकात का परिणाम",
                "select",
                "completed",
                [
                  { id: "completed", label: tr("Completed", "पूरा हुआ") },
                  { id: "cancelled", label: tr("Cancelled", "रद्द हुआ") },
                ],
              ),
              field("outcome", "Feedback / reason", "राय / कारण"),
            ]
          : form === "status"
            ? [
                field(
                  "status",
                  "Enquiry status",
                  "पूछताछ की स्थिति",
                  "select",
                  e?.status === "appointment" ? "open" : e?.status,
                  [
                    { id: "open", label: tr("Open", "खुला") },
                    {
                      id: "negotiation",
                      label: tr("Negotiating", "बातचीत जारी"),
                    },
                    {
                      id: "won",
                      label: tr("Successful / resolved", "सफल / हल हुआ"),
                    },
                    {
                      id: "lost",
                      label: tr("Closed without sale", "बिना सौदे के बंद"),
                    },
                  ],
                ),
                field(
                  "reason",
                  "Reason / promises / finance dependency",
                  "कारण / वादा / फाइनेंस की ज़रूरत",
                ),
              ]
            : form === "assign"
              ? [
                  field(
                    "assigned",
                    "Responsible person",
                    "ज़िम्मेदार व्यक्ति",
                    "select",
                    e?.assignedTo,
                    people.data?.map((p) => ({ id: p.id, label: p.name })) ??
                      [],
                  ),
                  field(
                    "reason",
                    "Reason for reassignment",
                    "काम बदलने का कारण",
                  ),
                ]
              : [
                  field(
                    "car",
                    "Car",
                    "गाड़ी",
                    "select",
                    e?.carId ?? "",
                    cars.data?.items.map((c) => ({
                      id: c.id,
                      label: `${c.make} ${c.model} · ${c.registration}`,
                    })) ?? [],
                  ),
                ];
  async function submit(v: Record<string, string>, version: number) {
    let payload: Payload;
    if (form === "contact")
      payload = {
        action: form,
        channel: v.channel as "call" | "visit" | "message" | "other",
        note: v.note || "",
        nextFollowUpAt: requireFutureDayTimestamp(v.due || ""),
      };
    else if (form === "appointment")
      payload = {
        action: form,
        kind: v.kind as "viewing" | "inspection" | "test_drive",
        scheduledAt: futureLocalDateTimeTimestamp(v.at || ""),
        driverName: v.driver || "",
        licenseChecked: v.license === "yes",
      };
    else if (form === "finish_appointment")
      payload = {
        action: form,
        appointmentId,
        status: v.status === "cancelled" ? "cancelled" : "completed",
        outcome: v.outcome || "",
      };
    else if (form === "status")
      payload = {
        action: form,
        status: v.status as "open" | "negotiation" | "won" | "lost",
        reason: v.reason || "",
      };
    else if (form === "assign")
      payload = {
        action: form,
        assignedTo: v.assigned || "",
        reason: v.reason || "",
      };
    else payload = { action: "link_car", carId: v.car || "" };
    try {
      await sendCommand(
        session!.actor.id,
        `enquiry:${route.params.id}:${form}`,
        { ...payload, expectedVersion: version },
        (body) => api.enquiryCommand(route.params.id, body as EnquiryCommand),
      );
      changed();
      setForm(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      resource.refresh();
      return false;
    }
  }
  return (
    <Workspace
      title={e?.name ?? tr("Enquiry", "पूछताछ")}
      selected={section}
      busy={busy || !!form}
      onChange={setSection}
      items={[
        {
          id: "next",
          label: tr("Next step", "अगला कदम"),
          icon: "person-outline",
        },
        {
          id: "visits",
          label: tr("Visits", "मुलाकात"),
          icon: "calendar-outline",
        },
        { id: "history", label: tr("History", "इतिहास"), icon: "time-outline" },
      ]}
    >
      {form && e ? (
        <BusinessForm
          serverError={error}
          key={`${form}:${appointmentId}`}
          spec={{
            key: `enquiry:${e.id}:${form}:${appointmentId}`,
            title: tr("Update enquiry", "पूछताछ अपडेट करें"),
            submitLabel: tr("Save update", "अपडेट सेव करें"),
            steps: [{ label: tr("Details", "विवरण"), fields }],
          }}
          version={e.version}
          summary={`${e.name} · ${e.phone}`}
          onBusyChange={setBusy}
          onCancel={() => {
            setForm(null);
            setError("");
          }}
          onSubmit={submit}
        />
      ) : (
        <FocusPage
          scrollKey={section}
          footer={
            e && section !== "history" ? (
              <Button
                label={
                  section === "visits"
                    ? tr("Schedule a visit", "मुलाकात तय करें")
                    : tr(
                        "Log contact & next step",
                        "संपर्क और अगला कदम दर्ज करें",
                      )
                }
                onPress={() => {
                  setError("");
                  setForm(section === "visits" ? "appointment" : "contact");
                }}
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
          {!e && !resource.error ? <ActivityIndicator color="#fff" /> : null}
          {e && data ? (
            section === "next" ? (
              <>
                <Panel style={{ gap: 14 }}>
                  <Text style={s.title}>{e.name}</Text>
                  <Text style={{ fontSize: 22 }} selectable>
                    {e.phone}
                  </Text>
                  <Pill
                    label={
                      e.kind === "buyer"
                        ? tr("Wants to buy", "खरीदना चाहते हैं")
                        : tr("Wants to sell", "बेचना चाहते हैं")
                    }
                  />
                  <Text>{e.interest || "—"}</Text>
                  <Text style={s.muted}>
                    {e.source} · {e.assigneeName}
                  </Text>
                  <Text>
                    {e.status} ·{" "}
                    {e.nextFollowUpAt
                      ? formatDateTime(e.nextFollowUpAt, language)
                      : "—"}
                  </Text>
                  <Button
                    secondary
                    icon="call-outline"
                    label={tr("Call", "फोन करें")}
                    onPress={() => {
                      const phone = e.phone.replace(/[^0-9+]/g, "");
                      if (!/^\+?\d{3,15}$/.test(phone)) {
                        setError(
                          tr(
                            "Check the saved phone number.",
                            "सेव किया फोन नंबर जाँचें।",
                          ),
                        );
                        return;
                      }
                      void Linking.openURL(`tel:${phone}`).catch(() =>
                        setError(
                          tr(
                            "Calling is unavailable on this device.",
                            "इस डिवाइस पर फोन नहीं हो सकता।",
                          ),
                        ),
                      );
                    }}
                  />
                </Panel>
                <CardGrid>
                  <Button
                    secondary
                    label={tr(
                      "Change enquiry status",
                      "पूछताछ की स्थिति बदलें",
                    )}
                    onPress={() => setForm("status")}
                  />
                  <Button
                    secondary
                    label={tr("Link a car", "गाड़ी जोड़ें")}
                    onPress={() => setForm("link_car")}
                  />
                  {e.carId ? (
                    <Button
                      secondary
                      label={tr("Open car", "गाड़ी खोलें")}
                      onPress={() =>
                        navigation.navigate("Car", { id: e.carId! })
                      }
                    />
                  ) : null}
                  {admin ? (
                    <Button
                      secondary
                      label={tr("Assign responsibility", "ज़िम्मेदारी सौंपें")}
                      onPress={() => setForm("assign")}
                    />
                  ) : null}
                </CardGrid>
                <Text style={s.muted}>
                  {tr(
                    "Successful enquiry status does not record a purchase, payment or delivery. Complete those steps on the car record.",
                    "सफल पूछताछ से खरीद, भुगतान या डिलीवरी दर्ज नहीं होती। वे कदम गाड़ी के रिकॉर्ड पर पूरे करें।",
                  )}
                </Text>
              </>
            ) : section === "visits" ? (
              <>
                {data.appointments.map((a) => (
                  <Panel key={a.id} style={{ gap: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: "600" }}>
                      {a.kind.replaceAll("_", " ")}
                    </Text>
                    <Text>
                      {new Date(a.scheduledAt).toLocaleString(
                        hi ? "hi-IN" : "en-IN",
                      )}
                    </Text>
                    <Pill label={a.status} />
                    {a.driverName ? (
                      <Text>
                        {a.driverName} ·{" "}
                        {tr("Licence checked", "लाइसेंस जाँचा")}
                      </Text>
                    ) : null}
                    {a.outcome ? <Text>{a.outcome}</Text> : null}
                    {a.status === "scheduled" ? (
                      <Button
                        secondary
                        label={tr(
                          "Record outcome / cancellation",
                          "परिणाम / रद्द दर्ज करें",
                        )}
                        onPress={() => {
                          setAppointmentId(a.id);
                          setForm("finish_appointment");
                        }}
                      />
                    ) : null}
                  </Panel>
                ))}
                {!data.appointments.length ? (
                  <Text>
                    {tr("No visits scheduled.", "कोई मुलाकात तय नहीं।")}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                {data.events.map((event) => (
                  <Panel key={event.id} style={{ gap: 10 }}>
                    <Text>{event.note}</Text>
                    <Text style={s.muted}>
                      {event.recordedByName} ·{" "}
                      {formatDateTime(event.createdAt, language)}
                    </Text>
                  </Panel>
                ))}
              </>
            )
          ) : null}
        </FocusPage>
      )}
    </Workspace>
  );
}
