import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, Users } from "lucide-react";
import { Studio, money } from "@/lib/api";
export function StudioCard({
  studio: s,
  category,
}: {
  studio: Studio;
  category?: string;
}) {
  return (
    <article className="market-studio-card">
      <Link href={`/studios/${s.slug}`} className="market-poster">
        <Image
          src={s.images[0]?.url || "/images/studio-hero.webp"}
          alt={s.images[0]?.alt || s.name}
          fill
          sizes="(max-width:600px) 78vw, (max-width:900px) 45vw, 30vw"
        />
        <span className="poster-caption">
          <span>{category || s.services[0]?.name || "Studio"}</span>
          <ArrowUpRight />
        </span>
      </Link>
      <div className="market-card-copy">
        <Link href={`/studios/${s.slug}`}>
          <h3>{s.name}</h3>
        </Link>
        <p className="card-location">
          <MapPin />
          {s.location}
        </p>
        <p className="card-facilities">
          {s.facilities
            .slice(0, 2)
            .map((f) => f.name)
            .join(" · ")}
        </p>
        <div className="market-card-bottom">
          <strong>
            {s.services[0] ? money(s.services[0].hourlyPaise) : "Enquire"}
            <small> / hour</small>
          </strong>
          <span>
            <Users />
            {s.capacity}
          </span>
        </div>
        <Link className="market-book-link" href={`/studios/${s.slug}`}>
          Check availability <ArrowUpRight />
        </Link>
      </div>
    </article>
  );
}
