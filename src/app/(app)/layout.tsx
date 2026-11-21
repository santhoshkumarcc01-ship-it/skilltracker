import { AppShell } from "@/components/layout/AppShell";
import { AppAuthGuard } from "@/components/providers/AppAuthGuard";

export default function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppAuthGuard><AppShell>{children}</AppShell></AppAuthGuard>;
}

