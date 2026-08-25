"use client";

// TEMPORARY design harness — delete after review.
import { Sidebar } from "@/components/layout";

export default function DesignPreviewPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1" />
    </div>
  );
}
