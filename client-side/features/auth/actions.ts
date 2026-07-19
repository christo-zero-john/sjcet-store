"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import { hasSupabasePublicConfig } from "../../lib/supabase/config";
import { isAllowedCollegeEmail } from "./college-email";
import { getServerAuthorizedRoles } from "./configured-super-admin";
import { destinationForRoles } from "./role-destination";
import { safeAuthReturnPath } from "./return-path";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function authError(message: string, next: string | null): never {
  const query = new URLSearchParams({ error: message });
  if (next) {
    query.set("next", next);
  }
  redirect(`/auth?${query.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const next = safeAuthReturnPath(field(formData, "next"));

  if (!email || !password) {
    authError("Enter your email address and password.", next);
  }

  if (!hasSupabasePublicConfig(process.env)) {
    authError("Supabase is not configured for this environment.", next);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    authError("The email address or password is incorrect.", next);
  }

  let roles;
  try {
    roles = await getServerAuthorizedRoles(data.user);
  } catch {
    authError(
      "Role authorization failed. Apply the latest database migration.",
      next,
    );
  }

  redirect(next ?? destinationForRoles(roles));
}

export async function signUp(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const displayName = field(formData, "displayName");

  if (!isAllowedCollegeEmail(email)) {
    authError(
      "Use a college email with a subdomain before sjcetpalai.ac.in.",
      null,
    );
  }

  if (password.length < 8) {
    authError("Password must contain at least 8 characters.", null);
  }

  if (!hasSupabasePublicConfig(process.env)) {
    authError("Supabase is not configured for this environment.", null);
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: { display_name: displayName },
    },
  });

  if (error) {
    authError(error.message, null);
  }

  redirect(
    "/auth?message=" +
      encodeURIComponent("Check your college email to confirm your account."),
  );
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth");
}
