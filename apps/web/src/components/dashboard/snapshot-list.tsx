"use client";

import { Camera, HardDrive, Clock } from "lucide-react";
import type { VolumeSnapshot } from "@clawnboard/shared";

interface SnapshotListProps {
  snapshots: VolumeSnapshot[];
  loading?: boolean;
}

export function SnapshotList({ snapshots, loading }: SnapshotListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Camera className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No snapshots yet</p>
        <p className="text-xs">Create a snapshot to save this moltbot's state</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {snapshots.map((snapshot) => (
        <div
          key={snapshot.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
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
          <code className="text-xs text-muted-foreground font-mono">
            {snapshot.id.slice(0, 8)}...
          </code>
        </div>
      ))}
    </div>
  );
}
