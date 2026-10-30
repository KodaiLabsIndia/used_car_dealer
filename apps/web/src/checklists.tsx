import React, { useEffect, useState } from "react";
import { ApiClient } from "@arihant/api-client";
import type { ManagedChecklist, ApproveChecklist } from "@arihant/contracts";
const kinds = {
  pre_purchase: "Before purchase",
  intake: "Arrival / intake",
  repair_qc: "Repair quality check",
  delivery: "Before delivery",
};
export function Checklists({
  api,
  revision,
  onChange,
}: {
  api: ApiClient;
  revision: number;
  onChange: () => void;
}) {
  const [records, setRecords] = useState<ManagedChecklist[]>([]),
    [id, setId] = useState(""),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ApproveChecklist | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .managedChecklists()
      .then((value) => {
        if (active) setRecords(value.items);
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
  }, [api, revision]);
  const selected = records.find((r) => r.template.id === id),
    latest = selected
      ? Math.max(
          ...records
            .filter(
              (r) =>
                r.template.name.toLowerCase() ===
                selected.template.name.toLowerCase(),
            )
            .map((r) => r.template.version),
        )
      : 0;
  async function approve() {
    if (!selected) return;
    if (
      !pending &&
      !window.confirm(
        `Approve ${selected.template.name} version ${selected.template.version}? Your owner approval will be recorded. Existing inspections retain their assigned template.`,
      )
    )
      return;
    const body = pending ?? {
      commandId: crypto.randomUUID(),
      expectedVersion: selected.template.version,
      reason,
      instructionsReviewed: reviewed,
    };
    setPending(body);
    setBusy(true);
    setError("");
    try {
      const value = await api.approveChecklist(id, body);
      setRecords((rows) => rows.map((r) => (r.template.id === id ? value : r)));
      setPending(null);
      setReason("");
      setReviewed(false);
      onChange();
    } catch (e) {
      setError((e as Error).message);
      const status = (e as { status?: number }).status;
      if (status && status >= 400 && status < 500) setPending(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted">
        Approved versions apply to new inspections. Existing tasks keep their
        assigned checklist, wording and approval snapshot.
      </p>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {loading ? <p role="status">Loading checklist versions…</p> : null}
      {!selected ? (
        <div className="cards">
          {records.map((record) => (
            <article key={record.template.id} className="panel">
              <p className="eyebrow">{kinds[record.template.kind]}</p>
              <h2>{record.template.name}</h2>
              <span className="badge">
                {record.template.approved ? "Approved" : "Draft"} · v
                {record.template.version}
              </span>
              <p>
                {record.template.items.length} checks ·{" "}
                {record.creatorName ?? "Training setup"}
              </p>
              <button
                onClick={() => {
                  setId(record.template.id);
                  setReason("");
                  setReviewed(false);
                  setPending(null);
                  setError("");
                }}
              >
                Review checks & approval ↗
              </button>
            </article>
          ))}
        </div>
      ) : (
        <>
          <button disabled={!!pending || busy} onClick={() => setId("")}>
            ← All versions
          </button>
          <section className="panel">
            <p className="eyebrow">{kinds[selected.template.kind]}</p>
            <h2>{selected.template.name}</h2>
            <span className="badge">
              {selected.template.approved ? "Approved" : "Draft"} · v
              {selected.template.version}
            </span>
            <p>
              {selected.revisionReason ||
                "Starter template — review before use."}
            </p>
            <p className="muted">
              {selected.creatorName ?? "Training setup"} ·{" "}
              {new Date(selected.createdAt).toLocaleString("en-IN")}
            </p>
          </section>
          <div className="cards">
            {selected.template.items.map((check, n) => (
              <article className="panel" key={check.id}>
                <span className="badge">
                  {check.required
                    ? "Photo and result required"
                    : "Optional check"}
                </span>
                <h3>
                  {n + 1}. {check.title}
                </h3>
                <p>{check.instruction}</p>
                <h3 lang="hi">{check.titleHi}</h3>
                <p lang="hi">{check.instructionHi}</p>
              </article>
            ))}
          </div>
          {selected.approval ? (
            <section className="panel">
              <h3>Owner approval</h3>
              <p>
                {selected.approval.reviewerName} ·{" "}
                {new Date(selected.approval.createdAt).toLocaleString("en-IN")}
              </p>
              <p>{selected.approval.reason}</p>
            </section>
          ) : !selected.template.approved &&
            selected.template.version === latest ? (
            <form
              className="checklist-approval"
              onSubmit={(e) => {
                e.preventDefault();
                void approve();
              }}
            >
              <h3>Approve this version</h3>
              <label>
                Reason
                <textarea
                  required
                  maxLength={1000}
                  value={reason}
                  disabled={busy || !!pending}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy || !!pending}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed every check and both language instructions.
              </label>
              {pending ? (
                <p>
                  This exact approval request is saved for retry. Review the
                  result before leaving this page.
                </p>
              ) : null}
              <button disabled={busy || !reviewed || !reason.trim()}>
                {busy
                  ? "Recording…"
                  : pending
                    ? "Retry saved approval"
                    : "Approve checklist version"}
              </button>
            </form>
          ) : null}
        </>
      )}
    </>
  );
}
