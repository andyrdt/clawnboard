"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VM_SPECS, AI_MODELS, DEFAULT_MODEL } from "@clawnboard/shared";
import type { MoltbotSize, AIModelId, VolumeSnapshot } from "@clawnboard/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface DeployFromSnapshotDialogProps {
  children: React.ReactNode;
}

interface ProviderStatus {
  anthropic: boolean;
  openai: boolean;
  openrouter: boolean;
}

export function DeployFromSnapshotDialog({ children }: DeployFromSnapshotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [size, setSize] = useState<MoltbotSize>("2gb");
  const [model, setModel] = useState<AIModelId>(DEFAULT_MODEL);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus>({ anthropic: false, openai: false, openrouter: false });
  const [snapshots, setSnapshots] = useState<VolumeSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // Fetch snapshots and providers when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch providers
      fetch(`${API_URL}/health/providers`)
        .then((res) => res.json())
        .then((data) => {
          setProviders(data.providers);
          const currentProvider = AI_MODELS[model].provider;
          if (!data.providers[currentProvider]) {
            const availableModel = (Object.entries(AI_MODELS) as [AIModelId, typeof AI_MODELS[AIModelId]][]).find(
              ([, m]) => data.providers[m.provider]
            );
            if (availableModel) {
              setModel(availableModel[0]);
            }
          }
        })
        .catch(() => {
          setProviders({ anthropic: true, openai: true, openrouter: true });
        });

      // Fetch all snapshots
      setLoadingSnapshots(true);
      fetch(`${API_URL}/api/snapshots`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSnapshots(data.data);
          }
        })
        .catch(() => {
          setError("Failed to load snapshots");
        })
        .finally(() => {
          setLoadingSnapshots(false);
        });
    }
  }, [open, model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnapshot) {
      setError("Please select a snapshot");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Find the selected snapshot to get its source app
    const snapshot = snapshots.find((s) => s.id === selectedSnapshot);
    if (!snapshot) {
      setError("Selected snapshot not found");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/snapshots/${selectedSnapshot}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          size,
          model,
          sourceApp: `moltbot-${snapshot.moltbotName}`,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setOpen(false);
        setName("");
        setSize("2gb");
        setModel(DEFAULT_MODEL);
        setSelectedSnapshot("");
        router.refresh();
        window.location.reload();
      } else {
        setError(data.error?.message || "Failed to deploy from snapshot");
      }
    } catch {
      setError("Failed to connect to API");
    } finally {
      setIsLoading(false);
    }
  };

  const isModelAvailable = (modelId: AIModelId) => {
    const provider = AI_MODELS[modelId].provider;
    return providers[provider as keyof ProviderStatus];
  };

  const hasAnyProvider = providers.anthropic || providers.openai || providers.openrouter;

  // Group snapshots by moltbot
  const snapshotsByMoltbot = snapshots.reduce((acc, snapshot) => {
    if (!acc[snapshot.moltbotName]) {
      acc[snapshot.moltbotName] = [];
    }
    acc[snapshot.moltbotName].push(snapshot);
    return acc;
  }, {} as Record<string, VolumeSnapshot[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-primary" />
            <span>Deploy from Snapshot</span>
          </DialogTitle>
          <DialogDescription>
            Create a new moltbot from an existing snapshot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="snapshot">Select Snapshot</Label>
            <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot}>
              <SelectTrigger>
                <SelectValue placeholder={loadingSnapshots ? "Loading..." : "Select a snapshot"} />
              </SelectTrigger>
              <SelectContent>
                {loadingSnapshots ? (
                  <SelectItem value="loading" disabled>Loading snapshots...</SelectItem>
                ) : snapshots.length === 0 ? (
                  <SelectItem value="none" disabled>No snapshots available</SelectItem>
                ) : (
                  Object.entries(snapshotsByMoltbot).map(([moltbotName, moltbotSnapshots]) => (
                    <div key={moltbotName}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {moltbotName}
                      </div>
                      {moltbotSnapshots.map((snapshot) => (
                        <SelectItem key={snapshot.id} value={snapshot.id}>
                          <div className="flex items-center gap-2">
                            <span>{new Date(snapshot.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-muted-foreground">
                              {snapshot.sizeGb}GB
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div>
              <Label htmlFor="name">New Name</Label>
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <Input
              id="name"
              placeholder="e.g., my-clone"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div>
              <Label htmlFor="model">Default Model</Label>
              <p className="text-xs text-muted-foreground">Override the model from the snapshot</p>
            </div>
            <Select value={model} onValueChange={(v) => setModel(v as AIModelId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(AI_MODELS) as [AIModelId, typeof AI_MODELS[AIModelId]][]).map(([key, m]) => {
                  const available = isModelAvailable(key);
                  return (
                    <SelectItem key={key} value={key} disabled={!available}>
                      <div className="flex items-center gap-2">
                        <span className={available ? "font-medium" : "text-muted-foreground"}>
                          {m.label}
                        </span>
                        {!available && (
                          <span className="text-xs text-muted-foreground">
                            (no API key)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="size">Instance Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v as MoltbotSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(VM_SPECS) as [MoltbotSize, typeof VM_SPECS["2gb"]][]).map(([key, spec]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{spec.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {spec.pricePerMonth}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!hasAnyProvider && (
            <p className="text-sm text-destructive">
              No AI provider API keys configured.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name || !selectedSnapshot || isLoading || !hasAnyProvider || loadingSnapshots}
            >
              {isLoading ? "Deploying..." : "Deploy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
