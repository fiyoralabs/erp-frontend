import Link from "next/link";
import {
  MapPin,
  FolderTree,
  Tag,
  Ruler,
  Percent,
  ListOrdered,
  CreditCard,
  ClipboardList,
  Users,
  Hash,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  { title: "Locations", href: "/master/locations", icon: MapPin, description: "Stores and warehouses" },
  { title: "Categories", href: "/master/categories", icon: FolderTree, description: "Product categories" },
  { title: "Brands", href: "/master/brands", icon: Tag, description: "Product brands" },
  { title: "Units", href: "/master/units", icon: Ruler, description: "Units of measure" },
  { title: "Taxes", href: "/master/taxes", icon: Percent, description: "Tax rates" },
  { title: "Price Lists", href: "/master/price-lists", icon: ListOrdered, description: "Selling price lists" },
  { title: "Payment Methods", href: "/master/payment-methods", icon: CreditCard, description: "Accepted payment methods" },
  { title: "Reasons", href: "/master/reasons", icon: ClipboardList, description: "Adjustment / return reason codes" },
  { title: "Customer Groups", href: "/master/customer-groups", icon: Users, description: "Customer segments" },
  { title: "Document Sequences", href: "/master/document-sequences", icon: Hash, description: "Document numbering" },
];

export default function MasterDataPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          Foundational reference data used across every other module.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="min-h-24 transition-colors hover:bg-muted/50">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <Icon className="size-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
