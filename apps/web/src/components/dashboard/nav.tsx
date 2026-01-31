"use client";

import Link from "next/link";
import { Bot, Settings, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardNav() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <Bot className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">ClawnBoard</span>
        </Link>

        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost">Moltbots</Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              OpenClaw Docs
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}
