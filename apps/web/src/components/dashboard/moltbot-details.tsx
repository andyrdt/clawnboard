"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Trash2,
  Download,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Bot,
  Camera,
  ChevronDown,
  Wrench,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import type { Moltbot, MoltbotStatus, VolumeSnapshot } from "@clawnboard/shared";
import { VM_SPECS } from "@clawnboard/shared";
import { SnapshotList } from "./snapshot-list";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface MoltbotDetailsProps {
  moltbotId: string;
}

const statusConfig: Record<MoltbotStatus, { variant: "success" | "secondary" | "warning" | "destructive"; label: string }> = {
  created: { variant: "warning", label: "Starting..." },
  starting: { variant: "warning", label: "Starting..." },
  started: { variant: "success", label: "Running" },
  stopping: { variant: "warning", label: "Stopping..." },
  stopped: { variant: "secondary", label: "Stopped" },
  destroying: { variant: "warning", label: "Deleting..." },
  destroyed: { variant: "secondary", label: "Deleted" },
  error: { variant: "destructive", label: "Error" },
};

export function MoltbotDetails({ moltbotId }: MoltbotDetailsProps) {
  const router = useRouter();
  const [moltbot, setMoltbot] = useState<Moltbot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<VolumeSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);

  const checkServerHealth = async (hostname: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(`https://${hostname}`, {
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

  useEffect(() => {
    const fetchMoltbot = async () => {
      try {
        const res = await fetch(`${API_URL}/api/moltbots/${moltbotId}`);
        const data = await res.json();
        if (data.success) {
          setMoltbot(data.data);
          if (data.data.status === 'started') {
            checkServerHealth(data.data.hostname);
          } else {
            setServerReady(null);
          }
        } else {
          setError(data.error?.message || "Failed to fetch moltbot");
        }
      } catch {
        setError("Failed to connect to API");
      } finally {
        setLoading(false);
      }
    };
    fetchMoltbot();
    const interval = setInterval(fetchMoltbot, 5000);
    return () => clearInterval(interval);
  }, [moltbotId]);

  // Fetch snapshots
  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const res = await fetch(`${API_URL}/api/moltbots/${moltbotId}/snapshots`);
        const data = await res.json();
        if (data.success) {
          setSnapshots(data.data);
        }
      } catch {
        // Silently fail - snapshots are not critical
      } finally {
        setLoadingSnapshots(false);
      }
    };
    fetchSnapshots();
  }, [moltbotId]);

  const handleAction = async (action: "start" | "stop" | "restart" | "destroy" | "update") => {
    setActionLoading(action);
    try {
      const endpoint = action === "destroy"
        ? `${API_URL}/api/moltbots/${moltbotId}`
        : `${API_URL}/api/moltbots/${moltbotId}/${action}`;
      const method = action === "destroy" ? "DELETE" : "POST";
      const res = await fetch(endpoint, { method });
      const data = await res.json();
      if (data.success) {
        if (action === "destroy") {
          router.push("/dashboard");
        } else {
          const refreshRes = await fetch(`${API_URL}/api/moltbots/${moltbotId}`);
          const refreshData = await refreshRes.json();
          if (refreshData.success) {
            setMoltbot(refreshData.data);
          }
          if (action === "update") {
            setJustUpdated(true);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} moltbot:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await fetch(`${API_URL}/api/moltbots/${moltbotId}/snapshots`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        const previousCount = snapshots.length;
        // Poll until we get a new snapshot with valid data (2 min max)
        for (let i = 0; i < 60; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const listRes = await fetch(`${API_URL}/api/moltbots/${moltbotId}/snapshots`);
          const listData = await listRes.json();
          if (listData.success && listData.data.length > previousCount) {
            const newest = listData.data[0];
            // Check if data looks valid (year > 2000 and size > 0)
            const year = new Date(newest.createdAt).getFullYear();
            if (year > 2000 && newest.sizeGb > 0) {
              setSnapshots(listData.data);
              break;
            }
          }
          // After max retries, just use whatever we have
          if (i === 59) {
            setSnapshots(listData.data);
          }
        }
      }
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    const res = await fetch(`${API_URL}/api/moltbots/${moltbotId}/snapshots/${snapshotId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="animate-pulse h-32 bg-muted rounded-lg" />
          <div className="animate-pulse h-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !moltbot) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold text-destructive">Error</h3>
          <p className="mt-2 text-muted-foreground">{error || "Moltbot not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[moltbot.status];
  const isRunning = moltbot.status === "started";
  const isStopped = moltbot.status === "stopped";
  const isStartingUp = moltbot.status === "created" || moltbot.status === "starting";
  const isBooting = isRunning && serverReady === false;
  const isReady = isRunning && serverReady === true;
  const controlUrl = moltbot.gatewayToken
    ? `https://${moltbot.hostname}?token=${encodeURIComponent(moltbot.gatewayToken)}`
    : `https://${moltbot.hostname}`;
  const sshCommand = `fly ssh console -a moltbot-${moltbot.name}`;

  const getDisplayStatus = () => {
    if (isStartingUp) return { label: "Starting...", variant: "warning" as const, loading: true };
    if (isBooting) return { label: "Booting...", variant: "warning" as const, loading: true };
    if (isReady) return { label: "Ready", variant: "success" as const, loading: false };
    if (isRunning && serverReady === null) return { label: "Checking...", variant: "warning" as const, loading: true };
    return { label: status.label, variant: status.variant, loading: false };
  };
  const displayStatus = getDisplayStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${isReady ? 'bg-green-500/10' : displayStatus.loading ? 'bg-yellow-500/10' : 'bg-muted'}`}>
            {displayStatus.loading ? (
              <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
            ) : (
              <Bot className={`h-8 w-8 ${isReady ? 'text-green-500' : 'text-muted-foreground'}`} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{moltbot.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{moltbot.hostname}</p>
          </div>
        </div>
        <Badge variant={displayStatus.variant} className="text-sm px-3 py-1 flex items-center gap-2">
          {displayStatus.loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {displayStatus.label}
        </Badge>
      </div>

      {/* Startup notice */}
      {(isStartingUp || isBooting) && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Server is starting up...</p>
            <p className="text-sm text-muted-foreground mt-1">
              First boot can take 1-2 minutes while OpenClaw initializes.
            </p>
          </div>
        </div>
      )}

      {/* Main Action: OpenClaw Dashboard */}
      <Card className={`${isReady ? 'border-primary bg-primary/5' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-semibold mb-1">OpenClaw Dashboard</h2>
              <p className="text-muted-foreground text-sm">
                Configure AI model, personality, Discord/Slack integrations, and chat with your moltbot
              </p>
            </div>
            <a href={controlUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <Button size="lg" disabled={!isReady} className="min-w-[180px]">
                {displayStatus.loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-5 w-5" />
                )}
                {displayStatus.loading ? "Starting..." : "Open Dashboard"}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* SSH Access - Terminal Style */}
      <div className="bg-zinc-950 rounded-lg px-4 py-3">
        <div className="flex items-center gap-4">
          <Terminal className="h-5 w-5 text-zinc-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200">SSH Access</p>
            <p className="text-xs text-zinc-500 truncate">For advanced configuration via command line</p>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 font-mono text-sm">
            <code className="text-green-400 hidden sm:block">{sshCommand}</code>
            <code className="text-green-400 sm:hidden">fly ssh console...</code>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-zinc-800" onClick={() => copyToClipboard(sshCommand)}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Secondary sections in grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Server Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Server Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isStartingUp ? (
              <Button className="w-full" size="sm" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </Button>
            ) : isStopped ? (
              <Button className="w-full" size="sm" onClick={() => handleAction("start")} disabled={actionLoading !== null}>
                <Play className="mr-2 h-4 w-4" />
                {actionLoading === "start" ? "Starting..." : "Start Server"}
              </Button>
            ) : isRunning ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleAction("restart")} disabled={actionLoading !== null}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${actionLoading === "restart" ? "animate-spin" : ""}`} />
                  Restart
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleAction("stop")} disabled={actionLoading !== null}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" disabled>
                {status.label}
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => handleAction("update")} disabled={actionLoading !== null || !isRunning}>
              <Download className={`mr-2 h-4 w-4 ${actionLoading === "update" ? "animate-bounce" : ""}`} />
              {actionLoading === "update" ? "Updating..." : "Update OpenClaw"}
            </Button>
            {justUpdated && (
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex gap-2 text-sm">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-muted-foreground">
                    <p className="font-medium text-foreground">Update complete!</p>
                    <p className="mt-1">If you experience issues, try running <code className="bg-muted px-1 rounded">openclaw doctor</code> via SSH.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Region</span>
              <span className="font-medium">{moltbot.region}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{VM_SPECS[moltbot.size]?.description || moltbot.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(moltbot.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Snapshots */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Snapshots
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot || !isRunning}
            >
              {creatingSnapshot ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Save Snapshot
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Save the current state for backup or cloning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SnapshotList snapshots={snapshots} loading={loadingSnapshots} creating={creatingSnapshot} onDelete={handleDeleteSnapshot} />
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <button
          className="w-full px-6 py-4 flex items-center justify-between text-left"
          onClick={() => setTroubleshootingOpen(!troubleshootingOpen)}
        >
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="text-base font-semibold">Troubleshooting</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${troubleshootingOpen ? "rotate-180" : ""}`} />
        </button>
        {troubleshootingOpen && (
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">After updating OpenClaw</h4>
              <p className="text-sm text-muted-foreground">
                If your moltbot isn&apos;t working correctly after an update, SSH in and run the doctor command:
              </p>
              <div className="bg-zinc-950 rounded-lg px-3 py-2 font-mono text-sm space-y-1">
                <div><code className="text-green-400">openclaw doctor</code></div>
                <div className="text-zinc-500 text-xs"># Interactive - walks you through each fix</div>
                <div className="mt-2"><code className="text-green-400">openclaw doctor --non-interactive --yes</code></div>
                <div className="text-zinc-500 text-xs"># Auto-fix - applies safe fixes automatically</div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">View logs</h4>
              <p className="text-sm text-muted-foreground">
                Check the moltbot logs from your terminal (not SSH):
              </p>
              <div className="bg-zinc-950 rounded-lg px-3 py-2 font-mono text-sm">
                <code className="text-green-400">fly logs -a moltbot-{moltbot.name}</code>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Hard restart</h4>
              <p className="text-sm text-muted-foreground">
                If the Restart button doesn&apos;t help, try a machine-level restart:
              </p>
              <div className="bg-zinc-950 rounded-lg px-3 py-2 font-mono text-sm">
                <code className="text-green-400">fly machine restart -a moltbot-{moltbot.name}</code>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Delete Moltbot</p>
              <p className="text-xs text-muted-foreground">Permanently delete this moltbot and all its data</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={actionLoading !== null}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {moltbot.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the moltbot and all its data including
                    configuration, workspace files, and conversation history.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("destroy")}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {actionLoading === "destroy" ? "Deleting..." : "Delete Forever"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
