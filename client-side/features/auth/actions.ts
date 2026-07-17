"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import { hasSupabasePublicConfig } from "../../lib/supabase/config";
import { isAllowedCollegeEmail } from "./college-email";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function authError(message: string): never {
  redirect(`/auth?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");

  if (!email || !password) {
    authError("Enter your email address and password.");
  }

  if (!hasSupabasePublicConfig(process.env)) {
    authError("Supabase is not configured for this environment.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authError("The email address or password is incorrect.");
  }

  redirect("/store-manager");
}

export async function signUp(formData: FormData) {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const displayName = field(formData, "displayName");

  if (!isAllowedCollegeEmail(email)) {
    authError(
      "Use a college email with a subdomain before sjcetpalai.ac.in.",
    );
  }

  if (password.length < 8) {
    authError("Password must contain at least 8 characters.");
  }

  if (!hasSupabasePublicConfig(process.env)) {
    authError("Supabase is not configured for this environment.");
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
    authError(error.message);
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
