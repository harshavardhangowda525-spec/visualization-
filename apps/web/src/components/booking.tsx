"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  Users,
  Check,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { api, Studio, money, dateTime, requestKey } from "@/lib/api";
import { Button } from "./ui/button";
import { checkout } from "@/lib/checkout";
export function Booking({ studio: s }: { studio: Studio }) {
  const [serviceId, setService] = useState(s.services[0]?.id || ""),
    [minutes, setMinutes] = useState(s.services[0]?.minMinutes || 60),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<any[]>([]),
    [start, setStart] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [hold, setHold] = useState<any>(null),
    [memberships, setMemberships] = useState<any[]>([]),
    [membershipId, setMembership] = useState(""),
    [now, setNow] = useState(Date.now());
  const key = useRef("");
  const service = s.services.find((x) => x.id === serviceId);
  useEffect(() => {
    api("/memberships/mine")
      .then(setMemberships)
      .catch(() => {});
  }, []);
  useEffect(() => {
    key.current = requestKey();
    setHold(null);
    setStart("");
    if (!date || !serviceId) return;
    let active = true;
    setLoading(true);
    const refresh = () =>
      api(
        `/studios/${s.id}/availability?date=${date}&serviceId=${serviceId}&minutes=${minutes}`,
      )
        .then((r) => active && setSlots(r.slots))
        .catch((e) => active && setMessage(e.message))
        .finally(() => active && setLoading(false));
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [date, serviceId, minutes, s.id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    key.current = requestKey();
    setHold(null);
  }, [start, membershipId]);
  async function reserve() {
    setBusy(true);
    setMessage("");
    try {
      await api("/auth/me");
      const b =
        hold ||
        (await api("/bookings/hold", {
          studioId: s.id,
          serviceId,
          startsAt: start,
          minutes,
          idempotencyKey: key.current,
          ...(membershipId ? { membershipId } : {}),
        }));
      setHold(b);
      const order = await api("/payments/create-order", { id: b.id });
      const result = order.free ? order : await checkout(order);
      setMessage(
        result.status === "CAPTURED"
          ? "Your session is confirmed. Find the details in your dashboard."
          : "Payment received and flagged for review. Contact the studio; no session has been confirmed.",
      );
    } catch (e) {
      setMessage(
        (e as Error).message === "Authentication required"
          ? "Sign in to reserve your session."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  const eligible = memberships.filter(
    (m) => m.status === "ACTIVE" && new Date(m.expiresAt) > new Date(),
  );
  return (
    <>
      <div className="detail-breadcrumb">
        <Link href="/studios">
          <ArrowLeft /> All spaces
        </Link>
        <span>
          {s.location} / {s.name}
        </span>
      </div>
      <div className="detail-cover">
        <Image
          src={s.images[0]?.url || "/images/studio-hero.webp"}
          alt={s.images[0]?.alt || s.name}
          fill
          priority
          sizes="100vw"
        />
        <div>
          <span>A SPACE FOR YOUR NEXT STORY</span>
          <h1>{s.name}</h1>
        </div>
      </div>
      <div className="detail-layout">
        <div className="detail-copy">
          <span className="section-index">THE STUDIO</span>
          <h2>
            Set the scene.
            <br />
            <em>Make it yours.</em>
          </h2>
          <p className="lead">{s.description}</p>
          <div className="detail-facts">
            <span>
              <MapPin />
              {s.location}
            </span>
            <span>
              <Users />
              Up to {s.capacity} people
            </span>
            <span>
              <Clock />
              Times shown in {s.timezone}
            </span>
          </div>
          <h3>Everything you need.</h3>
          <div className="facility-list">
            {s.facilities.map((f) => (
              <span key={f.name}>
                <Check />
                {f.name}
              </span>
            ))}
          </div>
          <h3>In the kit</h3>
          <ul>
            {s.equipment.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <h3>Opening hours</h3>
          <ul>
            {s.hours.map((h) => (
              <li key={h.weekday}>
                {
                  [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ][h.weekday]
                }
                : {Math.floor(h.openMinute / 60)}:
                {String(h.openMinute % 60).padStart(2, "0")}–
                {Math.floor(h.closeMinute / 60)}:
                {String(h.closeMinute % 60).padStart(2, "0")}
              </li>
            ))}
          </ul>
          <h3>A little housekeeping</h3>
          <p>
            Review the{" "}
            <Link href="/policies/cancellation">
              cancellation and refund policy
            </Link>{" "}
            before payment. Your hold lasts ten minutes. Booking is confirmed
            after verified payment capture. Extensions require a separate
            available slot.
          </p>
        </div>
        <aside className="booking-panel">
          <span className="section-index">MAKE TIME TO CREATE</span>
          <h2>Book your session.</h2>
          <p>
            From {service ? money(service.hourlyPaise) : "—"}{" "}
            <small>/ hour + applicable tax</small>
          </p>
          <label>
            Service
            <select
              value={serviceId}
              onChange={(e) => {
                setService(e.target.value);
                setMinutes(
                  s.services.find((x) => x.id === e.target.value)!.minMinutes,
                );
              }}
            >
              {s.services.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Date
              <input
                type="date"
                min={new Date().toLocaleDateString("en-CA")}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Duration
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {service
                  ? Array.from(
                      {
                        length:
                          Math.floor(
                            (service.maxMinutes - service.minMinutes) /
                              service.stepMinutes,
                          ) + 1,
                      },
                      (_, i) => service.minMinutes + i * service.stepMinutes,
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n / 60} hours
                      </option>
                    ))
                  : null}
              </select>
            </label>
          </div>
          <fieldset className="slot-fieldset">
            <legend>Choose a start time</legend>
            {loading ? (
              <p aria-live="polite">Checking availability…</p>
            ) : date ? (
              <div className="time-slots">
                {slots.map((slot) => (
                  <label
                    className={
                      !slot.available
                        ? "unavailable"
                        : start === slot.startsAt
                          ? "selected"
                          : ""
                    }
                    key={slot.startsAt}
                  >
                    <input
                      type="radio"
                      name="slot"
                      value={slot.startsAt}
                      checked={start === slot.startsAt}
                      disabled={!slot.available}
                      onChange={() => setStart(slot.startsAt)}
                    />
                    {new Intl.DateTimeFormat("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: s.timezone,
                    }).format(new Date(slot.startsAt))}
                  </label>
                ))}
              </div>
            ) : (
              <p>Select a date to see live availability.</p>
            )}
            {date && !loading && !slots.length ? (
              <p>No operating hours for this date.</p>
            ) : null}
          </fieldset>
          {eligible.length > 0 ? (
            <label>
              Membership
              <select
                value={membershipId}
                onChange={(e) => setMembership(e.target.value)}
              >
                <option value="">No membership</option>
                {eligible.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.discountBps / 100}% discount · {m.remainingMinutes}{" "}
                    minutes remaining
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="price-summary">
            {hold ? (
              <>
                <div>
                  <span>Studio session</span>
                  <span>{money(hold.subtotalPaise)}</span>
                </div>
                <div>
                  <span>Membership savings</span>
                  <span>−{money(hold.discountPaise)}</span>
                </div>
                <div>
                  <span>Tax</span>
                  <span>{money(hold.taxPaise)}</span>
                </div>
                <div className="total">
                  <strong>Total</strong>
                  <strong>{money(hold.totalPaise)}</strong>
                </div>
                <p role="timer">
                  Hold expires in{" "}
                  {Math.max(
                    0,
                    Math.ceil((Date.parse(hold.expiresAt) - now) / 1000),
                  )}{" "}
                  seconds
                </p>
              </>
            ) : (
              <>
                <div>
                  <span>Session estimate</span>
                  <span>
                    {service
                      ? money(Math.round((service.hourlyPaise * minutes) / 60))
                      : "—"}
                  </span>
                </div>
                <p>
                  Final tax and eligible benefits are calculated securely when
                  you reserve.
                </p>
              </>
            )}
          </div>
          <Button
            disabled={
              !start || busy || (hold && Date.parse(hold.expiresAt) <= now)
            }
            onClick={reserve}
          >
            {busy
              ? "Securing your session…"
              : hold
                ? "Continue to payment"
                : "Reserve & continue"}{" "}
            <ArrowUpRight data-icon="inline-end" />
          </Button>
          <p className="secure-note">
            <ShieldCheck /> Secure checkout powered by Razorpay
          </p>
          {message ? (
            <div className="notice" role="status">
              {message}
              {message.includes("Sign in") ? (
                <Link href={"/login?next=/studios/" + s.slug}> Sign in →</Link>
              ) : null}
              {message.includes("confirmed") ? (
                <Link href="/dashboard"> Your dashboard →</Link>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
