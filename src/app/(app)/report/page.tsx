"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

const ReportDashboard = dynamic(
  () => import("@/components/reports/ReportDashboard").then((module) => module.ReportDashboard),
  { loading: () => <Skeleton className="h-[38rem]" />, ssr: false },
);

export default function ReportPage() {
  return <ReportDashboard />;
}

