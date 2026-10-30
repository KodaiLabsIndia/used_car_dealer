import React, { useEffect, useRef, useState } from "react";
import { ApiClient } from "@arihant/api-client";
import type {
  DecisionItem,
  ServiceFinance,
  ServiceFinanceCommand,
} from "@arihant/contracts";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    v / 100,
  );
export function DecisionBoard({
  api,
  revision,
  openCar,
  openTask,
}: {
  api: ApiClient;
  revision: number;
  openCar: (id: string) => void;
  openTask: (id: string) => void;
}) {
  const [items, setItems] = useState<DecisionItem[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [job, setJob] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api
      .decisions(offset)
      .then((v) => {
        if (active) {
          setItems(v.items);
          setTotal(v.total);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, offset, revision, job]);
  if (job)
    return <QuoteReview api={api} id={job} onBack={() => setJob(null)} />;
  return (
    <>
      <p className="muted">
        {total} pending decisions · Inspections, help, purchases, repair quotes,
        documents, warranty and car holds.
      </p>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {loading ? <p>Loading decisions…</p> : null}
      <div className="cards">
        {items.map((v) => (
          <article key={`${v.kind}:${v.id}`}>
            <span className="badge">{v.kind}</span>
            <h3>{v.carLabel}</h3>
            <p>{v.title}</p>
            <small>{new Date(v.createdAt).toLocaleString()}</small>
            <button
              onClick={() => {
                if (v.targetType === "task") openTask(v.targetId);
                else if (v.targetType === "service_finance") setJob(v.targetId);
                else openCar(v.carId);
              }}
            >
              Open & review →
            </button>
          </article>
        ))}
      </div>
      {!loading && !error && !items.length ? (
        <p>No decisions waiting.</p>
      ) : null}
      <div className="pager">
        <button
          disabled={!offset || loading}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          ← Previous
        </button>
        <span>Page {Math.floor(offset / 30) + 1}</span>
        <button
          disabled={loading || offset + 30 >= total}
          onClick={() => setOffset(offset + 30)}
        >
          Next →
        </button>
      </div>
    </>
  );
}
function QuoteReview({
  api,
  id,
  onBack,
}: {
  api: ApiClient;
  id: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<ServiceFinance | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    pending = useRef<ServiceFinanceCommand | null>(null);
  useEffect(() => {
    let active = true;
    void api
      .serviceFinance(id)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [api, id]);
  async function decide(quoteId: string, decision: "approved" | "rejected") {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const intended = {
        action: "decide_quote" as const,
        quoteId,
        decision,
        reason,
        expectedVersion: data.job.version,
      };
      if (pending.current) {
        const old = pending.current;
        if (
          old.action !== "decide_quote" ||
          old.quoteId !== quoteId ||
          old.decision !== decision ||
          old.reason !== reason
        )
          throw Error(
            "A previous request is pending. Retry the same decision or refresh the record first.",
          );
      }
      const command = pending.current ?? {
        ...intended,
        commandId: crypto.randomUUID(),
      };
      pending.current = command;
      const updated = await api.serviceFinanceCommand(id, command);
      setData(updated);
      pending.current = null;
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={onBack} disabled={busy}>
        ← Back to decisions
      </button>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {data ? (
        <>
          <div className="car-heading">
            <div>
              <p className="eyebrow">
                {data.job.car.registration} ·{" "}
                {data.job.workshopName ?? "Internal workshop"}
              </p>
              <h2>{data.job.title}</h2>
            </div>
            <span className="badge">
              {data.job.status.replaceAll("_", " ")}
            </span>
          </div>
          <div className="stats">
            <article>
              <p>Invoices</p>
              <h3>{money(data.invoiceTotalPaise)}</h3>
            </article>
            <article>
              <p>Vendor payments</p>
              <h3>{money(data.paidPaise)}</h3>
            </article>
            <article>
              <p>Vendor balance</p>
              <h3>{money(data.balancePaise)}</h3>
            </article>
            <article>
              <p>Advance</p>
              <h3>{money(data.advancePaise)}</h3>
            </article>
          </div>
          {data.quotes.map((q, i) => (
            <article key={q.id}>
              <span className="badge">
                Revision {q.revision} · {q.decision}
                {i ? " · previous" : ""}
              </span>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Work / part</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.lines.map((l, index) => (
                      <tr key={index}>
                        <td>{l.description}</td>
                        <td>{l.quantity}</td>
                        <td>{money(l.unitPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Other charges {money(q.chargesPaise)}</p>
              <h2>Total {money(q.totalPaise)}</h2>
              <p>{q.note}</p>
              <small>
                Prepared by {q.recordedByName}
                {q.approvedByName ? ` · Reviewed by ${q.approvedByName}` : ""}
              </small>
              {i === 0 && q.decision === "pending" ? (
                <>
                  <label>
                    Decision reason
                    <input
                      value={reason}
                      disabled={busy}
                      maxLength={1000}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="toolbar">
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide(q.id, "rejected")}
                    >
                      Reject quote
                    </button>
                    <button
                      className="primary"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide(q.id, "approved")}
                    >
                      Approve this revision
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void api
                          .serviceFinance(id)
                          .then((v) => {
                            setData(v);
                            pending.current = null;
                          })
                          .catch((e) => setError((e as Error).message))
                      }
                    >
                      Refresh record
                    </button>
                  </div>
                </>
              ) : (
                <p>{q.reason}</p>
              )}
            </article>
          ))}
        </>
      ) : (
        <p>Loading repair costs…</p>
      )}
    </>
  );
}
