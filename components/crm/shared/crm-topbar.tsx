"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, User, LogOut } from "lucide-react";
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
  locationContext?: {
    activeLocation: { id: number; name: string } | null;
    allowedLocations: { id: number; name: string }[];
  };
}

export function CrmTopbar({
  userName = "User",
  userEmail = "user@fiyora.com",
  locationContext,
}: CrmTopbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const activeLocName = locationContext?.activeLocation?.name ?? "Main Branch";

  async function handleLogout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-16 w-full border-b border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] flex justify-between items-center px-4 sm:px-6 shrink-0 z-10">
      {/* Left: Logo (below lg: only -- the sidebar already carries the Fiyora
          mark once it's visible) + Breadcrumbs */}
      <div className="flex items-center text-[#545f73] dark:text-[#a3cfcf] text-xs sm:text-sm font-medium gap-1.5 sm:gap-2 min-w-0">
        <Link href="/crm" className="relative h-7 w-7 shrink-0 lg:hidden">
          <Image src="/logo-light.png" alt="Fiyora ERP" fill className="object-contain" />
        </Link>
        <span className="text-[#1a1c1c] dark:text-white font-semibold truncate">
          {activeLocName}
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Open in New Window Button */}
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs rounded-xl border-[#e2e2e2] dark:border-[#404848] text-[#1a1c1c] dark:text-white hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hidden sm:inline-flex"
          render={<a href="/crm" target="_blank" rel="noreferrer" />}
          title="Open CRM Workspace in a new window/tab"
        >
          <ExternalLink className="h-3.5 w-3.5 text-[#545f73]" />
          <span>New Window</span>
        </Button>

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] transition-colors outline-none cursor-pointer"
              />
            }
          >
            <div className="w-8 h-8 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-xs text-[#1a1c1c] dark:text-white hidden md:inline-block max-w-[120px] truncate">
              {userName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-[#e2e2e2] dark:border-[#404848]">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium leading-none text-[#1a1c1c] dark:text-white">{userName}</p>
              <p className="text-xs leading-none text-[#545f73] dark:text-[#a3cfcf] mt-1">{userEmail}</p>
            </div>
            <DropdownMenuSeparator className="bg-[#e2e2e2] dark:bg-[#404848]" />
            <DropdownMenuItem
              render={<Link href="/settings/profile" className="cursor-pointer text-xs flex items-center gap-2" />}
            >
              <User className="h-3.5 w-3.5" /> Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onClick={handleLogout}
              className="text-xs flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
