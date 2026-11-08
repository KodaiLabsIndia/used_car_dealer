import { useIsFocused } from "@react-navigation/native";
import { salaryStatementText } from "@arihant/contracts";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  RefreshControl,
  Share,
  View,
} from "react-native";
import type { WorkforceCommand, AttendanceRecord } from "@arihant/contracts";
import { can } from "../application/access";
import { sendCommand } from "../application/send-command";
import { formatMoney, parseRupees, rupeeInput } from "../application/money";
import { attendanceLocation } from "../adapters/attendance-location";
import { preparePhoto } from "../adapters/photo";
import { useApp } from "../state/app-context";
import { useResource } from "../state/use-resource";
import { Workspace, FocusPage, SelectField } from "../components/workspace";
import { BusinessForm, type BusinessField } from "../components/business-form";
import { DateField } from "../components/date-field";
import { PhotoCamera } from "../components/photo-camera";
import {
  ActionRow,
  Button,
  Panel,
  Pill,
  Text,
  s,
  ErrorNotice,
} from "../components/ui";
import type { ScreenProps } from "../navigation";

type Action = WorkforceCommand["action"];
type Form = {
  kind: Action | "policy" | "holiday" | "adjust";
  title: string;
  fields: BusinessField[];
  target?: string | undefined;
  version: number;
  signature?: string | undefined;
};
export function WorkforceScreen({ route }: ScreenProps<"Workforce">) {
  const { api, session, language, changed } = useApp();
  const actor = session!.actor;
  const tr = (en: string, hi: string, mr: string) =>
    language === "mr" ? mr : language === "hi" ? hi : en;
  const finance = can(actor, "finance"),
    owner = actor.role === "owner";
  const [person, setPerson] = useState(route.params?.userId ?? actor.id),
    [asOf, setAsOf] = useState("");
  const [section, setSection] = useState<
      "attendance" | "leave" | "pay" | "rules"
    >(route.params?.section ?? "attendance"),
    [form, setForm] = useState<Form | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [camera, setCamera] = useState(false),
    [punchAction, setPunchAction] = useState<"punch_in" | "punch_out">(
      "punch_in",
    ),
    [bonus, setBonus] = useState(0),
    [deduction, setDeduction] = useState(0),
    [breakdown, setBreakdown] = useState(false),
    [proof, setProof] = useState<string | null>(null);
  useEffect(() => {
    if (route.params?.userId) setPerson(route.params.userId);
    if (route.params?.section) setSection(route.params.section);
  }, [route.params?.userId, route.params?.section]);
  const resource = useResource(`workforce:${person}:${asOf}`, () =>
    api.workforce(person, asOf || undefined),
  );
  const data = resource.data;
  useEffect(() => {
    if (data && !asOf) setAsOf(data.today);
  }, [data?.today, asOf]);
  const payroll = useResource(
    `salary:${person}:${asOf}:${bonus}:${deduction}:${!!data?.payTerms}`,
    () =>
      data?.payTerms && asOf
        ? api.salaryPreview(person, asOf, bonus, deduction)
        : Promise.resolve(null),
  );
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || form) return;
    const refresh = () => {
      if (AppState.currentState === "active") {
        resource.refresh();
        payroll.refresh();
      }
    };
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [focused, form, person, asOf]);
  const own = person === actor.id;
  const current =
    data?.attendance.find((a) => a.workDate === asOf) ??
    (asOf === data?.today
      ? data?.attendance.find(
          (a) =>
            a.workDate < data.today &&
            a.schedule.end < a.schedule.start &&
            a.cutoffAt > data.serverNow,
        )
      : undefined);
  const money = (v: number) => formatMoney(v, language === "hi");
  const labels: Record<string, string> = {
    not_punched: tr("Not punched in", "आने का पंच नहीं", "येण्याचा पंच नाही"),
    off_day: tr("Off day", "छुट्टी का दिन", "सुट्टीचा दिवस"),
    open: tr("At work", "काम पर", "कामावर"),
    closed: tr("Day finished", "दिन पूरा", "दिवस पूर्ण"),
    missed_out: tr(
      "Punch-out missing",
      "जाने का पंच बाकी",
      "बाहेर पडण्याचा पंच नाही",
    ),
    pending: tr("Awaiting review", "मंज़ूरी बाकी", "मंजुरी बाकी"),
    approved: tr("Approved", "मंज़ूर", "मंजूर"),
    rejected: tr("Returned", "वापस किया", "परत केले"),
    paid: tr("Paid", "भुगतान दर्ज", "पैसे दिले"),
    confirmed: tr("Confirmed", "पक्का किया", "निश्चित"),
    void: tr("Voided", "रद्द", "रद्द"),
    full: tr("Full recovery", "पूरी वसूली", "पूर्ण वसुली"),
    skip: tr("Skip this salary", "इस वेतन में नहीं", "या पगारातून नाही"),
    partial: tr("Smaller amount", "कम रकम", "कमी रक्कम"),
    split: tr("Split across salaries", "कई वेतन में बाँटें", "पगारांत विभागा"),
    attendance: tr("Attendance", "हाज़िरी", "हजेरी"),
    weekly_off: tr("Weekly off", "साप्ताहिक छुट्टी", "साप्ताहिक सुट्टी"),
    paid_leave: tr("Paid leave", "वेतन वाली छुट्टी", "पगारी रजा"),
    unpaid_leave: tr("Unpaid leave", "बिना वेतन छुट्टी", "बिनपगारी रजा"),
    paid_holiday: tr("Paid holiday", "वेतन वाला अवकाश", "पगारी सुट्टी"),
    unpaid_holiday: tr("Unpaid holiday", "बिना वेतन अवकाश", "बिनपगारी सुट्टी"),
    missing: tr("Needs review", "जाँच बाकी", "तपासणी बाकी"),
    reviewed: tr("Reviewed paid time", "समय की समीक्षा हुई", "वेळ तपासली"),
    off_day_work: tr(
      "Work on a day off",
      "छुट्टी के दिन काम",
      "सुट्टीच्या दिवशी काम",
    ),
  };
  const field = (
    key: string,
    en: string,
    hi: string,
    mr: string,
    kind: BusinessField["kind"] = "text",
    initial?: string,
  ): BusinessField => ({
    key,
    label: tr(en, hi, mr),
    kind,
    ...(initial !== undefined ? { initial } : {}),
  });
  const reason = field(
    "reason",
    "Reason / agreed note",
    "कारण / सहमति का नोट",
    "कारण / मान्य नोंद",
  );
  const open = (
    kind: Form["kind"],
    title: string,
    fields: BusinessField[],
    target?: string,
    version = 0,
    signature?: string,
  ) => {
    setError("");
    setForm({ kind, title, fields, target, version, signature });
  };
  const amount = (key: string, v: Record<string, string>) => {
    const n = parseRupees(v[key] ?? "0");
    if (n === null)
      throw Error(
        tr(
          "Enter a valid rupee amount.",
          "सही रुपये की रकम भरें।",
          "योग्य रुपयांची रक्कम भरा.",
        ),
      );
    return n;
  };
  const number = (key: string, v: Record<string, string>) => {
    const n = Number(v[key]);
    if (!Number.isInteger(n) || n < 0)
      throw Error(
        tr("Enter a whole number.", "पूरी संख्या भरें।", "पूर्ण संख्या भरा."),
      );
    return n;
  };
  async function run(payload: Omit<WorkforceCommand, "commandId">) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        actor.id,
        `workforce:${person}:${payload.action}`,
        payload,
        (b) => api.workforceCommand(person, b),
      );
      changed();
      return true;
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        resource.refresh();
        payroll.refresh();
      }
      setError(
        (e as { code?: string }).code === "SOURCE_CHANGED"
          ? tr(
              "Sources changed. Close this form and review the updated calculation.",
              "जानकारी बदली है। फॉर्म बंद करके नई गणना जाँचें।",
              "माहिती बदलली आहे. फॉर्म बंद करून नवीन हिशोब तपासा.",
            )
          : (e as Error).message,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function punch(action: "punch_in" | "punch_out", proofId?: string) {
    if (!data) return;
    const location = data.policy.collectLocation
      ? await attendanceLocation()
      : {};
    return run({
      action,
      punch: {
        mocked: false,
        ...location,
        clientTime: new Date().toISOString(),
        proofId: proofId ?? null,
      },
      sessionId: action === "punch_out" ? (current?.id ?? null) : null,
      expectedVersion: current?.version ?? 0,
    });
  }
  function startPunch(action: "punch_in" | "punch_out") {
    setPunchAction(action);
    if (
      action === "punch_out"
        ? current?.selfieRequired
        : data?.policy.selfieRequired
    )
      setCamera(true);
    else void punch(action);
  }
  function reviewDay(record?: AttendanceRecord) {
    open(
      "review_day",
      tr("Review paid time", "वेतन के समय की जाँच", "पगारी वेळ तपासा"),
      [
        field(
          "day",
          "Work day",
          "काम का दिन",
          "कामाचा दिवस",
          "date",
          record?.workDate ?? asOf,
        ),
        {
          ...field(
            "halves",
            "Payable day",
            "वेतन वाला दिन",
            "पगारी दिवस",
            "select",
            "2",
          ),
          options: [
            {
              id: "0",
              label: tr(
                "Unpaid / absent",
                "बिना वेतन / अनुपस्थित",
                "बिनपगारी / गैरहजर",
              ),
            },
            { id: "1", label: tr("Half day", "आधा दिन", "अर्धा दिवस") },
            { id: "2", label: tr("Full day", "पूरा दिन", "पूर्ण दिवस") },
          ],
        },
        field(
          "minutes",
          "Paid minutes · required for hourly pay",
          "वेतन के मिनट · घंटे के वेतन के लिए ज़रूरी",
          "पगारी मिनिटे · ताशी पगारासाठी आवश्यक",
          "number",
          record?.minutes?.toString() ?? "",
        ),
        reason,
      ],
      undefined,
      0,
      record?.sourceSignature ?? data?.emptyDaySignature,
    );
  }
  async function submit(v: Record<string, string>, version: number) {
    if (!form || !data) return false;
    if (form.kind === "adjust") {
      setBonus(amount("bonus", v));
      setDeduction(amount("deduction", v));
      setForm(null);
      return true;
    }
    if (form.kind === "policy" || form.kind === "holiday") {
      setBusy(true);
      try {
        const policy = { ...data.policy, effectiveFrom: data.today };
        if (form.kind === "holiday") {
          policy.holidays = [
            ...policy.holidays.filter((h) => h.day !== v.day),
            { day: v.day!, name: v.name!, paid: v.paid === "yes" },
          ].sort((a, b) => a.day.localeCompare(b.day));
        } else {
          policy.schedule = {
            ...policy.schedule,
            start: v.start!,
            end: v.end!,
            graceMinutes: number("grace", v),
            weekdays: [0, 1, 2, 3, 4, 5, 6].filter(
              (d) => v[`day${d}`] === "yes",
            ),
          };
          policy.paidLeaveHalfDays = Number(v.leaveDays) * 2;
          policy.collectLocation = v.location === "yes";
          policy.selfieRequired = v.selfie === "yes";
          policy.latitude = v.latitude?.trim() ? Number(v.latitude) : null;
          policy.longitude = v.longitude?.trim() ? Number(v.longitude) : null;
          policy.radiusM = number("radius", v);
        }
        await sendCommand(
          actor.id,
          "workforce-policy",
          { expectedVersion: version, policy, reason: v.reason ?? "" },
          (b) => api.publishWorkforcePolicy(b),
        );
        changed();
        setForm(null);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    }
    let p: Omit<WorkforceCommand, "commandId"> = {
      action: form.kind,
      expectedVersion: version,
      targetId: form.target ?? null,
      reason: v.reason ?? "",
      asOf,
    };
    switch (form.kind) {
      case "save_profile":
        p = {
          ...p,
          terms: {
            effectiveFrom: v.effective!,
            basis: v.basis as "daily",
            cycle: v.cycle as "daily",
            ratePaise: amount("rate", v),
            payoutDelayDays: number("delay", v),
            schedule:
              v.custom === "yes"
                ? {
                    timezone: "Asia/Kolkata",
                    start: v.start!,
                    end: v.end!,
                    weekdays: [0, 1, 2, 3, 4, 5, 6].filter(
                      (d) => v[`day${d}`] === "yes",
                    ),
                    graceMinutes: number("grace", v),
                  }
                : null,
          },
        };
        break;
      case "request_leave":
        p = {
          ...p,
          start: v.start!,
          end: v.end!,
          halfDays: number("halves", v),
          paid: v.paid === "yes",
        };
        break;
      case "review_leave":
      case "review_advance":
        p = { ...p, decision: v.decision as "approved" | "rejected" };
        break;
      case "request_advance":
        p = { ...p, amountPaise: amount("amount", v) };
        break;
      case "pay_advance":
      case "pay_salary":
        p = {
          ...p,
          amountPaise: amount("amount", v),
          reference: v.reference ?? "",
          occurredAt: new Date(v.occurred!).toISOString(),
        };
        break;
      case "review_day": {
        const r = data.attendance.find((a) => a.workDate === v.day);
        p = {
          ...p,
          workDate: v.day!,
          halfDays: number("halves", v),
          minutes: v.minutes?.trim() ? number("minutes", v) : null,
          fingerprint: r?.sourceSignature ?? data.emptyDaySignature,
        };
        break;
      }
      case "save_advance_plan":
        p = {
          ...p,
          planMode: v.mode as "split",
          installments: number("installments", v),
          amountPaise: amount("amount", v),
        };
        break;
      case "confirm_salary":
        p = {
          ...p,
          fingerprint: form.signature ?? "",
          bonusPaise: bonus,
          deductionPaise: deduction,
        };
        break;
    }
    const ok = await run(p);
    if (ok) setForm(null);
    return ok;
  }
  const paymentFields = (value: number) => [
    field(
      "amount",
      "Amount · ₹",
      "रकम · ₹",
      "रक्कम · ₹",
      "money",
      rupeeInput(value),
    ),
    field(
      "reference",
      "Bank / cash voucher reference",
      "बैंक / नकद रसीद संदर्भ",
      "बँक / रोख पावती संदर्भ",
    ),
    field(
      "occurred",
      "Paid at",
      "भुगतान का समय",
      "पैसे दिल्याची वेळ",
      "datetime",
      new Date().toISOString(),
    ),
    reason,
  ];
  const weekdays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    hiDays = [
      "सोमवार",
      "मंगलवार",
      "बुधवार",
      "गुरुवार",
      "शुक्रवार",
      "शनिवार",
      "रविवार",
    ],
    mrDays = [
      "सोमवार",
      "मंगळवार",
      "बुधवार",
      "गुरुवार",
      "शुक्रवार",
      "शनिवार",
      "रविवार",
    ];
  const scheduleFields = (schedule = data?.policy.schedule) => [
    field(
      "start",
      "Shift starts · HH:MM",
      "शिफ्ट शुरू · HH:MM",
      "पाळी सुरू · HH:MM",
      "text",
      schedule?.start,
    ),
    field(
      "end",
      "Shift ends · HH:MM",
      "शिफ्ट समाप्त · HH:MM",
      "पाळी संपते · HH:MM",
      "text",
      schedule?.end,
    ),
    field(
      "grace",
      "Late grace · minutes",
      "देर की छूट · मिनट",
      "उशिराची सवलत · मिनिटे",
      "number",
      String(schedule?.graceMinutes ?? 15),
    ),
    ...weekdays.map((day, i) =>
      field(
        `day${i}`,
        day,
        hiDays[i]!,
        mrDays[i]!,
        "choice",
        schedule?.weekdays.includes(i) ? "yes" : "no",
      ),
    ),
  ];
  const reviewFields = [
    {
      ...field("decision", "Decision", "फैसला", "निर्णय", "select", "approved"),
      options: [
        { id: "approved", label: labels.approved! },
        { id: "rejected", label: labels.rejected! },
      ],
    },
    reason,
  ];
  return (
    <Workspace
      title={tr("Attendance & pay", "हाज़िरी और वेतन", "हजेरी आणि पगार")}
      selected={section}
      onChange={(v) => {
        setSection(v);
        setForm(null);
        setError("");
      }}
      busy={busy || !!form}
      items={[
        { id: "attendance", label: labels.attendance!, icon: "time-outline" },
        {
          id: "leave",
          label: tr("Leave", "छुट्टी", "रजा"),
          icon: "calendar-outline",
        },
        { id: "pay", label: tr("Pay", "वेतन", "पगार"), icon: "wallet-outline" },
        ...(owner
          ? [
              {
                id: "rules" as const,
                label: tr("Rules", "नियम", "नियम"),
                icon: "options-outline" as const,
              },
            ]
          : []),
      ]}
    >
      {form ? (
        <BusinessForm
          spec={{
            key: `workforce:${person}:${form.kind}:${form.target ?? asOf}`,
            title: form.title,
            note:
              form.kind === "confirm_salary" && payroll.data
                ? `${payroll.data.start} → ${payroll.data.end}\n${tr("Earned", "कमाई", "कमाई")}: ${money(payroll.data.basePaise)}\n${tr("Advance recovery", "अग्रिम वसूली", "आगाऊ वसुली")}: ${money(payroll.data.advanceRecoveryPaise)}\n${tr("Net salary", "मिलने वाला वेतन", "निव्वळ पगार")}: ${money(payroll.data.netPaise)}`
                : ["pay_salary", "pay_advance"].includes(form.kind)
                  ? tr(
                      "Record a completed bank/cash payment.",
                      "पूरा हुआ बैंक या नकद भुगतान दर्ज करें।",
                      "पूर्ण झालेले बँक किंवा रोख देयक नोंदवा.",
                    )
                  : undefined,
            submitLabel: tr(
              "Review & save",
              "जाँचकर सेव करें",
              "तपासून जतन करा",
            ),
            steps: Array.from(
              { length: Math.ceil(form.fields.length / 3) },
              (_, i) => ({
                label: tr("Details", "जानकारी", "माहिती"),
                fields: form.fields.slice(i * 3, i * 3 + 3),
              }),
            ),
          }}
          version={form.version}
          summary={data?.people.find((p) => p.id === person)?.name ?? ""}
          serverError={error}
          onBusyChange={setBusy}
          onCancel={() => setForm(null)}
          onSubmit={submit}
        />
      ) : (
        <FocusPage
          scrollKey={`${section}:${person}`}
          refreshControl={
            <RefreshControl
              refreshing={resource.loading}
              onRefresh={() => {
                resource.refresh();
                payroll.refresh();
              }}
            />
          }
        >
          {error || resource.error ? (
            <ErrorNotice
              message={error || resource.error}
              retry={resource.refresh}
            />
          ) : null}
          {!data ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {finance ? (
                <SelectField
                  label={tr("Person", "व्यक्ति", "व्यक्ती")}
                  value={person}
                  options={data.people.map((p) => ({
                    id: p.id,
                    label:
                      p.name +
                      (p.active
                        ? ""
                        : tr(" · inactive", " · बंद", " · निष्क्रिय")),
                  }))}
                  onChange={(id) => {
                    setPerson(id);
                    setBonus(0);
                    setDeduction(0);
                  }}
                />
              ) : null}
              <DateField
                label={tr(
                  "Work / pay-period date",
                  "काम / वेतन की तारीख",
                  "कामाची / पगाराची तारीख",
                )}
                value={asOf}
                onChange={setAsOf}
              />
              {section === "attendance" ? (
                <>
                  {finance ? (
                    <>
                      <Text style={s.label}>
                        {tr("Team attendance", "टीम की हाज़िरी", "टीमची हजेरी")}
                      </Text>
                      <ActionRow>
                        {data.people.map((p) => (
                          <Button
                            key={p.id}
                            secondary={p.id !== person}
                            label={`${p.name} · ${labels[p.attendanceStatus] ?? p.attendanceStatus}`}
                            onPress={() => setPerson(p.id)}
                          />
                        ))}
                      </ActionRow>
                    </>
                  ) : null}
                  <Panel>
                    <Text style={s.title}>
                      {current
                        ? labels[current.status]
                        : tr(
                            "Not punched in",
                            "आने का पंच नहीं",
                            "येण्याचा पंच नाही",
                          )}
                    </Text>
                    <Text>
                      {data.people.find((p) => p.id === person)?.name}
                    </Text>
                    {current ? (
                      <>
                        <Text>
                          {current.workDate} · {current.schedule.start}–
                          {current.schedule.end}
                        </Text>
                        <Text>
                          {tr("In", "आए", "आले")}:{" "}
                          {new Date(current.punchedInAt).toLocaleString(
                            language === "en" ? "en-IN" : `${language}-IN`,
                          )}
                        </Text>
                        <Text>
                          {tr("Out", "गए", "गेले")}:{" "}
                          {current.punchedOutAt
                            ? new Date(current.punchedOutAt).toLocaleString(
                                language === "en" ? "en-IN" : `${language}-IN`,
                              )
                            : tr(
                                "Unknown until recorded",
                                "पंच तक अज्ञात",
                                "नोंद होईपर्यंत अज्ञात",
                              )}
                        </Text>
                        {current.minutes !== null ? (
                          <Text>
                            {current.minutes}{" "}
                            {tr(
                              "recorded minutes",
                              "दर्ज मिनट",
                              "नोंदलेली मिनिटे",
                            )}
                          </Text>
                        ) : null}
                        {current.flags.map((f) => (
                          <Pill key={f} label={f} warning />
                        ))}
                        {current.proofId ? (
                          <Button
                            secondary
                            label={tr(
                              "View punch photo",
                              "पंच की फोटो देखें",
                              "पंचचा फोटो पहा",
                            )}
                            onPress={() =>
                              setProof(
                                proof === current.proofId
                                  ? null
                                  : current.proofId,
                              )
                            }
                          />
                        ) : null}
                        {current.outProofId ? (
                          <Button
                            secondary
                            label={tr(
                              "View punch-out photo",
                              "जाते समय की फोटो",
                              "बाहेर पडतानाचा फोटो",
                            )}
                            onPress={() =>
                              setProof(
                                proof === current.outProofId
                                  ? null
                                  : current.outProofId,
                              )
                            }
                          />
                        ) : null}
                      </>
                    ) : (
                      <Text>
                        {tr(
                          "Punches use server time. Location warnings can be reviewed.",
                          "पंच में सर्वर का समय लगता है। स्थान की चेतावनी की जाँच हो सकती है।",
                          "पंचसाठी सर्व्हरची वेळ वापरली जाते. ठिकाणाच्या सूचनेची तपासणी करता येते.",
                        )}
                      </Text>
                    )}
                  </Panel>
                  {proof ? (
                    <Panel>
                      <Image
                        source={api.attendanceProofUri(proof)}
                        accessibilityLabel={tr(
                          "Attendance proof",
                          "हाज़िरी का सबूत",
                          "हजेरीचा पुरावा",
                        )}
                        style={{
                          height: 260,
                          width: "100%",
                          resizeMode: "contain",
                        }}
                      />
                      <Button
                        secondary
                        label={tr(
                          "Close photo",
                          "फोटो बंद करें",
                          "फोटो बंद करा",
                        )}
                        onPress={() => setProof(null)}
                      />
                    </Panel>
                  ) : null}
                  {own ? (
                    <Button
                      busy={busy}
                      disabled={
                        asOf !== data.today || current?.status === "closed"
                      }
                      icon="finger-print-outline"
                      label={
                        current?.status === "open"
                          ? tr("Punch out", "जाने का पंच", "बाहेर पडण्याचा पंच")
                          : tr("Punch in", "आने का पंच", "येण्याचा पंच")
                      }
                      onPress={() =>
                        startPunch(
                          current?.status === "open" ? "punch_out" : "punch_in",
                        )
                      }
                    />
                  ) : null}
                  {finance ? (
                    <Button
                      secondary
                      label={tr(
                        "Review paid time",
                        "वेतन के समय की जाँच",
                        "पगारी वेळ तपासा",
                      )}
                      onPress={() => reviewDay(current)}
                    />
                  ) : null}
                  {data.attendance.length ? (
                    <SelectField
                      label={tr("Recorded days", "दर्ज दिन", "नोंदलेले दिवस")}
                      value={asOf}
                      options={data.attendance.map((a) => ({
                        id: a.workDate,
                        label: `${a.workDate} · ${labels[a.status]}`,
                      }))}
                      onChange={setAsOf}
                    />
                  ) : null}
                  {data.reviews
                    .filter((r) => r.workDate === (current?.workDate ?? asOf))
                    .map((r) => (
                      <Panel key={r.id}>
                        <Text>
                          {tr(
                            "Paid-time review",
                            "वेतन के समय की समीक्षा",
                            "पगारी वेळेची तपासणी",
                          )}
                          : {r.halfDays / 2} {tr("day", "दिन", "दिवस")} ·{" "}
                          {r.minutes ?? "—"} {tr("minutes", "मिनट", "मिनिटे")}
                        </Text>
                        <Text>
                          {r.reviewedBy} · {r.reason}
                        </Text>
                      </Panel>
                    ))}
                </>
              ) : section === "leave" ? (
                <>
                  <Text style={s.title}>
                    {tr(
                      "Paid leave used",
                      "ली गई वेतन वाली छुट्टी",
                      "वापरलेली पगारी रजा",
                    )}
                    : {data.leaveUsedHalfDays / 2} /{" "}
                    {data.policy.paidLeaveHalfDays / 2}
                  </Text>
                  {own ? (
                    <Button
                      label={tr("Request leave", "छुट्टी माँगें", "रजा मागा")}
                      onPress={() =>
                        open(
                          "request_leave",
                          tr("Request leave", "छुट्टी की माँग", "रजेची विनंती"),
                          [
                            field(
                              "start",
                              "From",
                              "कब से",
                              "कधीपासून",
                              "date",
                              asOf,
                            ),
                            field(
                              "end",
                              "Through",
                              "कब तक",
                              "कधीपर्यंत",
                              "date",
                              asOf,
                            ),
                            {
                              ...field(
                                "halves",
                                "Days",
                                "दिन",
                                "दिवस",
                                "select",
                                "2",
                              ),
                              options: [
                                {
                                  id: "2",
                                  label: tr(
                                    "Full day(s)",
                                    "पूरा दिन",
                                    "पूर्ण दिवस",
                                  ),
                                },
                                {
                                  id: "1",
                                  label: tr(
                                    "Half day · one date",
                                    "आधा दिन · एक तारीख",
                                    "अर्धा दिवस · एक तारीख",
                                  ),
                                },
                              ],
                            },
                            field(
                              "paid",
                              "Paid leave requested",
                              "वेतन वाली छुट्टी चाहिए",
                              "पगारी रजा हवी",
                              "choice",
                              "yes",
                            ),
                            reason,
                          ],
                        )
                      }
                    />
                  ) : null}
                  {data.leaves
                    .slice()
                    .reverse()
                    .map((l) => (
                      <Panel key={l.id}>
                        <Text style={s.label}>
                          {l.start} → {l.end}
                        </Text>
                        <Pill label={labels[l.status]!} />
                        <Text>
                          {l.reason} ·{" "}
                          {l.paid
                            ? tr("Paid", "वेतन सहित", "पगारी")
                            : tr("Unpaid", "बिना वेतन", "बिनपगारी")}
                        </Text>
                        {l.reviewReason ? <Text>{l.reviewReason}</Text> : null}
                        {finance && l.status === "pending" ? (
                          <Button
                            label={tr(
                              "Review request",
                              "माँग की जाँच",
                              "विनंती तपासा",
                            )}
                            onPress={() =>
                              open(
                                "review_leave",
                                tr(
                                  "Leave decision",
                                  "छुट्टी का फैसला",
                                  "रजेचा निर्णय",
                                ),
                                reviewFields,
                                l.id,
                                l.version,
                              )
                            }
                          />
                        ) : null}
                      </Panel>
                    ))}
                </>
              ) : section === "pay" ? (
                <>
                  <ActionRow>
                    {owner ? (
                      <Button
                        secondary
                        label={tr("Set pay terms", "वेतन तय करें", "पगार ठरवा")}
                        onPress={() =>
                          open(
                            "save_profile",
                            tr("Agreed pay terms", "सहमत वेतन", "मान्य पगार"),
                            [
                              {
                                ...field(
                                  "basis",
                                  "Pay basis",
                                  "वेतन का आधार",
                                  "पगाराचा आधार",
                                  "select",
                                  data.payTerms?.basis ?? "monthly",
                                ),
                                options: [
                                  "daily",
                                  "weekly",
                                  "monthly",
                                  "hourly",
                                ].map((id, i) => ({
                                  id,
                                  label: [
                                    tr("Daily", "दैनिक", "दैनिक"),
                                    tr("Weekly", "साप्ताहिक", "साप्ताहिक"),
                                    tr("Monthly", "मासिक", "मासिक"),
                                    tr(
                                      "Hourly",
                                      "घंटे के हिसाब से",
                                      "तासानुसार",
                                    ),
                                  ][i]!,
                                })),
                              },
                              {
                                ...field(
                                  "cycle",
                                  "Settlement cycle",
                                  "भुगतान अवधि",
                                  "पगाराची मुदत",
                                  "select",
                                  data.payTerms?.cycle ?? "monthly",
                                ),
                                options: ["daily", "weekly", "monthly"].map(
                                  (id, i) => ({
                                    id,
                                    label: [
                                      tr("Daily", "दैनिक", "दैनिक"),
                                      tr("Weekly", "साप्ताहिक", "साप्ताहिक"),
                                      tr("Monthly", "मासिक", "मासिक"),
                                    ][i]!,
                                  }),
                                ),
                              },
                              field(
                                "rate",
                                "Agreed rate · ₹",
                                "सहमत दर · ₹",
                                "मान्य दर · ₹",
                                "money",
                                rupeeInput(data.payTerms?.ratePaise ?? 0),
                              ),
                              field(
                                "effective",
                                "Effective from",
                                "कब से लागू",
                                "कधीपासून लागू",
                                "date",
                                data.today,
                              ),
                              field(
                                "delay",
                                "Due days after period end",
                                "अवधि के बाद भुगतान के दिन",
                                "मुदतीनंतर देय दिवस",
                                "number",
                                String(data.payTerms?.payoutDelayDays ?? 1),
                              ),
                              field(
                                "custom",
                                "Use employee-specific shift",
                                "व्यक्ति की अलग शिफ्ट",
                                "व्यक्तीची वेगळी पाळी",
                                "choice",
                                data.payTerms?.schedule ? "yes" : "no",
                              ),
                              ...scheduleFields(
                                data.payTerms?.schedule ?? data.policy.schedule,
                              ),
                              reason,
                            ],
                            undefined,
                            data.profileVersion,
                          )
                        }
                      />
                    ) : null}
                    {finance ? (
                      <Button
                        secondary
                        label={tr(
                          "Bonus / deduction",
                          "बोनस / कटौती",
                          "बोनस / कपात",
                        )}
                        onPress={() =>
                          open(
                            "adjust",
                            tr(
                              "Salary adjustments",
                              "वेतन के बदलाव",
                              "पगारातील बदल",
                            ),
                            [
                              field(
                                "bonus",
                                "Bonus · ₹",
                                "बोनस · ₹",
                                "बोनस · ₹",
                                "money",
                                rupeeInput(bonus),
                              ),
                              field(
                                "deduction",
                                "Other agreed deduction · ₹",
                                "अन्य सहमत कटौती · ₹",
                                "इतर मान्य कपात · ₹",
                                "money",
                                rupeeInput(deduction),
                              ),
                            ],
                          )
                        }
                      />
                    ) : null}
                  </ActionRow>
                  {payroll.error ? (
                    <ErrorNotice
                      message={payroll.error}
                      retry={payroll.refresh}
                    />
                  ) : null}
                  {!data.payTerms ? (
                    <Text>
                      {tr(
                        "The owner has not set pay terms for this date.",
                        "इस तारीख के लिए मालिक ने वेतन तय नहीं किया है।",
                        "या तारखेसाठी मालकाने पगार ठरवलेला नाही.",
                      )}
                    </Text>
                  ) : payroll.data ? (
                    <>
                      <Panel>
                        <Text style={s.label}>
                          {payroll.data.start} → {payroll.data.end}
                        </Text>
                        <Text>
                          {tr("Earned", "कमाई", "कमाई")}:{" "}
                          {money(payroll.data.basePaise)}
                        </Text>
                        <Text>
                          {tr(
                            "Bonus / other deduction",
                            "बोनस / अन्य कटौती",
                            "बोनस / इतर कपात",
                          )}
                          : +{money(payroll.data.bonusPaise)} / −
                          {money(payroll.data.deductionPaise)}
                        </Text>
                        <Text>
                          {tr(
                            "Advance recovery",
                            "अग्रिम की वसूली",
                            "आगाऊ रकमेची वसुली",
                          )}
                          : {money(payroll.data.advanceRecoveryPaise)}
                        </Text>
                        <Text style={s.title}>
                          {money(payroll.data.netPaise)}
                        </Text>
                        <Text>
                          {tr("Due", "देय", "देय")}: {payroll.data.dueOn}
                        </Text>
                      </Panel>
                      {payroll.data.blockers.map((b) => (
                        <Text key={b} style={s.muted}>
                          {b}
                        </Text>
                      ))}
                      <Button
                        secondary
                        label={
                          breakdown
                            ? tr(
                                "Hide calculation",
                                "गणना छिपाएँ",
                                "हिशोब लपवा",
                              )
                            : tr(
                                "Explain calculation",
                                "गणना देखें",
                                "हिशोब पहा",
                              )
                        }
                        onPress={() => setBreakdown(!breakdown)}
                      />
                      {breakdown
                        ? payroll.data.sourceDays.map((d) => (
                            <Panel key={d.day}>
                              <Text>
                                {d.day} · {labels[d.source] ?? d.source}
                              </Text>
                              <Text>
                                {d.halfDays / 2} {tr("day", "दिन", "दिवस")} ·{" "}
                                {d.minutes ?? "—"}{" "}
                                {tr("minutes", "मिनट", "मिनिटे")} ·{" "}
                                {money(d.earningsPaise)}
                              </Text>
                              {d.warnings.map((w) => (
                                <Text key={w}>{w}</Text>
                              ))}
                            </Panel>
                          ))
                        : null}
                      {finance ? (
                        <Button
                          label={tr(
                            "Confirm salary",
                            "वेतन पक्का करें",
                            "पगार निश्चित करा",
                          )}
                          disabled={!!payroll.data.blockers.length}
                          onPress={() =>
                            open(
                              "confirm_salary",
                              tr(
                                "Confirm reviewed salary",
                                "जाँचा हुआ वेतन पक्का करें",
                                "तपासलेला पगार निश्चित करा",
                              ),
                              [reason],
                              undefined,
                              0,
                              payroll.data!.fingerprint,
                            )
                          }
                        />
                      ) : null}
                    </>
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )}
                  <Text style={s.title}>
                    {tr("Salary advances", "अग्रिम वेतन", "आगाऊ पगार")} ·{" "}
                    {money(data.advanceBalancePaise)}
                  </Text>
                  {own ? (
                    <Button
                      secondary
                      label={tr(
                        "Request an advance",
                        "अग्रिम माँगें",
                        "आगाऊ रक्कम मागा",
                      )}
                      onPress={() =>
                        open(
                          "request_advance",
                          tr(
                            "Advance request",
                            "अग्रिम की माँग",
                            "आगाऊ रकमेची विनंती",
                          ),
                          [
                            field(
                              "amount",
                              "Amount · ₹",
                              "रकम · ₹",
                              "रक्कम · ₹",
                              "money",
                            ),
                            reason,
                          ],
                        )
                      }
                    />
                  ) : null}
                  {finance && data.advanceBalancePaise > 0 ? (
                    <Button
                      secondary
                      label={tr(
                        "Set recovery plan",
                        "वसूली की योजना",
                        "वसुलीची योजना",
                      )}
                      onPress={() =>
                        open(
                          "save_advance_plan",
                          tr(
                            "Advance recovery plan",
                            "अग्रिम वसूली की योजना",
                            "आगाऊ वसुलीची योजना",
                          ),
                          [
                            {
                              ...field(
                                "mode",
                                "Recovery",
                                "वसूली",
                                "वसुली",
                                "select",
                                data.advancePlan?.mode ?? "full",
                              ),
                              options: ["full", "skip", "partial", "split"].map(
                                (id) => ({ id, label: labels[id]! }),
                              ),
                            },
                            field(
                              "installments",
                              "Number of salaries · split",
                              "वेतनों की संख्या · बाँटना",
                              "पगारांची संख्या · विभागणी",
                              "number",
                              "3",
                            ),
                            field(
                              "amount",
                              "Smaller recovery · ₹",
                              "कम वसूली · ₹",
                              "कमी वसुली · ₹",
                              "money",
                              "0",
                            ),
                            reason,
                          ],
                        )
                      }
                    />
                  ) : null}
                  {data.advancePlan ? (
                    <Text>
                      {labels[data.advancePlan.mode]} ·{" "}
                      {money(data.advancePlan.portionPaise)} ·{" "}
                      {data.advancePlan.startsOn}
                    </Text>
                  ) : null}
                  {data.advances
                    .slice()
                    .reverse()
                    .map((a) => (
                      <Panel key={a.id}>
                        <Text style={s.label}>
                          {money(a.amountPaise)} · {labels[a.status]}
                        </Text>
                        <Text>{a.reason}</Text>
                        {finance && a.status === "pending" ? (
                          <Button
                            label={tr(
                              "Review advance",
                              "अग्रिम की जाँच",
                              "आगाऊ रक्कम तपासा",
                            )}
                            onPress={() =>
                              open(
                                "review_advance",
                                tr(
                                  "Advance decision",
                                  "अग्रिम का फैसला",
                                  "आगाऊ रकमेचा निर्णय",
                                ),
                                reviewFields,
                                a.id,
                                a.version,
                              )
                            }
                          />
                        ) : null}
                        {finance && a.status === "approved" ? (
                          <Button
                            label={tr(
                              "Record advance paid",
                              "दिया अग्रिम दर्ज करें",
                              "दिलेली आगाऊ रक्कम नोंदवा",
                            )}
                            onPress={() =>
                              open(
                                "pay_advance",
                                tr(
                                  "Record completed payment",
                                  "पूरा भुगतान दर्ज करें",
                                  "पूर्ण झालेले देयक नोंदवा",
                                ),
                                paymentFields(a.amountPaise),
                                a.id,
                                a.version,
                              )
                            }
                          />
                        ) : null}
                      </Panel>
                    ))}
                  <Text style={s.title}>
                    {tr(
                      "Issued salary statements",
                      "जारी वेतन पर्चियाँ",
                      "जारी पगारपत्रके",
                    )}
                  </Text>
                  {data.salaries.map((salary) => (
                    <Panel key={salary.id}>
                      <Text style={s.label}>
                        {salary.start} → {salary.end} · v{salary.revision}
                      </Text>
                      <Pill label={labels[salary.status]!} />
                      <Text style={s.title}>
                        {money(salary.snapshot.netPaise)}
                      </Text>
                      <Text>
                        {tr("Paid", "भुगतान दर्ज", "दिलेली रक्कम")}:{" "}
                        {money(salary.paidPaise)} · {salary.confirmedBy}
                      </Text>
                      <Text>
                        {tr(
                          "Earned / advance recovery",
                          "कमाई / अग्रिम वसूली",
                          "कमाई / आगाऊ वसुली",
                        )}
                        : {money(salary.snapshot.basePaise)} /{" "}
                        {money(salary.snapshot.advanceRecoveryPaise)}
                      </Text>
                      <Button
                        secondary
                        label={tr(
                          "Share statement",
                          "वेतन पर्ची साझा करें",
                          "पगारपत्रक शेअर करा",
                        )}
                        onPress={() =>
                          void Share.share({
                            message: salaryStatementText(
                              salary,
                              data.people.find((p) => p.id === person)?.name ??
                                "",
                              language,
                            ),
                          }).catch((e) => setError(e.message))
                        }
                      />
                      {finance &&
                      salary.status === "confirmed" &&
                      salary.paidPaise < salary.snapshot.netPaise ? (
                        <Button
                          label={tr(
                            "Record salary paid",
                            "दिया वेतन दर्ज करें",
                            "दिलेला पगार नोंदवा",
                          )}
                          onPress={() =>
                            open(
                              "pay_salary",
                              tr(
                                "Record salary payment",
                                "वेतन का भुगतान दर्ज करें",
                                "पगाराचे देयक नोंदवा",
                              ),
                              paymentFields(
                                salary.snapshot.netPaise - salary.paidPaise,
                              ),
                              salary.id,
                            )
                          }
                        />
                      ) : null}
                      {finance &&
                      salary.status !== "void" &&
                      salary.paidPaise === 0 ? (
                        <Button
                          secondary
                          label={tr(
                            "Void for correction",
                            "सुधार के लिए रद्द",
                            "दुरुस्तीसाठी रद्द",
                          )}
                          onPress={() =>
                            open(
                              "void_salary",
                              tr(
                                "Void salary statement",
                                "वेतन पर्ची रद्द करें",
                                "पगारपत्रक रद्द करा",
                              ),
                              [reason],
                              salary.id,
                            )
                          }
                        />
                      ) : null}
                    </Panel>
                  ))}
                  {data.payments
                    .filter((e) =>
                      ["salary_payment", "advance_payment"].includes(e.kind),
                    )
                    .map((e) => (
                      <Panel key={e.id}>
                        <Text>
                          {e.reference} · {money(e.amountPaise)}
                        </Text>
                        <Text>
                          {e.recordedBy} · {e.reason}
                        </Text>
                        {e.reversed ? (
                          <Pill
                            label={tr(
                              "Corrected · original retained",
                              "सुधारा · मूल सुरक्षित",
                              "दुरुस्त · मूळ जतन",
                            )}
                          />
                        ) : finance ? (
                          <Button
                            secondary
                            label={tr(
                              "Correct mistaken payment",
                              "गलत भुगतान सुधारें",
                              "चुकीचे देयक दुरुस्त करा",
                            )}
                            onPress={() =>
                              open(
                                "reverse_payment",
                                tr(
                                  "Correct payment record",
                                  "भुगतान का रिकॉर्ड सुधारें",
                                  "देयकाची नोंद दुरुस्त करा",
                                ),
                                [reason],
                                e.id,
                              )
                            }
                          />
                        ) : null}
                      </Panel>
                    ))}
                </>
              ) : (
                <>
                  <Text style={s.title}>
                    {tr(
                      "Company attendance rules",
                      "कंपनी के हाज़िरी नियम",
                      "कंपनीचे हजेरीचे नियम",
                    )}{" "}
                    · v{data.policy.version}
                  </Text>
                  <Text>
                    {data.policy.schedule.start}–{data.policy.schedule.end} ·{" "}
                    {data.policy.schedule.weekdays
                      .map((d) => tr(weekdays[d]!, hiDays[d]!, mrDays[d]!))
                      .join(" · ")}
                  </Text>
                  <Text>
                    {tr(
                      "Late/location flags do not deduct salary automatically.",
                      "देर या स्थान की चेतावनी से वेतन अपने आप नहीं कटता।",
                      "उशीर किंवा ठिकाणाच्या सूचनेमुळे पगार आपोआप कापला जात नाही.",
                    )}
                  </Text>
                  <Button
                    label={tr(
                      "Configure attendance",
                      "हाज़िरी तय करें",
                      "हजेरी ठरवा",
                    )}
                    onPress={() =>
                      open(
                        "policy",
                        tr(
                          "Attendance rules",
                          "हाज़िरी के नियम",
                          "हजेरीचे नियम",
                        ),
                        [
                          ...scheduleFields(),
                          field(
                            "leaveDays",
                            "Annual paid leave · days",
                            "साल की वेतन वाली छुट्टी · दिन",
                            "वार्षिक पगारी रजा · दिवस",
                            "number",
                            String(data.policy.paidLeaveHalfDays / 2),
                          ),
                          field(
                            "location",
                            "Collect location at punch only",
                            "सिर्फ पंच पर स्थान लें",
                            "फक्त पंचवेळी ठिकाण घ्या",
                            "choice",
                            data.policy.collectLocation ? "yes" : "no",
                          ),
                          field(
                            "selfie",
                            "Require punch photo",
                            "पंच पर फोटो ज़रूरी",
                            "पंचवेळी फोटो आवश्यक",
                            "choice",
                            data.policy.selfieRequired ? "yes" : "no",
                          ),
                          field(
                            "latitude",
                            "Showroom latitude · optional",
                            "शोरूम अक्षांश · वैकल्पिक",
                            "शोरूम अक्षांश · ऐच्छिक",
                            "number",
                            data.policy.latitude?.toString() ?? "",
                          ),
                          field(
                            "longitude",
                            "Showroom longitude · optional",
                            "शोरूम देशांतर · वैकल्पिक",
                            "शोरूम रेखांश · ऐच्छिक",
                            "number",
                            data.policy.longitude?.toString() ?? "",
                          ),
                          field(
                            "radius",
                            "Showroom radius · metres",
                            "शोरूम दायरा · मीटर",
                            "शोरूम परिघ · मीटर",
                            "number",
                            String(data.policy.radiusM),
                          ),
                          reason,
                        ],
                        undefined,
                        data.policy.version,
                      )
                    }
                  />
                  <Button
                    secondary
                    label={tr(
                      "Add / update holiday",
                      "अवकाश जोड़ें / बदलें",
                      "सुट्टी जोडा / बदला",
                    )}
                    onPress={() =>
                      open(
                        "holiday",
                        tr(
                          "Business holiday",
                          "कंपनी का अवकाश",
                          "कंपनीची सुट्टी",
                        ),
                        [
                          field(
                            "day",
                            "Holiday date",
                            "अवकाश की तारीख",
                            "सुट्टीची तारीख",
                            "date",
                            asOf,
                          ),
                          field(
                            "name",
                            "Holiday name",
                            "अवकाश का नाम",
                            "सुट्टीचे नाव",
                          ),
                          field(
                            "paid",
                            "Paid holiday",
                            "वेतन वाला अवकाश",
                            "पगारी सुट्टी",
                            "choice",
                            "yes",
                          ),
                          reason,
                        ],
                        undefined,
                        data.policy.version,
                      )
                    }
                  />
                  {data.policy.holidays.map((h) => (
                    <Panel key={h.day}>
                      <Text>
                        {h.day} · {h.name} ·{" "}
                        {h.paid ? labels.paid_holiday : labels.unpaid_holiday}
                      </Text>
                    </Panel>
                  ))}
                </>
              )}
            </>
          )}
        </FocusPage>
      )}
      <PhotoCamera
        visible={camera}
        facing="front"
        onClose={() => setCamera(false)}
        onPhoto={async (source) => {
          setBusy(true);
          try {
            const p = await preparePhoto(source, actor.id);
            await api.uploadAttendanceProof(p.id, p.uri);
            await punch(punchAction, p.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Workspace>
  );
}
