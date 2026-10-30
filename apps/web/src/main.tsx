import { can, workingLevel } from "@arihant/contracts";
import { checkState, inspectionProgress } from "@arihant/contracts";
import { Checklists } from "./checklists";
import { DecisionBoard } from "./decisions";
import { Reports } from "./reports";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ApiClient } from "@arihant/api-client";
import type {
  Session,
  Car,
  Task,
  Dashboard,
  RepairJob,
  HistoryEntry,
  VehicleBusiness,
  Purchase,
  EnquiryDetail,
  Inbox,
  CarDocument,
  VideoClip,
} from "@arihant/contracts";
import logo from "../../mobile/assets/arihant-logo.png";
import "./style.css";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    v / 100,
  );
const human = (v: string) => v.replaceAll("_", " ").replaceAll(".", " · ");
const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-IN") : "—";
function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
function ProtectedMedia({
  api,
  id,
  kind = "evidence",
}: {
  api: ApiClient;
  id: string;
  kind?: "evidence" | "document" | "clip";
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    const controller = new AbortController();
    const resource =
      kind === "document"
        ? api.documentUri(id)
        : kind === "clip"
          ? api.clipUri(id)
          : api.evidenceUri(id);
    void fetch(resource.uri, {
      headers: resource.headers,
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw Error("This private file is unavailable.");
        const blob = await r.blob();
        if (alive) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      });
    return () => {
      alive = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, kind, api]);
  return error ? (
    <ErrorBox message={error} />
  ) : url ? (
    kind === "clip" ? (
      <video controls preload="metadata" src={url} />
    ) : (
      <img
        className="evidence"
        alt={
          kind === "document" ? "Private document page" : "Inspection evidence"
        }
        src={url}
      />
    )
  ) : (
    <p className="muted">Loading private file…</p>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [page, setPage] = useState("today"),
    [selected, setSelected] = useState<string | null>(null),
    [taskId, setTaskId] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const api = useMemo(
    () => new ApiClient(session?.token ?? null, "", () => setSession(null)),
    [session?.token],
  );
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  if (!session) return <Login api={api} onSession={setSession} />;
  if (session.mustChangeSecret)
    return <ChangeSecret api={api} onSession={setSession} />;
  return (
    <div className="shell">
      <aside className="sidebar">
        <img className="logo" src={logo} alt="Arihant Cars" />
        <p className="eyebrow">THE OPERATIONS GARAGE</p>
        <nav aria-label="Main navigation">
          {[
            ["today", "Today"],
            ...(can(session.actor, "overview")
              ? [["decisions", "Decisions"]]
              : []),
            ["stock", "All cars"],
            ["work", "Inspections"],
            ["service", "Workshop"],
            ["enquiries", "Enquiries"],
            ...(can(session.actor, "finance")
              ? [
                  ["business", "Sales & support"],
                  ["reports", "Reports"],
                ]
              : []),
            ...(session.actor.role === "owner"
              ? [["checklists", "Checklists"]]
              : []),
            ["inbox", "Updates"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={page === id && !selected ? "active" : ""}
              onClick={() => {
                setPage(id!);
                setSelected(null);
                setTaskId(null);
              }}
            >
              {label}
              <span>↗</span>
            </button>
          ))}
        </nav>
        <div className="identity">
          <strong>{session.actor.name}</strong>
          <p>
            {session.actor.role === "owner"
              ? "Owner · full business access"
              : human(workingLevel(session.actor))}
          </p>
          <button
            onClick={() =>
              void api
                .logout()
                .catch(() => {})
                .finally(() => setSession(null))
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">ARIHANT CARS · LIVE OPERATIONS</p>
            <h1>
              {selected
                ? "Car workspace"
                : taskId
                  ? "Inspection review"
                  : human(page)}
            </h1>
          </div>
          <button onClick={refresh}>Refresh ↻</button>
        </header>
        {session.authentication === "training" ? (
          <p className="training">
            Training workspace · checklist templates need business approval
          </p>
        ) : null}
        {taskId ? (
          <TaskReview
            key={taskId}
            api={api}
            id={taskId}
            session={session}
            onBack={() => setTaskId(null)}
            onChange={refresh}
          />
        ) : selected ? (
          <CarWorkspace
            key={selected}
            api={api}
            id={selected}
            owner={can(session.actor, "finance")}
            revision={revision}
            openTask={setTaskId}
            onBack={() => setSelected(null)}
          />
        ) : page === "checklists" ? (
          <Checklists api={api} revision={revision} onChange={refresh} />
        ) : page === "reports" ? (
          <Reports api={api} revision={revision} openCar={setSelected} />
        ) : page === "decisions" ? (
          <DecisionBoard
            api={api}
            revision={revision}
            openCar={setSelected}
            openTask={setTaskId}
          />
        ) : (
          <Board
            key={page}
            api={api}
            page={page}
            revision={revision}
            openCar={setSelected}
            openTask={setTaskId}
          />
        )}
      </main>
    </div>
  );
}
function Login({
  api,
  onSession,
}: {
  api: ApiClient;
  onSession: (v: Session) => void;
}) {
  const [training, setTraining] = useState(false),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void api
      .authOptions()
      .then((v) => setAvailable(v.trainingLogin))
      .catch((e) => setError((e as Error).message));
  }, [api]);
  return (
    <div className="login">
      <section>
        <img className="logo" src={logo} alt="Arihant Cars" />
        <p className="eyebrow">EVERY CAR. EVERY RESPONSIBILITY.</p>
        <h1>
          The whole garage,
          <br />
          in your hands.
        </h1>
        <p>
          Follow the car from first inspection to the customer's next visit.
        </p>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          void (
            training
              ? api.signIn(
                  String(data.get("code")),
                  data.get("account") === "employee" ? "employee" : "owner",
                )
              : api.signInPassword(
                  String(data.get("dealer")),
                  String(data.get("username")),
                  String(data.get("password")),
                )
          )
            .then(onSession)
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        <h2>{training ? "Training sign in" : "Staff sign in"}</h2>
        <ErrorBox message={error} />
        {training ? (
          <>
            <label>
              Development access code
              <input
                autoComplete="off"
                name="code"
                type="password"
                required
                minLength={12}
              />
            </label>
            <label>
              Training account
              <select name="account">
                <option value="owner">Owner</option>
                <option value="employee">Employee</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              Dealer code
              <input name="dealer" autoComplete="organization" required />
            </label>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Open garage →"}
        </button>
        {available ? (
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => setTraining(!training)}
          >
            {training ? "Use individual staff login" : "Use training workspace"}
          </button>
        ) : null}
        <p className="muted">
          Your session stays in this page. Closing or reloading it requires sign
          in again.
        </p>
      </form>
    </div>
  );
}
function ChangeSecret({
  api,
  onSession,
}: {
  api: ApiClient;
  onSession: (v: Session) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (f.get("next") !== f.get("repeat")) {
            setError("Passwords must match.");
            return;
          }
          setBusy(true);
          void api
            .changeSecret(String(f.get("current")), String(f.get("next")))
            .then(onSession)
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        <h1>Choose your password</h1>
        <ErrorBox message={error} />
        <label>
          Temporary password
          <input
            type="password"
            name="current"
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          New password
          <input
            type="password"
            name="next"
            minLength={10}
            required
            autoComplete="new-password"
          />
        </label>
        <label>
          Repeat new password
          <input
            type="password"
            name="repeat"
            minLength={10}
            required
            autoComplete="new-password"
          />
        </label>
        <button className="primary" disabled={busy}>
          Save password
        </button>
      </form>
    </div>
  );
}
function Board({
  api,
  page,
  revision,
  openCar,
  openTask,
}: {
  api: ApiClient;
  page: string;
  revision: number;
  openCar: (id: string) => void;
  openTask: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<Car[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [jobs, setJobs] = useState<RepairJob[]>([]),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [leads, setLeads] = useState<Awaited<
      ReturnType<ApiClient["enquiries"]>
    > | null>(null),
    [business, setBusiness] = useState<Awaited<
      ReturnType<ApiClient["businessQueue"]>
    > | null>(null),
    [inbox, setInbox] = useState<Inbox | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () =>
        void (async () => {
          try {
            if (page === "today") {
              const v = await api.dashboard();
              if (active) {
                setDashboard(v);
                setCars(v.attention);
                setTasks(v.tasks);
              }
            } else if (page === "stock") {
              const v = await api.cars(search, undefined, offset);
              if (active) setCars(v.items);
            } else if (page === "work") {
              const v = await api.tasks(
                filter === "mine"
                  ? "mine"
                  : filter === "decisions"
                    ? "decisions"
                    : "all",
              );
              if (active) setTasks(v);
            } else if (page === "service") {
              const v = await api.jobs();
              if (active) setJobs(v);
            } else if (page === "enquiries") {
              const v = await api.enquiries(
                filter === "due" ? "due" : filter === "mine" ? "mine" : "all",
                search,
                offset,
              );
              if (active) setLeads(v);
            } else if (page === "business") {
              const v = await api.businessQueue(
                search,
                filter === "booked"
                  ? "booked"
                  : filter === "support"
                    ? "support"
                    : filter === "attention"
                      ? "attention"
                      : "all",
                offset,
              );
              if (active) setBusiness(v);
            } else if (page === "inbox") {
              const v = await api.inbox(filter !== "all", offset);
              if (active) setInbox(v);
            }
          } catch (e) {
            if (active) setError((e as Error).message);
          } finally {
            if (active) setLoading(false);
          }
        })(),
      search ? 220 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, page, search, filter, offset, revision]);
  const rows = page === "today" || page === "stock" ? cars : [],
    filters =
      page === "work"
        ? ["all", "mine", "decisions"]
        : page === "enquiries"
          ? ["all", "mine", "due"]
          : page === "business"
            ? ["all", "attention", "booked", "support"]
            : page === "inbox"
              ? ["unread", "all"]
              : [];
  return (
    <>
      <div className="toolbar">
        {["stock", "enquiries", "business"].includes(page) ? (
          <input
            aria-label="Search records"
            placeholder="Search cars or people…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        ) : null}
        {filters.length ? (
          <div className="tabs" role="tablist">
            {filters.map((v) => (
              <button
                role="tab"
                aria-selected={filter === v}
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => {
                  setFilter(v);
                  setOffset(0);
                }}
              >
                {human(v)}
              </button>
            ))}
          </div>
        ) : null}
        <span className="muted">{loading ? "Loading…" : "Server records"}</span>
      </div>
      <ErrorBox message={error} />
      {page === "today" && dashboard ? (
        <>
          <div className="stats">
            {[
              ["Cars in the business", dashboard.cars],
              ["In workshop", dashboard.workshop],
              ["Booked", dashboard.booked],
              ["Decisions waiting", dashboard.decisions],
            ].map(([label, value]) => (
              <article key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="stage-strip">
            {Object.entries(dashboard.stages).map(([key, value]) => (
              <span key={key}>
                {human(key)} <strong>{value}</strong>
              </span>
            ))}
          </div>
          <h2>Needs attention</h2>
        </>
      ) : null}
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Car</th>
                <th>Now</th>
                <th>Next action</th>
                <th>Location / due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>
                      {c.make} {c.model}
                    </strong>
                    <small>
                      {c.registration} · {c.stockNumber}
                    </small>
                  </td>
                  <td>
                    <Badge>{human(c.stage)}</Badge>
                    <small>
                      {human(c.commercialStatus)} · {human(c.serviceStatus)}
                    </small>
                  </td>
                  <td>{c.nextAction}</td>
                  <td>
                    {c.location}
                    <small>{date(c.dueAt)}</small>
                  </td>
                  <td>
                    <button onClick={() => openCar(c.id)}>Open ↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {page === "today" || page === "work" ? (
        <section>
          <h2>
            {page === "today" ? "Inspection work" : "Assigned inspections"}
          </h2>
          <div className="cards">
            {tasks.map((t) => (
              <article key={t.id}>
                <Badge>{human(t.status)}</Badge>
                <h3>
                  {t.car.make} {t.car.model}
                </h3>
                <p>
                  {t.car.registration} · {t.title}
                </p>
                <small>
                  {t.assigneeName} · {inspectionProgress(t).completed}/
                  {inspectionProgress(t).total} checks
                </small>
                <button onClick={() => openTask(t.id)}>
                  Open inspection →
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {page === "service" ? (
        <div className="cards">
          {jobs.map((j) => (
            <article key={j.id}>
              <Badge>{human(j.status)}</Badge>
              <h3>{j.title}</h3>
              <p>
                {j.car.registration} · {j.assigneeName}
              </p>
              <small>
                {j.workshopName ?? "Internal workshop"} · {date(j.dueAt)}
              </small>
              {j.blocker ? <p className="error">{j.blocker}</p> : null}
              <button onClick={() => openCar(j.carId)}>Open car →</button>
            </article>
          ))}
        </div>
      ) : null}
      {page === "enquiries" && leads ? (
        <div className="cards">
          {leads.items.map((l) => (
            <article key={l.id}>
              <Badge>
                {human(l.status)} · {l.kind}
              </Badge>
              <h3>{l.name}</h3>
              <p>{l.interest}</p>
              <small>
                {l.assigneeName} · Next contact {date(l.nextFollowUpAt)}
              </small>
              {l.carId ? (
                <button onClick={() => openCar(l.carId!)}>
                  Open linked car →
                </button>
              ) : null}
              <LeadDetails api={api} id={l.id} />
            </article>
          ))}
        </div>
      ) : null}
      {page === "business" && business ? (
        <div className="cards">
          {business.items.map((v) => (
            <article key={v.car.id}>
              <Badge>{human(v.car.commercialStatus)}</Badge>
              <h3>
                {v.car.make} {v.car.model}
              </h3>
              <p>{v.car.registration}</p>
              <p>
                Refund obligation {money(v.refundDuePaise)} · {v.openClaims}{" "}
                open claims
              </p>
              <small>{v.car.nextAction}</small>
              <button onClick={() => openCar(v.car.id)}>Open car →</button>
            </article>
          ))}
        </div>
      ) : null}
      {page === "inbox" && inbox ? (
        <>
          <button
            disabled={!inbox.items.length}
            onClick={() =>
              void api
                .readNotifications(inbox.cutoff)
                .then(() =>
                  setInbox({
                    ...inbox,
                    items: inbox.items.map((i) => ({
                      ...i,
                      readAt: inbox.cutoff,
                    })),
                    unread: 0,
                  }),
                )
                .catch((e) => setError((e as Error).message))
            }
          >
            Mark this page read
          </button>
          <div className="cards">
            {inbox.items.map((v) => (
              <article key={v.id}>
                <Badge>{v.readAt ? "Read" : "Unread"}</Badge>
                <h3>{human(v.kind)}</h3>
                <small>{date(v.createdAt)}</small>
                <button
                  onClick={() => {
                    void api.readNotifications(inbox.cutoff, v.id);
                    if (v.targetType === "task") openTask(v.targetId);
                    else if (
                      v.targetType === "car" ||
                      v.targetType === "business"
                    )
                      openCar(v.targetId);
                  }}
                >
                  Open record →
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
      {!loading &&
      !error &&
      !rows.length &&
      !tasks.length &&
      !jobs.length &&
      !leads?.items.length &&
      !business?.items.length &&
      !inbox?.items.length ? (
        <div className="empty">
          <h2>Nothing waiting here.</h2>
          <p>New work appears as it is recorded by the team.</p>
        </div>
      ) : null}
      {["stock", "enquiries", "business", "inbox"].includes(page) ? (
        <div className="pager">
          <button
            disabled={loading || !offset}
            onClick={() =>
              setOffset(Math.max(0, offset - (page === "stock" ? 50 : 30)))
            }
          >
            ← Previous
          </button>
          <span>
            Page {Math.floor(offset / (page === "stock" ? 50 : 30)) + 1}
          </span>
          <button
            disabled={
              loading ||
              (page === "stock"
                ? cars.length
                : page === "enquiries"
                  ? leads?.items.length
                  : page === "business"
                    ? business?.items.length
                    : inbox?.items.length)! < (page === "stock" ? 50 : 30)
            }
            onClick={() => setOffset(offset + (page === "stock" ? 50 : 30))}
          >
            Next →
          </button>
        </div>
      ) : null}
    </>
  );
}
function LeadDetails({ api, id }: { api: ApiClient; id: string }) {
  const [value, setValue] = useState<EnquiryDetail | null>(null),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="quiet"
        onClick={() =>
          void api
            .enquiry(id)
            .then(setValue)
            .catch((e) => setError((e as Error).message))
        }
      >
        Contact history
      </button>
      <ErrorBox message={error} />
      {value ? (
        <div>
          {value.events.slice(-8).map((v) => (
            <p key={v.id}>
              {v.note}
              <small>
                {v.recordedByName} · {date(v.createdAt)}
              </small>
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
function CarWorkspace({
  api,
  id,
  owner,
  revision,
  openTask,
  onBack,
}: {
  api: ApiClient;
  id: string;
  owner: boolean;
  revision: number;
  openTask: (id: string) => void;
  onBack: () => void;
}) {
  const [car, setCar] = useState<Car | null>(null),
    [tab, setTab] = useState("overview"),
    [tasks, setTasks] = useState<Task[]>([]),
    [jobs, setJobs] = useState<RepairJob[]>([]),
    [history, setHistory] = useState<HistoryEntry[]>([]),
    [business, setBusiness] = useState<VehicleBusiness | null>(null),
    [purchase, setPurchase] = useState<Purchase | null>(null),
    [docs, setDocs] = useState<CarDocument[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void (async () => {
      try {
        const c = await api.car(id);
        if (!active) return;
        setCar(c);
        if (tab === "work") {
          const [t, j] = await Promise.all([api.tasks(), api.jobs(id)]);
          if (active) {
            setTasks(t.filter((v) => v.carId === id));
            setJobs(j);
          }
        }
        if (tab === "history") {
          const h = await api.history(id);
          if (active) setHistory(h);
        }
        if (tab === "business" && owner) {
          const b = await api.vehicleBusiness(id);
          if (active) setBusiness(b);
        }
        if (tab === "purchase" && owner) {
          const p = await api.purchaseForCar(id);
          if (active) setPurchase(p);
        }
        if (tab === "documents" && owner) {
          const d = await api.documents(id);
          if (active) setDocs(d.items);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, tab, revision, api, owner]);
  return (
    <>
      <button className="quiet" onClick={onBack}>
        ← Back to workspace
      </button>
      <ErrorBox message={error} />
      {car ? (
        <>
          <div className="car-heading">
            <div>
              <p className="eyebrow">
                {car.stockNumber} · {car.registration}
              </p>
              <h2>
                {car.make} {car.model}
              </h2>
            </div>
            <Badge>
              {human(car.stage)} · {human(car.commercialStatus)}
            </Badge>
          </div>
          <div className="tabs">
            {[
              "overview",
              "work",
              "history",
              ...(owner ? ["purchase", "business", "documents"] : []),
            ].map((v) => (
              <button
                className={tab === v ? "active" : ""}
                key={v}
                onClick={() => setTab(v)}
              >
                {human(v)}
              </button>
            ))}
          </div>
          {tab === "overview" ? (
            <div className="stats">
              <article>
                <p>Next action</p>
                <h3>{car.nextAction}</h3>
              </article>
              <article>
                <p>Current location</p>
                <h3>{car.location}</h3>
              </article>
              <article>
                <p>Odometer</p>
                <h3>
                  {car.odometerKm?.toLocaleString("en-IN") ?? "Unknown"} km
                </h3>
              </article>
              <article>
                <p>Service</p>
                <h3>{human(car.serviceStatus)}</h3>
              </article>
            </div>
          ) : null}
          {tab === "work" ? (
            <div className="cards">
              {tasks.map((t) => (
                <article key={t.id}>
                  <Badge>{human(t.status)}</Badge>
                  <h3>{t.title}</h3>
                  <p>{t.assigneeName}</p>
                  <button onClick={() => openTask(t.id)}>
                    Review inspection →
                  </button>
                </article>
              ))}
              {jobs.map((j) => (
                <article key={j.id}>
                  <Badge>{human(j.status)}</Badge>
                  <h3>{j.title}</h3>
                  <p>
                    {j.workshopName ?? "Internal workshop"} · {j.assigneeName}
                  </p>
                  <p>{j.blocker}</p>
                  {j.qcTaskId ? (
                    <button onClick={() => openTask(j.qcTaskId!)}>
                      Open repair QC →
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "history" ? (
            <ol className="history">
              {history.map((h) => (
                <li key={h.id}>
                  <span>{human(h.action)}</span>
                  <p>{h.summary}</p>
                  <small>
                    {h.actorName} · {date(h.createdAt)}
                  </small>
                </li>
              ))}
            </ol>
          ) : null}
          {tab === "purchase" ? (
            purchase ? (
              <>
                <div className="stats">
                  <article>
                    <p>Purchase</p>
                    <h3>{money(purchase.terms.purchasePricePaise)}</h3>
                    <Badge>{human(purchase.status)}</Badge>
                  </article>
                  <article>
                    <p>Seller payments recorded</p>
                    <h3>{money(purchase.paidPaise)}</h3>
                  </article>
                  <article>
                    <p>Balance</p>
                    <h3>{money(purchase.balancePaise)}</h3>
                  </article>
                </div>
                <article>
                  <h3>Seller & terms</h3>
                  <p>{purchase.terms.sellerName}</p>
                  <p>{purchase.terms.notes}</p>
                  <p>
                    Forecast contribution:{" "}
                    {money(purchase.expectedContributionPaise)} · proposal
                    estimates
                  </p>
                  <p>
                    {purchase.documentsClear
                      ? "Document checks clear"
                      : "Document checks pending"}
                  </p>
                  <p>
                    {purchase.inspectionReady
                      ? "Inspection accepted"
                      : "Inspection pending"}
                  </p>
                </article>
                <h3>Payments</h3>
                {purchase.payments.map((p) => (
                  <article key={p.id}>
                    <p>
                      {money(p.amountPaise)} · {p.method} · {p.reference}
                    </p>
                    <small>
                      {p.recordedByName} · {date(p.paidAt)}
                      {p.reversedAt ? " · corrected" : ""}
                    </small>
                  </article>
                ))}
              </>
            ) : (
              <p>No purchase recorded yet.</p>
            )
          ) : null}
          {tab === "business" && business ? (
            <>
              <div className="stats">
                <article>
                  <p>Actual costs</p>
                  <h3>{money(business.investedPaise)}</h3>
                </article>
                <article>
                  <p>Seller balance</p>
                  <h3>{money(business.sellerBalancePaise)}</h3>
                </article>
                <article>
                  <p>Warranty cost</p>
                  <h3>{money(business.warrantyCostPaise)}</h3>
                </article>
              </div>
              <article>
                <h3>Readiness</h3>
                {business.readiness.map((v) => (
                  <p key={v.id}>
                    {v.clear ? "✓" : "◉"} {v.label}
                  </p>
                ))}
              </article>
              <h3>Cost ledger</h3>
              {business.ledger.map((v) => (
                <article key={v.id}>
                  <strong>
                    {money(v.amountPaise)} · {human(v.category)}
                  </strong>
                  <p>{v.note}</p>
                  <small>
                    {v.reference} · {v.recordedByName}
                    {v.reversedAt ? " · corrected" : ""}
                  </small>
                </article>
              ))}
            </>
          ) : null}
          {tab === "documents" ? (
            <div className="cards">
              {docs.map((d) => (
                <article key={d.id}>
                  <Badge>{d.status}</Badge>
                  <h3>{d.title}</h3>
                  <ProtectedMedia api={api} id={d.id} kind="document" />
                  <p>{d.reference}</p>
                  <small>
                    {d.recordedByName} · {date(d.createdAt)}
                  </small>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p>Loading car…</p>
      )}
    </>
  );
}
function TaskReview({
  api,
  id,
  session,
  onBack,
  onChange,
}: {
  api: ApiClient;
  id: string;
  session: Session;
  onBack: () => void;
  onChange: () => void;
}) {
  const [task, setTask] = useState<Task | null>(null),
    [clips, setClips] = useState<VideoClip[]>([]),
    [checkQuery, setCheckQuery] = useState(""),
    [index, setIndex] = useState(0),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([api.task(id), api.clips(id)])
      .then(([t, c]) => {
        if (active) {
          setTask(t);
          setClips(c.items);
        }
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id, api]);
  async function command(
    action: "takeover" | "review",
    decision?: "accept" | "recheck",
  ) {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.command(id, {
        commandId: crypto.randomUUID(),
        expectedVersion: task.version,
        action,
        ...(decision ? { decision } : {}),
      } as Parameters<ApiClient["command"]>[1]);
      setTask(next);
      onChange();
      setChecked(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const item = task?.items[index],
    answer = task?.answers.find((v) => v.itemId === item?.id),
    canReview = can(session.actor, "review_inspection");
  return (
    <>
      <button className="quiet" onClick={onBack}>
        ← Back
      </button>
      <ErrorBox message={error} />
      {task && item ? (
        <>
          <div className="car-heading">
            <div>
              <p className="eyebrow">
                {task.car.registration} · {task.assigneeName}
              </p>
              <h2>{task.title}</h2>
            </div>
            <Badge>{human(task.status)}</Badge>
          </div>
          <div className="review-grid">
            <nav aria-label="Inspection checks" className="check-list">
              <input
                type="search"
                aria-label="Find an inspection check"
                placeholder="Find a part or check"
                value={checkQuery}
                onChange={(e) => setCheckQuery(e.target.value)}
              />
              <small>
                {inspectionProgress(task).completed}/
                {inspectionProgress(task).total} recorded ·{" "}
                {inspectionProgress(task).issues} issues
              </small>
              {task.items
                .map((v, i) => ({ v, i }))
                .filter(({ v }) =>
                  `${v.title} ${v.titleHi} ${v.id} ${v.zone}`
                    .toLowerCase()
                    .includes(checkQuery.toLowerCase()),
                )
                .map(({ v, i }) => (
                  <button
                    disabled={busy}
                    key={v.id}
                    className={i === index ? "active" : ""}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}. {v.title}
                    <small>{human(checkState(task, v))}</small>
                  </button>
                ))}
            </nav>
            <article>
              <p className="eyebrow">
                CHECK {index + 1} OF {task.items.length}
              </p>
              <h2>{item.title}</h2>
              <p>{item.instruction}</p>
              <p className="muted">
                {human(item.zone)} · {item.critical ? "Safety-critical · " : ""}
                {item.requiresClip
                  ? "Photo + video required"
                  : "Photo required"}
                {item.measurementUnit
                  ? ` · Measure (${item.measurementUnit})`
                  : ""}
              </p>
              {answer ? (
                <>
                  <ProtectedMedia api={api} id={answer.evidenceId} />
                  <Badge>
                    {
                      {
                        ok: "Inspector recorded OK",
                        problem: "Inspector reported a problem",
                        unable: "Unable to inspect · unresolved",
                        not_applicable:
                          "Not applicable · review the reason and proof",
                      }[answer.result]
                    }
                  </Badge>
                  <p>{answer.note || "No note recorded."}</p>
                  {answer.reading !== null ? (
                    <p>
                      Recorded measurement: {answer.reading}{" "}
                      {item.measurementUnit}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted">
                  The employee has not recorded this check yet.
                </p>
              )}
              {clips
                .filter((c) => c.itemId === item.id)
                .map((c) => (
                  <ProtectedMedia key={c.id} api={api} id={c.id} kind="clip" />
                ))}
            </article>
          </div>
          {task.status === "submitted" && canReview ? (
            <article className="decision">
              <h3>Review the whole inspection</h3>
              <p>
                {task.submittedBy === session.actor.id
                  ? "You performed this inspection. Your decision will be recorded as a self-review."
                  : "Your identity and the inspection version are retained with this decision."}
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                I reviewed every required result and its evidence.
              </label>
              <div className="toolbar">
                <button
                  disabled={busy || !checked}
                  onClick={() => void command("review", "recheck")}
                >
                  Send for recheck
                </button>
                <button
                  className="primary"
                  disabled={busy || !checked}
                  onClick={() => void command("review", "accept")}
                >
                  Accept inspection
                </button>
              </div>
            </article>
          ) : null}
          {can(session.actor, "assign_inspection") &&
          task.assignedTo !== session.actor.id &&
          !["submitted", "completed"].includes(task.status) ? (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Take responsibility for this inspection yourself?",
                  )
                )
                  void command("takeover");
              }}
            >
              Take this inspection myself
            </button>
          ) : null}
        </>
      ) : (
        <p>Loading inspection…</p>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
