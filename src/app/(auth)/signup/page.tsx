import { Card } from "@/frontend/components/ui";
import { AuthForm } from "@/frontend/components/auth/AuthForm";

export default function SignupPage() {
  return <Card className="w-full max-w-md"><div className="mb-6"><p className="font-heading text-3xl font-bold">🐸 HabitHop</p><h1 className="mt-4 font-heading text-2xl font-bold">Start your hop</h1><p className="mt-1 text-ink/80">Create an account and make your first small win.</p></div><AuthForm mode="signup" /></Card>;
}

