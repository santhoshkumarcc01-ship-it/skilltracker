"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ChunkyButton, Input, PasswordInput } from "@/frontend/components/ui";
import { initializeSound, playSound } from "@/frontend/lib/sound";
import { apiRequest, getCurrentUser, refreshSession } from "@/frontend/lib/api-client";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "@/shared/validators/auth";

type AuthFormProps = { mode: "login" | "signup" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [serverError, setServerError] = useState("");
  const [shake, setShake] = useState(0);
  const signupMode = mode === "signup";
  const [restoreChecked, setRestoreChecked] = useState(signupMode);
  const signupForm = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: "onBlur" });
  const loginForm = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onBlur" });

  useEffect(() => {
    if (signupMode) return;
    let active = true;
    void refreshSession().then((user) => {
      if (active) router.replace(user.profile?.onboarded ? "/dashboard" : "/onboarding");
    }).catch(() => { /* No refresh session is expected for a signed-out visitor. */ }).finally(() => {
      if (active) setRestoreChecked(true);
    });
    return () => { active = false; };
  }, [router, signupMode]);

  async function submit(values: SignupInput | LoginInput) {
    setServerError("");
    initializeSound();
    try {
      if (signupMode) {
        await apiRequest("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(values) });
        playSound("success");
        try {
          const user = await getCurrentUser();
          router.replace(user.profile?.onboarded ? "/dashboard" : "/onboarding");
        } catch {
          router.replace("/login?signup=pending");
        }
      } else {
        await apiRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify(values) });
        playSound("success");
        router.replace("/dashboard");
      }
    } catch (error) {
      playSound("error");
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setShake((value) => value + 1);
    }
  }

  return <m.div animate={shake && !reduceMotion ? { x: [0, -9, 8, -6, 5, 0] } : { x: 0 }} transition={{ duration: 0.32 }}>
    {signupMode ? <form className="space-y-4" noValidate onSubmit={signupForm.handleSubmit((values) => submit(values))}>
      <Field label="Display name" id="displayName" error={signupForm.formState.errors.displayName?.message}><Input id="displayName" autoComplete="name" aria-invalid={Boolean(signupForm.formState.errors.displayName)} aria-describedby={signupForm.formState.errors.displayName ? "displayName-error" : undefined} {...signupForm.register("displayName")} /></Field>
      <Field label="Email" id="signup-email" error={signupForm.formState.errors.email?.message}><Input id="signup-email" type="email" autoComplete="email" aria-invalid={Boolean(signupForm.formState.errors.email)} aria-describedby={signupForm.formState.errors.email ? "signup-email-error" : undefined} {...signupForm.register("email")} /></Field>
      <Field label="Password" id="signup-password" error={signupForm.formState.errors.password?.message}><PasswordInput id="signup-password" autoComplete="new-password" aria-invalid={Boolean(signupForm.formState.errors.password)} aria-describedby={signupForm.formState.errors.password ? "signup-password-error" : "signup-password-hint"} {...signupForm.register("password")} /><span id="signup-password-hint" className="text-xs text-ink/80">Use 10–128 characters. Mix character types for a stronger password.</span></Field>
      <Field label="Confirm password" id="confirmPassword" error={signupForm.formState.errors.confirmPassword?.message}><Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(signupForm.formState.errors.confirmPassword)} aria-describedby={signupForm.formState.errors.confirmPassword ? "confirmPassword-error" : undefined} {...signupForm.register("confirmPassword")} /></Field>
      {serverError && <p className="rounded-xl bg-coral/10 p-3 font-semibold" role="alert">{serverError}</p>}
      <ChunkyButton className="w-full" type="submit" disabled={signupForm.formState.isSubmitting}>{signupForm.formState.isSubmitting ? "Making your account…" : "Create account"}</ChunkyButton>
      <p className="text-center text-sm text-ink/80">Already hopping with us? <Link className="font-bold text-[var(--palette-076285)] underline" href="/login">Sign in</Link></p>
    </form> : <form className="space-y-4" noValidate onSubmit={loginForm.handleSubmit((values) => submit(values))}>
      <Field label="Email" id="login-email" error={loginForm.formState.errors.email?.message}><Input id="login-email" type="email" autoComplete="email" aria-invalid={Boolean(loginForm.formState.errors.email)} aria-describedby={loginForm.formState.errors.email ? "login-email-error" : undefined} {...loginForm.register("email")} /></Field>
      <Field label="Password" id="login-password" error={loginForm.formState.errors.password?.message}><PasswordInput id="login-password" autoComplete="current-password" aria-invalid={Boolean(loginForm.formState.errors.password)} aria-describedby={loginForm.formState.errors.password ? "login-password-error" : "login-password-hint"} {...loginForm.register("password")} /><span id="login-password-hint" className="text-xs text-ink/80">Enter your account password.</span></Field>
      {serverError && <p className="rounded-xl bg-coral/10 p-3 font-semibold" role="alert">{serverError}</p>}
      <ChunkyButton className="w-full" type="submit" disabled={loginForm.formState.isSubmitting || !restoreChecked}>{!restoreChecked ? "Checking session…" : loginForm.formState.isSubmitting ? "Signing you in…" : "Sign in"}</ChunkyButton>
      <p className="text-center text-sm text-ink/80">New around here? <Link className="font-bold text-[var(--palette-076285)] underline" href="/signup">Create an account</Link></p>
    </form>}
  </m.div>;
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-2"><label className="font-bold" htmlFor={id}>{label}</label>{children}{error && <span id={errorId} role="alert" className="text-sm font-semibold text-[var(--palette-a12626)]">{error}</span>}</div>;
}


