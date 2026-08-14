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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white">
          Master Data
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#545f73] dark:text-[#a3cfcf]">
          Foundational reference data used across every other module.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group flex items-center gap-3.5 rounded-2xl border border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] p-5 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:border-[#0F3D3E]/30 dark:hover:border-[#a3cfcf]/40 transition-all duration-200"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0F3D3E]/10 text-[#0F3D3E] dark:bg-[#a3cfcf]/15 dark:text-[#a3cfcf]">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#1a1c1c] dark:text-white group-hover:text-[#0F3D3E] dark:group-hover:text-[#a3cfcf] transition-colors">
                  {section.title}
                </h2>
                <p className="truncate text-xs text-[#545f73] dark:text-[#a3cfcf]">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
