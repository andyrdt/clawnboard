import { Suspense } from "react";
import { Plus, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoltbotList } from "@/components/dashboard/moltbot-list";
import { CreateMoltbotDialog } from "@/components/dashboard/create-moltbot-dialog";
import { DeployFromSnapshotDialog } from "@/components/dashboard/deploy-from-snapshot-dialog";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Moltbots</h1>
          <p className="text-muted-foreground">
            Manage your AI assistants
          </p>
        </div>
        <div className="flex gap-2">
          <DeployFromSnapshotDialog>
            <Button variant="outline">
              <Camera className="mr-2 h-4 w-4" />
              Deploy from Snapshot
            </Button>
          </DeployFromSnapshotDialog>
          <CreateMoltbotDialog>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Moltbot
            </Button>
          </CreateMoltbotDialog>
        </div>
      </div>

      <Suspense fallback={<MoltbotListSkeleton />}>
        <MoltbotList />
      </Suspense>
    </div>
  );
}

function MoltbotListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-lg border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}
