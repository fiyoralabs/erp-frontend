"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, UserCircle, Settings, ChevronDown } from "lucide-react";

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

interface TopbarProps {
  userName: string;
  userEmail: string;
  companyLabel: string;
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

export function Topbar({ userName, userEmail, companyLabel }: TopbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

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
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <span className="text-sm text-muted-foreground truncate">{companyLabel}</span>

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
            <DropdownMenuItem
              render={
                <a href="/settings">
                  <Settings className="size-4" />
                  Settings
                </a>
              }
            />
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
