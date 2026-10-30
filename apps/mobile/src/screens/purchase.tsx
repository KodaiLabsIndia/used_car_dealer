import { can } from "../application/access";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import type { Purchase, PurchaseCommand } from "@arihant/contracts";
import type { ScreenProps } from "../navigation";
import {
  Workspace,
  FocusPage,
  CarIdentity,
  StepHeader,
} from "../components/workspace";
import { useSection } from "../state/use-section";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Pill,
  Text,
  s,
} from "../components/ui";
import { Choice, Field } from "../components/forms";
import { PurchaseTermsForm } from "../components/purchase-terms";
import { PurchaseDocumentChecks } from "../components/purchase-documents";
import { PurchasePayments } from "../components/purchase-payments";
import { PurchaseHandover } from "../components/purchase-handover";
import { formatMoney } from "../application/money";
import { sendCommand } from "../application/send-command";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
type Payload = PurchaseCommand extends infer C
  ? C extends PurchaseCommand
    ? Omit<C, "commandId" | "expectedVersion">
    : never
  : never;
export function purchaseLabel(status: Purchase["status"], hi: boolean): string {
  return {
    draft: hi ? "प्रस्ताव ड्राफ्ट" : "Draft proposal",
    submitted: hi ? "मंज़ूरी बाकी" : "Awaiting approval",
    approved: hi ? "कीमत मंज़ूर" : "Price approved",
    rejected: hi ? "बदलाव माँगा गया" : "Changes requested",
    acquired: hi ? "समझौता दर्ज" : "Agreement recorded",
  }[status];
}
function Amount({
  label,
  value,
  hi,
  large = false,
}: {
  label: string;
  value: number;
  hi: boolean;
  large?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.muted}>{label}</Text>
      <Text
        style={{
          fontSize: large ? 29 : 19,
          lineHeight: large ? 37 : 28,
          fontWeight: "600",
          color: value < 0 ? "#ff9fa6" : "#fff",
        }}
      >
        {formatMoney(value, hi)}
      </Text>
    </View>
  );
}
export function PurchaseScreen({ route, navigation }: ScreenProps<"Purchase">) {
  const { api, session, language, changed } = useApp(),
    hi = language === "hi",
    owner = can(session!.actor, "finance"),
    carId = route.params.carId;
  const carResource = useResource(`car:${carId}`, () => api.car(carId));
  const resource = useResource(`purchase:${carId}`, async () => ({
    purchase: await api.purchaseForCar(carId),
  }));
  const [tab, setTab] = useSection(`purchase:${carId}`, "review", [
    "terms",
    "review",
    "documents",
    "payments",
    "handover",
    "history",
  ] as const);
  const [docStep, setDocStep] = useSection(
    `purchase-documents:${carId}`,
    "checks",
    ["checks", "agreement"] as const,
  );
  const [historyStep, setHistoryStep] = useState<"approvals" | "prices">(
    "approvals",
  );
  const [expanded, setExpanded] = useState("");
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState(""),
    [acknowledgeLoss, setAcknowledgeLoss] = useState(false),
    [acknowledgeDraft, setAcknowledgeDraft] = useState(false),
    [agreement, setAgreement] = useState("");
  const purchase = resource.data?.purchase ?? null,
    car = carResource.data;
  async function run(
    payload: Payload,
    expectedVersion?: number,
  ): Promise<boolean> {
    if (!purchase) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendCommand(
        session!.actor.id,
        `purchase:${purchase.id}:${payload.action}`,
        { ...payload, expectedVersion: expectedVersion ?? purchase.version },
        (body) => api.purchaseCommand(purchase.id, body as PurchaseCommand),
      );
      setReason("");
      setReturning(false);
      setNotice(hi ? "रिकॉर्ड सेव हुआ।" : "Record saved.");
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
  function confirmApproval() {
    if (!purchase) return;
    const self = purchase.submittedBy === session!.actor.id;
    Alert.alert(
      hi ? "खरीद प्रस्ताव मंज़ूर करें?" : "Approve this purchase?",
      `${purchase.terms.sellerName}\n${hi ? "खरीद" : "Purchase"}: ${formatMoney(purchase.terms.purchasePricePaise, hi)}\n${hi ? "मरम्मत बजट" : "Repair budget"}: ${formatMoney(purchase.terms.repairBudgetPaise, hi)}\n${hi ? "अनुमानित योगदान" : "Expected contribution"}: ${formatMoney(purchase.expectedContributionPaise, hi)}${self ? `\n${hi ? "आप अपने भेजे प्रस्ताव की मंज़ूरी दे रहे हैं। यह रिकॉर्ड में दिखेगा।" : "You are approving your own submitted proposal. This will be recorded as a self-review."}` : ""}`,
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "मंज़ूर करें" : "Approve",
          onPress: () =>
            void run({
              action: "review",
              decision: "approve",
              reason: "",
              acknowledgeLoss,
              acknowledgeDraftChecklist: acknowledgeDraft,
            }),
        },
      ],
    );
  }
  function confirmAgreement() {
    if (!purchase) return;
    Alert.alert(
      hi ? "खरीद समझौता दर्ज करें?" : "Record the purchase agreement?",
      `${agreement}\n${formatMoney(purchase.terms.purchasePricePaise, hi)}\n${hi ? "हस्ताक्षर किया हुआ समझौता दर्ज करें। इसके बाद तय शर्तें यहाँ नहीं बदली जाएँगी। भुगतान और गाड़ी की प्राप्ति अलग रहेंगे।" : "Record the signed agreement. Agreed terms are retained after this step. Payments and physical receipt remain separate."}`,
      [
        { text: hi ? "रद्द करें" : "Cancel", style: "cancel" },
        {
          text: hi ? "समझौता दर्ज करें" : "Record agreement",
          onPress: () =>
            void run({
              action: "acquire",
              agreementReference: agreement.trim(),
            }),
        },
      ],
    );
  }
  function backToCar() {
    navigation.navigate("Car", { id: carId });
  }
  const canSubmit =
    purchase &&
    (["draft", "rejected"].includes(purchase.status) ||
      (purchase.status === "approved" && !purchase.approvalValid));
  const pendingInspection =
    purchase?.inspections.find((i) => i.status !== "completed") ||
    purchase?.inspections[0];
  function openInspection() {
    if (pendingInspection)
      navigation.navigate("Task", { id: pendingInspection.id });
    else navigation.navigate("AssignInspection", { carId });
  }
  const items = [
    { id: "terms", label: hi ? "कीमत" : "Valuation", icon: "pricetag-outline" },
    {
      id: "review",
      label: hi ? "मंज़ूरी" : "Approval",
      icon: "checkmark-done-outline",
    },
    {
      id: "documents",
      label: hi ? "दस्तावेज़" : "Documents",
      icon: "document-text-outline",
      badge: purchase?.documentsClear ? "✓" : "!",
    },
    {
      id: "payments",
      label: hi ? "भुगतान" : "Payments",
      icon: "wallet-outline",
    },
    {
      id: "handover",
      label: hi ? "प्राप्ति" : "Handover",
      icon: "key-outline",
    },
    { id: "history", label: hi ? "इतिहास" : "History", icon: "time-outline" },
  ] as const;
  return (
    <Workspace
      title={hi ? "खरीद" : "Purchase"}
      items={
        purchase
          ? items.filter((item) => owner || item.id !== "payments")
          : [items[0]]
      }
      selected={
        purchase ? (tab === "payments" && !owner ? "review" : tab) : "terms"
      }
      onChange={(value) => {
        setTab(value);
        setNotice("");
      }}
      busy={busy}
      context={
        car ? (
          <View style={{ gap: 6 }}>
            <CarIdentity
              car={car}
              detail={purchase ? purchaseLabel(purchase.status, hi) : ""}
              onPress={backToCar}
            />
            {error || resource.error || carResource.error ? (
              <ErrorNotice
                message={error || resource.error || carResource.error}
                retry={() => {
                  resource.refresh();
                  carResource.refresh();
                }}
              />
            ) : null}
            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: "#b9e5c9", fontSize: 12, lineHeight: 18 }}
              >
                {notice}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
    >
      {!resource.data || !car ? (
        <FocusPage>
          {resource.error || carResource.error ? (
            <ErrorNotice
              message={resource.error || carResource.error}
              retry={() => {
                resource.refresh();
                carResource.refresh();
              }}
            />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </FocusPage>
      ) : !purchase || tab === "terms" ? (
        <PurchaseTermsForm
          car={car}
          purchase={purchase}
          onBusyChange={setBusy}
          refresh={() => {
            resource.refresh();
            carResource.refresh();
          }}
          onSaved={() => {
            setTab("review");
            setNotice(hi ? "प्रस्ताव सेव हुआ।" : "Purchase proposal saved.");
            changed();
          }}
        />
      ) : tab === "review" ? (
        <FocusPage
          scrollKey={`review:${returning}`}
          footer={
            canSubmit ? (
              <Button
                label={
                  !purchase.inspectionReady
                    ? pendingInspection
                      ? hi
                        ? "जाँच खोलें"
                        : "Complete inspection"
                      : hi
                        ? "जाँच सौंपें"
                        : "Assign inspection"
                    : hi
                      ? "मंज़ूरी के लिए भेजें"
                      : "Send for approval"
                }
                icon={
                  !purchase.inspectionReady
                    ? "clipboard-outline"
                    : "arrow-forward-outline"
                }
                busy={busy}
                onPress={() => {
                  if (!purchase.inspectionReady) openInspection();
                  else void run({ action: "submit" });
                }}
              />
            ) : purchase.status === "submitted" && owner ? (
              <ActionRow>
                <Button
                  label={
                    returning
                      ? hi
                        ? "रद्द करें"
                        : "Cancel"
                      : hi
                        ? "बदलाव माँगें"
                        : "Request changes"
                  }
                  secondary
                  disabled={busy}
                  onPress={() => setReturning((v) => !v)}
                  style={{ flex: 1 }}
                />
                {returning ? (
                  <Button
                    label={hi ? "वापस भेजें" : "Return proposal"}
                    icon="refresh-outline"
                    busy={busy}
                    disabled={reason.trim().length < 3}
                    onPress={() =>
                      void run({
                        action: "review",
                        decision: "reject",
                        reason: reason.trim(),
                        acknowledgeLoss: false,
                        acknowledgeDraftChecklist: false,
                      })
                    }
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    label={hi ? "मंज़ूर करें" : "Approve"}
                    icon="checkmark-done-outline"
                    busy={busy}
                    disabled={
                      !purchase.inspectionReady ||
                      (purchase.draftInspection && !acknowledgeDraft) ||
                      (purchase.expectedContributionPaise < 0 &&
                        !acknowledgeLoss)
                    }
                    onPress={confirmApproval}
                    style={{ flex: 1 }}
                  />
                )}
              </ActionRow>
            ) : (
              <Button
                label={
                  purchase.status === "acquired"
                    ? hi
                      ? "प्राप्ति खोलें"
                      : "Open handover"
                    : hi
                      ? "दस्तावेज़ और समझौता"
                      : "Documents & agreement"
                }
                icon="arrow-forward-outline"
                onPress={() => {
                  setTab(
                    purchase.status === "acquired" ? "handover" : "documents",
                  );
                }}
              />
            )
          }
        >
          <Panel style={{ gap: 12 }}>
            <View
              style={[
                s.row,
                { justifyContent: "space-between", flexWrap: "wrap" },
              ]}
            >
              <Text style={{ fontWeight: "600" }}>
                {purchase.terms.sellerName}
              </Text>
              <Pill
                label={`${hi ? "शर्तें" : "Terms"} v${purchase.termsVersion}`}
              />
            </View>
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <Amount
                  label={hi ? "खरीद कीमत" : "Purchase price"}
                  value={purchase.terms.purchasePricePaise}
                  hi={hi}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Amount
                  label={hi ? "अनुमानित योगदान" : "Expected contribution"}
                  value={purchase.expectedContributionPaise}
                  hi={hi}
                />
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTab("terms")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: "#ff9fa6" }}>
                {hi
                  ? "कीमत और खर्च का पूरा हिसाब देखें →"
                  : "Review prices and cost estimates →"}
              </Text>
            </Pressable>
          </Panel>
          {returning ? (
            <Field
              label={hi ? "बदलाव माँगने का कारण" : "Reason to request changes"}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={1000}
              editable={!busy}
            />
          ) : (
            <>
              <Panel style={{ gap: 10 }}>
                <Text style={{ fontWeight: "600" }}>
                  {hi ? "खरीद से पहले जाँच" : "Pre-purchase inspection"}
                </Text>
                <Pill
                  label={
                    purchase.inspectionReady
                      ? hi
                        ? "जाँच मंज़ूर"
                        : "Inspection accepted"
                      : hi
                        ? "जाँच और समीक्षा बाकी"
                        : "Inspection & review needed"
                  }
                  warning={!purchase.inspectionReady}
                />
                {purchase.draftInspection ? (
                  <Text style={{ color: "#ffc283" }}>
                    {hi
                      ? "ड्राफ्ट चेकलिस्ट · अभी केवल प्रशिक्षण में मंज़ूरी।"
                      : "Draft checklist · approval is limited to acknowledged training."}
                  </Text>
                ) : null}
                {purchase.inspections.map((ins) => (
                  <Pressable
                    key={ins.id}
                    accessibilityRole="button"
                    onPress={() => navigation.navigate("Task", { id: ins.id })}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text>
                      {hi ? "जाँच खोलें" : "Open inspection"} · v{ins.version} →
                    </Text>
                  </Pressable>
                ))}
              </Panel>
              {purchase.status === "submitted" ? (
                <>
                  {purchase.submittedBy === session!.actor.id ? (
                    <Text style={s.muted}>
                      {hi
                        ? "यह स्वयं समीक्षा होगी। दोनों भूमिकाओं में आपका नाम दर्ज होगा।"
                        : "This will be recorded as your self-review, with your identity in both roles."}
                    </Text>
                  ) : null}
                  {purchase.draftInspection ? (
                    <Choice
                      label={
                        hi
                          ? "मैं समझता हूँ: ड्राफ्ट चेकलिस्ट पर प्रशिक्षण"
                          : "I acknowledge training with a draft checklist"
                      }
                      selected={acknowledgeDraft}
                      onPress={() => {
                        if (!busy) setAcknowledgeDraft((v) => !v);
                      }}
                      icon="information-circle-outline"
                    />
                  ) : null}
                  {purchase.expectedContributionPaise < 0 ? (
                    <Choice
                      label={
                        hi
                          ? "अनुमानित घाटा देखकर मंज़ूरी"
                          : "I acknowledge the projected loss"
                      }
                      selected={acknowledgeLoss}
                      onPress={() => {
                        if (!busy) setAcknowledgeLoss((v) => !v);
                      }}
                      icon="alert-circle-outline"
                    />
                  ) : null}
                </>
              ) : (
                <Text style={s.muted}>
                  {canSubmit
                    ? hi
                      ? "जाँच स्वीकार होने के बाद प्रस्ताव मंज़ूरी के लिए भेजें।"
                      : "Send the proposal for approval after inspection acceptance."
                    : purchase.approvalValid
                      ? hi
                        ? "मंज़ूरी दर्ज है। दस्तावेज़, भुगतान और प्राप्ति अलग हिस्सों में हैं।"
                        : "Approval is recorded. Documents, payments and handover have their own sections."
                      : hi
                        ? "जाँच बदल गई है। फिर मंज़ूरी लें।"
                        : "The inspection changed. Fresh approval is required."}
                </Text>
              )}
            </>
          )}
        </FocusPage>
      ) : tab === "documents" ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <StepHeader
              labels={[hi ? "जाँच" : "Checks", hi ? "समझौता" : "Agreement"]}
              current={docStep === "checks" ? 0 : 1}
              onSelect={(i) => setDocStep(i === 0 ? "checks" : "agreement")}
              disabled={busy}
            />
          </View>
          {docStep === "checks" ? (
            <PurchaseDocumentChecks
              purchase={purchase}
              busy={busy}
              onSave={async (documents, version) => {
                const success = await run(
                  { action: "documents", documents },
                  version,
                );
                if (success) setDocStep("agreement");
                return success;
              }}
            />
          ) : (
            <FocusPage
              scrollKey="agreement"
              footer={
                purchase.acquiredAt ? (
                  <Button
                    label={
                      hi ? "गाड़ी की प्राप्ति खोलें" : "Open physical handover"
                    }
                    icon="key-outline"
                    onPress={() => setTab("handover")}
                  />
                ) : (
                  <Button
                    label={hi ? "समझौता दर्ज करें" : "Record agreement"}
                    icon="document-text-outline"
                    busy={busy}
                    disabled={
                      !owner ||
                      purchase.status !== "approved" ||
                      !agreement.trim() ||
                      !purchase.approvalValid ||
                      !purchase.documentsClear
                    }
                    onPress={confirmAgreement}
                  />
                )
              }
            >
              <Text style={{ fontSize: 22, fontWeight: "600", lineHeight: 30 }}>
                {hi ? "खरीद समझौता" : "Purchase agreement"}
              </Text>
              {purchase.acquiredAt ? (
                <Panel style={{ gap: 12 }}>
                  <Pill label={hi ? "समझौता दर्ज" : "Agreement recorded"} />
                  <Text selectable>{purchase.agreementReference}</Text>
                  <Text style={s.muted}>
                    {new Date(purchase.acquiredAt).toLocaleString(
                      hi ? "hi-IN" : "en-IN",
                    )}
                  </Text>
                  <Text>
                    {hi
                      ? "भुगतान और प्राप्ति अलग से दर्ज हैं।"
                      : "Payments and physical receipt are tracked separately."}
                  </Text>
                </Panel>
              ) : (
                <>
                  <Panel style={{ gap: 12 }}>
                    <Pill
                      label={
                        purchase.approvalValid
                          ? hi
                            ? "कीमत मंज़ूर"
                            : "Price approved"
                          : hi
                            ? "मंज़ूरी बाकी"
                            : "Approval required"
                      }
                      warning={!purchase.approvalValid}
                    />
                    <Pill
                      label={
                        purchase.documentsClear
                          ? hi
                            ? "दस्तावेज़ जाँच पूरी"
                            : "Documents checked"
                          : hi
                            ? "दस्तावेज़ जाँच बाकी"
                            : "Document checks pending"
                      }
                      warning={!purchase.documentsClear}
                    />
                  </Panel>
                  {!purchase.approvalValid ? (
                    <Button
                      label={hi ? "मंज़ूरी खोलें" : "Open approval"}
                      secondary
                      onPress={() => setTab("review")}
                    />
                  ) : null}
                  {!purchase.documentsClear ? (
                    <Button
                      label={
                        hi ? "दस्तावेज़ जाँच खोलें" : "Open document checks"
                      }
                      secondary
                      onPress={() => setDocStep("checks")}
                    />
                  ) : null}
                  <Field
                    label={
                      hi
                        ? "हस्ताक्षर किए समझौते का संदर्भ"
                        : "Signed agreement reference"
                    }
                    value={agreement}
                    onChangeText={setAgreement}
                    maxLength={120}
                    editable={!busy}
                  />
                  <Text style={s.muted}>
                    {hi
                      ? "हस्ताक्षर किया समझौता दर्ज करें। इसके बाद तय शर्तें सुरक्षित रहेंगी।"
                      : "Record the signed agreement. The agreed terms are retained after this step."}
                  </Text>
                </>
              )}
            </FocusPage>
          )}
        </View>
      ) : tab === "payments" ? (
        <PurchasePayments
          purchase={purchase}
          busy={busy}
          onRecord={run}
          onCorrect={(paymentId, reason) =>
            run({ action: "reverse_payment", paymentId, reason })
          }
        />
      ) : tab === "handover" ? (
        <PurchaseHandover
          purchase={purchase}
          busy={busy}
          onReceive={(receipt) => run({ action: "receive", receipt })}
          onOpenIntake={(id) => navigation.navigate("Task", { id })}
        />
      ) : (
        <FocusPage
          scrollKey={historyStep}
          top={
            <StepHeader
              labels={[
                hi ? "मंज़ूरी" : "Decisions",
                hi ? "कीमत" : "Valuations",
              ]}
              current={historyStep === "approvals" ? 0 : 1}
              onSelect={(i) => {
                setHistoryStep(i === 0 ? "approvals" : "prices");
                setExpanded("");
              }}
            />
          }
        >
          {historyStep === "approvals" ? (
            <>
              {purchase.approvals.map((a) => (
                <Panel key={a.id} style={{ gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expanded === a.id }}
                    onPress={() => setExpanded((v) => (v === a.id ? "" : a.id))}
                    style={{ minHeight: 48, gap: 6 }}
                  >
                    <Text style={{ fontWeight: "600" }}>
                      {a.decision === "approve"
                        ? hi
                          ? "मंज़ूर"
                          : "Approved"
                        : hi
                          ? "बदलाव माँगा"
                          : "Changes requested"}{" "}
                      · {formatMoney(a.terms.purchasePricePaise, hi)}
                    </Text>
                    <Text style={s.muted}>
                      {a.actorName} · v{a.termsVersion}
                      {a.selfReview
                        ? ` · ${hi ? "स्वयं समीक्षा" : "Self-review"}`
                        : ""}{" "}
                      · {expanded === a.id ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {expanded === a.id ? (
                    <>
                      <Amount
                        label={hi ? "मरम्मत बजट" : "Repair budget"}
                        value={a.terms.repairBudgetPaise}
                        hi={hi}
                      />
                      {a.reason ? <Text>{a.reason}</Text> : null}
                      <Text style={s.muted}>
                        {new Date(a.createdAt).toLocaleString(
                          hi ? "hi-IN" : "en-IN",
                        )}
                      </Text>
                    </>
                  ) : null}
                </Panel>
              ))}
              {!purchase.approvals.length ? (
                <Text style={s.muted}>
                  {hi
                    ? "अभी कोई निर्णय दर्ज नहीं है।"
                    : "No decisions recorded yet."}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {purchase.revisions.map((r) => (
                <Panel key={r.termsVersion} style={{ gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: expanded === String(r.termsVersion),
                    }}
                    onPress={() =>
                      setExpanded((v) =>
                        v === String(r.termsVersion)
                          ? ""
                          : String(r.termsVersion),
                      )
                    }
                    style={{ minHeight: 48, gap: 6 }}
                  >
                    <Text style={{ fontWeight: "600" }}>
                      v{r.termsVersion} ·{" "}
                      {formatMoney(r.terms.purchasePricePaise, hi)}
                    </Text>
                    <Text style={s.muted}>
                      {r.preparedByName} ·{" "}
                      {expanded === String(r.termsVersion) ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {expanded === String(r.termsVersion) ? (
                    <>
                      <Text>{r.terms.sellerName}</Text>
                      <Amount
                        label={hi ? "बिक्री अनुमान" : "Expected resale"}
                        value={r.terms.expectedResalePaise}
                        hi={hi}
                      />
                      <Amount
                        label={hi ? "मरम्मत बजट" : "Repair budget"}
                        value={r.terms.repairBudgetPaise}
                        hi={hi}
                      />
                      <Amount
                        label={hi ? "सीधे खर्च" : "Direct expenses"}
                        value={r.terms.directExpensesPaise}
                        hi={hi}
                      />
                      <Text style={s.muted}>
                        {new Date(r.createdAt).toLocaleString(
                          hi ? "hi-IN" : "en-IN",
                        )}
                      </Text>
                    </>
                  ) : null}
                </Panel>
              ))}
              {!purchase.revisions.length ? (
                <Text style={s.muted}>
                  {hi
                    ? "अभी कोई बदलाव दर्ज नहीं है।"
                    : "No revisions recorded."}
                </Text>
              ) : null}
            </>
          )}
        </FocusPage>
      )}
    </Workspace>
  );
}
