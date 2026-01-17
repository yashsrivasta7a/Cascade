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
  // Only hide sidebar on individual workflow editor pages (e.g., /workflows/123)
  const isWorkflowEditor = pathname.match(/^\/workflows\/[^/]+$/);

  return (
    <div className="flex h-screen overflow-hidden bg-[#909192] dark:bg-[#09090b]">
      {!isWorkflowEditor && <Sidebar />}
      <main className={cn("flex-1 overflow-hidden", isWorkflowEditor && "w-full")}>
        {children}
      </main>
    </div>
  );
}

