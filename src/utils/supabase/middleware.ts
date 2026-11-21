import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

/** Refreshes Supabase Auth cookies when a Supabase session exists. HabitHop's own auth is separate. */
export async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const hasSupabaseSession = request.cookies
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));

  if (!hasSupabaseSession) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase Auth cookies exist, but Supabase public environment variables are missing.",
    );
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser validates with Supabase Auth and triggers refresh when the session is expiring.
  await supabase.auth.getUser();
  return response;
}
