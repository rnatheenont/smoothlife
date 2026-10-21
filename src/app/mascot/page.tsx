import MascotShowcase from "./MascotShowcase";

export const metadata = {
  title: "น้อง Smoothie | Smoothlife.com",
  // A showcase for the team, not a page for search.
  robots: { index: false, follow: false },
};

export default function MascotPage() {
  return <MascotShowcase />;
}
