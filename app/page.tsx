import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/dal";

export default async function RootPage() {
  const session = await getSessionOrNull();
  redirect(session ? "/dashboard" : "/login");
}
