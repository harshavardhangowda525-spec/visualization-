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
import { StudioCard } from "./studio-card";
import { Button } from "./ui/button";
export function Discovery() {
  const params = useSearchParams();
  const [category, setCategory] = useState(params.get("category") || ""),
    [location, setLocation] = useState(params.get("location") || ""),
    [search, setSearch] = useState(params.get("search") || ""),
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
    setCategory(params.get("category") || "");
    setSearch(params.get("search") || "");
    setLocation(params.get("location") || "");
    setPage(1);
  }, [params]);
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
      search,
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
  }, [category, search, location, capacity, maxPrice, facility, date, page]);
  return (
    <>
      <section className="listing-intro">
        <span className="section-index">DISCOVER / STUDIOS</span>
        <h1>Studios for your next creation</h1>
        <p>
          Photography, filmmaking and podcasts. Find your space and book your
          time.
        </p>
      </section>
      <section className="section listing-section">
        <div className="filters">
          <span>
            <SlidersHorizontal /> Find your space
          </span>
          <label>
            Search studios
            <input
              type="search"
              value={search}
              maxLength={100}
              placeholder="Studio or service"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
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
              setSearch("");
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
        <div className="market-studio-grid discovery-cards">
          {studios.map((s) => (
            <StudioCard
              key={s.id}
              studio={s}
              category={categories.find((c) => c.id === s.categoryId)?.name}
            />
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
