import { Workspace } from "@/components/workspace";
export const metadata = {
  title: "Admin workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main id="main">
      <Workspace mode="admin" />
    </main>
  );
}
