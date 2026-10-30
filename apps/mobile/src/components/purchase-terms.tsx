import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  purchaseTermsSchema,
  type Car,
  type Purchase,
  type PurchaseTerms,
} from "@arihant/contracts";
import { Field } from "./forms";
import { Split } from "./layout";
import { FocusPage, StepHeader } from "./workspace";
import { useSection } from "../state/use-section";
import { ActionRow, Button, ErrorNotice, Panel, Text, s } from "./ui";
import { useApp } from "../state/app-context";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";
import { sendCommand } from "../application/send-command";
import { formatMoney, parseRupees, rupeeInput } from "../application/money";
type Form = {
  sellerName: string;
  sellerPhone: string;
  asking: string;
  price: string;
  resale: string;
  repair: string;
  expenses: string;
  notes: string;
};
type Draft = { form: Form; baseVersion: number; purchaseId: string | null };
const empty: Form = {
  sellerName: "",
  sellerPhone: "",
  asking: "",
  price: "",
  resale: "",
  repair: "0",
  expenses: "0",
  notes: "",
};
function fromTerms(terms: PurchaseTerms): Form {
  return {
    sellerName: terms.sellerName,
    sellerPhone: terms.sellerPhone,
    asking:
      terms.askingPricePaise === null ? "" : rupeeInput(terms.askingPricePaise),
    price: rupeeInput(terms.purchasePricePaise),
    resale: rupeeInput(terms.expectedResalePaise),
    repair: rupeeInput(terms.repairBudgetPaise),
    expenses: rupeeInput(terms.directExpensesPaise),
    notes: terms.notes,
  };
}
export function PurchaseTermsForm({
  car,
  purchase,
  onSaved,
  refresh,
  onBusyChange,
}: {
  car: Car;
  purchase: Purchase | null;
  onSaved: () => void;
  refresh: () => void;
  onBusyChange?: (value: boolean) => void;
}) {
  const { api, session, language } = useApp(),
    hi = language === "hi",
    ownerId = session!.actor.id,
    key = `purchase-form:${car.id}`;
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const steps = ["seller", "price", "confirm"] as const;
  const [step, setStep] = useSection(`valuation:${car.id}`, "seller", steps);
  const fresh = (): Draft => ({
    form: purchase ? fromTerms(purchase.terms) : empty,
    baseVersion: purchase?.version ?? car.version,
    purchaseId: purchase?.id ?? null,
  });
  useEffect(() => {
    let active = true;
    void loadLocal<Draft>(ownerId, key)
      .catch(() => null)
      .then((saved) => {
        if (active)
          setDraft(
            saved && saved.purchaseId === (purchase?.id ?? null)
              ? saved
              : fresh(),
          );
      });
    return () => {
      active = false;
    };
  }, [ownerId, key, purchase?.id]);
  function edit(field: keyof Form, value: string) {
    if (!draft) return;
    const next = { ...draft, form: { ...draft.form, [field]: value } };
    setDraft(next);
    void saveLocal(ownerId, key, next).catch(() =>
      setError(
        hi
          ? "ड्राफ्ट सेव नहीं हुआ। दोबारा कोशिश करें।"
          : "Could not save the draft. Please try again.",
      ),
    );
  }
  function reload() {
    const next = fresh();
    setDraft(next);
    setError("");
    void saveLocal(ownerId, key, next);
  }
  async function save() {
    if (!draft) return;
    setError("");
    const f = draft.form;
    const result = purchaseTermsSchema.safeParse({
      sellerName: f.sellerName,
      sellerPhone: f.sellerPhone,
      askingPricePaise: f.asking.trim() ? parseRupees(f.asking) : null,
      purchasePricePaise: parseRupees(f.price),
      expectedResalePaise: parseRupees(f.resale),
      repairBudgetPaise: parseRupees(f.repair),
      directExpensesPaise: parseRupees(f.expenses),
      notes: f.notes,
    });
    if (
      !result.success ||
      (f.asking.trim() && parseRupees(f.asking) === null)
    ) {
      setStep(
        !f.sellerName.trim() ||
          (f.asking.trim() && parseRupees(f.asking) === null)
          ? "seller"
          : "price",
      );
      setError(
        hi
          ? "नाम और रकम जाँचें। रुपये में रकम लिखें, पैसे के लिए दो दशमलव तक।"
          : "Check the seller name and amounts. Enter rupees, with up to two decimal places.",
      );
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      if (purchase)
        await sendCommand(
          ownerId,
          `purchase-revise:${purchase.id}`,
          {
            action: "revise" as const,
            expectedVersion: draft.baseVersion,
            terms: result.data,
          },
          (body) => api.purchaseCommand(purchase.id, body),
        );
      else
        await sendCommand(
          ownerId,
          `purchase-create:${car.id}`,
          { expectedVersion: draft.baseVersion, terms: result.data },
          (body) => api.createPurchase(car.id, body),
        );
      await deleteLocal(ownerId, key);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      refresh();
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  if (!draft) return <ActivityIndicator color="#fff" />;
  const f = draft.form,
    stale = draft.baseVersion !== (purchase?.version ?? car.version),
    editable =
      !purchase || ["draft", "rejected", "approved"].includes(purchase.status);
  const values = [f.price, f.resale, f.repair, f.expenses].map(parseRupees);
  const forecast = values.every((v) => v !== null)
    ? values[1]! - values[0]! - values[2]! - values[3]!
    : null;
  const current = steps.indexOf(step);
  function go(index: number) {
    if (busy) return;
    if (index > current) {
      if (
        !f.sellerName.trim() ||
        (f.asking.trim() && parseRupees(f.asking) === null)
      ) {
        setError(
          hi
            ? "विक्रेता का नाम और माँगी गई कीमत जाँचें।"
            : "Check the seller name and asking price.",
        );
        setStep("seller");
        return;
      }
      if (
        index > 1 &&
        (values.some((v) => v === null) || !values[0] || !values[1])
      ) {
        setError(
          hi ? "कीमत और खर्च जाँचें।" : "Check the prices and cost estimates.",
        );
        setStep("price");
        return;
      }
    }
    setError("");
    setStep(steps[index]!);
  }
  return (
    <FocusPage
      scrollKey={step}
      top={
        <StepHeader
          labels={[
            hi ? "विक्रेता" : "Seller",
            hi ? "कीमत" : "Price",
            hi ? "पुष्टि" : "Confirm",
          ]}
          current={current}
          onSelect={go}
          disabled={busy}
        />
      }
      footer={
        <ActionRow>
          {current > 0 ? (
            <Button
              label={hi ? "पीछे" : "Back"}
              secondary
              disabled={busy}
              onPress={() => go(current - 1)}
              style={{ flex: 1 }}
            />
          ) : null}
          {current < 2 ? (
            <Button
              label={hi ? "आगे" : "Next"}
              icon="arrow-forward-outline"
              disabled={!draft || busy}
              onPress={() => go(current + 1)}
              style={{ flex: 2 }}
            />
          ) : editable ? (
            <Button
              label={
                purchase?.status === "approved"
                  ? hi
                    ? "सेव करें · फिर मंज़ूरी"
                    : "Save · reapproval required"
                  : hi
                    ? "प्रस्ताव सेव करें"
                    : "Save proposal"
              }
              icon="save-outline"
              busy={busy}
              disabled={stale}
              onPress={() => void save()}
              style={{ flex: 2 }}
            />
          ) : null}
        </ActionRow>
      }
    >
      {error ? <ErrorNotice message={error} /> : null}
      {stale ? (
        <Panel style={{ gap: 10 }}>
          <Text>
            {hi
              ? "इस ड्राफ्ट के बाद रिकॉर्ड बदला है। ताज़ा जानकारी देखें।"
              : "The saved record changed after this draft. Review the latest terms before saving."}
          </Text>
          <Button
            label={hi ? "ताज़ा जानकारी लें" : "Use latest saved terms"}
            secondary
            onPress={reload}
          />
        </Panel>
      ) : null}
      {step === "seller" ? (
        <Panel style={{ gap: 14 }}>
          <Field
            label={hi ? "विक्रेता का नाम" : "Seller name"}
            value={f.sellerName}
            onChangeText={(v) => edit("sellerName", v)}
            editable={editable && !busy}
            maxLength={120}
          />
          <Field
            label={hi ? "फ़ोन (वैकल्पिक)" : "Phone (optional)"}
            value={f.sellerPhone}
            onChangeText={(v) => edit("sellerPhone", v)}
            editable={editable && !busy}
            keyboardType="phone-pad"
            maxLength={30}
          />
          <Field
            label={
              hi ? "माँगी गई कीमत ₹ (वैकल्पिक)" : "Asking price ₹ (optional)"
            }
            value={f.asking}
            onChangeText={(v) => edit("asking", v)}
            editable={editable && !busy}
            keyboardType="decimal-pad"
            maxLength={18}
          />
        </Panel>
      ) : null}
      {step === "price" ? (
        <>
          <Split
            first={
              <Panel style={{ gap: 14 }}>
                {(
                  [
                    [
                      "price",
                      hi ? "तय खरीद कीमत ₹" : "Agreed purchase price ₹",
                    ],
                    [
                      "resale",
                      hi ? "अनुमानित बिक्री कीमत ₹" : "Expected resale price ₹",
                    ],
                  ] as const
                ).map(([field, label]) => (
                  <Field
                    key={field}
                    label={label}
                    value={f[field]}
                    onChangeText={(v) => edit(field, v)}
                    editable={editable && !busy}
                    keyboardType="decimal-pad"
                    maxLength={18}
                  />
                ))}
              </Panel>
            }
            second={
              <Panel style={{ gap: 14 }}>
                {(
                  [
                    ["repair", hi ? "मरम्मत बजट ₹" : "Repair budget ₹"],
                    [
                      "expenses",
                      hi ? "अन्य सीधे खर्च ₹" : "Other direct expenses ₹",
                    ],
                  ] as const
                ).map(([field, label]) => (
                  <Field
                    key={field}
                    label={label}
                    value={f[field]}
                    onChangeText={(v) => edit(field, v)}
                    editable={editable && !busy}
                    keyboardType="decimal-pad"
                    maxLength={18}
                  />
                ))}
              </Panel>
            }
          />
          <View
            style={[
              s.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <Text style={s.muted}>
              {hi ? "अनुमानित योगदान" : "Expected contribution"}
            </Text>
            <Text
              style={{
                fontSize: 22,
                lineHeight: 30,
                color: forecast !== null && forecast < 0 ? "#ff9fa6" : "#fff",
              }}
            >
              {forecast === null ? "—" : formatMoney(forecast, hi)}
            </Text>
          </View>
        </>
      ) : null}
      {step === "confirm" ? (
        <>
          <Panel style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "600" }}>
              {f.sellerName}
            </Text>
            {f.sellerPhone ? (
              <Text style={s.muted}>{f.sellerPhone}</Text>
            ) : null}
            {[
              [hi ? "खरीद" : "Purchase", f.price],
              [hi ? "बिक्री अनुमान" : "Expected resale", f.resale],
              [hi ? "मरम्मत बजट" : "Repair budget", f.repair],
              [hi ? "सीधे खर्च" : "Direct expenses", f.expenses],
            ].map(([label, value]) => (
              <View
                key={label}
                style={[
                  s.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <Text style={s.muted}>{label}</Text>
                <Text>
                  {parseRupees(value!) === null
                    ? "—"
                    : formatMoney(parseRupees(value!)!, hi)}
                </Text>
              </View>
            ))}
            <View style={s.divider} />
            <Text style={s.muted}>
              {hi ? "अनुमानित योगदान" : "Expected contribution"}
            </Text>
            <Text
              style={{
                fontSize: 27,
                lineHeight: 34,
                fontWeight: "600",
                color: forecast !== null && forecast < 0 ? "#ff9fa6" : "#fff",
              }}
            >
              {forecast === null ? "—" : formatMoney(forecast, hi)}
            </Text>
          </Panel>
          <Field
            label={
              hi
                ? "टिप्पणी (वैकल्पिक)"
                : "Negotiation / valuation notes (optional)"
            }
            value={f.notes}
            onChangeText={(v) => edit("notes", v)}
            editable={editable && !busy}
            multiline
            maxLength={2000}
          />
          {!editable ? (
            <Text style={s.muted}>
              {hi
                ? "भेजे प्रस्ताव को बदलाव के लिए वापस लें। समझौते की शर्तें सुरक्षित रहती हैं।"
                : "Return submitted proposals for changes. Acquired purchase terms are retained."}
            </Text>
          ) : null}
        </>
      ) : null}
    </FocusPage>
  );
}
