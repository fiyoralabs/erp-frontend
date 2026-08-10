"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Building2, MapPin, User, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CrmTopbarProps {
  userName?: string;
  userEmail?: string;
  companyLabel?: string;
  locationContext?: {
    activeLocation: { id: number; name: string } | null;
    allowedLocations: { id: number; name: string }[];
  };
}

export function CrmTopbar({
  userName = "User",
  userEmail = "user@fiyora.com",
  companyLabel = "Company #1",
  locationContext,
}: CrmTopbarProps) {
  const activeLocName = locationContext?.activeLocation?.name ?? "All Locations";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 shrink-0 gap-4">
      {/* Left side info */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 font-bold text-sm lg:hidden shrink-0">
          <span className="p-1 rounded bg-primary text-primary-foreground text-xs">CRM</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          <Building2 className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
          <span className="truncate hidden sm:inline">{companyLabel}</span>
          <span className="hidden sm:inline">·</span>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium text-foreground">{activeLocName}</span>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Open in New Tab Launcher Button */}
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs hidden sm:inline-flex"
          render={<a href="/crm" target="_blank" rel="noreferrer" />}
          title="Open CRM Workspace in a new window/tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>New Window</span>
        </Button>

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-xs" />
            }
          >
            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium hidden md:inline-block max-w-[120px] truncate">
              {userName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/settings/profile" className="cursor-pointer text-xs flex items-center gap-2" />}
            >
              <User className="h-3.5 w-3.5" /> Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              render={<a href="/api/auth/logout" className="text-xs flex items-center gap-2" />}
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
