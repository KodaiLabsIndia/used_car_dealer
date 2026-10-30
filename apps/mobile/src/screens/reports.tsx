import { stageKeys } from "../components/garage-motion";
import { formatDateTime } from "../components/date-format";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { ScreenProps } from "../navigation";
import { useApp } from "../state/app-context";
import { useSection } from "../state/use-section";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import {
  ActionRow,
  Button,
  ErrorNotice,
  Panel,
  Text,
  s,
} from "../components/ui";
import { Field } from "../components/forms";
import { formatMoney } from "../application/money";

export function ReportsScreen({ navigation }: ScreenProps<"Reports">) {
  const { api, language, t } = useApp(),
    hi = language === "hi",
    tr = (en: string, hn: string) => (hi ? hn : en);
  const stageLabel = (stage: string) => {
    const key = stageKeys[stage as keyof typeof stageKeys];
    return key ? t(key) : tr("Stage needs review", "चरण की जाँच करें");
  };
  const [section, setSection] = useSection("reports", "stock", [
    "stock",
    "costs",
    "cash",
    "balances",
  ] as const);
  const [scope, setScope] = useState("all"),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0);
  const resource = useResource(
      `operations-report:${scope}:${search}:${offset}`,
      () => api.operationsReport(scope, search, offset),
    ),
    data = resource.data;
  const amounts = data
    ? ([
        [
          tr("Purchase commitments", "खरीद की प्रतिबद्ध रकम"),
          data.totals.purchaseCommittedPaise,
          "costs",
        ],
        [
          tr("Seller payments recorded", "विक्रेता को दर्ज भुगतान"),
          data.totals.sellerPaidPaise,
          "cash",
        ],
        [
          tr("Seller balance", "विक्रेता की बकाया रकम"),
          data.totals.sellerBalancePaise,
          "balances",
        ],
        [
          tr("Recorded operating costs", "दर्ज संचालन खर्च"),
          data.totals.recordedCostsPaise,
          "costs",
        ],
        [
          tr("Warranty costs", "वारंटी खर्च"),
          data.totals.warrantyCostsPaise,
          "costs",
        ],
        [
          tr("Buyer collections", "खरीदार से मिली रकम"),
          data.totals.buyerCollectedPaise,
          "cash",
        ],
        [
          tr("Buyer refunds recorded", "खरीदार को दर्ज वापसी"),
          data.totals.buyerRefundedPaise,
          "cash",
        ],
        [
          tr("Buyer balance", "खरीदार की बकाया रकम"),
          data.totals.buyerBalancePaise,
          "balances",
        ],
        [
          tr("Refunds still due", "वापस करना बाकी"),
          data.totals.refundDuePaise,
          "balances",
        ],
        [
          tr("Workshop payments", "वर्कशॉप भुगतान"),
          data.totals.vendorPaidPaise,
          "cash",
        ],
        [
          tr("Workshop balance", "वर्कशॉप बकाया"),
          data.totals.vendorBalancePaise,
          "balances",
        ],
        [
          tr("Workshop advances awaiting bills", "वर्कशॉप अग्रिम: बिल बाकी"),
          data.totals.vendorAdvancePaise,
          "balances",
        ],
      ] as const)
    : [];
  return (
    <Workspace
      title={tr("Business reports", "कारोबार की रिपोर्ट")}
      selected={section}
      onChange={setSection}
      items={[
        {
          id: "stock",
          label: tr("Stock & delays", "स्टॉक और देरी"),
          icon: "car-sport-outline",
        },
        {
          id: "costs",
          label: tr("Costs", "खर्च"),
          icon: "wallet-outline",
        },
        {
          id: "cash",
          label: tr("Payments", "भुगतान"),
          icon: "swap-horizontal-outline",
        },
        {
          id: "balances",
          label: tr("Balances", "बकाया"),
          icon: "time-outline",
        },
      ]}
    >
      <FocusPage
        scrollKey={section}
        top={
          <View style={{ gap: 10 }}>
            <SelectField
              label={tr("Records", "रिकॉर्ड")}
              value={scope}
              options={[
                { id: "all", label: tr("All records", "सभी रिकॉर्ड") },
                {
                  id: "stock",
                  label: tr("Before delivery", "डिलीवरी से पहले"),
                },
                { id: "sold", label: tr("Sold cars", "बेची कारें") },
              ]}
              onChange={(value) => {
                setScope(value);
                setOffset(0);
              }}
            />
            <Field
              label={tr("Find car", "कार खोजें")}
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setOffset(0);
              }}
            />
          </View>
        }
        footer={
          section === "stock" ? (
            <ActionRow>
              <Button
                secondary
                label={tr("Previous", "पिछला")}
                style={{ flex: 1 }}
                disabled={!offset || resource.loading}
                onPress={() => setOffset(Math.max(0, offset - 30))}
              />
              <Button
                secondary
                label={tr("Next", "अगला")}
                style={{ flex: 1 }}
                disabled={resource.loading || offset + 30 >= (data?.total ?? 0)}
                onPress={() => setOffset(offset + 30)}
              />
            </ActionRow>
          ) : undefined
        }
      >
        {resource.error ? (
          <ErrorNotice message={resource.error} retry={resource.refresh} />
        ) : null}
        {resource.loading ? <ActivityIndicator color="#fff" /> : null}
        {data ? (
          <Text style={s.muted}>
            {data.total}{" "}
            {tr(
              "records · totals include every matching page",
              "रिकॉर्ड · कुल में सभी पेज शामिल हैं",
            )}{" "}
            · {formatDateTime(data.cutoff, language)}
          </Text>
        ) : null}
        {section === "stock" ? (
          data?.items.map((row) => (
            <Panel key={row.carId}>
              <Text style={{ fontSize: 22, fontWeight: "600" }}>
                {row.carLabel}
              </Text>
              <Text>
                {row.registration} · {row.stockNumber}
              </Text>
              <Text>
                {row.location} · {stageLabel(row.stage)}
              </Text>
              <Text>
                {row.stockAgeDays === null
                  ? tr(
                      "Physical receipt not recorded",
                      "गाड़ी मिलने का रिकॉर्ड नहीं",
                    )
                  : `${row.stockAgeDays} ${tr("days from receipt to delivery / today", "दिन: प्राप्ति से डिलीवरी / आज तक")}`}
              </Text>
              <Text>
                {row.openJobs} {tr("open jobs", "बाकी काम")} · {row.waitingJobs}{" "}
                {tr("waiting for parts", "पुर्जों के लिए रुके")}
              </Text>
              {row.oldestDueAt ? (
                <Text>
                  {tr("Earliest job due", "सबसे पहले काम की तारीख")}:{" "}
                  {formatDateTime(row.oldestDueAt, language)}
                </Text>
              ) : null}
              <Button
                secondary
                label={tr("Open source car", "मूल कार रिकॉर्ड खोलें")}
                onPress={() => navigation.navigate("Car", { id: row.carId })}
              />
            </Panel>
          ))
        ) : (
          <>
            <Text>
              {tr(
                "Recorded costs, commitments and cash movements are separate. These figures do not establish accounting profit.",
                "दर्ज खर्च, प्रतिबद्ध रकम और भुगतान अलग हैं। ये रकम लेखा लाभ नहीं बताती।",
              )}
            </Text>
            {amounts
              .filter(([, , group]) => group === section)
              .map(([label, value]) => (
                <Panel key={label}>
                  <Text>{label}</Text>
                  <Text style={{ fontSize: 26, fontWeight: "600" }}>
                    {formatMoney(value, hi)}
                  </Text>
                </Panel>
              ))}
          </>
        )}
        {!resource.loading && data && !data.total ? (
          <Text>{tr("No matching records.", "कोई रिकॉर्ड नहीं मिला।")}</Text>
        ) : null}
      </FocusPage>
    </Workspace>
  );
}
