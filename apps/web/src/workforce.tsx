import { salaryStatementText } from "@arihant/contracts";
import React, { useEffect, useState } from "react";
import {
  can,
  type Actor,
  type WorkforceView,
  type WorkforceCommand,
  type SalaryPreview,
} from "@arihant/contracts";
import type { ApiClient } from "@arihant/api-client";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    n / 100,
  );
const paise = (s: string) => {
  const v = s.trim().replace(/[₹,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(v))
    throw Error("Enter a valid rupee amount.");
  const [a, b = ""] = v.split(".");
  const n = BigInt(a!) * 100n + BigInt(b.padEnd(2, "0"));
  if (n > 100_000_000_000n) throw Error("Amount exceeds the supported limit.");
  return Number(n);
};
type Field = {
  key: string;
  label: string;
  type?: string;
  value?: string;
  options?: string[];
};
type Form = {
  action: WorkforceCommand["action"];
  fields: Field[];
  targetId?: string | undefined;
  version?: number | undefined;
  fingerprint?: string | undefined;
};
export function Workforce({
  api,
  actor,
  userId,
}: {
  api: ApiClient;
  actor: Actor;
  userId?: string | undefined;
}) {
  const [bonusInput, setBonusInput] = useState("0"),
    [deductionInput, setDeductionInput] = useState("0");
  const [person, setPerson] = useState(userId ?? actor.id),
    [day, setDay] = useState(""),
    [tab, setTab] = useState("attendance"),
    [data, setData] = useState<WorkforceView | null>(null),
    [preview, setPreview] = useState<SalaryPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [form, setForm] = useState<Form | null>(null),
    [expanded, setExpanded] = useState(false);
  const finance = can(actor, "finance"),
    owner = actor.role === "owner",
    own = person === actor.id;
  useEffect(() => {
    let active = true;
    setData(null);
    setPreview(null);
    setError("");
    void api
      .workforce(person, day || undefined)
      .then(async (v) => {
        if (!active) return;
        setData(v);
        if (!day) setDay(v.today);
        if (v.payTerms) {
          try {
            const p = await api.salaryPreview(
              person,
              day || v.today,
              paise(bonusInput),
              paise(deductionInput),
            );
            if (active) setPreview(p);
          } catch (e) {
            if (active) setError((e as Error).message);
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, person, day, revision, bonusInput, deductionInput]);
  useEffect(() => {
    if (form) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [form]);
  const reason: Field = {
    key: "reason",
    label: "Reason / agreed note",
    type: "text",
  };
  const open = (
    action: Form["action"],
    fields: Field[],
    targetId?: string,
    version?: number,
    fingerprint?: string,
  ) => setForm({ action, fields, targetId, version, fingerprint });
  async function send(body: Omit<WorkforceCommand, "commandId">) {
    setBusy(true);
    setError("");
    const key = `arihant.workforce.command:${actor.id}:${person}:${body.action}`;
    try {
      const saved = sessionStorage.getItem(key);
      const request = saved
        ? (JSON.parse(saved) as WorkforceCommand)
        : { ...body, commandId: crypto.randomUUID() };
      sessionStorage.setItem(key, JSON.stringify(request));
      await api.workforceCommand(person, request);
      sessionStorage.removeItem(key);
      setRevision((v) => v + 1);
      const { commandId: _, ...priorPayload } = request;
      if (saved && JSON.stringify(priorPayload) !== JSON.stringify(body))
        throw Error(
          "Your earlier action was saved. Review this changed form before saving it as a new action.",
        );
      setForm(null);
    } catch (e) {
      if (
        (e as { status?: number }).status &&
        (e as { status: number }).status < 500
      )
        sessionStorage.removeItem(key);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !data) return;
    const v = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    let body: Omit<WorkforceCommand, "commandId"> = {
      action: form.action,
      targetId: form.targetId ?? null,
      expectedVersion: form.version ?? 0,
      reason: v.reason ?? "",
      asOf: day,
    };
    try {
      switch (form.action) {
        case "save_profile":
          body = {
            ...body,
            terms: {
              basis: v.basis as "monthly",
              cycle: v.cycle as "monthly",
              ratePaise: paise(v.rate!),
              effectiveFrom: v.effective!,
              payoutDelayDays: Number(v.delay),
              schedule: data.payTerms?.schedule ?? null,
            },
          };
          break;
        case "review_day": {
          const s = data.attendance.find((s) => s.workDate === v.day);
          body = {
            ...body,
            workDate: v.day!,
            halfDays: Number(v.halves),
            minutes: v.minutes ? Number(v.minutes) : null,
            fingerprint: s?.sourceSignature ?? data.emptyDaySignature,
          };
          break;
        }
        case "request_leave":
          body = {
            ...body,
            start: v.start!,
            end: v.end!,
            halfDays: Number(v.halves),
            paid: v.paid === "yes",
          };
          break;
        case "review_leave":
        case "review_advance":
          body = { ...body, decision: v.decision as "approved" | "rejected" };
          break;
        case "request_advance":
          body = { ...body, amountPaise: paise(v.amount!) };
          break;
        case "pay_advance":
        case "pay_salary":
          body = {
            ...body,
            amountPaise: paise(v.amount!),
            reference: v.reference!,
            occurredAt: new Date().toISOString(),
          };
          break;
        case "save_advance_plan":
          body = {
            ...body,
            planMode: v.mode as "split",
            installments: Number(v.installments),
            amountPaise: paise(v.amount!),
          };
          break;
        case "confirm_salary":
          body = {
            ...body,
            fingerprint: form.fingerprint ?? "",
            bonusPaise: preview?.bonusPaise ?? 0,
            deductionPaise: preview?.deductionPaise ?? 0,
          };
          break;
      }
      await send(body);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const payment = (n: number): Field[] => [
    {
      key: "amount",
      label: "Completed payment · ₹",
      value: String(n / 100),
      type: "number",
    },
    { key: "reference", label: "Bank / cash voucher reference" },
    reason,
  ];
  const review: Field[] = [
    {
      key: "decision",
      label: "Decision",
      value: "approved",
      options: ["approved", "rejected"],
    },
    reason,
  ];
  const current =
    data?.attendance.find((a) => a.workDate === day) ??
    (day === data?.today
      ? data?.attendance.find(
          (a) =>
            a.workDate < data.today &&
            a.schedule.end < a.schedule.start &&
            a.cutoffAt > data.serverNow,
        )
      : undefined);
  async function punch() {
    if (!data) return;
    setError("");
    const required =
      current?.status === "open"
        ? current.selfieRequired
        : data.policy.selfieRequired;
    if (required) {
      setError("Use the mobile app to capture the required attendance photo.");
      return;
    }
    let fix: Partial<NonNullable<WorkforceCommand["punch"]>> = {};
    if (data.policy.collectLocation) {
      fix = await new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({});
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) =>
            resolve({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracyM: p.coords.accuracy,
            }),
          () => resolve({}),
          { timeout: 10000, maximumAge: 0 },
        );
      });
    }
    await send({
      action: current?.status === "open" ? "punch_out" : "punch_in",
      sessionId: current?.id ?? null,
      expectedVersion: current?.version ?? 0,
      punch: { mocked: false, ...fix, clientTime: new Date().toISOString() },
    });
  }
  return (
    <section>
      <h1>Attendance & pay</h1>
      <p className="muted">
        Attendance evidence, approved leave and issued salary statements.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="toolbar">
        {finance && data ? (
          <label>
            Person
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? "" : " · inactive"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Work / pay-period date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button disabled={busy} onClick={() => setRevision((r) => r + 1)}>
          Refresh
        </button>
      </div>
      {finance && tab === "pay" ? (
        <div className="toolbar">
          <label>
            Bonus · ₹
            <input
              value={bonusInput}
              onChange={(e) => setBonusInput(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Other agreed deduction · ₹
            <input
              value={deductionInput}
              onChange={(e) => setDeductionInput(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      ) : null}
      <div className="tabs" role="tablist">
        {["attendance", "leave", "pay"].map((id) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => {
              setTab(id);
              setForm(null);
            }}
          >
            {id === "pay" ? "Payroll" : id === "leave" ? "Leave" : "Attendance"}
          </button>
        ))}
      </div>
      {form ? (
        <form onSubmit={(e) => void submit(e)} className="panel">
          <h2>{form.action.replaceAll("_", " ")}</h2>
          <div className="workforce-fields">
            {form.fields.map((f) => (
              <label key={f.key}>
                {f.label}
                {f.options ? (
                  <select name={f.key} defaultValue={f.value} required>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={f.key}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    defaultValue={f.value}
                    required={f.key !== "minutes"}
                    maxLength={500}
                  />
                )}
              </label>
            ))}
          </div>
          <button disabled={busy} type="submit">
            Review & save
          </button>
          <button type="button" disabled={busy} onClick={() => setForm(null)}>
            Cancel
          </button>
        </form>
      ) : !data ? (
        <p>Loading workforce…</p>
      ) : tab === "attendance" ? (
        <>
          {finance ? (
            <div className="cards">
              {data.people.map((p) => (
                <article key={p.id}>
                  <h3>{p.name}</h3>
                  <p>{p.attendanceStatus.replaceAll("_", " ")}</p>
                  <button onClick={() => setPerson(p.id)}>Open person</button>
                </article>
              ))}
            </div>
          ) : null}
          <article>
            <h2>{data.people.find((p) => p.id === person)?.name}</h2>
            <p>{current?.status.replaceAll("_", " ") ?? "Not punched in"}</p>
            {current ? (
              <>
                <p>
                  {current.workDate} · {current.schedule.start}–
                  {current.schedule.end}
                </p>
                <p>
                  In: {new Date(current.punchedInAt).toLocaleString("en-IN")} ·
                  Out:{" "}
                  {current.punchedOutAt
                    ? new Date(current.punchedOutAt).toLocaleString("en-IN")
                    : "Unknown until recorded"}
                </p>
                <p>
                  {current.minutes === null
                    ? "Worked minutes unknown"
                    : `${current.minutes} recorded minutes`}
                </p>
                {current.flags.map((f) => (
                  <p key={f}>{f}</p>
                ))}
              </>
            ) : null}
            {own ? (
              <button
                disabled={
                  busy || day !== data.today || current?.status === "closed"
                }
                onClick={() => void punch()}
              >
                {current?.status === "open" ? "Punch out" : "Punch in"}
              </button>
            ) : null}
            {finance ? (
              <button
                onClick={() =>
                  open("review_day", [
                    { key: "day", label: "Work day", type: "date", value: day },
                    {
                      key: "halves",
                      label: "Payable half-days · 0, 1 or 2",
                      type: "number",
                      value: "2",
                    },
                    {
                      key: "minutes",
                      label: "Paid minutes · required for hourly pay",
                      type: "number",
                      value: current?.minutes?.toString() ?? "",
                    },
                    reason,
                  ])
                }
              >
                Review paid time
              </button>
            ) : null}
          </article>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Status</th>
                  <th>Recorded minutes</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button onClick={() => setDay(a.workDate)}>
                        {a.workDate}
                      </button>
                    </td>
                    <td>{a.status}</td>
                    <td>{a.minutes ?? "Unknown"}</td>
                    <td>{a.flags.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === "leave" ? (
        <>
          <p>
            Paid leave used: {data.leaveUsedHalfDays / 2} /{" "}
            {data.policy.paidLeaveHalfDays / 2} days this year
          </p>
          {own ? (
            <button
              onClick={() =>
                open("request_leave", [
                  { key: "start", label: "From", type: "date", value: day },
                  { key: "end", label: "Through", type: "date", value: day },
                  {
                    key: "halves",
                    label: "Half-days per date",
                    value: "2",
                    options: ["2", "1"],
                  },
                  {
                    key: "paid",
                    label: "Request paid leave",
                    value: "yes",
                    options: ["yes", "no"],
                  },
                  reason,
                ])
              }
            >
              Request leave
            </button>
          ) : null}
          <div className="cards">
            {data.leaves
              .slice()
              .reverse()
              .map((l) => (
                <article key={l.id}>
                  <h3>
                    {l.start} → {l.end}
                  </h3>
                  <p>
                    {l.status} · {l.paid ? "Paid" : "Unpaid"}
                  </p>
                  <p>{l.reason}</p>
                  {l.reviewReason ? <p>{l.reviewReason}</p> : null}
                  {finance && l.status === "pending" ? (
                    <button
                      onClick={() =>
                        open("review_leave", review, l.id, l.version)
                      }
                    >
                      Review leave
                    </button>
                  ) : null}
                </article>
              ))}
          </div>
        </>
      ) : (
        <>
          {owner ? (
            <button
              onClick={() =>
                open(
                  "save_profile",
                  [
                    {
                      key: "basis",
                      label: "Agreed rate basis",
                      value: data.payTerms?.basis ?? "monthly",
                      options: ["daily", "weekly", "monthly", "hourly"],
                    },
                    {
                      key: "cycle",
                      label: "Settlement cycle",
                      value: data.payTerms?.cycle ?? "monthly",
                      options: ["daily", "weekly", "monthly"],
                    },
                    {
                      key: "rate",
                      label: "Agreed rate · ₹",
                      type: "number",
                      value: String((data.payTerms?.ratePaise ?? 0) / 100),
                    },
                    {
                      key: "effective",
                      label: "Effective from",
                      type: "date",
                      value: data.today,
                    },
                    {
                      key: "delay",
                      label: "Due days after period end",
                      type: "number",
                      value: String(data.payTerms?.payoutDelayDays ?? 1),
                    },
                    reason,
                  ],
                  undefined,
                  data.profileVersion,
                )
              }
            >
              Set pay terms
            </button>
          ) : null}
          {preview ? (
            <article>
              <h2>
                {preview.start} → {preview.end}
              </h2>
              <p>
                Earned {money(preview.basePaise)} · Advance recovery{" "}
                {money(preview.advanceRecoveryPaise)}
              </p>
              <h2>{money(preview.netPaise)}</h2>
              <p>Due {preview.dueOn}</p>
              {preview.blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
              {finance ? (
                <button
                  disabled={busy || !!preview.blockers.length}
                  onClick={() =>
                    open(
                      "confirm_salary",
                      [reason],
                      undefined,
                      0,
                      preview.fingerprint,
                    )
                  }
                >
                  Confirm salary
                </button>
              ) : null}
              <button onClick={() => setExpanded(!expanded)}>
                {expanded ? "Hide calculation" : "Explain calculation"}
              </button>
              {expanded ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Source</th>
                        <th>Days</th>
                        <th>Minutes</th>
                        <th>Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sourceDays.map((d) => (
                        <tr key={d.day}>
                          <td>{d.day}</td>
                          <td>{d.source}</td>
                          <td>{d.halfDays / 2}</td>
                          <td>{d.minutes ?? "Unknown"}</td>
                          <td>{money(d.earningsPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          ) : (
            <p>
              No pay terms are configured for this date. The owner can set the
              agreed terms.
            </p>
          )}
          <h2>Salary advances · {money(data.advanceBalancePaise)}</h2>
          {own ? (
            <button
              onClick={() =>
                open("request_advance", [
                  { key: "amount", label: "Amount · ₹", type: "number" },
                  reason,
                ])
              }
            >
              Request advance
            </button>
          ) : null}
          {finance && data.advanceBalancePaise > 0 ? (
            <button
              onClick={() =>
                open("save_advance_plan", [
                  {
                    key: "mode",
                    label: "Recovery",
                    options: ["full", "skip", "partial", "split"],
                    value: data.advancePlan?.mode ?? "full",
                  },
                  {
                    key: "installments",
                    label: "Number of salaries for split",
                    type: "number",
                    value: "3",
                  },
                  {
                    key: "amount",
                    label: "Smaller recovery · ₹",
                    type: "number",
                    value: "0",
                  },
                  reason,
                ])
              }
            >
              Set recovery plan
            </button>
          ) : null}
          <div className="cards">
            {data.advances.map((a) => (
              <article key={a.id}>
                <h3>{money(a.amountPaise)}</h3>
                <p>
                  {a.status} · {a.reason}
                </p>
                {finance && a.status === "pending" ? (
                  <button
                    onClick={() =>
                      open("review_advance", review, a.id, a.version)
                    }
                  >
                    Review
                  </button>
                ) : null}
                {finance && a.status === "approved" ? (
                  <button
                    onClick={() =>
                      open("pay_advance", payment(a.amountPaise), a.id)
                    }
                  >
                    Record paid advance
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          <h2>Issued statements</h2>
          <div className="cards">
            {data.salaries.map((s) => (
              <article key={s.id}>
                <h3>
                  {s.start} → {s.end} · v{s.revision}
                </h3>
                <p>
                  {s.status} · {s.confirmedBy}
                </p>
                <h2>{money(s.snapshot.netPaise)}</h2>
                <p>Paid {money(s.paidPaise)}</p>
                <details>
                  <summary>Issued calculation</summary>
                  <p>
                    Earned {money(s.snapshot.basePaise)} · Bonus{" "}
                    {money(s.snapshot.bonusPaise)} · Other deduction{" "}
                    {money(s.snapshot.deductionPaise)} · Advance recovery{" "}
                    {money(s.snapshot.advanceRecoveryPaise)}
                  </p>
                  {s.snapshot.sourceDays.map((d) => (
                    <p key={d.day}>
                      {d.day} · {d.source} · {d.halfDays / 2} day ·{" "}
                      {money(d.earningsPaise)}
                    </p>
                  ))}
                </details>
                <button
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob(
                        [
                          salaryStatementText(
                            s,
                            data.people.find((p) => p.id === person)?.name ??
                              "",
                          ),
                        ],
                        { type: "text/plain;charset=utf-8" },
                      ),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `salary-${s.start}-v${s.revision}.txt`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download statement
                </button>
                {finance &&
                s.status === "confirmed" &&
                s.paidPaise < s.snapshot.netPaise ? (
                  <button
                    onClick={() =>
                      open(
                        "pay_salary",
                        payment(s.snapshot.netPaise - s.paidPaise),
                        s.id,
                      )
                    }
                  >
                    Record salary paid
                  </button>
                ) : null}
                {finance && s.status !== "void" && !s.paidPaise ? (
                  <button onClick={() => open("void_salary", [reason], s.id)}>
                    Void for correction
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          <h2>Payment history</h2>
          <div className="cards">
            {data.payments
              .filter(
                (p) =>
                  p.kind === "advance_payment" || p.kind === "salary_payment",
              )
              .map((p) => (
                <article key={p.id}>
                  <h3>
                    {p.reference} · {money(p.amountPaise)}
                  </h3>
                  <p>
                    {p.recordedBy} · {p.reason}
                  </p>
                  {p.reversed ? (
                    <p>Corrected · original retained</p>
                  ) : finance ? (
                    <button
                      onClick={() => open("reverse_payment", [reason], p.id)}
                    >
                      Correct mistaken payment
                    </button>
                  ) : null}
                </article>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
