import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowDown,
  Check,
  MapPin,
  Users,
  MoveRight,
} from "lucide-react";
import { serverApi, money, Studio, Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
    <main id="main">
      <section className="hero">
        <Image
          src="/images/studio-hero.webp"
          alt="Warm cyclorama studio with cinema lighting and professional equipment"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <h1>
            CREATE.
            <br />
            CAPTURE.
            <br />
            <em>EXPERIENCE.</em>
          </h1>
          <p>
            Discover professional spaces for photography,
            <br className="desktop" /> filmmaking, podcasts, and creative
            productions.
          </p>
          <div className="hero-buttons">
            <Button asChild>
              <Link href="/studios">
                Explore studios <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studios">Book your session</Link>
            </Button>
          </div>
        </div>
        <div className="hero-bottom">
          <span>YOUR VISION. OUR SPACE.</span>
          <a href="#spaces">
            Discover the possibilities <ArrowDown />
          </a>
          <span>PHOTOGRAPHY / FILM / SOUND</span>
        </div>
      </section>
      <div className="intro-strip">
        <span>
          For the ideas that deserve
          <br />
          <strong>a little more space.</strong>
        </span>
        <p>
          Thoughtfully designed spaces. Professional equipment.
          <br />
          Everything you need to bring your next story to life.
        </p>
        <Link href="/studios">
          Find your space <ArrowUpRight />
        </Link>
      </div>
      <section id="spaces" className="section">
        <div className="section-heading">
          <div>
            <span className="section-index">01 / THE SPACES</span>
            <h2>
              A setting for <em>every story.</em>
            </h2>
          </div>
          <Link href="/studios" className="text-link">
            Explore all spaces <ArrowUpRight />
          </Link>
        </div>
        {error ? (
          <p role="status" className="notice">
            {error}
          </p>
        ) : (
          <div className="category-grid">
            {categories.map((c, i) => (
              <article className="category" key={c.id}>
                <Link href={"/studios?category=" + c.id}>
                  <div className="category-photo">
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="(max-width: 700px) 100vw, 33vw"
                    />
                    <span className="photo-count">0{i + 1}</span>
                    <span className="round-arrow">
                      <ArrowUpRight />
                    </span>
                  </div>
                </Link>
                <div className="category-title">
                  <h3>{c.name}</h3>
                  <span>
                    {c.startingPaise ? (
                      <>
                        From {money(c.startingPaise)} <small>/ hr</small>
                      </>
                    ) : (
                      "Enquire for pricing"
                    )}
                  </span>
                </div>
                <p>{c.description}</p>
                <div className="card-links">
                  <Link href={"/studios?category=" + c.id}>View details</Link>
                  <Link href={"/studios?category=" + c.id}>
                    Book now <MoveRight />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="section featured">
        <div className="section-heading">
          <div>
            <span className="section-index">02 / FIND YOUR FAVOURITE</span>
            <h2>
              Made for <em>your next idea.</em>
            </h2>
          </div>
          <p>
            From the first frame to the final take.
            <br />
            Find the room that feels right.
          </p>
        </div>
        <div className="studio-grid">
          {studios.slice(0, 3).map((s) => (
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
                  <h3>{s.name}</h3>
                  <ArrowUpRight />
                </div>
              </Link>
              <p>
                <MapPin />
                {s.location} <span>·</span> <Users />
                {s.capacity} people
              </p>
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
              <Link className="text-link" href={"/studios/" + s.slug}>
                Check availability <MoveRight />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="section process">
        <div className="section-heading">
          <div>
            <span className="section-index">
              03 / LESS PLANNING. MORE CREATING.
            </span>
            <h2>
              From idea to <em>action.</em>
            </h2>
          </div>
        </div>
        <div className="steps">
          {[
            ["Choose your studio", "Find a space that fits your vision."],
            ["Make time for it", "Select your date, time and session length."],
            ["Make it official", "Complete your secure online payment."],
            ["Bring it to life", "Get your confirmation. Arrive and create."],
          ].map(([h, p], i) => (
            <article key={h}>
              <span>0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="memberships" className="membership-section">
        <div className="membership-intro">
          <span className="section-index">04 / YOUR CREATIVE HOME</span>
          <h2>
            More creating.
            <br />
            <em>More possibilities.</em>
          </h2>
          <p>
            For the creators who keep coming back.
            <br />
            Make our space part of your process.
          </p>
          <span className="membership-signature">
            STILL / HOUSE
            <br />
            CREATOR MEMBERSHIPS
          </span>
        </div>
        <div className="plans">
          {plans.map((p) => (
            <article key={p.id}>
              <div className="plan-top">
                <h3>{p.name}</h3>
                <span>{p.days} days</span>
              </div>
              <p>{p.description}</p>
              <h4>
                {money(p.pricePaise)}
                <small> / plan</small>
              </h4>
              <ul>
                {p.benefits.map((b) => (
                  <li key={b}>
                    <Check />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="fine-print">
                Up to {p.maxBookings} eligible bookings. Benefits valid during
                the plan term.
              </p>
              <Button asChild>
                <Link href={"/memberships?plan=" + p.id}>
                  Explore membership <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>
      <section id="portfolio" className="section">
        <div className="section-heading">
          <div>
            <span className="section-index">05 / INSIDE THE HOUSE</span>
            <h2>
              A space to <em>see differently.</em>
            </h2>
          </div>
          <p>
            A closer look at the spaces.
            <br />
            Your next story starts here.
          </p>
        </div>
        <div className="portfolio-grid">
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
                  sizes="(max-width:700px) 100vw, 50vw"
                />
              )}
              <figcaption>{x.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      {reviews.length > 0 ? (
        <section className="section reviews">
          <span className="section-index">FROM OUR CREATORS</span>
          <h2>
            Stories from <em>the house.</em>
          </h2>
          {reviews.map((r) => (
            <blockquote key={r.id}>
              <p>“{r.text}”</p>
              <cite>
                {r.name} · {r.rating}/5
              </cite>
            </blockquote>
          ))}
        </section>
      ) : null}
      <section id="faq" className="section faq-section">
        <div>
          <span className="section-index">06 / A FEW GOOD QUESTIONS</span>
          <h2>
            Before you
            <br />
            <em>make yourself at home.</em>
          </h2>
          <Link href="/contact" className="text-link">
            Still have a question? <ArrowUpRight />
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
      <section className="closing">
        <h2>
          Your next great idea
          <br />
          deserves <em>a great space.</em>
        </h2>
        <Button asChild>
          <Link href="/studios">
            Let’s make it happen <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
