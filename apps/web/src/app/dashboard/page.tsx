import { Workspace } from "@/components/workspace";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function Dashboard() {
  return (
    <main id="main">
      <Workspace mode="customer" />
    </main>
  );
}
