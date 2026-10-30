import { formatDateTime } from "../components/date-format";
import React, { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import type { StockCommand } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage, CarIdentity } from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
  type BusinessField,
} from "../components/business-form";
import { Button, ErrorNotice, Panel, Pill, Text, s } from "../components/ui";
import { can } from "../application/access";
import { sendCommand } from "../application/send-command";

type Payload = StockCommand extends infer C
  ? C extends StockCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
export function StockScreen({ route }: ScreenProps<"Stock">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    tr = (en: string, hindi: string) => (hi ? hindi : en),
    coordinator = can(session!.actor, "service"),
    reviewer = can(session!.actor, "review_inspection");
  const resource = useResource(`stock:${route.params.carId}`, () =>
      api.stock(route.params.carId),
    ),
    people = useResource(`custody-people:${coordinator}`, () =>
      coordinator ? api.people() : Promise.resolve([]),
    ),
    workshops = useResource(`custody-workshops:${coordinator}`, () =>
      coordinator ? api.workshops() : Promise.resolve([]),
    );
  const [section, setSection] = useState<"location" | "holds" | "history">(
      "location",
    ),
    [form, setForm] = useState<"move" | "hold" | "release_hold" | null>(null),
    [holdId, setHoldId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const data = resource.data;
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
  const kinds = [
    { id: "yard", label: tr("Dealership / yard", "डीलरशिप / यार्ड") },
    { id: "workshop", label: tr("Workshop", "वर्कशॉप") },
    { id: "test_drive", label: tr("Test drive", "टेस्ट ड्राइव") },
    {
      id: "customer",
      label: tr("Customer after delivery", "डिलीवरी के बाद ग्राहक"),
    },
  ];
  const spec: BusinessFormSpec = {
    key: `stock:${route.params.carId}:${form}:${holdId}`,
    title:
      form === "move"
        ? tr("Record custody handover", "गाड़ी सौंपना दर्ज करें")
        : form === "hold"
          ? tr("Place a stock hold", "गाड़ी पर रोक लगाएँ")
          : tr("Resolve stock hold", "गाड़ी की रोक हटाएँ"),
    submitLabel: tr("Confirm & record", "पुष्टि करके दर्ज करें"),
    steps:
      form === "move"
        ? [
            {
              label: tr("Where", "कहाँ"),
              fields: [
                field(
                  "kind",
                  "Destination type",
                  "स्थान का प्रकार",
                  "select",
                  "yard",
                  kinds,
                ),
                field("location", "Receiving location", "जहाँ गाड़ी पहुँचेगी"),
                field(
                  "workshop",
                  "Workshop · when applicable",
                  "वर्कशॉप · यदि लागू हो",
                  "select",
                  undefined,
                  workshops.data?.map((w) => ({ id: w.id, label: w.name })) ??
                    [],
                ),
                field(
                  "appointment",
                  "Test drive · when applicable",
                  "टेस्ट ड्राइव · यदि लागू हो",
                  "select",
                  undefined,
                  data?.testDrives.map((a) => ({
                    id: a.id,
                    label: `${a.driverName} · ${formatDateTime(a.scheduledAt, language)}`,
                  })) ?? [],
                ),
              ],
            },
            {
              label: tr("Who", "कौन"),
              fields: [
                field(
                  "custodian",
                  "Responsible staff member",
                  "ज़िम्मेदार कर्मचारी",
                  "select",
                  session!.actor.id,
                  people.data?.map((p) => ({ id: p.id, label: p.name })) ?? [],
                ),
                field(
                  "receiver",
                  "Person receiving the car",
                  "गाड़ी लेने वाला व्यक्ति",
                ),
                field(
                  "ack",
                  "Receiver confirmed the handover",
                  "लेने वाले ने गाड़ी प्राप्त करने की पुष्टि की",
                  "choice",
                ),
              ],
            },
            {
              label: tr("Condition", "हालत"),
              fields: [
                field(
                  "odometer",
                  "Odometer · km",
                  "मीटर · किमी",
                  "number",
                  String(data?.car.odometerKm ?? ""),
                ),
                field("keys", "Keys handed over", "सौंपी गई चाबियाँ", "number"),
                field(
                  "fuel",
                  "Fuel · percent, 0 to 100",
                  "ईंधन · प्रतिशत, 0 से 100",
                  "number",
                ),
                field("note", "Condition / items / note", "हालत / सामान / नोट"),
              ],
            },
          ]
        : [
            {
              label: tr("Details", "विवरण"),
              fields:
                form === "hold"
                  ? [
                      field(
                        "kind",
                        "Hold type",
                        "रोक का प्रकार",
                        "select",
                        "safety",
                        [
                          { id: "safety", label: tr("Safety", "सुरक्षा") },
                          {
                            id: "documents",
                            label: tr("Documents", "कागज़ात"),
                          },
                          { id: "other", label: tr("Other", "अन्य") },
                        ],
                      ),
                      field(
                        "reason",
                        "What needs attention?",
                        "क्या ठीक करना है?",
                      ),
                    ]
                  : [
                      field(
                        "resolution",
                        "What cleared the hold?",
                        "रोक हटाने के लिए क्या किया गया?",
                      ),
                    ],
            },
          ],
  };
  async function submit(v: Record<string, string>, version: number) {
    const integer = (key: string) => {
      const value = Number(v[key]);
      if (!v[key]?.trim() || !Number.isInteger(value))
        throw Error(
          tr(
            "Enter whole numbers for odometer, keys and fuel.",
            "मीटर, चाबियाँ और ईंधन में पूर्ण संख्या लिखें।",
          ),
        );
      return value;
    };
    const payload: Payload =
      form === "hold"
        ? {
            action: "hold",
            kind: v.kind as "safety" | "documents" | "other",
            reason: v.reason || "",
          }
        : form === "release_hold"
          ? { action: "release_hold", holdId, resolution: v.resolution || "" }
          : {
              action: "move",
              toKind: v.kind as "yard" | "workshop" | "test_drive" | "customer",
              toLocation: v.location || "",
              custodianId: v.custodian || "",
              receiverName: v.receiver || "",
              receiverAcknowledged: v.ack === "yes",
              odometerKm: integer("odometer"),
              keysCount: integer("keys"),
              fuelPercent: integer("fuel"),
              note: v.note || "",
              workshopId: v.kind === "workshop" ? v.workshop || null : null,
              appointmentId:
                v.kind === "test_drive" ? v.appointment || null : null,
            };
    const yes = await new Promise<boolean>((resolve) =>
      Alert.alert(
        tr("Record this change?", "यह बदलाव दर्ज करें?"),
        `${data?.car.make} ${data?.car.model} · ${data?.car.registration}\n${form === "move" ? tr("Confirm the car, receiving person, keys and meter reading.", "गाड़ी, लेने वाला व्यक्ति, चाबियाँ और मीटर जाँचें।") : tr("Holds prevent readiness and delivery until a supervisor resolves them.", "सुपरवाइज़र रोक हटाने तक गाड़ी तैयार या डिलीवर नहीं हो सकती।")}`,
        [
          {
            text: tr("Cancel", "रद्द"),
            style: "cancel",
            onPress: () => resolve(false),
          },
          { text: tr("Confirm", "पुष्टि"), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!yes) return false;
    setError("");
    try {
      await sendCommand(
        session!.actor.id,
        `stock:${route.params.carId}:${form}:${holdId}`,
        { ...payload, expectedVersion: version },
        (body) => api.stockCommand(route.params.carId, body as StockCommand),
      );
      changed();
      setForm(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
      return false;
    }
  }
  return (
    <Workspace
      title={tr("Location & custody", "स्थान और ज़िम्मेदारी")}
      context={
        data ? (
          <CarIdentity car={data.car} detail={data.car.location} />
        ) : undefined
      }
      selected={section}
      busy={busy || !!form}
      onChange={setSection}
      items={[
        {
          id: "location",
          label: tr("Location", "स्थान"),
          icon: "location-outline",
        },
        {
          id: "holds",
          label: tr("Holds", "रोक"),
          icon: "hand-left-outline",
          badge: String(data?.holds.filter((h) => !h.resolvedAt).length ?? 0),
        },
        {
          id: "history",
          label: tr("Movements", "आवाजाही"),
          icon: "swap-horizontal-outline",
        },
      ]}
    >
      {form && data ? (
        <BusinessForm
          key={spec.key}
          spec={spec}
          serverError={error}
          version={data.car.version}
          summary={data.car.registration}
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
            data && section !== "history" ? (
              <Button
                label={
                  section === "location"
                    ? tr("Record a handover", "गाड़ी सौंपना दर्ज करें")
                    : tr("Place a hold", "रोक लगाएँ")
                }
                disabled={section === "location" && !coordinator}
                icon={
                  section === "location"
                    ? "swap-horizontal-outline"
                    : "hand-left-outline"
                }
                onPress={() => {
                  setError("");
                  setForm(section === "location" ? "move" : "hold");
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
          {!data && !resource.error ? <ActivityIndicator color="#fff" /> : null}
          {data ? (
            section === "location" ? (
              <>
                <Panel style={{ gap: 14 }}>
                  <Text style={s.title}>{data.car.location}</Text>
                  <Pill
                    label={
                      kinds.find((k) => k.id === data.custodyKind)?.label ??
                      data.custodyKind
                    }
                  />
                  <Text>
                    {data.custodianName ??
                      tr(
                        "No custody handover recorded yet",
                        "अभी गाड़ी सौंपने का रिकॉर्ड नहीं",
                      )}
                  </Text>
                  <Text style={s.muted}>
                    {tr("Last saved meter", "आखिरी दर्ज मीटर")} ·{" "}
                    {data.car.odometerKm?.toLocaleString("en-IN") ?? "—"} km
                  </Text>
                </Panel>
                {data.movements[0] ? (
                  <Panel style={{ gap: 12 }}>
                    <Text>
                      {tr("Last received by", "आखिरी बार प्राप्त करने वाला")} ·{" "}
                      {data.movements[0].receiverName}
                    </Text>
                    <Text>
                      {data.movements[0].keysCount} {tr("keys", "चाबियाँ")} ·{" "}
                      {data.movements[0].fuelPercent}% {tr("fuel", "ईंधन")}
                    </Text>
                    <Text style={s.muted}>
                      {formatDateTime(data.movements[0].createdAt, language)} ·{" "}
                      {data.movements[0].recordedByName}
                    </Text>
                  </Panel>
                ) : null}
                <Text style={s.muted}>
                  {tr(
                    "This records a handover observation. It does not track the car continuously.",
                    "यह गाड़ी सौंपते समय की जानकारी है। गाड़ी की लगातार ट्रैकिंग नहीं होती।",
                  )}
                </Text>
              </>
            ) : section === "holds" ? (
              <>
                {data.holds.map((h) => (
                  <Panel key={h.id} style={{ gap: 12 }}>
                    <Pill
                      label={
                        h.resolvedAt
                          ? tr("Resolved", "हल हुआ")
                          : tr("Delivery blocked", "डिलीवरी पर रोक")
                      }
                      warning={!h.resolvedAt}
                    />
                    <Text style={{ fontSize: 20, fontWeight: "600" }}>
                      {h.reason}
                    </Text>
                    <Text style={s.muted}>
                      {h.recordedByName} ·{" "}
                      {formatDateTime(h.createdAt, language)}
                    </Text>
                    {h.resolvedAt ? (
                      <Text>
                        {h.resolution} · {h.resolvedByName}
                      </Text>
                    ) : reviewer ? (
                      <Button
                        secondary
                        label={tr("Resolve this hold", "यह रोक हटाएँ")}
                        onPress={() => {
                          setHoldId(h.id);
                          setForm("release_hold");
                        }}
                      />
                    ) : null}
                  </Panel>
                ))}
                {!data.holds.length ? (
                  <Text>{tr("No stock holds.", "गाड़ी पर कोई रोक नहीं।")}</Text>
                ) : null}
              </>
            ) : (
              <>
                {data.movements.map((m) => (
                  <Panel key={m.id} style={{ gap: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: "600" }}>
                      {m.fromLocation} → {m.toLocation}
                    </Text>
                    <Text>
                      {m.receiverName} · {m.custodianName}
                    </Text>
                    <Text>
                      {m.odometerKm.toLocaleString("en-IN")} km · {m.keysCount}{" "}
                      {tr("keys", "चाबियाँ")} · {m.fuelPercent}%{" "}
                      {tr("fuel", "ईंधन")}
                    </Text>
                    {m.note ? <Text>{m.note}</Text> : null}
                    <Text style={s.muted}>
                      {m.recordedByName} ·{" "}
                      {formatDateTime(m.createdAt, language)}
                    </Text>
                  </Panel>
                ))}
                {!data.movements.length ? (
                  <Text>
                    {tr("No movements recorded.", "अभी कोई आवाजाही दर्ज नहीं।")}
                  </Text>
                ) : null}
              </>
            )
          ) : null}
        </FocusPage>
      )}
    </Workspace>
  );
}
