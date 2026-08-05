import Link from "next/link";
import { UserCircle, Users, ShieldCheck, KeyRound, Monitor } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentPermissions } from "@/lib/authorization";
import { hasAnyPermission } from "@/lib/permissions";

const sections = [
  {
    title: "My Profile",
    href: "/settings/profile",
    icon: UserCircle,
    description: "Your name, phone, and role",
    implemented: true,
    requiredPermissions: [] as string[],
  },
  {
    title: "Users",
    href: "/settings/users",
    icon: Users,
    description: "Manage employee accounts",
    implemented: true,
    requiredPermissions: ["USER_VIEW"],
  },
  {
    title: "Roles & Permissions",
    href: "/settings/roles",
    icon: ShieldCheck,
    description: "Configure access control",
    implemented: true,
    requiredPermissions: ["ROLE_VIEW"],
  },
  {
    title: "API Keys",
    href: "/settings/api-keys",
    icon: KeyRound,
    description: "Manage integration credentials",
    implemented: true,
    requiredPermissions: ["API_KEY_VIEW"],
  },
  {
    title: "Sessions",
    href: "/settings/sessions",
    icon: Monitor,
    description: "Active logins and devices",
    implemented: true,
    requiredPermissions: ["SESSION_VIEW"],
  },
];

export default async function SettingsPage() {
  const permissions = await getCurrentPermissions();
  const visibleSections = sections.filter((section) =>
    section.requiredPermissions.length === 0 || hasAnyPermission(permissions, section.requiredPermissions));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account, employees, access policies, integrations, and active devices.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const card = (
            <Card
              className={
                section.implemented
                  ? "min-h-24 transition-colors hover:bg-muted/50"
                  : "min-h-24 opacity-60"
              }
            >
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Icon className="size-5 text-muted-foreground" />
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {section.title}
                    {!section.implemented && (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        Soon
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          );

          return section.implemented ? (
            <Link key={section.href} href={section.href}>
              {card}
            </Link>
          ) : (
            <div key={section.href} className="cursor-not-allowed" aria-disabled>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
