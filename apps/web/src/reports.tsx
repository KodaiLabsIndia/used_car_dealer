import React, { useEffect, useState } from "react";
import { ApiClient } from "@arihant/api-client";
import type { OperationsReport } from "@arihant/contracts";
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    value / 100,
  );
const labels: Record<keyof OperationsReport["totals"], string> = {
  purchaseCommittedPaise: "Purchase commitments",
  sellerPaidPaise: "Seller payments recorded",
  sellerBalancePaise: "Seller balance",
  recordedCostsPaise: "Recorded operating costs",
  warrantyCostsPaise: "Warranty costs",
  buyerCollectedPaise: "Buyer collections",
  buyerRefundedPaise: "Buyer refunds recorded",
  buyerBalancePaise: "Buyer balance",
  refundDuePaise: "Refunds still due",
  vendorPaidPaise: "Workshop payments",
  vendorBalancePaise: "Workshop balance",
  vendorAdvancePaise: "Workshop advances awaiting bills",
};
export function Reports({
  api,
  revision,
  openCar,
}: {
  api: ApiClient;
  revision: number;
  openCar: (id: string) => void;
}) {
  const [data, setData] = useState<OperationsReport | null>(null),
    [scope, setScope] = useState("all"),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [section, setSection] = useState("stock"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api
      .operationsReport(scope, search, offset)
      .then((value) => {
        if (active) setData(value);
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
  }, [api, scope, search, offset, revision]);
  async function download() {
    setExporting(true);
    setError("");
    try {
      const blob = await api.exportOperationsReport(scope, search),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "arihant-operations.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <label>
          Records
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setOffset(0);
            }}
          >
            <option value="all">All records</option>
            <option value="stock">Before delivery</option>
            <option value="sold">Sold cars</option>
          </select>
        </label>
        <label>
          Search
          <input
            aria-label="Find report car"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Car, number or stock ID"
          />
        </label>
        <button disabled={exporting || loading} onClick={() => void download()}>
          {exporting ? "Preparing export…" : "Export matching records ↓"}
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Report section">
        {["stock", "money"].map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={section === v}
            className={section === v ? "active" : ""}
            onClick={() => setSection(v)}
          >
            {v === "stock" ? "Stock & delays" : "Money recorded"}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {loading ? <p>Loading report…</p> : null}
      {data ? (
        <p className="muted">
          {data.total} matching records · totals cover every matching page · as
          of {new Date(data.cutoff).toLocaleString()}
        </p>
      ) : null}
      {data && section === "money" ? (
        <>
          <p>
            Commitments, recorded costs and cash movements stay separate. These
            figures do not establish accounting profit. Workshop invoices count
            once as costs; workshop payments settle invoices or remain advances.
          </p>
          <div className="stats report-money">
            {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
              <article key={key}>
                <span>{labels[key]}</span>
                <strong>{money(data.totals[key])}</strong>
              </article>
            ))}
          </div>
        </>
      ) : data ? (
        <>
          <p className="muted">
            Age starts at physical receipt and stops at delivery. Missing
            receipt stays unknown.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Car</th>
                  <th>States / location</th>
                  <th>Age</th>
                  <th>Open / waiting jobs</th>
                  <th>Earliest job due</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.carId}>
                    <td>
                      <strong>{row.carLabel}</strong>
                      <br />
                      {row.registration}
                      <br />
                      <small>{row.stockNumber}</small>
                    </td>
                    <td>
                      {row.stage} · {row.commercialStatus}
                      <br />
                      {row.location}
                    </td>
                    <td>
                      {row.stockAgeDays === null
                        ? "Receipt missing"
                        : `${row.stockAgeDays} days`}
                    </td>
                    <td>
                      {row.openJobs} / {row.waitingJobs}
                    </td>
                    <td>
                      {row.oldestDueAt
                        ? new Date(row.oldestDueAt).toLocaleString()
                        : "No due date"}
                    </td>
                    <td>
                      <button onClick={() => openCar(row.carId)}>
                        Open car →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <p>No matching records.</p> : null}
          <div className="pager">
            <button
              disabled={!offset || loading}
              onClick={() => setOffset(Math.max(0, offset - 30))}
            >
              ← Previous
            </button>
            <span>Page {Math.floor(offset / 30) + 1}</span>
            <button
              disabled={loading || offset + 30 >= data.total}
              onClick={() => setOffset(offset + 30)}
            >
              Next →
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
