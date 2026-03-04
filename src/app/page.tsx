import { Dashboard } from "@/components/dashboard";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <Dashboard />;
}
