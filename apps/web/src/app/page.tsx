import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Camera,
  CalendarDays,
  CreditCard,
  TicketCheck,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { serverApi, money, Studio, Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StudioCard } from "@/components/studio-card";
import { StudioBanner } from "@/components/studio-banner";
export const dynamic = "force-dynamic";
export default async function Home() {
  let studios: Studio[] = [],
    categories: any[] = [],
    plans: Plan[] = [],
    settings: any = {},
    reviews: any[] = [],
    error = "";
  try {
    const result = await Promise.all([
      serverApi("/studios"),
      serverApi("/categories"),
      serverApi("/memberships"),
      serverApi("/settings"),
      serverApi("/reviews"),
    ]);
    studios = result[0].items;
    categories = result[1];
    plans = result[2];
    settings = result[3];
    reviews = result[4];
  } catch {
    error =
      "The studio catalogue is temporarily unavailable. Please try again shortly.";
  }
  return (
    <main id="main" className="market-home">
      <StudioBanner />
      <section className="market-section" id="spaces">
        <div className="market-heading">
          <h2>Recommended studios</h2>
          <Link href="/studios">
            See all <ArrowRight />
          </Link>
        </div>
        {error ? (
          <p role="status" className="notice">
            {error}
          </p>
        ) : (
          <div className="market-studio-grid">
            {studios.slice(0, 6).map((s) => (
              <StudioCard
                key={s.id}
                studio={s}
                category={categories.find((c) => c.id === s.categoryId)?.name}
              />
            ))}
          </div>
        )}
      </section>
      <section className="market-section category-section">
        <div className="market-heading">
          <h2>Find your creative space</h2>
          <Link href="/studios">
            Explore all categories <ArrowRight />
          </Link>
        </div>
        <div className="market-categories">
          {categories.map((c) => (
            <article key={c.id}>
              <Link
                href={`/studios?category=${c.id}`}
                className="market-category-image"
              >
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  sizes="(max-width:600px) 78vw, 30vw"
                />
                <span>{c.name.replace(/ Studio$/i, "")}</span>
              </Link>
              <p>{c.description}</p>
              <div className="category-bottom">
                <strong>
                  {c.startingPaise ? (
                    <>
                      From {money(c.startingPaise)}
                      <small> / hr</small>
                    </>
                  ) : (
                    "Enquire for pricing"
                  )}
                </strong>
                <Link href={`/studios?category=${c.id}`}>
                  Book now <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="memberships" className="creator-club">
        <div className="creator-club-inner">
          <div className="club-intro">
            <span>{settings.business?.name || "STILL / HOUSE"}</span>
            <h2>The Creator Club</h2>
            <p>
              Make more of your creative time. Explore membership benefits,
              booking discounts and included credits.
            </p>
            <Button asChild variant="outline">
              <Link href="/memberships">
                Explore memberships <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="club-plans">
            {plans.map((p) => (
              <article key={p.id}>
                <div className="club-plan-heading">
                  <h3>{p.name}</h3>
                  <span>{p.days} days</span>
                </div>
                <h4>
                  {money(p.pricePaise)}
                  <small> / plan</small>
                </h4>
                <p>{p.description}</p>
                <ul>
                  {p.benefits.map((b) => (
                    <li key={b}>
                      <Check />
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="fine-print">
                  Up to {p.maxBookings} eligible bookings during the plan term.
                </p>
                <Button asChild>
                  <Link href={`/memberships?plan=${p.id}`}>
                    View plan <ArrowRight />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="market-section booking-steps">
        <div className="market-heading">
          <h2>Your next session, in four steps</h2>
        </div>
        <div>
          {[
            [Camera, "Choose a studio", "Find a space for your next idea."],
            [
              CalendarDays,
              "Select date & time",
              "Check live slots and session length.",
            ],
            [
              CreditCard,
              "Complete payment",
              "Review your price and pay securely.",
            ],
            [
              TicketCheck,
              "You're all set",
              "Receive your booking confirmation.",
            ],
          ].map(([Icon, title, copy], i) => {
            const Symbol = Icon as typeof Camera;
            return (
              <article key={i}>
                <span className="step-icon">
                  <Symbol />
                </span>
                <div>
                  <small>STEP {i + 1}</small>
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section id="portfolio" className="market-section">
        <div className="market-heading">
          <h2>Inside the studios</h2>
          <Link href="/studios">
            Find your space <ArrowRight />
          </Link>
        </div>
        <div className="market-portfolio">
          {(settings.portfolio || []).map((x: any, i: number) => (
            <figure key={i}>
              {x.type === "video" ? (
                <video controls preload="none" poster={x.poster}>
                  <source src={x.url} />
                  <track kind="captions" src={x.captions} label="English" />
                </video>
              ) : (
                <Image
                  src={x.url}
                  alt={x.alt}
                  fill
                  sizes="(max-width:600px) 100vw, 50vw"
                />
              )}
              <figcaption>{x.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      {reviews.length ? (
        <section className="market-section">
          <div className="market-heading">
            <h2>From our creators</h2>
          </div>
          <div className="market-reviews">
            {reviews.map((r) => (
              <blockquote key={r.id}>
                <p>“{r.text}”</p>
                <cite>
                  {r.name} · {r.rating}/5
                </cite>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}
      <section id="faq" className="market-section market-faq">
        <div className="market-heading">
          <h2>Frequently asked questions</h2>
          <Link href="/contact">
            Need help? <ArrowRight />
          </Link>
        </div>
        <div className="faqs">
          {(settings.faq || []).map((f: any) => (
            <details key={f.question}>
              <summary>
                {f.question}
                <span>+</span>
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <div className="market-support">
        <Link href="/contact">
          <Headphones />
          <span>STUDIO SUPPORT</span>
        </Link>
        <Link href="/dashboard">
          <TicketCheck />
          <span>YOUR BOOKINGS</span>
        </Link>
        <Link href="/policies/cancellation">
          <ShieldCheck />
          <span>BOOKING POLICIES</span>
        </Link>
      </div>
    </main>
  );
}
