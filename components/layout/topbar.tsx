"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, UserCircle, Settings, ChevronDown, MapPin, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { hasAnyPermission, SETTINGS_PERMISSIONS } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { Location } from "@/lib/types/master";

interface TopbarProps {
  userName: string;
  userEmail: string;
  companyLabel: string;
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

export function Topbar({ userName, userEmail, companyLabel, permissions, locationContext }: TopbarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const switchLocation = useMutation({
    mutationFn: (locationId: string) => apiClient.post("auth/select-location", { locationId: Number(locationId) }),
    onSuccess: async (_, locationId) => {
      const location = locationContext.allowedLocations.find((item) => String(item.id) === locationId);
      toast.success(`Working location changed to ${location?.name ?? "selected location"}`);
      await queryClient.invalidateQueries();
      router.refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to change working location"),
  });
  const locationItems = Object.fromEntries(locationContext.allowedLocations.map((location) => [String(location.id), location.name]));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
      {/* Mobile nav trigger -- hidden at lg: and above where the fixed sidebar takes over */}
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-11"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-4 font-semibold">
            Fiyora ERP
          </div>
          <SidebarNav permissions={permissions} />
        </SheetContent>
      </Sheet>

      <span className="hidden text-sm text-muted-foreground sm:inline truncate">{companyLabel}</span>

      <div className="min-w-0 sm:ml-2">
        {locationContext.allowedLocations.length === 0 ? <div className="flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs text-amber-800"><MapPin className="size-4"/><span className="truncate">No store access assigned</span></div> : <Select items={locationItems} value={locationContext.activeLocation ? String(locationContext.activeLocation.id) : ""} onValueChange={(value) => value && switchLocation.mutate(value)} disabled={switchLocation.isPending}><SelectTrigger className="h-9 w-[180px] max-w-[48vw] sm:w-[240px]"><span className="flex min-w-0 items-center gap-2">{switchLocation.isPending ? <Loader2 className="size-4 shrink-0 animate-spin"/> : <MapPin className="size-4 shrink-0"/>}<SelectValue placeholder="Select working store"/></span></SelectTrigger><SelectContent>{locationContext.allowedLocations.map((location) => <SelectItem key={location.id} value={String(location.id)}><span className="flex flex-col"><span>{location.name}</span><span className="text-xs text-muted-foreground">{location.type} · {location.code}{location.isUserDefault ? " · Default" : ""}</span></span></SelectItem>)}</SelectContent></Select>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 h-11 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {initials(userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {userName}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            {/* Menu.GroupLabel (what DropdownMenuLabel wraps) throws at
                runtime if it isn't inside a Menu.Group -- "MenuGroupContext
                is missing" -- confirmed live via the dev server log (an
                actual uncaught error, not just a console warning like the
                nativeButton one). It was missing here from the very first
                version of this dropdown. */}
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
