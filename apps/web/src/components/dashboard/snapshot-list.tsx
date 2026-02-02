"use client";

import { useState } from "react";
import { Camera, HardDrive, Clock, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VolumeSnapshot } from "@clawnboard/shared";

interface SnapshotListProps {
  snapshots: VolumeSnapshot[];
  loading?: boolean;
  creating?: boolean;
  onDelete?: (snapshotId: string) => Promise<void>;
}

export function SnapshotList({ snapshots, loading, creating, onDelete }: SnapshotListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (snapshotId: string) => {
    if (!onDelete) return;
    setDeletingId(snapshotId);
    try {
      await onDelete(snapshotId);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0 && !creating) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Camera className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No snapshots yet</p>
        <p className="text-xs">Create a snapshot to save this moltbot's state</p>
      </div>
    );
  }

  // Filter out snapshots with missing ids (can happen right after creation)
  const validSnapshots = snapshots.filter((s) => s.id);

  return (
    <div className="space-y-2">
      {creating && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card border-dashed">
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Creating snapshot...</p>
        </div>
      )}
      {validSnapshots.map((snapshot) => (
        <div
          key={snapshot.id}
          className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{snapshot.label}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(snapshot.createdAt).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {snapshot.sizeGb}GB
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-muted-foreground font-mono">
              {snapshot.id.slice(0, 8)}...
            </code>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(snapshot.id)}
                disabled={deletingId === snapshot.id}
              >
                {deletingId === snapshot.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                )}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
