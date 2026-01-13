"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideSidebarOnWorkflows = pathname.startsWith("/workflows");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-[#09090b]">
      {!hideSidebarOnWorkflows && <Sidebar />}
      <main className={cn("flex-1 overflow-hidden", hideSidebarOnWorkflows && "w-full")}>
        {children}
      </main>
    </div>
  );
}

