"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/frontend/components/ui";

const ReportDashboard = dynamic(
  () => import("@/frontend/components/reports/ReportDashboard").then((module) => module.ReportDashboard),
  { loading: () => <Skeleton className="h-[38rem]" />, ssr: false },
);

export default function ReportPage() {
  return <ReportDashboard />;
}

