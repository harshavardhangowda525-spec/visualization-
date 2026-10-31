"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Users,
  Building2,
  Settings,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Analytics } from "./analytics";
import { Management } from "./management";
import { api, money, dateTime } from "@/lib/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
type Mode = "customer" | "admin" | "staff";
export function Workspace({ mode }: { mode: Mode }) {
  const [user, setUser] = useState<any>(null),
    [tab, setTab] = useState("overview"),
    [data, setData] = useState<any>(null),
    [bookings, setBookings] = useState<any[]>([]),
    [staff, setStaff] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [filterStatus, setFilterStatus] = useState(""),
    [action, setAction] = useState<any>(null),
    [value, setValue] = useState(""),
    [pending, setPending] = useState(false),
    [rating, setRating] = useState(5);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await api("/auth/me");
      setUser(me);
      if (mode !== "customer" && me.role !== mode.toUpperCase())
        throw new Error("You do not have access to this workspace.");
      const prefix =
        mode === "admin"
          ? "/admin/bookings"
          : mode === "staff"
            ? "/staff/bookings"
            : "/bookings";
      const rows = await api(prefix);
      setBookings(rows);
      if (mode === "admin") setStaff(await api("/admin/staff"));
      const endpoint =
        mode === "admin"
          ? (
              {
                overview: "/admin/dashboard",
                revenue: "/admin/revenue",
                studios: "/admin/studios",
                customers: "/admin/customers",
                payments: "/admin/payments",
                refunds: "/admin/refunds",
                reviews: "/admin/reviews",
                audit: "/admin/audit",
                memberships: "/admin/plans",
              } as Record<string, string>
            )[tab]
          : (
              {
                memberships: "/memberships/mine",
                payments: "/payments",
                notifications: "/users/notifications",
              } as Record<string, string>
            )[tab];
      setData(endpoint ? await api(endpoint) : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mode, tab]);
  useEffect(() => {
    load();
  }, [load]);
  async function perform() {
    if (!action) return;
    setPending(true);
    setStatus("");
    try {
      if (action.kind === "review") {
        await api("/users/reviews", {
          bookingId: action.id,
          rating,
          text: value,
        });
        setStatus("Thank you. Your review is awaiting moderation.");
      } else if (action.kind === "cancel") {
        await api(`/bookings/${action.id}/cancel`, {
          reason: value || "Customer requested cancellation",
        });
        setStatus(
          "Booking cancelled. Eligible refunds enter the administrator review queue.",
        );
      } else if (action.kind === "code") {
        const r = await api("/session-verification/code", {
          bookingId: action.id,
          purpose: action.purpose,
        });
        setStatus(
          `${action.purpose} verification code: ${r.code}. Expires in 3 minutes. Share only with assigned staff.`,
        );
      } else if (action.kind === "verify") {
        await api("/session-verification/verify", {
          bookingId: action.id,
          purpose: action.purpose,
          code: value,
        });
        setStatus("Session verified.");
      } else if (action.kind === "assign") {
        await api("/admin/assign", { bookingId: action.id, staffId: value });
        setStatus("Staff assigned.");
      } else if (action.kind === "refund") {
        await api("/admin/refunds/" + action.id + "/process", {});
        setStatus("Refund submitted to Razorpay.");
      } else if (action.kind === "approve") {
        await api("/admin/reviews/" + action.id + "/approve", {});
        setStatus("Review approved.");
      } else if (action.kind === "exception") {
        await api("/admin/bookings/" + action.id + "/exception", {
          status: action.status,
          reason: value,
        });
        setStatus("Exception recorded in audit log.");
      } else if (action.kind === "membership-cancel") {
        await api("/memberships/" + action.id + "/cancel", {});
        setStatus("Prepaid membership cancelled.");
      } else if (action.kind === "reschedule") {
        await api("/bookings/" + action.id + "/reschedule", {
          startsAt: new Date(value).toISOString(),
        });
        setStatus("Booking rescheduled.");
      }
      setAction(null);
      setValue("");
      await load();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const tabs =
    mode === "admin"
      ? [
          ["overview", "Overview", LayoutDashboard],
          ["bookings", "Bookings", CalendarDays],
          ["studios", "Studios", Building2],
          ["customers", "Customers", Users],
          ["memberships", "Membership plans", CreditCard],
          ["plan-create", "New membership", CreditCard],
          ["category-create", "New category", Building2],
          ["analytics", "Analytics", LayoutDashboard],
          ["revenue", "Revenue", CreditCard],
          ["payments", "Payments", CreditCard],
          ["refunds", "Refunds", CreditCard],
          ["reviews", "Reviews", Users],
          ["audit", "Audit log", ShieldCheck],
          ["team", "Staff access", Users],
          ["studio-create", "Add studio / media", Building2],
          ["settings", "Settings", Settings],
        ]
      : mode === "staff"
        ? [
            ["overview", "My schedule", CalendarDays],
            ["bookings", "Assigned bookings", LayoutDashboard],
            ["notifications", "Notifications", CalendarDays],
          ]
        : [
            ["overview", "Overview", LayoutDashboard],
            ["bookings", "My bookings", CalendarDays],
            ["memberships", "Memberships", CreditCard],
            ["payments", "Payments", CreditCard],
            ["notifications", "Notifications", CalendarDays],
            ["profile", "My profile", Settings],
          ];
  const rows = bookings.filter(
    (b) =>
      (!search ||
        [b.id, b.studioId, b.userId].some((x) => x.includes(search))) &&
      (!filterStatus || b.status === filterStatus),
  );
  return (
    <div className="workspace">
      <aside className="workspace-nav">
        <span className="section-index">
          {mode === "admin"
            ? "STUDIO MANAGEMENT"
            : mode === "staff"
              ? "STAFF WORKSPACE"
              : "YOUR CREATIVE HOME"}
        </span>
        {tabs.map(([id, label, Icon]: any) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon />
            {label}
          </button>
        ))}
        <div className="workspace-nav-bottom">
          <Link href="/studios">
            Explore studios <ArrowUpRight />
          </Link>
          {user?.role === "ADMIN" && mode !== "admin" ? (
            <Link href="/admin">Admin workspace</Link>
          ) : null}
          {user?.role === "STAFF" && mode !== "staff" ? (
            <Link href="/staff">Staff workspace</Link>
          ) : null}
          <button
            onClick={async () => {
              await api("/auth/logout", {});
              window.location.assign("/login");
            }}
          >
            <LogOut />
            Sign out
          </button>
        </div>
      </aside>
      <section className="workspace-content">
        <div className="workspace-top">
          <div>
            <span className="section-index">STILL / HOUSE</span>
            <h1>
              {tab === "overview"
                ? mode === "admin"
                  ? "The bigger picture."
                  : mode === "staff"
                    ? "Ready for your next session?"
                    : `Welcome${user?.name ? ", " + user.name.split(" ")[0] : ""}.`
                : String(tabs.find((t) => t[0] === tab)?.[1] || tab)}
            </h1>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
        {error ? (
          <div className="notice" role="alert">
            {error} {!user ? <Link href="/login">Sign in →</Link> : null}
          </div>
        ) : null}
        {status ? (
          <p className="notice" role="status">
            {status}
          </p>
        ) : null}
        {loading ? <p aria-live="polite">Loading your workspace…</p> : null}
        {!loading && !error && tab === "overview" ? (
          <>
            <div className="metric-grid">
              {(mode === "admin"
                ? [
                    ["Total bookings", data?.bookings || 0],
                    ["Today’s sessions", data?.today || 0],
                    ["Captured revenue", money(data?.revenuePaise || 0)],
                    ["Active memberships", data?.activeMemberships || 0],
                  ]
                : [
                    [
                      "Upcoming sessions",
                      bookings.filter((b) => b.status === "CONFIRMED").length,
                    ],
                    [
                      "In progress",
                      bookings.filter((b) => b.status === "IN_PROGRESS").length,
                    ],
                    [
                      "Completed",
                      bookings.filter((b) => b.status === "COMPLETED").length,
                    ],
                  ]
              ).map(([label, n]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{n}</strong>
                </article>
              ))}
            </div>
            <div className="section-heading">
              <h2>
                Your next <em>chapter.</em>
              </h2>
              <Link href="/studios" className="text-link">
                Book a session <ArrowUpRight />
              </Link>
            </div>
          </>
        ) : null}
        {!loading && !error && ["overview", "bookings"].includes(tab) ? (
          <>
            <div className="table-toolbar">
              <input
                aria-label="Search bookings"
                placeholder="Search booking, studio or customer ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "HELD",
                  "CONFIRMED",
                  "IN_PROGRESS",
                  "COMPLETED",
                  "CANCELLED",
                  "EXPIRED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Session (IST)</th>
                    <th>Status</th>
                    {mode !== "staff" ? <th>Total</th> : null}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>#{b.id.slice(0, 8)}</strong>
                        <small>
                          {b.studioName || `Studio ${b.studioId.slice(0, 8)}`}
                        </small>
                      </td>
                      <td>
                        {dateTime(b.startsAt)}
                        <small>
                          {(Date.parse(b.endsAt) - Date.parse(b.startsAt)) /
                            3600000}{" "}
                          hour session
                        </small>
                      </td>
                      <td>
                        <span
                          className={"status status-" + b.status.toLowerCase()}
                        >
                          {b.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      {mode !== "staff" ? <td>{money(b.totalPaise)}</td> : null}
                      <td>
                        <div className="row-actions">
                          {mode === "customer" && b.status === "COMPLETED" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setAction({
                                  kind: "review",
                                  id: b.id,
                                  title: "Share your experience",
                                })
                              }
                            >
                              Review session
                            </Button>
                          ) : null}
                          {mode === "customer" &&
                          ["CONFIRMED", "IN_PROGRESS"].includes(b.status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setAction({
                                  kind: "code",
                                  id: b.id,
                                  purpose:
                                    b.status === "CONFIRMED" ? "START" : "END",
                                  title: "Show session verification code",
                                })
                              }
                            >
                              Get {b.status === "CONFIRMED" ? "start" : "end"}{" "}
                              code
                            </Button>
                          ) : null}
                          {mode === "staff" &&
                          ["CONFIRMED", "IN_PROGRESS"].includes(b.status) ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                setAction({
                                  kind: "verify",
                                  id: b.id,
                                  purpose:
                                    b.status === "CONFIRMED" ? "START" : "END",
                                  title: "Verify customer session",
                                })
                              }
                            >
                              {b.status === "CONFIRMED" ? "Start" : "End"}{" "}
                              session
                            </Button>
                          ) : null}
                          {mode === "admin" &&
                          ["HELD", "CONFIRMED"].includes(b.status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setValue("");
                                setAction({
                                  kind: "assign",
                                  id: b.id,
                                  title: "Assign staff",
                                });
                              }}
                            >
                              Assign staff
                            </Button>
                          ) : null}
                          {mode === "admin" &&
                          ["CONFIRMED", "IN_PROGRESS"].includes(b.status) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setAction({
                                  kind: "exception",
                                  id: b.id,
                                  status:
                                    b.status === "CONFIRMED"
                                      ? "IN_PROGRESS"
                                      : "COMPLETED",
                                  title: "Administrator session exception",
                                })
                              }
                            >
                              OTP exception
                            </Button>
                          ) : null}
                          {mode !== "staff" && b.status === "CONFIRMED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setAction({
                                  kind: "reschedule",
                                  id: b.id,
                                  title: "Reschedule session",
                                })
                              }
                            >
                              Reschedule
                            </Button>
                          ) : null}
                          {mode !== "staff" &&
                          ["HELD", "CONFIRMED"].includes(b.status) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setAction({
                                  kind: "cancel",
                                  id: b.id,
                                  title: "Cancel this booking?",
                                })
                              }
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? (
                <p className="empty">
                  No bookings here yet. Your next great idea starts with a
                  space.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
        {!loading &&
        !error &&
        [
          "team",
          "settings",
          "studio-create",
          "plan-create",
          "category-create",
        ].includes(tab) ? (
          <Management kind={tab} onSave={load} />
        ) : null}
        {!loading && !error && tab === "profile" ? (
          <Profile user={user} onSave={() => load()} />
        ) : null}
        {!loading && !error && tab === "analytics" ? <Analytics /> : null}
        {!loading && !error && tab === "revenue" ? (
          <Revenue data={data || []} />
        ) : null}
        {!loading && !error && tab === "studios" ? (
          <AdminStudios studios={data || []} onSave={load} />
        ) : null}
        {!loading && !error && tab === "memberships" && mode === "admin" ? (
          <PlanEditor plans={data || []} onSave={load} />
        ) : null}
        {!loading && !error && tab === "memberships" && mode === "customer" ? (
          <div className="workspace-cards">
            {(data || []).map((m: any) => (
              <article key={m.id}>
                <h3>{m.status} membership</h3>
                <p>Expires {dateTime(m.expiresAt)}</p>
                <p>
                  {m.discountBps / 100}% discount · {m.remainingMinutes} credit
                  minutes · {m.remainingBookings} bookings left
                </p>
                {m.status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setAction({
                        kind: "membership-cancel",
                        id: m.id,
                        title: "Cancel membership?",
                      })
                    }
                  >
                    Cancel plan
                  </Button>
                ) : null}
              </article>
            ))}
            <Button asChild>
              <Link href="/memberships">
                Explore plans / renew <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        ) : null}
        {!loading &&
        !error &&
        ![
          "overview",
          "bookings",
          "profile",
          "revenue",
          "studios",
          "memberships",
          "team",
          "settings",
          "studio-create",
          "plan-create",
          "category-create",
          "analytics",
        ].includes(tab) ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(data?.length
                    ? Object.keys(data[0])
                        .filter(
                          (k) =>
                            !["userId", "detail", "payloadHash"].includes(k),
                        )
                        .slice(0, 7)
                    : ["Records"]
                  ).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                  {["refunds", "reviews"].includes(tab) ? (
                    <th>Action</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {(data || []).map((r: any) => (
                  <tr key={r.id}>
                    {Object.keys(r)
                      .filter(
                        (k) => !["userId", "detail", "payloadHash"].includes(k),
                      )
                      .slice(0, 7)
                      .map((k) => (
                        <td key={k}>
                          {k.includes("Paise")
                            ? money(r[k])
                            : typeof r[k] === "object"
                              ? JSON.stringify(r[k])
                              : String(r[k] ?? "—")}
                        </td>
                      ))}
                    {tab === "refunds" ? (
                      <td>
                        <Button
                          size="sm"
                          disabled={r.status !== "REQUESTED"}
                          onClick={() =>
                            setAction({
                              kind: "refund",
                              id: r.id,
                              title: "Submit this refund?",
                            })
                          }
                        >
                          Process
                        </Button>
                      </td>
                    ) : tab === "reviews" ? (
                      <td>
                        <Button
                          size="sm"
                          disabled={r.approved}
                          onClick={() =>
                            setAction({
                              kind: "approve",
                              id: r.id,
                              title: "Publish this customer review?",
                            })
                          }
                        >
                          Approve
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.length ? (
              <p className="empty">No records to display.</p>
            ) : null}
          </div>
        ) : null}
      </section>
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setValue("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{action?.title}</DialogTitle>
          <DialogDescription>
            {action?.kind === "exception"
              ? "A detailed reason is mandatory. This action bypasses normal OTP verification and is permanently audited."
              : action?.kind === "code"
                ? "Display this private code only when the customer and assigned staff are ready."
                : "Review the details before confirming. Business policies are checked on the server."}
          </DialogDescription>
          {action?.kind === "assign" ? (
            <label>
              Staff
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">Select assigned staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.phone}
                  </option>
                ))}
              </select>
            </label>
          ) : [
              "cancel",
              "exception",
              "verify",
              "reschedule",
              "review",
            ].includes(action?.kind) ? (
            <label>
              {action?.kind === "verify"
                ? "Customer verification code"
                : action?.kind === "reschedule"
                  ? "New start time (your device timezone)"
                  : "Reason"}
              <input
                type={action?.kind === "reschedule" ? "datetime-local" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode={action?.kind === "verify" ? "numeric" : "text"}
              />
            </label>
          ) : null}
          {action?.kind === "review" ? (
            <label>
              Rating
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button disabled={pending} onClick={perform}>
            {pending ? "Processing…" : "Confirm"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Profile({ user, onSave }: { user: any; onSave: () => void }) {
  const [name, setName] = useState(user?.name || ""),
    [email, setEmail] = useState(user?.email || ""),
    [status, setStatus] = useState("");
  return (
    <form
      className="editor-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(
            "/users/me",
            { name, ...(email ? { email } : {}) },
            "PATCH",
          );
          setStatus("Profile saved");
          onSave();
        } catch (e) {
          setStatus((e as Error).message);
        }
      }}
    >
      <label>
        Your name
        <input
          required
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Email for confirmations
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <p>Mobile: {user?.phone}</p>
      <Button type="submit">Save profile</Button>
      <p role="status">{status}</p>
    </form>
  );
}
function Revenue({ data }: { data: any[] }) {
  const max = Math.max(1, ...data.map((x) => x.paise));
  return (
    <section>
      <h2>
        Captured revenue <em>by day.</em>
      </h2>
      <p>Last 90 days · INR · Asia/Kolkata · before refunds and gateway fees</p>
      <div className="revenue-chart">
        {data.map((r) => (
          <div key={r.day} className="chart-column">
            <button
              aria-label={`${r.day}: ${money(r.paise)}`}
              title={`${r.day}: ${money(r.paise)}`}
              style={{ height: Math.max(4, (r.paise / max) * 220) + "px" }}
            />
            <small>{String(r.day).slice(5, 10)}</small>
          </div>
        ))}
      </div>
      {!data.length ? (
        <p className="empty">
          Revenue appears here after verified payment captures.
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Captured revenue</th>
            <th>Payments</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.day}>
              <td>{String(r.day).slice(0, 10)}</td>
              <td>{money(r.paise)}</td>
              <td>{r.transactions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
function AdminStudios({
  studios,
  onSave,
}: {
  studios: any[];
  onSave: () => void;
}) {
  const [msg, setMsg] = useState("");
  return (
    <div className="workspace-cards">
      {studios.map((s) => (
        <article key={s.id}>
          <h3>{s.name}</h3>
          <p>
            {s.location} · {s.capacity} people
          </p>
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api(
                  "/admin/studios/" + s.id,
                  {
                    slug: s.slug,
                    categoryId: s.categoryId,
                    name: String(f.get("name")),
                    description: String(f.get("description")),
                    location: String(f.get("location")),
                    capacity: Number(f.get("capacity")),
                    bufferMinutes: s.bufferMinutes,
                    equipment: s.equipment,
                    active: f.get("active") === "on",
                  },
                  "PATCH",
                );
                await api(
                  "/admin/studios/" + s.id + "/facilities",
                  {
                    names: String(f.get("facilities"))
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                  "PATCH",
                );
                setMsg("Studio updated.");
                onSave();
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            <label>
              Name
              <input name="name" defaultValue={s.name} required />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={s.description}
                required
              />
            </label>
            <label>
              Location
              <input name="location" defaultValue={s.location} required />
            </label>
            <label>
              Capacity
              <input
                name="capacity"
                type="number"
                min="1"
                max="500"
                defaultValue={s.capacity}
                required
              />
            </label>
            <label>
              Facilities (comma separated)
              <input
                name="facilities"
                defaultValue={s.facilities.map((f: any) => f.name).join(", ")}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="active" defaultChecked={s.active} />
              Available for booking
            </label>
            <Button type="submit" size="sm">
              Save studio
            </Button>
          </form>
          {s.services.map((service: any) => (
            <form
              key={service.id}
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await api(
                    `/admin/services/${service.id}/price`,
                    {
                      hourlyPaise: Math.round(Number(f.get("price")) * 100),
                      taxBps: Number(f.get("tax")),
                    },
                    "PATCH",
                  );
                  setMsg(
                    "Pricing updated. Existing bookings keep their price snapshot.",
                  );
                  onSave();
                } catch (e) {
                  setMsg((e as Error).message);
                }
              }}
            >
              <h4>{service.name}</h4>
              <label>
                Hourly price (₹)
                <input
                  name="price"
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  defaultValue={service.hourlyPaise / 100}
                />
              </label>
              <label>
                Tax in basis points (1800 = 18%)
                <input
                  name="tax"
                  required
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue={service.taxBps}
                />
              </label>
              <Button size="sm" type="submit">
                Update pricing
              </Button>
            </form>
          ))}
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/admin/blocks", {
                  studioId: s.id,
                  startsAt: new Date(String(f.get("start"))).toISOString(),
                  endsAt: new Date(String(f.get("end"))).toISOString(),
                  reason: String(f.get("reason")),
                });
                setMsg("Studio time blocked.");
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            <h4>Block unavailable time</h4>
            <label>
              Start (device timezone)
              <input required name="start" type="datetime-local" />
            </label>
            <label>
              End
              <input required name="end" type="datetime-local" />
            </label>
            <label>
              Reason
              <input required name="reason" />
            </label>
            <Button variant="outline" size="sm" type="submit">
              Block time
            </Button>
          </form>
        </article>
      ))}
      <p className="notice" role="status">
        {msg}
      </p>
    </div>
  );
}
function PlanEditor({ plans, onSave }: { plans: any[]; onSave: () => void }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="workspace-cards">
      {plans.map((p) => (
        <form
          key={p.id}
          className="editor-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const { id, ...rest } = p;
            try {
              await api(
                "/admin/plans/" + id,
                {
                  ...rest,
                  name: f.get("name"),
                  pricePaise: Math.round(Number(f.get("price")) * 100),
                  discountBps: Number(f.get("discount")) * 100,
                  days: Number(f.get("days")),
                  maxBookings: Number(f.get("maxBookings")),
                  creditMinutes: Number(f.get("credits")),
                  benefits: String(f.get("benefits"))
                    .split("\n")
                    .filter(Boolean),
                  active: f.get("active") === "on",
                },
                "PATCH",
              );
              setMsg(
                "Plan updated. Existing memberships retain their benefits.",
              );
              onSave();
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          <h3>{p.name}</h3>
          <label>
            Name
            <input name="name" defaultValue={p.name} required />
          </label>
          <label>
            Plan price (₹)
            <input
              name="price"
              type="number"
              min="1"
              step="0.01"
              defaultValue={p.pricePaise / 100}
              required
            />
          </label>
          <label>
            Discount %
            <input
              name="discount"
              type="number"
              min="0"
              max="100"
              defaultValue={p.discountBps / 100}
              required
            />
          </label>
          <label>
            Validity days
            <input
              name="days"
              type="number"
              min="1"
              max="730"
              defaultValue={p.days}
              required
            />
          </label>
          <label>
            Maximum eligible bookings
            <input
              name="maxBookings"
              type="number"
              min="1"
              max="1000"
              defaultValue={p.maxBookings}
              required
            />
          </label>
          <label>
            Included minutes
            <input
              name="credits"
              type="number"
              min="0"
              max="10000"
              defaultValue={p.creditMinutes}
              required
            />
          </label>
          <label>
            Benefits (one per line)
            <textarea name="benefits" defaultValue={p.benefits.join("\n")} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={p.active} />
            Available for purchase
          </label>
          <Button type="submit">Save plan</Button>
        </form>
      ))}
      <p role="status">{msg}</p>
    </div>
  );
}
