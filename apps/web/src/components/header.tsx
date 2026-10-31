"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  Search,
  MapPin,
  ChevronDown,
  Camera,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";

export function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [brand, setBrand] = useState("STILL / HOUSE");
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  useEffect(() => {
    api("/settings")
      .then((s) => setBrand(s.business?.name || "STILL / HOUSE"))
      .catch(() => {});
    api("/categories")
      .then(setCategories)
      .catch(() => {});
    api("/locations")
      .then(setLocations)
      .catch(() => {});
    api("/auth/me")
      .then(setUser)
      .catch(() => {});
    setCity(sessionStorage.getItem("studio-city") || "");
  }, []);
  return (
    <header className="market-header">
      <div className="market-top">
        <Link href="/" className="market-brand" aria-label={`${brand} home`}>
          {brand.includes("/") ? (
            <>
              {brand.split("/")[0]}
              <span>/</span>
              {brand.split("/").slice(1).join("/")}
            </>
          ) : (
            brand
          )}
        </Link>
        <form action="/studios" className="market-search" role="search">
          <Search aria-hidden="true" />
          <input
            type="search"
            name="search"
            aria-label="Search studios"
            placeholder="Search studios, services and spaces"
            maxLength={100}
          />
          {city ? <input type="hidden" name="location" value={city} /> : null}
          <button aria-label="Search" type="submit">
            <ArrowRight />
          </button>
        </form>
        <div className="market-actions">
          <Dialog open={cityOpen} onOpenChange={setCityOpen}>
            <DialogTrigger asChild>
              <button className="city-trigger">
                <MapPin />
                <span>{city || "Select location"}</span>
                <ChevronDown />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="city-title">
                Choose your location
              </DialogTitle>
              <DialogDescription>
                Find a studio near you. Locations reflect the current studio
                catalogue.
              </DialogDescription>
              <input
                type="search"
                aria-label="Search locations"
                placeholder="Search your city or neighbourhood"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
              />
              <div className="city-list">
                <button
                  onClick={() => {
                    setCity("");
                    sessionStorage.removeItem("studio-city");
                    setCityOpen(false);
                    router.push("/studios");
                  }}
                >
                  <MapPin /> All locations
                </button>
                {locations
                  .filter((l) =>
                    l.toLowerCase().includes(cityQuery.toLowerCase()),
                  )
                  .map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setCity(l);
                        sessionStorage.setItem("studio-city", l);
                        setCityOpen(false);
                        router.push(
                          "/studios?location=" + encodeURIComponent(l),
                        );
                      }}
                    >
                      <MapPin />
                      {l}
                      <ArrowRight />
                    </button>
                  ))}
                {locations.length > 0 &&
                !locations.some((l) =>
                  l.toLowerCase().includes(cityQuery.toLowerCase()),
                ) ? (
                  <p>No locations match your search.</p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
          <Link className="signin-button" href={user ? "/dashboard" : "/login"}>
            {user ? "My account" : "Sign in"}
          </Link>
          <button
            className="market-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="account-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <div className="market-nav">
        <nav aria-label="Studio categories">
          <Link href="/studios">All studios</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/studios?category=${c.id}`}>
              {c.name.replace(/ Studio$/i, "")}
            </Link>
          ))}
          <Link href="/memberships">Memberships</Link>
        </nav>
        <nav aria-label="Quick links">
          <Link href="/dashboard">My bookings</Link>
          <Link href="/#portfolio">The collection</Link>
          <Link href="/contact">Help & support</Link>
        </nav>
      </div>
      {open ? (
        <nav
          id="account-navigation"
          className="account-drawer"
          aria-label="Account navigation"
        >
          <strong>Your next creation starts here.</strong>
          <Link onClick={() => setOpen(false)} href="/studios">
            <Camera /> Our studios
          </Link>
          <Link onClick={() => setOpen(false)} href="/dashboard">
            My bookings & account
          </Link>
          <Link onClick={() => setOpen(false)} href="/memberships">
            Creator memberships
          </Link>
          <Link onClick={() => setOpen(false)} href="/#faq">
            FAQs
          </Link>
          <Link onClick={() => setOpen(false)} href="/contact">
            Help & support
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
