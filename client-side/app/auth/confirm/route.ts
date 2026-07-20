import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getServerAuthorizedRoles } from "../../../features/auth/configured-super-admin";
import { destinationForRoles } from "../../../features/auth/role-destination";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error && data.user) {
      try {
        const roles = await getServerAuthorizedRoles(data.user);
        return NextResponse.redirect(
          new URL(destinationForRoles(roles), request.url),
        );
      } catch {
        return NextResponse.redirect(
          new URL(
            "/auth?error=Role%20authorization%20failed.%20Apply%20the%20latest%20database%20migration.",
            request.url,
          ),
        );
      }
    }
  }

  return NextResponse.redirect(
    new URL("/auth?error=Unable%20to%20confirm%20this%20email.", request.url),
  );
}
