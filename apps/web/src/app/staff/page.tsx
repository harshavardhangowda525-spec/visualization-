import { Workspace } from "@/components/workspace";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main id="main">
      <Workspace mode="staff" />
    </main>
  );
}
