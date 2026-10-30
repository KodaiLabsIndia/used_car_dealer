import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import type {
  BusinessCommand,
  LedgerEntry,
  SaleBooking,
  VehicleBusiness,
  WarrantyClaim,
} from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { useSection } from "../state/use-section";
import {
  Workspace,
  CarIdentity,
  FocusPage,
  SelectField,
} from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
  type BusinessField,
} from "../components/business-form";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Icon,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Split } from "../components/layout";
import { formatMoney, parseRupees } from "../application/money";
import { localDateInput, paymentTimestamp } from "../application/payment-date";
import { futureDayTimestamp } from "../application/future-date";
import { sendCommand } from "../application/send-command";

type Payload = BusinessCommand extends infer C
  ? C extends BusinessCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
type FormKind =
  | "cost"
  | "book"
  | "cancel_booking"
  | "extend_booking"
  | "sale_receipt"
  | "sale_refund"
  | "sale_documents"
  | "deliver"
  | "complete_transfer"
  | "open_claim"
  | "review_claim"
  | "reverse_entry";
type FormState = {
  kind: FormKind;
  bookingId?: string;
  claimId?: string;
  entryId?: string;
};
const sections = [
  "readiness",
  "costs",
  "booking",
  "money",
  "delivery",
  "warranty",
] as const;
function Money({
  label,
  value,
  hi,
}: {
  label: string;
  value: number;
  hi: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.muted}>{label}</Text>
      <Text
        style={{
          fontSize: 25,
          lineHeight: 34,
          fontWeight: "600",
          color: value < 0 ? "#ffadb3" : "#fff",
        }}
      >
        {formatMoney(value, hi)}
      </Text>
    </View>
  );
}
const readinessHindi: Record<string, string> = {
  purchase: "खरीद समझौता दर्ज",
  receipt: "गाड़ी प्राप्त हुई",
  documents: "मालिकाना और लोन जाँच पूरी",
  pre_purchase: "खरीद से पहले की जाँच मंज़ूर",
  intake: "प्राप्ति जाँच मंज़ूर",
  issues: "सभी समस्याएँ ठीक",
  repairs: "मरम्मत और QC मंज़ूर",
};

export function BusinessScreen({ route, navigation }: ScreenProps<"Business">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    carId = route.params.carId,
    owner = session!.actor.role === "owner";
  const resource = useResource(`business:${carId}`, () =>
    api.vehicleBusiness(carId),
  );
  const [section, setSection] = useSection(
    `business:${carId}`,
    "readiness",
    sections,
  );
  const [form, setForm] = useState<FormState | null>(null),
    [selectedBooking, setSelectedBooking] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [expanded, setExpanded] = useState("");
  const data = resource.data,
    booking =
      data?.bookings.find((b) => b.id === selectedBooking) ??
      data?.bookings.find((b) => b.status === "booked") ??
      data?.bookings.find((b) => b.status === "delivered") ??
      data?.bookings[0];
  const tr = (en: string, hindi: string) => (hi ? hindi : en);
  const date = (value: string) =>
    new Date(value).toLocaleDateString(hi ? "hi-IN" : "en-IN");
  const labels = {
    cost: tr("Record vehicle cost", "गाड़ी का खर्च दर्ज करें"),
    book: tr("Book this car", "बुकिंग करें"),
    cancel_booking: tr("Cancel booking", "बुकिंग रद्द करें"),
    extend_booking: tr("Extend hold", "बुकिंग की अवधि बढ़ाएँ"),
    sale_receipt: tr("Record buyer receipt", "खरीदार से मिली रकम"),
    sale_refund: tr("Record buyer refund", "खरीदार को वापसी दर्ज करें"),
    sale_documents: tr("Delivery documents", "डिलीवरी दस्तावेज़"),
    deliver: tr("Record physical delivery", "गाड़ी की डिलीवरी दर्ज करें"),
    complete_transfer: tr(
      "Record ownership transfer",
      "मालिकाना ट्रांसफर दर्ज करें",
    ),
    open_claim: tr("Log customer concern", "ग्राहक की समस्या दर्ज करें"),
    review_claim: tr("Review warranty claim", "वारंटी अनुरोध पर फैसला"),
    reverse_entry: tr("Correct this entry", "इस एंट्री को ठीक करें"),
  };
  function open(kind: FormKind, extra: Omit<FormState, "kind"> = {}) {
    setError("");
    setNotice("");
    setForm({ kind, ...extra });
  }
  async function run(
    payload: Payload,
    version = data?.car.version,
  ): Promise<boolean> {
    if (!data || version === undefined) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendCommand(
        session!.actor.id,
        `business:${carId}:${payload.action}`,
        { ...payload, expectedVersion: version },
        (body) => api.businessCommand(carId, body as BusinessCommand),
      );
      setForm(null);
      setNotice(tr("Record saved on the server.", "रिकॉर्ड सर्वर पर सेव हुआ।"));
      changed();
      return true;
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function confirmed(payload: Payload, version?: number) {
    const amount =
      "amountPaise" in payload
        ? formatMoney(payload.amountPaise, hi)
        : "salePricePaise" in payload
          ? formatMoney(payload.salePricePaise, hi)
          : "";
    const yes = await new Promise<boolean>((resolve) =>
      Alert.alert(
        tr("Record this change?", "यह बदलाव दर्ज करें?"),
        `${data?.car.make} ${data?.car.model} · ${data?.car.registration}\n${amount}\n${tr("This action will be retained in the car history.", "यह बदलाव गाड़ी के इतिहास में रहेगा।")}`,
        [
          {
            text: tr("Cancel", "रद्द करें"),
            style: "cancel",
            onPress: () => resolve(false),
          },
          { text: tr("Confirm", "पुष्टि करें"), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    return yes ? run(payload, version) : false;
  }
  function specFor(f: FormState): BusinessFormSpec {
    const b = data?.bookings.find((b) => b.id === f.bookingId),
      claim = data?.claims.find((c) => c.id === f.claimId);
    const field = (
      key: string,
      en: string,
      hindi: string,
      kind: BusinessField["kind"] = "text",
      initial?: string,
    ): BusinessField => ({ key, label: tr(en, hindi), kind, initial });
    const step = (en: string, hindi: string, fields: BusinessField[]) => ({
      label: tr(en, hindi),
      fields,
    });
    const amount = field("amount", "Amount in rupees", "रकम · रुपये", "money");
    const reference = field(
      "reference",
      "Bill / payment reference",
      "बिल / भुगतान संदर्भ",
    );
    const reason = field("reason", "Reason / decision", "कारण / फैसला");
    const note = field("note", "Short note (optional)", "छोटा नोट (वैकल्पिक)");
    const day = field("day", "Date", "तारीख", "date", localDateInput());
    let steps: BusinessFormSpec["steps"] = [];
    if (f.kind === "cost")
      steps = [
        step("Cost", "खर्च", [
          {
            ...field(
              "category",
              "Cost category",
              "खर्च का प्रकार",
              "select",
              f.claimId ? "warranty" : "repair",
            ),
            options: (f.claimId
              ? ["warranty"]
              : ["repair", "parts", "transport", "documents", "other"]
            ).map((id) => ({
              id,
              label:
                (
                  {
                    repair: tr("Repair / labour", "मरम्मत / मजदूरी"),
                    parts: tr("Parts", "पार्ट्स"),
                    transport: tr("Transport", "ट्रांसपोर्ट"),
                    documents: tr("Documents", "दस्तावेज़"),
                    other: tr("Other direct cost", "अन्य खर्च"),
                    warranty: tr("Warranty claim", "वारंटी अनुरोध"),
                  } as Record<string, string>
                )[id] ?? id,
            })),
          },
          amount,
          reference,
        ]),
        step("Record", "दर्ज करें", [day, note]),
      ];
    if (f.kind === "book")
      steps = [
        step("Buyer", "खरीदार", [
          field("customer", "Buyer name", "खरीदार का नाम"),
          field("phone", "Phone", "फ़ोन"),
        ]),
        step("Booking", "बुकिंग", [
          field(
            "price",
            "Agreed sale price · rupees",
            "तय बिक्री कीमत · रुपये",
            "money",
          ),
          field("expiry", "Booking expires", "बुकिंग की अंतिम तारीख", "date"),
          field(
            "notReady",
            "I have told the buyer that preparation is pending",
            "मैंने खरीदार को बताया कि गाड़ी तैयार होना बाकी है",
            "choice",
          ),
        ]),
      ];
    if (f.kind === "extend_booking")
      steps = [
        step("Extend hold", "बुकिंग की अवधि बढ़ाएँ", [
          field("expiry", "New expiry", "नई अंतिम तारीख", "date"),
          reason,
        ]),
      ];
    if (f.kind === "sale_receipt" || f.kind === "sale_refund")
      steps = [
        step("Amount", "रकम", [amount, reference]),
        step("Record", "दर्ज करें", [day, note]),
      ];
    if (f.kind === "cancel_booking" || f.kind === "reverse_entry")
      steps = [step("Reason", "कारण", [reason])];
    if (f.kind === "sale_documents")
      steps = [
        step("Checks", "जाँच", [
          field(
            "buyer",
            "Buyer identity checked",
            "खरीदार की पहचान जाँची",
            "choice",
            b?.documents.buyerVerified ? "yes" : "no",
          ),
          field(
            "registration",
            "Registration / transfer documents ready",
            "RC / ट्रांसफर के दस्तावेज़ तैयार",
            "choice",
            b?.documents.registrationReady ? "yes" : "no",
          ),
          field(
            "agreement",
            "Signed sale agreement reference",
            "हस्ताक्षर किए बिक्री समझौते का संदर्भ",
            "text",
            b?.documents.saleAgreementReference,
          ),
        ]),
      ];
    if (f.kind === "deliver")
      steps = [
        step("Handover", "डिलीवरी", [
          field(
            "odometer",
            "Delivery odometer · km",
            "डिलीवरी पर ओडोमीटर · किमी",
            "number",
          ),
          field(
            "receipt",
            "Signed customer handover reference",
            "ग्राहक के हस्ताक्षर वाली डिलीवरी का संदर्भ",
          ),
          field(
            "transferDue",
            "Transfer follow-up",
            "ट्रांसफर फॉलो-अप",
            "date",
          ),
        ]),
        step("Items & promises", "सामान और वादे", [
          field(
            "keys",
            "Keys handed to customer",
            "ग्राहक को दी गई चाबियाँ",
            "number",
          ),
          field("accessories", "Accessories handed over", "दिया गया सामान"),
          field(
            "promises",
            "Remaining promises / follow-ups",
            "बाकी वादे / अगला संपर्क",
          ),
        ]),
        step("Issued policy", "जारी वारंटी", [
          field(
            "provider",
            "Warranty provider · leave blank if none",
            "वारंटी देने वाला · न हो तो खाली रखें",
          ),
          field(
            "policy",
            "Policy version / written reference",
            "पॉलिसी संस्करण / लिखित संदर्भ",
          ),
          field(
            "exclusions",
            "Issued exclusions / limits",
            "जारी अपवाद / सीमाएँ",
          ),
        ]),
        step("Warranty", "वारंटी", [
          field(
            "until",
            "Issued warranty ends",
            "जारी वारंटी की अंतिम तारीख",
            "date",
          ),
          field(
            "kmLimit",
            "Warranty absolute odometer limit (optional)",
            "वारंटी की अंतिम ओडोमीटर रीडिंग (वैकल्पिक)",
            "number",
          ),
          field(
            "terms",
            "Actual issued warranty terms",
            "जारी की गई वारंटी की शर्तें",
          ),
          field(
            "noWarranty",
            "No warranty is issued; customer acknowledgement recorded",
            "वारंटी नहीं दी गई; ग्राहक की स्वीकृति दर्ज है",
            "choice",
          ),
        ]),
        step("Confirm", "पुष्टि", [
          field(
            "customerAck",
            "Customer received car, items, promises and warranty information",
            "ग्राहक को गाड़ी, सामान, वादे और वारंटी की जानकारी मिली",
            "choice",
          ),
          field(
            "training",
            "Training only: acknowledge draft checklists",
            "केवल ट्रेनिंग: ड्राफ्ट चेकलिस्ट की पुष्टि",
            "choice",
          ),
        ]),
      ];
    if (f.kind === "complete_transfer")
      steps = [
        step("Acknowledgement", "प्राप्ति", [
          field(
            "reference",
            "Ownership-transfer acknowledgement reference",
            "मालिकाना ट्रांसफर की प्राप्ति का संदर्भ",
          ),
        ]),
      ];
    if (f.kind === "open_claim")
      steps = [
        step("Concern", "समस्या", [
          field("description", "Customer's concern", "ग्राहक की समस्या"),
          field(
            "odometer",
            "Current odometer · km (leave blank if unknown)",
            "मौजूदा ओडोमीटर · किमी (पता न हो तो खाली रखें)",
            "number",
          ),
        ]),
      ];
    if (f.kind === "review_claim")
      steps = [
        step("Decision", "फैसला", [
          {
            ...field("decision", "Decision", "फैसला", "select", "approve"),
            options: [
              {
                id: "approve",
                label: tr("Approve / revise budget", "मंज़ूरी / बजट बदलें"),
              },
              { id: "reject", label: tr("Reject", "नामंज़ूर") },
            ],
          },
          field(
            "limit",
            "Approved limit · rupees (zero for rejection)",
            "मंज़ूर रकम · रुपये (नामंज़ूरी के लिए शून्य)",
            "money",
            claim?.approvedLimitPaise
              ? String(claim.approvedLimitPaise / 100)
              : "",
          ),
          reason,
        ]),
        step("Confirm", "पुष्टि", [
          field(
            "unknownMileage",
            "I reviewed the unknown mileage; approval is provisional",
            "अज्ञात मीटर की समीक्षा की; मंज़ूरी अस्थायी है",
            "choice",
          ),
          field(
            "goodwill",
            "I explicitly approve goodwill outside the recorded warranty limits",
            "वारंटी सीमा से बाहर सद्भावना खर्च की स्पष्ट मंज़ूरी देता हूँ",
            "choice",
          ),
        ]),
      ];
    return {
      key: `${carId}:${f.kind}:${f.bookingId ?? ""}:${f.claimId ?? ""}:${f.entryId ?? ""}`,
      title: labels[f.kind],
      submitLabel: tr("Review & record", "जाँचकर दर्ज करें"),
      note:
        f.kind === "sale_receipt" || f.kind === "sale_refund"
          ? tr(
              "Record a completed payment. This app does not move money.",
              "पूरा हो चुका भुगतान दर्ज करें। ऐप रकम नहीं भेजता है।",
            )
          : undefined,
      steps,
    };
  }
  async function submit(values: Record<string, string>, version: number) {
    if (!form) return false;
    const f = form;
    const amount = (key: string, zero = false) => {
      const n = parseRupees(values[key] ?? "");
      if (n === null || (!zero && n === 0))
        throw Error(
          tr("Enter a valid amount in rupees.", "रुपये में सही रकम लिखें।"),
        );
      return n;
    };
    const integer = (key: string) => {
      const value = values[key]?.trim();
      if (!/^\d+$/.test(value ?? ""))
        throw Error(
          tr(
            "Enter a whole odometer reading.",
            "ओडोमीटर की पूरी रीडिंग लिखें।",
          ),
        );
      return Number(value);
    };
    const future = (key: string) => {
      const value = futureDayTimestamp(values[key] ?? "");
      if (!value)
        throw Error(
          tr("Choose a valid future date.", "आगे की सही तारीख चुनें।"),
        );
      return value;
    };
    const occurred = () => {
      const value = paymentTimestamp(values.day ?? "");
      if (!value)
        throw Error(
          tr(
            "Check the date. Future payments cannot be recorded.",
            "तारीख जाँचें। आगे का भुगतान दर्ज नहीं कर सकते।",
          ),
        );
      return value;
    };
    let payload: Payload;
    switch (f.kind) {
      case "cost":
        payload = {
          action: "cost",
          category: values.category as Extract<
            Payload,
            { action: "cost" }
          >["category"],
          amountPaise: amount("amount"),
          reference: values.reference ?? "",
          note: values.note ?? "",
          occurredAt: occurred(),
          claimId: f.claimId ?? null,
        };
        break;
      case "book":
        payload = {
          action: "book",
          customerName: values.customer ?? "",
          customerPhone: values.phone ?? "",
          salePricePaise: amount("price"),
          expiresAt: future("expiry"),
          acknowledgeNotReady: values.notReady === "yes",
        };
        break;
      case "cancel_booking":
        payload = {
          action: "cancel_booking",
          bookingId: f.bookingId!,
          reason: values.reason ?? "",
        };
        break;
      case "sale_receipt":
      case "sale_refund":
        payload = {
          action: f.kind,
          bookingId: f.bookingId!,
          amountPaise: amount("amount"),
          reference: values.reference ?? "",
          note: values.note ?? "",
          occurredAt: occurred(),
        };
        break;
      case "sale_documents":
        payload = {
          action: "sale_documents",
          bookingId: f.bookingId!,
          documents: {
            buyerVerified: values.buyer === "yes",
            registrationReady: values.registration === "yes",
            saleAgreementReference: values.agreement ?? "",
          },
        };
        break;
      case "extend_booking":
        payload = {
          action: "extend_booking",
          bookingId: f.bookingId!,
          expiresAt: future("expiry"),
          reason: values.reason ?? "",
        };
        break;
      case "deliver":
        payload = {
          action: "deliver",
          keyCount: integer("keys"),
          accessories: values.accessories ?? "",
          customerPromises: values.promises ?? "",
          customerAcknowledged: values.customerAck === "yes",
          bookingId: f.bookingId!,
          odometerKm: integer("odometer"),
          receiptReference: values.receipt ?? "",
          transferDueAt: future("transferDue"),
          warranty: {
            provider: values.provider ?? "",
            policyReference: values.policy ?? "",
            exclusions: values.exclusions ?? "",
            until: values.until?.trim() ? future("until") : null,
            odometerLimitKm: values.kmLimit?.trim() ? integer("kmLimit") : null,
            terms: values.terms ?? "",
            noWarrantyAcknowledged: values.noWarranty === "yes",
          },
          acknowledgeDraftChecklist: values.training === "yes",
        };
        break;
      case "complete_transfer":
        payload = {
          action: "complete_transfer",
          bookingId: f.bookingId!,
          reference: values.reference ?? "",
        };
        break;
      case "open_claim":
        payload = {
          action: "open_claim",
          bookingId: f.bookingId!,
          description: values.description ?? "",
          odometerKm: values.odometer?.trim() ? integer("odometer") : null,
        };
        break;
      case "review_claim":
        payload = {
          action: "review_claim",
          claimId: f.claimId!,
          decision: values.decision as "approve" | "reject",
          reason: values.reason ?? "",
          approvedLimitPaise: values.limit?.trim() ? amount("limit", true) : 0,
          acknowledgeOutsideTerms: values.goodwill === "yes",
          acknowledgeUnknownMileage: values.unknownMileage === "yes",
        };
        break;
      case "reverse_entry":
        payload = {
          action: "reverse_entry",
          entryId: f.entryId!,
          reason: values.reason ?? "",
        };
        break;
    }
    return confirmed(payload, version);
  }
  function ledger(entries: LedgerEntry[]) {
    return entries.length ? (
      entries.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => setExpanded(expanded === e.id ? "" : e.id)}
          accessibilityRole="button"
          accessibilityLabel={`${e.reference}, ${formatMoney(e.amountPaise, hi)}`}
        >
          <Panel style={{ gap: 10 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{e.reference}</Text>
                <Text style={s.muted}>
                  {date(e.occurredAt)} · {e.recordedByName}
                </Text>
              </View>
              <Text>{formatMoney(e.amountPaise, hi)}</Text>
              <Icon
                name={
                  expanded === e.id
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
              />
            </View>
            {e.reversedAt ? (
              <Pill
                warning
                label={tr(
                  "Corrected · original retained",
                  "सुधारा गया · मूल एंट्री सुरक्षित",
                )}
              />
            ) : null}
            {expanded === e.id ? (
              <>
                <Text>{e.note || e.category}</Text>
                {e.reversalReason ? <Text>{e.reversalReason}</Text> : null}
                {!e.reversedAt ? (
                  <Button
                    secondary
                    label={labels.reverse_entry}
                    icon="return-up-back-outline"
                    onPress={() => open("reverse_entry", { entryId: e.id })}
                  />
                ) : null}
              </>
            ) : null}
          </Panel>
        </Pressable>
      ))
    ) : (
      <Text style={s.muted}>
        {tr("No entries yet.", "अभी कोई एंट्री नहीं।")}
      </Text>
    );
  }
  function bookingPicker() {
    return data && data.bookings.length > 1 ? (
      <SelectField
        label={tr("Booking", "बुकिंग")}
        value={booking?.id ?? ""}
        options={data.bookings.map((b) => ({
          id: b.id,
          label: `${b.customerName} · ${b.status}`,
        }))}
        onChange={setSelectedBooking}
      />
    ) : null;
  }
  function bookingSummary(b: SaleBooking) {
    return (
      <Panel style={{ gap: 12 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontSize: 21, fontWeight: "600", flex: 1 }}>
            {b.customerName}
          </Text>
          <Pill
            warning={b.expired || b.status === "cancelled"}
            label={
              b.expired
                ? tr("Expired", "समय समाप्त")
                : b.status === "booked"
                  ? tr("Booked", "बुकिंग")
                  : b.status === "cancelled"
                    ? tr("Cancelled", "रद्द")
                    : tr("Delivered", "डिलीवरी हुई")
            }
          />
        </View>
        <Text style={s.muted}>
          {b.customerPhone || tr("Phone not recorded", "फ़ोन दर्ज नहीं")}
        </Text>
        <Split
          first={
            <Money
              label={tr("Agreed sale price", "तय बिक्री कीमत")}
              value={b.salePricePaise}
              hi={hi}
            />
          }
          second={
            <Money
              label={
                b.status === "cancelled"
                  ? tr("Refund due", "वापसी बाकी")
                  : tr("Buyer balance", "खरीदार की बाकी रकम")
              }
              value={
                b.status === "cancelled" ? b.refundDuePaise : b.balancePaise
              }
              hi={hi}
            />
          }
        />
        <Text style={s.muted}>
          {tr("Booking expiry", "बुकिंग की अंतिम तारीख")} · {date(b.expiresAt)}
        </Text>
      </Panel>
    );
  }
  function claimPanel(c: WarrantyClaim) {
    return (
      <Panel key={c.id} style={{ gap: 12 }}>
        <Pill label={c.status} warning={c.status === "open"} />
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{c.description}</Text>
        <Text style={s.muted}>
          {c.odometerKm === null
            ? tr("Mileage unknown", "मीटर अज्ञात")
            : `${c.odometerKm.toLocaleString("en-IN")} km`}{" "}
          · {date(c.reportedAt)} · {c.recordedByName}
        </Text>
        <Text>
          {c.coverageObservation === "needs_review"
            ? tr(
                "Mileage is unknown. Coverage requires manual review.",
                "मीटर अज्ञात है। कवरेज की समीक्षा ज़रूरी है।",
              )
            : c.coverageObservation === "within_recorded_limits"
              ? tr(
                  "Within recorded time/km limits. Coverage still requires review.",
                  "दर्ज समय / किमी सीमा के भीतर। कवरेज की जाँच बाकी है।",
                )
              : tr(
                  "Outside recorded warranty limits / no issued warranty. Any goodwill needs explicit approval.",
                  "दर्ज वारंटी सीमा के बाहर / वारंटी नहीं। सद्भावना खर्च की अलग मंज़ूरी चाहिए।",
                )}
        </Text>
        <Text>
          {tr("Approved / actual cost", "मंज़ूर / वास्तविक खर्च")}:{" "}
          {formatMoney(c.approvedLimitPaise, hi)} /{" "}
          {formatMoney(c.actualCostPaise, hi)}
        </Text>
        {c.decisionReason ? (
          <Text style={s.muted}>{c.decisionReason}</Text>
        ) : null}
        {c.status !== "closed" ? (
          <>
            <Button
              secondary
              label={labels.review_claim}
              onPress={() => open("review_claim", { claimId: c.id })}
            />
            {c.status === "approved" ? (
              <>
                <Button
                  secondary
                  label={tr("Open linked repair work", "जुड़ी मरम्मत खोलें")}
                  icon="build-outline"
                  onPress={() => navigation.navigate("Car", { id: carId })}
                />
                <Button
                  secondary
                  label={tr("Record claim cost", "वारंटी का खर्च दर्ज करें")}
                  onPress={() => open("cost", { claimId: c.id })}
                />
                <Button
                  label={tr(
                    "Close after repair QC",
                    "मरम्मत QC के बाद बंद करें",
                  )}
                  disabled={busy || !c.issueResolved}
                  onPress={() =>
                    void confirmed({ action: "close_claim", claimId: c.id })
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </Panel>
    );
  }
  const menu = [
    {
      id: "readiness" as const,
      label: tr("Readiness", "तैयारी"),
      icon: "checkmark-done-outline" as const,
    },
    {
      id: "costs" as const,
      label: tr("Costs", "खर्च"),
      icon: "receipt-outline" as const,
    },
    {
      id: "booking" as const,
      label: tr("Booking", "बुकिंग"),
      icon: "person-add-outline" as const,
    },
    {
      id: "money" as const,
      label: tr("Buyer money", "खरीदार रकम"),
      icon: "wallet-outline" as const,
    },
    {
      id: "delivery" as const,
      label: tr("Delivery", "डिलीवरी"),
      icon: "key-outline" as const,
    },
    {
      id: "warranty" as const,
      label: tr("Support", "सहायता"),
      icon: "shield-checkmark-outline" as const,
    },
  ];
  return (
    <Workspace
      title={tr("Stock, sale & support", "स्टॉक, बिक्री और सहायता")}
      items={menu}
      selected={section}
      busy={busy}
      onChange={(value) => {
        setForm(null);
        setError("");
        setNotice("");
        setSection(value);
      }}
      context={data ? <CarIdentity car={data.car} /> : undefined}
    >
      {!owner ? (
        <FocusPage>
          <Text>{tr("Owner access required.", "मालिक की पहुँच चाहिए।")}</Text>
        </FocusPage>
      ) : !data ? (
        <FocusPage>
          {resource.error ? (
            <ErrorNotice message={resource.error} retry={resource.refresh} />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </FocusPage>
      ) : form ? (
        <BusinessForm
          serverError={error}
          key={`${form.kind}:${form.bookingId ?? ""}:${form.claimId ?? ""}:${form.entryId ?? ""}`}
          spec={specFor(form)}
          version={data.car.version}
          summary={`${tr("Invested", "कुल खर्च")}: ${formatMoney(data.investedPaise, hi)}${booking ? ` · ${booking.customerName} · ${tr("Buyer balance", "खरीदार बाकी")}: ${formatMoney(booking.balancePaise, hi)}` : ""}`}
          onBusyChange={setBusy}
          onCancel={() => setForm(null)}
          onSubmit={submit}
        />
      ) : (
        <FocusPage
          scrollKey={section}
          refreshControl={
            <RefreshControl
              refreshing={resource.loading}
              onRefresh={resource.refresh}
              tintColor="#fff"
            />
          }
          top={
            <>
              {error || resource.error ? (
                <ErrorNotice
                  message={error || resource.error}
                  retry={resource.refresh}
                />
              ) : null}
              {notice ? (
                <Text style={s.muted} accessibilityLiveRegion="polite">
                  {notice}
                </Text>
              ) : null}
              {["booking", "money", "delivery", "warranty"].includes(section)
                ? bookingPicker()
                : null}
            </>
          }
          footer={
            section === "readiness" ? (
              <ActionRow>
                <Button
                  secondary
                  label={tr("Purchase", "खरीद")}
                  onPress={() => navigation.navigate("Purchase", { carId })}
                  style={{ flex: 1 }}
                />
                <Button
                  label={tr("Review readiness", "तैयारी की पुष्टि")}
                  busy={busy}
                  disabled={
                    data.car.stage === "delivered" ||
                    !data.readiness.every((c) => c.clear)
                  }
                  onPress={() => {
                    if (data.draftChecklists)
                      Alert.alert(
                        tr("Training checklists", "ट्रेनिंग चेकलिस्ट"),
                        tr(
                          "These checklists are drafts. Continue only for development training; approved checklists are required for production.",
                          "ये ड्राफ्ट चेकलिस्ट हैं। केवल विकास / ट्रेनिंग के लिए आगे बढ़ें।",
                        ),
                        [
                          { text: tr("Cancel", "रद्द"), style: "cancel" },
                          {
                            text: tr(
                              "Training acknowledgement",
                              "ट्रेनिंग पुष्टि",
                            ),
                            onPress: () =>
                              void confirmed({
                                action: "mark_ready",
                                acknowledgeDraftChecklist: true,
                              }),
                          },
                        ],
                      );
                    else
                      void confirmed({
                        action: "mark_ready",
                        acknowledgeDraftChecklist: false,
                      });
                  }}
                  style={{ flex: 2 }}
                />
              </ActionRow>
            ) : section === "costs" ? (
              <Button
                label={labels.cost}
                icon="add-outline"
                onPress={() => open("cost")}
              />
            ) : section === "booking" &&
              !data.bookings.some((b) => b.status === "booked") &&
              data.car.stage !== "delivered" ? (
              <Button
                label={labels.book}
                icon="person-add-outline"
                onPress={() => open("book")}
              />
            ) : section === "money" &&
              booking &&
              booking.status !== "delivered" ? (
              <Button
                label={
                  booking.status === "cancelled"
                    ? labels.sale_refund
                    : labels.sale_receipt
                }
                disabled={
                  booking.status === "cancelled"
                    ? booking.refundDuePaise === 0
                    : booking.expired || booking.balancePaise === 0
                }
                onPress={() =>
                  open(
                    booking.status === "cancelled"
                      ? "sale_refund"
                      : "sale_receipt",
                    { bookingId: booking.id },
                  )
                }
              />
            ) : section === "delivery" && booking?.status === "booked" ? (
              <Button
                label={labels.deliver}
                onPress={() => open("deliver", { bookingId: booking.id })}
              />
            ) : section === "warranty" && booking?.status === "delivered" ? (
              <Button
                label={labels.open_claim}
                icon="add-outline"
                onPress={() => open("open_claim", { bookingId: booking.id })}
              />
            ) : undefined
          }
        >
          {section === "readiness" ? (
            <>
              <Text style={{ fontSize: 23, fontWeight: "600" }}>
                {tr("Ready means checked.", "तैयार मतलब जाँची हुई।")}
              </Text>
              <Pill
                label={
                  data.car.stage === "ready"
                    ? tr("Marked ready", "तैयार दर्ज")
                    : data.car.stage === "delivered"
                      ? tr("Delivered", "डिलीवरी हुई")
                      : tr("Preparation in progress", "तैयारी जारी")
                }
                warning={data.car.stage !== "ready"}
              />
              {data.readiness.map((c) => (
                <View
                  key={c.id}
                  style={[
                    s.row,
                    {
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderColor: "#333",
                    },
                  ]}
                >
                  <Icon
                    name={
                      c.clear ? "checkmark-circle-outline" : "ellipse-outline"
                    }
                    color={c.clear ? "#b6d4bd" : "#d4b283"}
                  />
                  <Text style={{ flex: 1 }}>
                    {hi ? (readinessHindi[c.id] ?? c.label) : c.label}
                  </Text>
                  <Text style={s.muted}>
                    {c.clear ? tr("Done", "पूरा") : tr("Pending", "बाकी")}
                  </Text>
                </View>
              ))}
              {data.draftChecklists ? (
                <Text style={s.muted}>
                  {tr(
                    "Draft inspection templates are present. Production clearance requires approved versions.",
                    "ड्राफ्ट चेकलिस्ट हैं। उत्पादन के लिए मंज़ूर संस्करण चाहिए।",
                  )}
                </Text>
              ) : null}
              <Button
                secondary
                label={tr("Open inspections & repairs", "जाँच और मरम्मत खोलें")}
                onPress={() => navigation.navigate("Car", { id: carId })}
              />
            </>
          ) : null}
          {section === "costs" ? (
            <>
              <Split
                first={
                  <Panel>
                    <Money
                      label={tr("Purchase commitment", "खरीद की तय रकम")}
                      value={data.purchasePricePaise}
                      hi={hi}
                    />
                  </Panel>
                }
                second={
                  <Panel>
                    <Money
                      label={tr("Actual total invested", "वास्तविक कुल खर्च")}
                      value={data.investedPaise}
                      hi={hi}
                    />
                  </Panel>
                }
              />
              <Text style={s.muted}>
                {tr("Direct costs", "सीधे खर्च")}:{" "}
                {formatMoney(data.runningCostPaise, hi)} ·{" "}
                {tr("Warranty", "वारंटी")}:{" "}
                {formatMoney(data.warrantyCostPaise, hi)}
              </Text>
              {ledger(data.ledger.filter((e) => e.kind === "cost"))}
            </>
          ) : null}
          {section === "booking" ? (
            <>
              {booking ? (
                bookingSummary(booking)
              ) : (
                <Panel>
                  <Text>
                    {tr(
                      "No customer booking recorded.",
                      "ग्राहक की बुकिंग दर्ज नहीं है।",
                    )}
                  </Text>
                </Panel>
              )}
              {booking?.status === "booked" ? (
                <>
                  <Text style={s.muted}>
                    {tr(
                      "Booking and workshop status are tracked independently. Preparation must still clear before delivery.",
                      "बुकिंग और वर्कशॉप की स्थिति अलग रहती हैं। डिलीवरी से पहले तैयारी पूरी चाहिए।",
                    )}
                  </Text>
                  <Button
                    secondary
                    label={labels.extend_booking}
                    icon="time-outline"
                    onPress={() =>
                      open("extend_booking", { bookingId: booking.id })
                    }
                  />
                  <Button
                    secondary
                    label={labels.cancel_booking}
                    icon="close-circle-outline"
                    onPress={() =>
                      open("cancel_booking", { bookingId: booking.id })
                    }
                  />
                </>
              ) : booking?.cancellationReason ? (
                <Text>{booking.cancellationReason}</Text>
              ) : null}
              {booking ? (
                <Money
                  label={tr(
                    "Forecast after recorded costs, before overhead/tax",
                    "दर्ज खर्च के बाद अनुमान, अन्य खर्च / टैक्स से पहले",
                  )}
                  value={booking.salePricePaise - data.investedPaise}
                  hi={hi}
                />
              ) : null}
            </>
          ) : null}
          {section === "money" ? (
            <>
              {booking ? (
                <>
                  {bookingSummary(booking)}
                  <Text style={s.muted}>
                    {tr("Received / refunded", "मिली / वापस की रकम")}:{" "}
                    {formatMoney(booking.collectedPaise, hi)} /{" "}
                    {formatMoney(booking.refundedPaise, hi)}
                  </Text>
                  {ledger(
                    data.ledger.filter((e) => e.bookingId === booking.id),
                  )}
                </>
              ) : (
                <Text>
                  {tr(
                    "Create a booking before recording buyer payments.",
                    "खरीदार का भुगतान दर्ज करने से पहले बुकिंग बनाएँ।",
                  )}
                </Text>
              )}
            </>
          ) : null}
          {section === "delivery" ? (
            <>
              {booking?.status === "booked" ? (
                <>
                  {bookingSummary(booking)}
                  <Panel style={{ gap: 12 }}>
                    <Text>
                      {tr("Delivery PDI", "डिलीवरी PDI")}:{" "}
                      {data.deliveryPdiClear
                        ? tr("Accepted", "मंज़ूर")
                        : tr("Pending", "बाकी")}
                    </Text>
                    <Text>
                      {tr("Seller balance", "विक्रेता की बाकी रकम")}:{" "}
                      {formatMoney(data.sellerBalancePaise, hi)}
                    </Text>
                    <Text>
                      {tr("Documents", "दस्तावेज़")}:{" "}
                      {booking.documents.buyerVerified &&
                      booking.documents.registrationReady &&
                      booking.documents.saleAgreementReference
                        ? tr("Checks recorded", "जाँच दर्ज")
                        : tr("Pending", "बाकी")}
                    </Text>
                    <Button
                      secondary
                      label={labels.sale_documents}
                      onPress={() =>
                        open("sale_documents", { bookingId: booking.id })
                      }
                    />
                    <Button
                      secondary
                      label={tr("Assign delivery PDI", "डिलीवरी PDI दें")}
                      icon="clipboard-outline"
                      onPress={() =>
                        navigation.navigate("AssignInspection", { carId })
                      }
                    />
                  </Panel>
                </>
              ) : booking?.delivery ? (
                <Panel style={{ gap: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: "600" }}>
                    {tr("Delivered to", "डिलीवरी दी गई")} {booking.customerName}
                  </Text>
                  <Text>
                    {date(booking.delivery.deliveredAt)} ·{" "}
                    {booking.delivery.odometerKm.toLocaleString("en-IN")} km
                  </Text>
                  <Text>
                    {booking.delivery.receiptReference} ·{" "}
                    {booking.delivery.recordedByName}
                  </Text>
                  <Pill
                    label={
                      booking.transfer?.status === "completed"
                        ? tr(
                            "Ownership transfer recorded",
                            "मालिकाना ट्रांसफर दर्ज",
                          )
                        : tr(
                            "Transfer follow-up pending",
                            "ट्रांसफर फॉलो-अप बाकी",
                          )
                    }
                    warning={booking.transfer?.status !== "completed"}
                  />
                  {booking.transfer ? (
                    <Text>
                      {tr("Follow-up", "फॉलो-अप")}:{" "}
                      {date(booking.transfer.dueAt)}
                    </Text>
                  ) : null}
                  {booking.transfer?.status === "pending" ? (
                    <Button
                      label={labels.complete_transfer}
                      onPress={() =>
                        open("complete_transfer", { bookingId: booking.id })
                      }
                    />
                  ) : booking.transfer?.reference ? (
                    <Text>{booking.transfer.reference}</Text>
                  ) : null}
                </Panel>
              ) : (
                <Text>
                  {tr(
                    "Choose an open booking to prepare delivery.",
                    "डिलीवरी के लिए चालू बुकिंग चुनें।",
                  )}
                </Text>
              )}
            </>
          ) : null}
          {section === "warranty" ? (
            <>
              {booking?.delivery ? (
                <Panel style={{ gap: 10 }}>
                  <Text style={{ fontSize: 20, fontWeight: "600" }}>
                    {tr("Issued warranty", "जारी वारंटी")}
                  </Text>
                  <Text>
                    {booking.delivery.warranty.until
                      ? `${tr("Until", "तक")} ${date(booking.delivery.warranty.until)}${booking.delivery.warranty.odometerLimitKm !== null ? ` · ${booking.delivery.warranty.odometerLimitKm.toLocaleString("en-IN")} km` : ""}`
                      : tr(
                          "No warranty issued; acknowledgement recorded.",
                          "वारंटी नहीं दी गई; स्वीकृति दर्ज है।",
                        )}
                  </Text>
                  <Text>{booking.delivery.warranty.terms}</Text>
                </Panel>
              ) : (
                <Text>
                  {tr(
                    "Warranty terms are recorded at physical delivery.",
                    "वारंटी की शर्तें डिलीवरी पर दर्ज होती हैं।",
                  )}
                </Text>
              )}
              {data.claims
                .filter((c) => !booking || c.bookingId === booking.id)
                .map(claimPanel)}
            </>
          ) : null}
        </FocusPage>
      )}
    </Workspace>
  );
}
