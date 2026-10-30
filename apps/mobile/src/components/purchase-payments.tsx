import { FormRow } from "./layout";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import type { Purchase, PurchaseCommand } from "@arihant/contracts";
import { Button, ErrorNotice, Panel, Pill, Text, s } from "./ui";
import { Field } from "./forms";
import { DateField } from "./date-field";
import { FocusPage, SectionTabs, StepHeader } from "./workspace";
import { useSection } from "../state/use-section";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { formatMoney, parseRupees } from "../application/money";
import { localDateInput, paymentTimestamp } from "../application/payment-date";
type PaymentPayload = Omit<
  Extract<PurchaseCommand, { action: "payment" }>,
  "commandId" | "expectedVersion"
>;
type Draft = {
  amount: string;
  method: "bank_transfer" | "upi" | "cash";
  reference: string;
  day: string;
};
export function PurchasePayments({
  purchase,
  busy,
  onRecord,
  onCorrect,
}: {
  purchase: Purchase;
  busy: boolean;
  onRecord: (payload: PaymentPayload) => Promise<boolean>;
  onCorrect: (paymentId: string, reason: string) => Promise<boolean>;
}) {
  const { session, language } = useApp(),
    hi = language === "hi",
    ownerId = session!.actor.id,
    key = `payment-form:${purchase.id}`;
  const [mode, setMode] = useSection(`payments:${purchase.id}`, "record", [
    "record",
    "history",
  ] as const);
  const [expanded, setExpanded] = useState("");
  const initial = (): Draft => ({
    amount: "",
    method: "bank_transfer",
    reference: "",
    day: localDateInput(),
  });
  const [draft, setDraft] = useState<Draft>(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [correcting, setCorrecting] = useState(""),
    [reason, setReason] = useState("");
  useEffect(() => {
    let active = true;
    void loadLocal<Draft>(ownerId, key)
      .catch(() => null)
      .then((saved) => {
        if (active) {
          if (saved) setDraft(saved);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ownerId, key]);
  function edit<K extends keyof Draft>(field: K, value: Draft[K]) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    void saveLocal(ownerId, key, next);
  }
  function confirmRecord() {
    const amountPaise = parseRupees(draft.amount),
      paidAt = paymentTimestamp(draft.day);
    if (!amountPaise || !paidAt || !draft.reference.trim()) {
      setError(
        hi
          ? "रकम, संदर्भ और तारीख जाँचें।"
          : "Check the amount, reference and completed payment date.",
      );
      return;
    }
    if (amountPaise > purchase.balancePaise) {
      setError(
        hi
          ? "रकम बाकी भुगतान से ज़्यादा है।"
          : "This exceeds the remaining balance.",
      );
      return;
    }
    setError("");
    Alert.alert(
      hi ? "भुगतान दर्ज करें?" : "Record this payment?",
      `${formatMoney(amountPaise, hi)} · ${draft.reference}\n${hi ? "केवल पहले से किया गया भुगतान दर्ज करें। ऐप पैसे नहीं भेजता।" : "Record a payment already made. The app does not transfer money."}`,
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "दर्ज करें" : "Record payment",
          onPress: () => {
            void onRecord({
              action: "payment",
              amountPaise,
              method: draft.method,
              reference: draft.reference.trim(),
              paidAt,
            }).then(async (success) => {
              if (success) {
                setDraft(initial());
                await deleteLocal(ownerId, key);
              }
            });
          },
        },
      ],
    );
  }
  async function correct(paymentId: string) {
    if (reason.trim().length < 3) {
      setError(
        hi
          ? "सुधार का कारण लिखें।"
          : "Enter the reason for correcting this entry.",
      );
      return;
    }
    Alert.alert(
      hi ? "गलत रिकॉर्ड सुधारें?" : "Correct a mistaken entry?",
      hi
        ? "पुराना रिकॉर्ड रहेगा। यह पैसे वापस नहीं भेजता। सही भुगतान अलग से दर्ज करें।"
        : "The original entry is retained. This does not refund money. Record the correct payment afterward.",
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "रिकॉर्ड सुधारें" : "Correct entry",
          onPress: () => {
            void onCorrect(paymentId, reason.trim()).then((success) => {
              if (success) {
                setCorrecting("");
                setReason("");
                setError("");
              }
            });
          },
        },
      ],
    );
  }
  const methodLabel = {
    bank_transfer: hi ? "बैंक ट्रांसफ़र" : "Bank transfer",
    upi: "UPI",
    cash: hi ? "नकद" : "Cash",
  };
  return (
    <FocusPage
      scrollKey={mode}
      top={
        <StepHeader
          labels={[
            hi ? "भुगतान दर्ज" : "Record payment",
            hi ? "इतिहास" : "History",
          ]}
          current={mode === "record" ? 0 : 1}
          onSelect={(i) => {
            if (!busy) {
              setMode(i === 0 ? "record" : "history");
              setError("");
            }
          }}
          disabled={busy}
        />
      }
      footer={
        mode === "record" &&
        purchase.approvalValid &&
        purchase.balancePaise > 0 ? (
          <Button
            label={
              hi ? "किया गया भुगतान दर्ज करें" : "Record completed payment"
            }
            icon="wallet-outline"
            busy={busy}
            disabled={!ready}
            onPress={confirmRecord}
          />
        ) : undefined
      }
    >
      {error ? <ErrorNotice message={error} /> : null}
      {mode === "record" ? (
        <>
          <Panel>
            <FormRow>
              <View style={{ flex: 1 }}>
                <Text style={s.muted}>{hi ? "दर्ज भुगतान" : "Recorded"}</Text>
                <Text
                  style={{ fontSize: 22, lineHeight: 30, fontWeight: "600" }}
                >
                  {formatMoney(purchase.paidPaise, hi)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.muted}>{hi ? "बाकी" : "Balance"}</Text>
                <Text
                  style={{ fontSize: 22, lineHeight: 30, fontWeight: "600" }}
                >
                  {formatMoney(purchase.balancePaise, hi)}
                </Text>
              </View>
            </FormRow>
          </Panel>
          {!purchase.approvalValid ? (
            <Text style={{ color: "#ffc283" }}>
              {hi
                ? "नया भुगतान दर्ज करने से पहले मौजूदा शर्तों की मंज़ूरी चाहिए।"
                : "Current terms need approval before another payment can be recorded."}
            </Text>
          ) : purchase.balancePaise === 0 ? (
            <Pill label={hi ? "पूरी रकम दर्ज है" : "Full amount recorded"} />
          ) : (
            <>
              <FormRow>
                <View style={{ flex: 1 }}>
                  <Field
                    label={hi ? "रकम ₹" : "Amount ₹"}
                    value={draft.amount}
                    onChangeText={(v) => edit("amount", v)}
                    keyboardType="decimal-pad"
                    maxLength={18}
                    editable={!busy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField
                    label={hi ? "तारीख" : "Paid on"}
                    value={draft.day}
                    onChange={(v) => edit("day", v)}
                    disabled={busy}
                  />
                </View>
              </FormRow>
              <Text style={s.muted}>
                {hi ? "भुगतान का तरीका" : "Payment method"}
              </Text>
              <SectionTabs
                items={[
                  {
                    id: "bank_transfer",
                    label: hi ? "बैंक" : "Bank",
                    icon: "business-outline",
                  },
                  { id: "upi", label: "UPI", icon: "phone-portrait-outline" },
                  {
                    id: "cash",
                    label: hi ? "नकद" : "Cash",
                    icon: "cash-outline",
                  },
                ]}
                selected={draft.method}
                onChange={(value) => edit("method", value)}
                disabled={busy}
              />
              <Field
                label={
                  draft.method === "cash"
                    ? hi
                      ? "कैश वाउचर संदर्भ"
                      : "Cash voucher reference"
                    : hi
                      ? "ट्रांज़ैक्शन संदर्भ"
                      : "Transaction reference"
                }
                value={draft.reference}
                onChangeText={(v) => edit("reference", v)}
                autoCapitalize="characters"
                maxLength={120}
                editable={!busy}
              />
              <Text style={s.muted}>
                {hi
                  ? "केवल पहले से किया गया भुगतान दर्ज करें। ऐप पैसे नहीं भेजता।"
                  : "Record a payment already made. The app does not transfer money."}
              </Text>
            </>
          )}
        </>
      ) : (
        <>
          {purchase.payments.map((p) => (
            <Panel key={p.id} style={{ gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expanded === p.id }}
                onPress={() => {
                  if (!busy) {
                    setExpanded((v) => (v === p.id ? "" : p.id));
                    setCorrecting("");
                  }
                }}
                style={{ minHeight: 48, gap: 6 }}
              >
                <View
                  style={[
                    s.row,
                    { justifyContent: "space-between", flexWrap: "wrap" },
                  ]}
                >
                  <Text
                    style={{ fontSize: 22, lineHeight: 30, fontWeight: "600" }}
                  >
                    {formatMoney(p.amountPaise, hi)}
                  </Text>
                  {p.reversedAt ? (
                    <Pill label={hi ? "सुधारा गया" : "Corrected"} warning />
                  ) : null}
                </View>
                <Text style={s.muted}>
                  {methodLabel[p.method]} ·{" "}
                  {new Date(p.paidAt).toLocaleDateString(
                    hi ? "hi-IN" : "en-IN",
                  )}{" "}
                  · {expanded === p.id ? "−" : "+"}
                </Text>
              </Pressable>
              {expanded === p.id ? (
                <>
                  <Text selectable>{p.reference}</Text>
                  <Text style={s.muted}>{p.recordedByName}</Text>
                  {p.reversalReason ? (
                    <Text>
                      {p.reversalReason} · {p.reversedByName}
                    </Text>
                  ) : correcting === p.id ? (
                    <>
                      <Field
                        label={hi ? "सुधार का कारण" : "Reason for correction"}
                        value={reason}
                        onChangeText={setReason}
                        maxLength={1000}
                        multiline
                        editable={!busy}
                      />
                      <Button
                        label={hi ? "सुधार दर्ज करें" : "Record correction"}
                        secondary
                        busy={busy}
                        onPress={() => void correct(p.id)}
                      />
                      <Button
                        label={hi ? "रद्द करें" : "Cancel"}
                        secondary
                        disabled={busy}
                        onPress={() => setCorrecting("")}
                      />
                    </>
                  ) : (
                    <Button
                      label={
                        hi ? "गलत रिकॉर्ड सुधारें" : "Correct mistaken entry"
                      }
                      secondary
                      icon="refresh-outline"
                      disabled={busy}
                      onPress={() => {
                        setCorrecting(p.id);
                        setReason("");
                      }}
                    />
                  )}
                </>
              ) : null}
            </Panel>
          ))}
          {!purchase.payments.length ? (
            <Text style={s.muted}>
              {hi ? "कोई भुगतान दर्ज नहीं है।" : "No payments recorded."}
            </Text>
          ) : null}
        </>
      )}
    </FocusPage>
  );
}
