import { NextResponse, type NextRequest } from "next/server";

import { getPaymentRedirectUrl } from "../../../../features/payments/actions";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

/**
 * Validated provider redirect. The browser never submits a provider URL; the
 * server resolves it from the claimed handoff and only redirects to an HTTPS
 * URL for a still-payable order. Any failure returns to the same handoff.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const handoffPath = `/pay/${token}`;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(handoffPath)}`, _request.url),
      { headers: SECURITY_HEADERS },
    );
  }

  const result = await getPaymentRedirectUrl(token);
  if (!result.ok || !/^https:\/\//u.test(result.data.checkoutUrl)) {
    return NextResponse.redirect(new URL(handoffPath, _request.url), {
      headers: SECURITY_HEADERS,
    });
  }

  return NextResponse.redirect(result.data.checkoutUrl, {
    headers: SECURITY_HEADERS,
  });
}
