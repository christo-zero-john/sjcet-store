const SENTINEL_ORIGIN = "http://local.invalid";

const CONTROL_CHARACTERS = new RegExp("[\u0000-\u001f\u007f]", "u");

/**
 * Accepts only relative `/pay/` application destinations. Rejects cross-origin
 * URLs, protocol-relative paths, backslashes, and control characters so an
 * authenticated return destination can never become an open redirect.
 */
export function safeAuthReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/pay/") || value.startsWith("//")) {
    return null;
  }

  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, SENTINEL_ORIGIN);
  } catch {
    return null;
  }

  return parsed.origin === SENTINEL_ORIGIN &&
    parsed.pathname.startsWith("/pay/")
    ? `${parsed.pathname}${parsed.search}`
    : null;
}
