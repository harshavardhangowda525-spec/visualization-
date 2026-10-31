import { serverApi, Studio } from "@/lib/api";
import { Booking } from "@/components/booking";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const s = await serverApi<Studio>("/studios/" + slug);
    return {
      title: s.name,
      description: s.description,
      alternates: { canonical: "/studios/" + s.slug },
    };
  } catch {
    return { title: "Studio" };
  }
}
export default async function StudioDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let studio: Studio;
  try {
    studio = await serverApi("/studios/" + slug);
  } catch {
    return (
      <main id="main" className="section">
        <h1>Studio unavailable</h1>
        <p>
          We couldn’t load this space. Please try again or explore another
          studio.
        </p>
        <a href="/studios">Back to studios</a>
      </main>
    );
  }
  return (
    <main id="main">
      <Booking studio={studio} />
    </main>
  );
}
