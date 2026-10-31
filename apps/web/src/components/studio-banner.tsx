"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
export function StudioBanner() {
  const [active, setActive] = useState(0);
  const slides = [
    {
      title: "CREATE. CAPTURE. EXPERIENCE.",
      lines: ["CREATE.", "CAPTURE.", "EXPERIENCE."],
      text: "Discover professional spaces for photography, filmmaking, podcasts, and creative productions.",
      image: "/images/studio-hero.webp",
      alt: "Cinematic photography studio with professional lighting",
      cta: "Explore studios",
      href: "/studios",
    },
    {
      title: "YOUR VOICE. YOUR SPACE.",
      lines: ["YOUR VOICE.", "YOUR SPACE."],
      text: "A dedicated space for your next conversation. Explore our podcast studios and equipment.",
      image: "/images/podcast.webp",
      alt: "Podcast recording space with microphones",
      cta: "Find a podcast studio",
      href: "/studios?search=podcast",
    },
    {
      title: "MAKE SPACE FOR MORE.",
      lines: ["MAKE SPACE", "FOR MORE."],
      text: "Keep your next project moving with creator memberships and eligible booking benefits.",
      image: "/images/studio-hero.webp",
      alt: "Creative studio space",
      cta: "Explore memberships",
      href: "/memberships",
    },
  ];
  return (
    <section
      className="banner-section"
      aria-roledescription="carousel"
      aria-label="Studio highlights"
    >
      <div className="studio-banner">
        {slides.map((s, i) => (
          <div
            className="banner-slide"
            key={s.title}
            hidden={i !== active}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
          >
            <Image
              src={s.image}
              alt={s.alt}
              fill
              priority={i === 0}
              sizes="100vw"
            />
            <div className="banner-shade" />
            <div className="banner-copy">
              {i === 0 ? (
                <h1 aria-label={s.title}>
                  {s.lines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </h1>
              ) : (
                <h2>
                  {s.lines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </h2>
              )}
              <p>{s.text}</p>
              <Link className="button button-gold" href={s.href}>
                {s.cta}
                <ArrowRight />
              </Link>
            </div>
          </div>
        ))}
        <button
          className="banner-arrow prev"
          aria-label="Previous highlight"
          onClick={() => setActive((active + 2) % 3)}
        >
          <ChevronLeft />
        </button>
        <button
          className="banner-arrow next"
          aria-label="Next highlight"
          onClick={() => setActive((active + 1) % 3)}
        >
          <ChevronRight />
        </button>
        <div className="banner-dots">
          {slides.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Show highlight ${i + 1}`}
              aria-current={active === i ? "true" : undefined}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
