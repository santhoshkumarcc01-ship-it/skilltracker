import { AppShell } from "@/frontend/components/layout/AppShell";
import { AppAuthGuard } from "@/frontend/components/providers/AppAuthGuard";

export default function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppAuthGuard><AppShell>{children}</AppShell></AppAuthGuard>;
}

