"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle, Settings, ChevronDown, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasAnyPermission, SETTINGS_PERMISSIONS } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { Location } from "@/lib/types/master";

interface TopbarProps {
  userName: string;
  userEmail: string;
  permissions: readonly string[];
  locationContext: { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Topbar({ userName, userEmail, permissions, locationContext }: TopbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [isSwitchingLocation, setIsSwitchingLocation] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleSwitchLocation(locationId: string | null) {
    if (!locationId) return;
    setIsSwitchingLocation(true);
    try {
      await apiClient.post("auth/select-location", { locationId: Number(locationId) });
      const location = locationContext.allowedLocations.find((item) => String(item.id) === locationId);
      toast.success(`Working location changed to ${location?.name ?? "selected location"}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change working location");
    } finally {
      setIsSwitchingLocation(false);
    }
  }

  const locationItems = Object.fromEntries(
    locationContext.allowedLocations.map((location) => [String(location.id), location.name])
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-white dark:bg-[#1a1c1c] px-4 sm:px-6">
      {/* Logo -- below lg: only, where the fixed sidebar's own branding isn't
          visible. Navigation itself now lives in the bottom nav's "More"
          drawer on mobile, so there's no hamburger trigger here anymore. */}
      <Link href="/dashboard" className="relative h-8 w-8 shrink-0 lg:hidden">
        <Image src="/logo-light.png" alt="Fiyora ERP" fill priority className="object-contain" />
      </Link>

      <div className="min-w-0">
        {locationContext.allowedLocations.length === 0 ? (
          <div className="flex h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 text-xs text-amber-800 dark:text-amber-400">
            <MapPin className="size-4" />
            <span className="truncate">No store access assigned</span>
          </div>
        ) : (
          <Select
            items={locationItems}
            value={locationContext.activeLocation ? String(locationContext.activeLocation.id) : ""}
            onValueChange={handleSwitchLocation}
            disabled={isSwitchingLocation}
          >
            <SelectTrigger className="h-9 w-[180px] max-w-[48vw] sm:w-[240px] rounded-xl border-[#c0c8c8] bg-white dark:border-[#717978] dark:bg-[#1a1c1c] text-xs sm:text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {isSwitchingLocation ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <MapPin className="size-4 shrink-0 text-[#545f73] dark:text-[#a3cfcf]" />
                )}
                <SelectValue placeholder="Select working store" className="min-w-0 truncate" />
              </span>
            </SelectTrigger>
            <SelectContent className="min-w-[240px]">
              {locationContext.allowedLocations.map((location) => (
                <SelectItem key={location.id} value={String(location.id)}>
                  <span className="flex flex-col whitespace-normal py-0.5">
                    <span>{location.name}</span>
                    <span className="text-xs text-[#545f73] dark:text-[#a3cfcf]">
                      {location.type} · {location.code}
                      {location.isUserDefault ? " · Default" : ""}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] transition-colors outline-none cursor-pointer"
              />
            }
          >
            <div className="w-8 h-8 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {initials(userName)}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-[#1a1c1c] dark:text-white max-w-[140px] truncate">
              {userName}
            </span>
            <ChevronDown className="size-4 text-[#717978] hidden sm:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-[#e2e2e2] dark:border-[#404848]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                <span className="truncate text-sm font-medium">{userName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {userEmail}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <a href="/settings/profile">
                  <UserCircle className="size-4" />
                  My Profile
                </a>
              }
            />
            {hasAnyPermission(permissions, SETTINGS_PERMISSIONS) && (
              <DropdownMenuItem
                render={
                  <a href="/settings">
                    <Settings className="size-4" />
                    Settings
                  </a>
                }
              />
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
