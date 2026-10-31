"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Search,
  MapPin,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { api, Studio, money } from "@/lib/api";
import { Button } from "./ui/button";
export function Discovery() {
  const params = useSearchParams();
  const [category, setCategory] = useState(params.get("category") || ""),
    [location, setLocation] = useState(""),
    [capacity, setCapacity] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [facility, setFacility] = useState(""),
    [date, setDate] = useState(""),
    [categories, setCategories] = useState<any[]>([]),
    [studios, setStudios] = useState<Studio[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    api("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    const query = new URLSearchParams({
      category,
      location,
      capacity,
      maxPrice: maxPrice ? String(Number(maxPrice) * 100) : "",
      facility,
      page: String(page),
    });
    api("/studios?" + query)
      .then(async (r) => {
        let rows = r.items;
        if (date)
          rows = (
            await Promise.all(
              rows.map(async (s: Studio) => {
                if (!s.services.length) return null;
                const a = await api(
                  `/studios/${s.id}/availability?date=${date}&serviceId=${s.services[0].id}&minutes=${s.services[0].minMinutes}`,
                );
                return a.slots.some((x: any) => x.available) ? s : null;
              }),
            )
          ).filter(Boolean);
        if (active) {
          setStudios(rows);
          setPages(r.pages);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [category, location, capacity, maxPrice, facility, date, page]);
  return (
    <>
      <section className="listing-intro">
        <span className="section-index">THE SPACES / STILL HOUSE</span>
        <h1>
          Room for <em>your vision.</em>
        </h1>
        <p>Find your light. Set your scene. Make something extraordinary.</p>
      </section>
      <section className="section listing-section">
        <div className="filters">
          <span>
            <SlidersHorizontal /> Find your space
          </span>
          <label>
            Studio type
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All spaces</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <input
              placeholder="City or neighbourhood"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Available date
            <input
              type="date"
              value={date}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            People
            <input
              type="number"
              min="1"
              max="500"
              placeholder="Any capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </label>
          <label>
            Max. hourly price (₹)
            <input
              type="number"
              min="1"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="No maximum"
            />
          </label>
          <label>
            Facility
            <select
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            >
              <option value="">All facilities</option>
              <option>Air conditioning</option>
              <option>Lighting included</option>
              <option>Sound treated</option>
              <option>Changing room</option>
            </select>
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setCategory("");
              setLocation("");
              setCapacity("");
              setMaxPrice("");
              setDate("");
              setFacility("");
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        </div>
        <div className="results-top">
          <span aria-live="polite">
            {busy
              ? "Finding your space…"
              : `${studios.length} spaces to make your own`}
          </span>
          <span>Thoughtfully equipped. Ready for you.</span>
        </div>
        {error ? (
          <p role="alert" className="notice">
            {error}
          </p>
        ) : !busy && !studios.length ? (
          <p className="empty">
            No studios match these filters. Try another date or a wider search.
          </p>
        ) : null}
        <div className="studio-grid">
          {studios.map((s) => (
            <article className="studio-card" key={s.id}>
              <Link href={"/studios/" + s.slug}>
                <div className="studio-photo">
                  <Image
                    src={s.images[0]?.url || "/images/studio-hero.webp"}
                    alt={s.images[0]?.alt || s.name}
                    fill
                    sizes="(max-width:700px) 100vw, 33vw"
                  />
                </div>
                <div className="studio-title">
                  <h2>{s.name}</h2>
                  <ArrowUpRight />
                </div>
              </Link>
              <p>
                <MapPin />
                {s.location} · <Users />
                {s.capacity} people
              </p>
              <p>{s.description}</p>
              <div className="studio-meta">
                <span>
                  {s.facilities
                    .slice(0, 2)
                    .map((f) => f.name)
                    .join(" · ")}
                </span>
                <strong>
                  {s.services[0] ? money(s.services[0].hourlyPaise) : "—"}
                  <small> / hr</small>
                </strong>
              </div>
              <Button asChild variant="outline">
                <Link href={"/studios/" + s.slug}>
                  View studio &amp; availability{" "}
                  <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
        <div className="pagination">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.max(1, pages)}
          </span>
          <Button
            variant="ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </section>
    </>
  );
}
