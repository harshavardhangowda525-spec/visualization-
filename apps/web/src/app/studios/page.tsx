import { Suspense } from "react";
import { Discovery } from "@/components/discovery";
export const metadata = {
  title: "Explore our studios",
  description:
    "Find photography, film and podcast spaces. Check live availability and book securely.",
};
export default function Studios() {
  return (
    <main id="main">
      <Suspense fallback={<p className="section">Loading studios…</p>}>
        <Discovery />
      </Suspense>
    </main>
  );
}
