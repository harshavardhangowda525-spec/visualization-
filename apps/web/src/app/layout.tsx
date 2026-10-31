import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import { Header } from "@/components/header";
import "./globals.css";
import "./marketplace.css";
const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: "STILL / HOUSE — Spaces for your next great idea",
    template: "%s | STILL / HOUSE",
  },
  description:
    "Discover professional spaces for photography, filmmaking, podcasts, and creative productions.",
  openGraph: {
    title: "STILL / HOUSE",
    description: "Create. Capture. Experience.",
    images: ["/images/studio-hero.webp"],
  },
  robots: {
    index:
      process.env.NODE_ENV === "production" &&
      process.env.DEPLOYMENT_ENV !== "preview",
    follow:
      process.env.NODE_ENV === "production" &&
      process.env.DEPLOYMENT_ENV !== "preview",
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let business: any = {};
  try {
    business = (await serverApi("/settings")).business || {};
  } catch {}
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {process.env.DEPLOYMENT_ENV === "preview" ? (
          <div className="deployment-preview-notice" role="note">
            Preview environment · Sample studios and pricing
          </div>
        ) : null}
        <Header />
        {children}
        <footer className="footer">
          <div>
            <a className="wordmark" href="/">
              {business.name || "STILL / HOUSE"}
            </a>
            <p>Space for extraordinary ideas.</p>
            <small>Developed by Infinity Web &amp; Apps</small>
          </div>
          <div>
            <a href="/studios">Our studios</a>
            <a href="/#memberships">Memberships</a>
            <a href="/dashboard">Your account</a>
          </div>
          <div>
            <a href="/policies/privacy">Privacy policy</a>
            <a href="/policies/terms">Terms &amp; conditions</a>
            <a href="/policies/cancellation">Cancellation &amp; refunds</a>
          </div>
          <div>
            <span>MAKE SOMETHING MEANINGFUL.</span>
            <p>Photography. Film. Sound.</p>
            <a href="/contact">Contact the studio ↗</a>
            {business.email ? (
              <a href={"mailto:" + business.email}>{business.email}</a>
            ) : null}
            {business.phone ? (
              <a href={"tel:" + business.phone}>{business.phone}</a>
            ) : null}
            {(business.socials || [])
              .filter((s: any) => s.url?.startsWith("https://"))
              .map((s: any) => (
                <a key={s.url} href={s.url} rel="noopener noreferrer">
                  {s.name}
                </a>
              ))}
          </div>
        </footer>
      </body>
    </html>
  );
}
