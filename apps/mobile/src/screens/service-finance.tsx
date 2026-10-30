import { can } from "../application/access";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import type { ServiceFinanceCommand } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import {
  Workspace,
  FocusPage,
  CarIdentity,
  SelectField,
  StepHeader,
} from "../components/workspace";
import {
  BusinessForm,
  type BusinessFormSpec,
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
import { formatMoney, parseRupees } from "../application/money";
import { localDateInput, paymentTimestamp } from "../application/payment-date";
import { sendCommand } from "../application/send-command";
import { loadLocal, saveLocal, deleteLocal } from "../adapters/local-store";

type Payload = ServiceFinanceCommand extends infer C
  ? C extends ServiceFinanceCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
type Line = { description: string; quantity: string; price: string };
type QuoteDraft = {
  version: number;
  lines: Line[];
  charges: string;
  note: string;
};
export function ServiceFinanceScreen({ route }: ScreenProps<"ServiceFinance">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    reviewer = can(session!.actor, "finance"),
    tr = (en: string, hindi: string) => (hi ? hindi : en);
  const resource = useResource(`job-finance:${route.params.jobId}`, () =>
      api.serviceFinance(route.params.jobId),
    ),
    data = resource.data;
  const [section, setSection] = useState<"quotes" | "invoices" | "payments">(
      "quotes",
    ),
    [form, setForm] = useState<"quote" | "invoice" | "payment" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(payload: Payload, version: number) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        session!.actor.id,
        `job-finance:${route.params.jobId}:${payload.action}`,
        { ...payload, expectedVersion: version },
        (body) =>
          api.serviceFinanceCommand(
            route.params.jobId,
            body as ServiceFinanceCommand,
          ),
      );
      changed();
      setForm(null);
      setCorrecting(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      resource.refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function confirm(payload: Payload, version: number) {
    const yes = await new Promise<boolean>((resolve) =>
      Alert.alert(
        tr("Record this action?", "यह कार्य दर्ज करें?"),
        `${data?.job.car.registration}\n${tr("This is retained in the work history. Recording a payment does not transfer money.", "यह काम के इतिहास में रहेगा। भुगतान दर्ज करने से पैसे नहीं भेजे जाते।")}`,
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
    return yes ? run(payload, version) : false;
  }
  const [correcting, setCorrecting] = useState<string | null>(null);
  const quote = data?.quotes[0];
  const spec: BusinessFormSpec = {
    key: `job:${route.params.jobId}:${form}:${quote?.id ?? ""}`,
    title:
      form === "invoice"
        ? tr("Record workshop invoice", "वर्कशॉप बिल दर्ज करें")
        : tr("Record vendor payment", "वर्कशॉप भुगतान दर्ज करें"),
    submitLabel: tr("Review & save", "जाँचकर सेव करें"),
    note: tr(
      "Keep the original bill or bank receipt. This entry records its reference.",
      "मूल बिल या बैंक रसीद रखें। यहाँ उसका संदर्भ दर्ज होता है।",
    ),
    steps: [
      {
        label: tr("Amount", "रकम"),
        fields: [
          {
            key: "amount",
            label: tr("Amount · rupees", "रकम · रुपये"),
            kind: "money",
          },
          {
            key: "reference",
            label: tr("Invoice / bank reference", "बिल / बैंक संदर्भ"),
          },
        ],
      },
      {
        label: tr("Details", "विवरण"),
        fields: [
          {
            key: "date",
            label: tr("Date", "तारीख"),
            kind: "date",
            initial: localDateInput(),
          },
          ...(form === "payment"
            ? [
                { key: "note", label: tr("Note", "नोट") },
                {
                  key: "advance",
                  label: tr(
                    "I confirm any amount above invoices is a vendor advance",
                    "बिल से अधिक रकम वर्कशॉप को अग्रिम देना है",
                  ),
                  kind: "choice" as const,
                },
              ]
            : []),
        ],
      },
    ],
  };
  return (
    <Workspace
      title={tr("Repair spending", "मरम्मत खर्च")}
      selected={section}
      busy={busy || !!form || !!correcting}
      onChange={setSection}
      context={
        data ? (
          <CarIdentity car={data.job.car} detail={data.job.title} />
        ) : undefined
      }
      items={[
        {
          id: "quotes",
          label: tr("Quotes", "कोटेशन"),
          icon: "document-text-outline",
        },
        {
          id: "invoices",
          label: tr("Invoices", "बिल"),
          icon: "receipt-outline",
        },
        {
          id: "payments",
          label: tr("Payments", "भुगतान"),
          icon: "wallet-outline",
        },
      ]}
    >
      {correcting && data ? (
        <BusinessForm
          serverError={error}
          key={correcting}
          spec={{
            key: `correct-vendor:${correcting}`,
            title: tr(
              "Correct a wrong payment entry",
              "गलत भुगतान रिकॉर्ड सुधारें",
            ),
            note: tr(
              "Use this only for a recording error. Keep actual money movements recorded separately.",
              "केवल दर्ज करने की गलती के लिए उपयोग करें। असली पैसों के लेन-देन अलग दर्ज रखें।",
            ),
            submitLabel: tr("Correct entry", "रिकॉर्ड सुधारें"),
            steps: [
              {
                label: tr("Reason", "कारण"),
                fields: [
                  {
                    key: "reason",
                    label: tr(
                      "Why is this entry incorrect?",
                      "यह रिकॉर्ड गलत क्यों है?",
                    ),
                  },
                ],
              },
            ],
          }}
          version={data.job.version}
          summary={data.job.car.registration}
          onBusyChange={setBusy}
          onCancel={() => setCorrecting(null)}
          onSubmit={(v, version) => {
            return confirm(
              {
                action: "correct_vendor_payment",
                paymentId: correcting,
                reason: v.reason || "",
              },
              version,
            );
          }}
        />
      ) : form === "quote" && data ? (
        <QuoteEditor
          serverError={error}
          jobId={data.job.id}
          version={data.job.version}
          onCancel={() => setForm(null)}
          onSave={(draft, version) => {
            const charges = parseRupees(draft.charges);
            if (charges === null)
              throw Error(
                tr(
                  "Enter valid charges, or zero.",
                  "सही शुल्क या शून्य लिखें।",
                ),
              );
            return confirm(
              {
                action: "quote",
                lines: draft.lines.map((l) => {
                  const unit = parseRupees(l.price);
                  const quantity = Number(l.quantity);
                  if (
                    !unit ||
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    !l.description.trim()
                  )
                    throw Error(
                      tr(
                        "Check every item, quantity and price.",
                        "हर वस्तु, संख्या और कीमत जाँचें।",
                      ),
                    );
                  return {
                    description: l.description.trim(),
                    quantity,
                    unitPaise: unit,
                  };
                }),
                chargesPaise: charges,
                note: draft.note,
              },
              version,
            );
          }}
        />
      ) : form && data && quote ? (
        <BusinessForm
          serverError={error}
          key={spec.key}
          spec={spec}
          version={data.job.version}
          summary={`${tr("Approved quote", "मंज़ूर कोटेशन")} · ${formatMoney(quote.totalPaise, hi)}`}
          onBusyChange={setBusy}
          onCancel={() => setForm(null)}
          onSubmit={async (values, version) => {
            const amount = parseRupees(values.amount || "");
            if (!amount)
              throw Error(tr("Enter a positive amount.", "सही रकम लिखें।"));
            const occurredAt = paymentTimestamp(values.date || "");
            if (!occurredAt)
              throw Error(
                tr(
                  "Enter a valid date up to today.",
                  "आज तक की सही तारीख लिखें।",
                ),
              );
            return confirm(
              form === "invoice"
                ? {
                    action: "invoice",
                    quoteId: quote.id,
                    amountPaise: amount,
                    reference: values.reference || "",
                    occurredAt: occurredAt,
                  }
                : {
                    action: "vendor_payment",
                    quoteId: quote.id,
                    amountPaise: amount,
                    reference: values.reference || "",
                    occurredAt: occurredAt,
                    note: values.note || "",
                    advanceAcknowledged: values.advance === "yes",
                  },
              version,
            );
          }}
        />
      ) : (
        <FocusPage
          scrollKey={section}
          footer={
            data && (reviewer || section === "quotes") ? (
              <Button
                label={
                  section === "quotes"
                    ? tr("New quote revision", "नया कोटेशन")
                    : section === "invoices"
                      ? tr("Record invoice", "बिल दर्ज करें")
                      : tr("Record vendor payment", "वर्कशॉप भुगतान दर्ज करें")
                }
                disabled={
                  busy ||
                  (section !== "quotes" && quote?.decision !== "approved")
                }
                onPress={() => {
                  setError("");
                  setForm(
                    section === "quotes"
                      ? "quote"
                      : section === "invoices"
                        ? "invoice"
                        : "payment",
                  );
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
            <>
              <Panel style={{ gap: 8 }}>
                <Text>
                  {tr("Invoiced", "बिल कुल")} ·{" "}
                  {formatMoney(data.invoiceTotalPaise, hi)}
                </Text>
                <Text>
                  {tr("Paid", "भुगतान")} · {formatMoney(data.paidPaise, hi)}
                </Text>
                <Text>
                  {tr("Vendor balance", "वर्कशॉप बाकी")} ·{" "}
                  {formatMoney(data.balancePaise, hi)}
                </Text>
                {data.advancePaise > 0 ? (
                  <Text>
                    {tr("Advance awaiting invoices", "अग्रिम · बिल बाकी")} ·{" "}
                    {formatMoney(data.advancePaise, hi)}
                  </Text>
                ) : null}
              </Panel>
              {section === "quotes"
                ? data.quotes.map((q) => (
                    <Panel key={q.id} style={{ gap: 12 }}>
                      <View
                        style={[s.row, { justifyContent: "space-between" }]}
                      >
                        <Text style={{ fontSize: 22, fontWeight: "600" }}>
                          #{q.revision} · {formatMoney(q.totalPaise, hi)}
                        </Text>
                        <Pill
                          label={q.decision}
                          warning={q.decision === "pending"}
                        />
                      </View>
                      {q.lines.map((l, i) => (
                        <Text key={i}>
                          {l.description} · {l.quantity} ×{" "}
                          {formatMoney(l.unitPaise, hi)}
                        </Text>
                      ))}
                      <Text style={s.muted}>
                        {tr("Taxes / charges", "कर / शुल्क")} ·{" "}
                        {formatMoney(q.chargesPaise, hi)}
                      </Text>
                      {q.note ? <Text>{q.note}</Text> : null}
                      <Text style={s.muted}>
                        {q.recordedByName} ·{" "}
                        {new Date(q.createdAt).toLocaleDateString()}
                      </Text>
                      {q.approvedByName ? (
                        <Text>
                          {q.approvedByName} · {q.reason}
                        </Text>
                      ) : null}
                      {reviewer &&
                      q.id === quote?.id &&
                      q.decision === "pending" ? (
                        <ActionRow>
                          <Button
                            label={tr("Approve", "मंज़ूर")}
                            busy={busy}
                            style={{ flex: 1 }}
                            onPress={() =>
                              void confirm(
                                {
                                  action: "decide_quote",
                                  quoteId: q.id,
                                  decision: "approved",
                                  reason: tr(
                                    "Owner / supervisor approved this exact quote revision",
                                    "मालिक ने इस कोटेशन संस्करण को मंज़ूर किया",
                                  ),
                                },
                                data.job.version,
                              )
                            }
                          />
                          <Button
                            secondary
                            label={tr("Reject", "अस्वीकार")}
                            disabled={busy}
                            style={{ flex: 1 }}
                            onPress={() =>
                              void confirm(
                                {
                                  action: "decide_quote",
                                  quoteId: q.id,
                                  decision: "rejected",
                                  reason: tr(
                                    "Owner rejected this quote revision; obtain a revised quote",
                                    "मालिक ने यह कोटेशन अस्वीकार किया; नया कोटेशन लें",
                                  ),
                                },
                                data.job.version,
                              )
                            }
                          />
                        </ActionRow>
                      ) : null}
                    </Panel>
                  ))
                : section === "invoices"
                  ? data.invoices.map((i) => (
                      <Panel key={i.id} style={{ gap: 8 }}>
                        <Text>
                          {i.reference} · {formatMoney(i.amountPaise, hi)}
                        </Text>
                        <Text style={s.muted}>
                          {i.recordedByName} ·{" "}
                          {new Date(i.occurredAt).toLocaleDateString()}
                          {i.reversed
                            ? ` · ${tr("Corrected entry", "सुधारा गया")}`
                            : ""}
                        </Text>
                      </Panel>
                    ))
                  : data.payments.map((p) => (
                      <Panel key={p.id} style={{ gap: 8 }}>
                        <Text>
                          {p.reference} · {formatMoney(p.amountPaise, hi)}
                        </Text>
                        <Text style={s.muted}>
                          {p.recordedByName} ·{" "}
                          {new Date(p.occurredAt).toLocaleDateString()}
                        </Text>
                        {p.note ? <Text>{p.note}</Text> : null}
                        {p.reversed ? (
                          <Pill
                            label={tr("Corrected entry", "सुधारा गया रिकॉर्ड")}
                          />
                        ) : reviewer ? (
                          <Button
                            secondary
                            disabled={busy}
                            label={tr(
                              "Correct wrong entry",
                              "गलत रिकॉर्ड सुधारें",
                            )}
                            onPress={() => setCorrecting(p.id)}
                          />
                        ) : null}
                      </Panel>
                    ))}
              {!(section === "quotes"
                ? data.quotes.length
                : section === "invoices"
                  ? data.invoices.length
                  : data.payments.length) ? (
                <Text style={s.muted}>
                  {tr("No entries yet.", "अभी कोई रिकॉर्ड नहीं।")}
                </Text>
              ) : null}
            </>
          ) : null}
        </FocusPage>
      )}
    </Workspace>
  );
}
function QuoteEditor({
  serverError,
  jobId,
  version,
  onCancel,
  onSave,
}: {
  serverError?: string | undefined;
  jobId: string;
  version: number;
  onCancel: () => void;
  onSave: (draft: QuoteDraft, version: number) => Promise<boolean>;
}) {
  const { session, language } = useApp(),
    hi = language === "hi",
    reviewer = can(session!.actor, "finance"),
    tr = (en: string, hindi: string) => (hi ? hindi : en),
    key = `quote-draft:${jobId}`;
  const [draft, setDraft] = useState<QuoteDraft | null>(null),
    [step, setStep] = useState(0),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fresh = (): QuoteDraft => ({
    version,
    lines: [{ description: "", quantity: "1", price: "" }],
    charges: "0",
    note: "",
  });
  useEffect(() => {
    let active = true;
    void loadLocal<QuoteDraft>(session!.actor.id, key)
      .then((saved) => {
        if (active) setDraft(saved ?? fresh());
      })
      .catch(() => {
        if (active) {
          setDraft(fresh());
          setError(
            tr(
              "The previous draft could not be opened.",
              "पिछला ड्राफ्ट नहीं खुला।",
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [key]);
  function update(next: QuoteDraft) {
    setDraft(next);
    void saveLocal(session!.actor.id, key, next).catch(() =>
      setError(
        tr(
          "Could not save the draft on this device.",
          "फोन पर ड्राफ्ट सेव नहीं हुआ।",
        ),
      ),
    );
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      if (await onSave(draft, draft.version))
        await deleteLocal(session!.actor.id, key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!draft) return <ActivityIndicator color="#fff" />;
  const line = draft.lines[index]!,
    total = draft.lines.reduce(
      (sum, l) => sum + (parseRupees(l.price) || 0) * (Number(l.quantity) || 0),
      parseRupees(draft.charges) || 0,
    );
  const stale = draft.version !== version;
  return (
    <FocusPage
      scrollKey={`quote:${step}:${index}`}
      top={
        <StepHeader
          current={step}
          labels={[
            tr("Items", "वस्तुएँ"),
            tr("Charges", "शुल्क"),
            tr("Review", "समीक्षा"),
          ]}
          onSelect={setStep}
        />
      }
      footer={
        <ActionRow>
          <Button
            secondary
            label={tr("Back", "वापस")}
            disabled={busy}
            onPress={step ? () => setStep(step - 1) : onCancel}
            style={{ flex: 1 }}
          />
          <Button
            label={
              step === 2 ? tr("Save quote", "कोटेशन सेव") : tr("Next", "आगे")
            }
            busy={busy}
            disabled={stale}
            onPress={step === 2 ? () => void save() : () => setStep(step + 1)}
            style={{ flex: 1 }}
          />
        </ActionRow>
      }
    >
      <Text style={s.title}>{tr("New quote revision", "नया कोटेशन")}</Text>
      {error || serverError ? (
        <ErrorNotice message={error || serverError || ""} />
      ) : null}
      {stale ? (
        <ErrorNotice
          message={tr(
            "The repair changed. Your draft is retained. Reload the latest version and review it.",
            "मरम्मत का रिकॉर्ड बदला। ड्राफ्ट सुरक्षित है। नई जानकारी लेकर समीक्षा करें।",
          )}
          retry={() => update({ ...draft, version })}
        />
      ) : null}
      {step === 0 ? (
        <>
          <SelectField
            label={tr("Item", "वस्तु")}
            value={String(index)}
            options={draft.lines.map((l, i) => ({
              id: String(i),
              label: `${i + 1}. ${l.description || tr("New item", "नई वस्तु")}`,
            }))}
            onChange={(v) => setIndex(Number(v))}
          />
          <Field
            label={tr(
              "Part / labour / outside service",
              "पार्ट / मज़दूरी / बाहर का काम",
            )}
            value={line.description}
            onChangeText={(v) =>
              update({
                ...draft,
                lines: draft.lines.map((l, i) =>
                  i === index ? { ...l, description: v } : l,
                ),
              })
            }
          />
          <Field
            label={tr("Quantity · whole units", "संख्या · पूर्ण इकाई")}
            keyboardType="number-pad"
            value={line.quantity}
            onChangeText={(v) =>
              update({
                ...draft,
                lines: draft.lines.map((l, i) =>
                  i === index ? { ...l, quantity: v } : l,
                ),
              })
            }
          />
          <Field
            label={tr("Price per unit · rupees", "प्रति इकाई कीमत · रुपये")}
            keyboardType="decimal-pad"
            value={line.price}
            onChangeText={(v) =>
              update({
                ...draft,
                lines: draft.lines.map((l, i) =>
                  i === index ? { ...l, price: v } : l,
                ),
              })
            }
          />
          <Button
            secondary
            label={tr("Add another item", "और वस्तु जोड़ें")}
            disabled={draft.lines.length >= 80}
            onPress={() => {
              update({
                ...draft,
                lines: [
                  ...draft.lines,
                  { description: "", quantity: "1", price: "" },
                ],
              });
              setIndex(draft.lines.length);
            }}
          />
          {draft.lines.length > 1 ? (
            <Button
              secondary
              label={tr("Remove this item", "यह वस्तु हटाएँ")}
              onPress={() => {
                update({
                  ...draft,
                  lines: draft.lines.filter((_, i) => i !== index),
                });
                setIndex(Math.max(0, index - 1));
              }}
            />
          ) : null}
        </>
      ) : step === 1 ? (
        <>
          <Field
            label={tr(
              "Taxes / other charges · rupees",
              "कर / अन्य शुल्क · रुपये",
            )}
            keyboardType="decimal-pad"
            value={draft.charges}
            onChangeText={(charges) => update({ ...draft, charges })}
          />
          <Field
            label={tr(
              "Quote note / workshop reference",
              "कोटेशन नोट / वर्कशॉप संदर्भ",
            )}
            value={draft.note}
            onChangeText={(note) => update({ ...draft, note })}
          />
        </>
      ) : (
        <>
          <Panel style={{ gap: 12 }}>
            {draft.lines.map((l, i) => (
              <Text key={i}>
                {l.description || "—"} · {l.quantity} ×{" "}
                {formatMoney(parseRupees(l.price) || 0, hi)}
              </Text>
            ))}
            <Text style={{ fontSize: 24, fontWeight: "600" }}>
              {formatMoney(total, hi)}
            </Text>
          </Panel>
          <Text style={s.muted}>
            {tr(
              "Saving creates a new immutable revision. Approval is a separate action. Earlier approval does not carry forward.",
              "सेव करने पर नया संस्करण बनेगा। मंज़ूरी अलग कदम है। पुरानी मंज़ूरी नए संस्करण पर लागू नहीं होगी।",
            )}
          </Text>
        </>
      )}
    </FocusPage>
  );
}
