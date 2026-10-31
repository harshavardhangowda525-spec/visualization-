import { serverApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export default async function Policy({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let policy: any;
  try {
    const settings = await serverApi("/settings");
    policy = settings.policies?.[slug];
  } catch {}
  return (
    <main id="main" className="section policy-page">
      <h1>{policy?.title || "Policy pending publication"}</h1>
      <p>
        {policy?.text ||
          "The studio has not published this policy. Contact the business before booking."}
      </p>
    </main>
  );
}
