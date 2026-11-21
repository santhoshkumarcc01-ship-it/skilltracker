export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <main className="aurora-backdrop grain-overlay grid min-h-screen place-items-center bg-canvas p-5">{children}</main>; }

