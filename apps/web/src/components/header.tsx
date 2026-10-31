"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
export function Header() {
  const [open, setOpen] = useState(false),
    [user, setUser] = useState<any>(null),
    [brand, setBrand] = useState("STILL / HOUSE");
  useEffect(() => {
    api("/settings")
      .then((s) => setBrand(s.business?.name || "STILL / HOUSE"))
      .catch(() => {});
    api("/auth/me")
      .then(setUser)
      .catch(() => {});
  }, []);
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Still House home">
        {brand}
      </Link>
      <nav
        className={open ? "navigation is-open" : "navigation"}
        aria-label="Main navigation"
      >
        <Link onClick={() => setOpen(false)} href="/studios">
          Our studios
        </Link>
        <Link onClick={() => setOpen(false)} href="/#memberships">
          Memberships
        </Link>
        <Link onClick={() => setOpen(false)} href="/#portfolio">
          The collection
        </Link>
        <Link onClick={() => setOpen(false)} href="/#faq">
          FAQs
        </Link>
      </nav>
      <div className="nav-actions">
        <Link href={user ? "/dashboard" : "/login"}>
          {user ? "My account" : "Sign in"}
        </Link>
        <Button asChild size="sm">
          <Link href="/studios">
            Book a session <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
        <button
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
