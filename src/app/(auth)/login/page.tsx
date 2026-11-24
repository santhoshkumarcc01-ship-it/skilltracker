import { Card } from "@/frontend/components/ui";
import { AuthForm } from "@/frontend/components/auth/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ signup?: string | string[] }> }) {
  const params = await searchParams;
  return <Card className="w-full max-w-md"><div className="mb-6 text-center"><p className="font-heading text-3xl font-bold">🐸 HabitHop</p><h1 className="mt-4 font-heading text-2xl font-bold">Welcome back</h1><p className="mt-1 text-ink/80">Your next little win is waiting.</p></div>{params.signup === "pending" && <p className="mb-4 rounded-xl bg-sky/10 p-3 text-sm" role="status">If an account can be created for that email, you can sign in here.</p>}<AuthForm mode="login" /></Card>;
}

