"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "../auth/authorization";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import type { StoreManagerAccessRequest } from "./contracts";
import {
  managerInviteRedirect,
  normalizeManagerEmail,
} from "./invitation";

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function superAdminError(message: string): never {
  redirect(`/super-admin?error=${encodeURIComponent(message)}`);
}

function superAdminMessage(message: string): never {
  revalidatePath("/super-admin");
  redirect(`/super-admin?message=${encodeURIComponent(message)}`);
}

function invitationRedirect(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return managerInviteRedirect(siteUrl);
}

export async function addStoreManager(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const displayName = formText(formData, "displayName");
  let email: string;

  try {
    email = normalizeManagerEmail(formText(formData, "email"));
  } catch (error) {
    superAdminError(
      error instanceof Error ? error.message : "Enter a valid college email.",
    );
  }

  const { data, error } = await supabase.rpc("request_store_manager_access", {
    target_email: email,
    target_display_name: displayName || null,
  });

  if (error) superAdminError(error.message);
  const request = data as StoreManagerAccessRequest;

  if (request.requires_auth_invite) {
    const admin = createSupabaseAdminClient();
    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: displayName ? { display_name: displayName } : undefined,
        redirectTo: invitationRedirect(),
      });

    if (inviteError) {
      console.error("[super-admin] Store-manager invitation failed.", {
        code: inviteError.code,
      });
      await supabase.rpc("mark_store_manager_invitation_failed", {
        target_email: email,
        failure_code: inviteError.code ?? "provider_error",
      });
      superAdminError(
        "The manager invitation could not be sent. You can retry it from the pending list.",
      );
    }
  }

  superAdminMessage(
    request.state === "active"
      ? "Store manager access assigned."
      : "Store manager invitation created.",
  );
}

export async function resendStoreManagerInvitation(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  let email: string;
  try {
    email = normalizeManagerEmail(formText(formData, "email"));
  } catch (error) {
    superAdminError(
      error instanceof Error ? error.message : "Enter a valid college email.",
    );
  }

  const { data: requestData, error: requestError } = await supabase.rpc(
    "request_store_manager_access",
    {
      target_email: email,
      target_display_name: null,
    },
  );
  if (requestError) superAdminError(requestError.message);
  const request = requestData as StoreManagerAccessRequest;
  const admin = createSupabaseAdminClient();
  const { error } = request.requires_auth_invite
    ? await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: invitationRedirect(),
      })
    : await admin.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: invitationRedirect() },
      });

  if (error) {
    console.error("[super-admin] Store-manager invitation resend failed.", {
      code: error.code,
    });
    await supabase.rpc("mark_store_manager_invitation_failed", {
      target_email: email,
      failure_code: error.code ?? "provider_error",
    });
    superAdminError("The invitation could not be resent.");
  }

  const { error: auditError } = await supabase.rpc(
    "mark_store_manager_invitation_resent",
    { target_email: email },
  );
  if (auditError) superAdminError(auditError.message);
  superAdminMessage("Store manager invitation resent.");
}

export async function cancelStoreManagerInvitation(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("cancel_store_manager_invitation", {
    target_email: formText(formData, "email"),
  });
  if (error) superAdminError(error.message);
  superAdminMessage("Store manager invitation cancelled.");
}

export async function removeStoreManager(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("remove_store_manager_access", {
    target_user_id: formText(formData, "userId"),
  });
  if (error) superAdminError(error.message);
  superAdminMessage("Store manager access removed.");
}
