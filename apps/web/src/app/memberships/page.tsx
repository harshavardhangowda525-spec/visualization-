"use client";
import { useState, useEffect } from "react";
import { api, Plan, money, requestKey } from "@/lib/api";
import { checkout } from "@/lib/checkout";
import { Button } from "@/components/ui/button";
export default function Memberships() {
  const [plans, setPlans] = useState<Plan[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    api("/memberships")
      .then(setPlans)
      .catch((e) => setMessage(e.message));
  }, []);
  async function buy(p: Plan) {
    setBusy(p.id);
    try {
      const k = "membership-key-" + p.id;
      let id = sessionStorage.getItem(k);
      if (!id) {
        id = requestKey();
        sessionStorage.setItem(k, id);
      }
      const order = await api("/memberships/subscribe", {
        planId: p.id,
        idempotencyKey: id,
      });
      const result = await checkout(order);
      if (result.status === "CAPTURED") {
        sessionStorage.removeItem(k);
        setMessage("Your membership is active. View it in your dashboard.");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main id="main" className="section memberships-page">
      <span className="section-index">YOUR CREATIVE HOME</span>
      <h1>
        Make room
        <br />
        for <em>more.</em>
      </h1>
      <p>
        Prepaid memberships. One payment, a fixed term, more possibilities.
        <br />
        No automatic recurring billing.
      </p>
      <div className="plans light-plans">
        {plans.map((p) => (
          <article key={p.id}>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <h3>
              {money(p.pricePaise)} / {p.days} days
            </h3>
            <ul>
              {p.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p>
              {p.maxBookings} eligible bookings. {p.discountBps / 100}%
              discount. {p.creditMinutes} credit minutes.
            </p>
            <Button disabled={Boolean(busy)} onClick={() => buy(p)}>
              {busy === p.id ? "Opening checkout…" : "Subscribe securely"}
            </Button>
          </article>
        ))}
      </div>
      <p className={message ? "notice" : ""} role="status">
        {message}
      </p>
      <a href="/dashboard">My membership dashboard →</a>
    </main>
  );
}
