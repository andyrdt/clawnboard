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
import type { Moltbot, MoltbotStatus } from "@clawnboard/shared";
import { VM_SPECS } from "@clawnboard/shared";

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
  const controlUrl = `https://${moltbot.hostname}?token=clawnboard`;
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
