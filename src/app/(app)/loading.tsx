import { Skeleton } from "@/components/ui";

export default function AppLoading() {
  return <main className="space-y-5" aria-busy="true" aria-label="Loading page"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-32" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div></main>;
}

