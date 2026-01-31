import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoltbotDetails } from "@/components/dashboard/moltbot-details";

interface MoltbotPageProps {
  params: Promise<{ id: string }>;
}

export default async function MoltbotPage({ params }: MoltbotPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          All Moltbots
        </Button>
      </Link>

      <Suspense fallback={<MoltbotDetailsSkeleton />}>
        <MoltbotDetails moltbotId={id} />
      </Suspense>
    </div>
  );
}

function MoltbotDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse h-16 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 animate-pulse h-96 bg-muted rounded-lg" />
        <div className="animate-pulse h-96 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
