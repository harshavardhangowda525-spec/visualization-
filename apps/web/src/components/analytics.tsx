"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { Button } from "./ui/button";
export function Analytics() {
  const [data, setData] = useState<any>(null),
    [series, setSeries] = useState("dailyRevenue"),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/analytics")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const options = [
    ["dailyRevenue", "Daily revenue"],
    ["monthlyRevenue", "Monthly revenue"],
    ["bookingTrends", "Booking trends"],
    ["popularServices", "Popular services"],
    ["studioUtilization", "Studio utilization"],
    ["membershipGrowth", "Membership growth"],
  ];
  const rows = data?.[series] || [];
  const max = Math.max(1, ...rows.map((x: any) => x.value));
  const format = (v: number) =>
    series.includes("Revenue")
      ? money(v)
      : series === "studioUtilization"
        ? v + "%"
        : String(v);
  return (
    <section>
      <h2>
        Understand <em>your studio.</em>
      </h2>
      <div
        className="analytics-options"
        role="group"
        aria-label="Choose analytics report"
      >
        {options.map(([key, name]) => (
          <Button
            key={key}
            variant={key === series ? "default" : "outline"}
            size="sm"
            aria-pressed={key === series}
            onClick={() => setSeries(key)}
          >
            {name}
          </Button>
        ))}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className="revenue-chart">
        {rows.map((r: any) => (
          <div key={r.label} className="chart-column">
            <button
              aria-label={`${r.label}: ${format(r.value)}`}
              title={`${r.label}: ${format(r.value)}`}
              style={{ height: Math.max(3, (r.value / max) * 220) + "px" }}
            />
            <small>{r.label}</small>
          </div>
        ))}
      </div>
      {!rows.length ? (
        <p className="empty">No activity for this report yet.</p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Period / category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fine-print">{data?.notes}</p>
    </section>
  );
}
