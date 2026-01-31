"use client";

import { useState, useEffect } from "react";
import { Server, Key, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function SettingsPage() {
  const [status, setStatus] = useState<{
    ready: boolean;
    checks: { flyio: boolean };
  } | null>(null);
  const [providers, setProviders] = useState<{
    anthropic: boolean;
    openai: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [healthRes, providersRes] = await Promise.all([
          fetch(`${API_URL}/health/ready`),
          fetch(`${API_URL}/health/providers`),
        ]);
        const healthData = await healthRes.json();
        const providersData = await providersRes.json();
        setStatus(healthData);
        setProviders(providersData.providers);
      } catch {
        setStatus({ ready: false, checks: { flyio: false } });
        setProviders({ anthropic: false, openai: false });
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          View your Fly.io connection status
        </p>
      </div>

      <div className="grid gap-6">
        {/* Fly.io Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Fly.io Connection</span>
            </CardTitle>
            <CardDescription>
              Status of your connection to Fly.io for deploying moltbots
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Checking connection...</span>
              </div>
            ) : status?.checks.flyio ? (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Connected to Fly.io</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span>Not connected to Fly.io</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Make sure you have configured <code className="bg-muted px-1 rounded">apps/api/.env</code> with your Fly.io token.
                </p>
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">To change your Fly.io configuration:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Edit <code className="bg-muted px-1 rounded">apps/api/.env</code></li>
                <li>Restart the dev server (<code className="bg-muted px-1 rounded">pnpm dev</code>)</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>API Keys</span>
            </CardTitle>
            <CardDescription>
              AI provider keys configured in your .env file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Checking...</span>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className={providers?.anthropic ? "" : "text-muted-foreground"}>
                    ANTHROPIC_API_KEY
                  </span>
                  <span className="text-muted-foreground mx-2 flex-1 border-b border-dotted border-muted-foreground/30" />
                  {providers?.anthropic ? (
                    <span className="text-green-600">configured</span>
                  ) : (
                    <span className="text-muted-foreground">not set</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className={providers?.openai ? "" : "text-muted-foreground"}>
                    OPENAI_API_KEY
                  </span>
                  <span className="text-muted-foreground mx-2 flex-1 border-b border-dotted border-muted-foreground/30" />
                  {providers?.openai ? (
                    <span className="text-green-600">configured</span>
                  ) : (
                    <span className="text-muted-foreground">not set</span>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Add keys to <code className="bg-muted px-1 rounded">apps/api/.env</code> and restart the dev server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
