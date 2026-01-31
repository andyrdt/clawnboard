import { DashboardNav } from "@/components/dashboard/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
