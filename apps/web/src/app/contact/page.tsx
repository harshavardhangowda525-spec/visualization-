import { serverApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export default async function Contact() {
  let b: any;
  try {
    b = (await serverApi("/settings")).business;
  } catch {}
  return (
    <main id="main" className="section policy-page">
      <h1>
        Let’s make
        <br />
        <em>something happen.</em>
      </h1>
      <p>{b?.address || "Contact details will be published by the studio."}</p>
      {b?.email ? <a href={"mailto:" + b.email}>{b.email}</a> : null}
      {b?.phone ? (
        <p>
          <a href={"tel:" + b.phone}>{b.phone}</a>
        </p>
      ) : null}
    </main>
  );
}
