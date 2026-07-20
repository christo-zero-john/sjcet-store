import { isAllowedCollegeEmail } from "../auth/college-email";

export function normalizeManagerEmail(email: string): string {
  const normalized = email.trim().toLocaleLowerCase();
  if (!isAllowedCollegeEmail(normalized)) {
    throw new Error("Use an approved SJCET college email address.");
  }
  return normalized;
}

export function managerInviteRedirect(siteUrl: string): string {
  return new URL("/auth/confirm", siteUrl).toString();
}
