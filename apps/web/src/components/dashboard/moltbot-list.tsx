"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Play, Square, ExternalLink, Trash2, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Moltbot, MoltbotStatus } from "@clawnboard/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function MoltbotList() {
  const [moltbots, setMoltbots] = useState<Moltbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMoltbots = async () => {
    try {
      const res = await fetch(`${API_URL}/api/moltbots`);
      const data = await res.json();
      if (data.success) {
        setMoltbots(data.data);
      } else {
        setError(data.error?.message || "Failed to fetch moltbots");
      }
    } catch (err) {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoltbots();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchMoltbots, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchMoltbots();
  };

  if (loading && moltbots.length === 0) {
    return <MoltbotListSkeleton />;
  }

  if (error) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Bot className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold text-destructive">Error</h3>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (moltbots.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No moltbots yet</h3>
          <p className="mt-2 text-muted-foreground">
            Create your first moltbot to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {moltbots.map((moltbot) => (
        <MoltbotCard key={moltbot.id} moltbot={moltbot} onUpdate={fetchMoltbots} />
      ))}
    </div>
  );
}

export function MoltbotListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-48 rounded-lg border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}

function MoltbotCard({ moltbot, onUpdate }: { moltbot: Moltbot; onUpdate: () => void }) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  const statusConfig: Record<MoltbotStatus, { variant: "success" | "secondary" | "warning" | "destructive"; label: string; isLoading?: boolean }> = {
    created: { variant: "secondary", label: "Created" },
    starting: { variant: "warning", label: "Starting...", isLoading: true },
    started: { variant: "success", label: "Running" },
    stopping: { variant: "warning", label: "Stopping...", isLoading: true },
    stopped: { variant: "secondary", label: "Stopped" },
    destroying: { variant: "warning", label: "Deleting...", isLoading: true },
    destroyed: { variant: "secondary", label: "Deleted" },
    error: { variant: "destructive", label: "Error" },
  };

  // Check server health when machine is running
  useEffect(() => {
    if (moltbot.status !== "started") {
      setServerReady(null);
      return;
    }

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        await fetch(`https://${moltbot.hostname}`, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setServerReady(true);
      } catch {
        setServerReady(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s on list
    return () => clearInterval(interval);
  }, [moltbot.status, moltbot.hostname]);

  const status = statusConfig[moltbot.status];
  const isRunning = moltbot.status === "started";
  const isBooting = isRunning && serverReady === false;
  const isReady = isRunning && serverReady === true;

  // Get display status
  const getDisplayStatus = () => {
    if (isBooting) {
      return { variant: "warning" as const, label: "Booting...", isLoading: true };
    }
    if (isReady) {
      return { variant: "success" as const, label: "Ready", isLoading: false };
    }
    if (isRunning && serverReady === null) {
      return { variant: "warning" as const, label: "Checking...", isLoading: true };
    }
    return status;
  };
  const displayStatus = getDisplayStatus();

  const handleCardClick = () => {
    router.push(`/dashboard/moltbots/${moltbot.name}`);
  };

  const handleAction = async (e: React.MouseEvent, action: "start" | "stop") => {
    e.stopPropagation(); // Don't navigate when clicking action buttons
    setActionLoading(action);
    try {
      const endpoint = `${API_URL}/api/moltbots/${moltbot.name}/${action}`;
      await fetch(endpoint, { method: "POST" });
      onUpdate();
    } catch (err) {
      console.error(`Failed to ${action} moltbot:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isReady ? 'bg-green-500/10' : isBooting ? 'bg-yellow-500/10' : 'bg-muted'}`}>
              {displayStatus.isLoading ? (
                <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
              ) : (
                <Bot className={`h-5 w-5 ${isReady ? 'text-green-500' : 'text-muted-foreground'}`} />
              )}
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {moltbot.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {moltbot.region} · {moltbot.size}
              </CardDescription>
            </div>
          </div>
          <Badge variant={displayStatus.variant} className="flex items-center gap-1">
            {displayStatus.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {displayStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground truncate font-mono">
          {moltbot.hostname}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-3">
        <div className="flex space-x-2">
          {moltbot.status === "stopped" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleAction(e, "start")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "start" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              Start Server
            </Button>
          )}
          {isRunning && !isBooting && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleAction(e, "stop")}
              disabled={actionLoading !== null}
            >
              {actionLoading === "stop" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-1 h-4 w-4" />
              )}
              Stop Server
            </Button>
          )}
          {(moltbot.status === "created" || moltbot.status === "starting" || status.isLoading || isBooting) && (
            <Button size="sm" variant="secondary" disabled>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              {isBooting ? "Booting..." : "Starting..."}
            </Button>
          )}
        </div>
        <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
          <span className="text-sm mr-1">Manage</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  );
}
