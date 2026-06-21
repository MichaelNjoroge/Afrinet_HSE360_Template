/**
 * Convert any thrown error from a server function, fetch, Supabase, or RPC
 * into a short, user-readable sentence. The goal is to never show "Failed
 * to fetch" or a raw Postgres code to a non-technical user.
 *
 * Pass the raw error to `humanizeError(err)` and show the returned string
 * in a toast / inline alert.
 */
export function humanizeError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  // Offline / network failure (browser fetch throws TypeError "Failed to fetch")
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your internet connection and try again.";
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (() => {
            try { return JSON.stringify(err); } catch { return String(err); }
          })();

  const lower = raw.toLowerCase();

  // Network
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (lower.includes("aborted") || lower.includes("timeout")) {
    return "The request took too long and was cancelled. Please try again.";
  }

  // Auth
  if (lower.includes("unauthorized") || lower.includes("not authenticated") || lower.includes("jwt expired") || lower.includes("no authorization header")) {
    return "Your session has expired. Please sign in again to continue.";
  }
  if (lower.includes("forbidden") || lower.includes("requires level") || lower.includes("not allowed") || lower.includes("permission denied")) {
    return "You do not have permission to perform this action. Contact your administrator if you need access.";
  }

  // Row level security
  if (lower.includes("row-level security") || lower.includes("violates row-level")) {
    return "You are not allowed to read or change this record. Contact your administrator.";
  }

  // Duplicate / unique constraint
  if (lower.includes("duplicate key") || lower.includes("already exists") || lower.includes("unique constraint")) {
    if (lower.includes("email")) return "An account with this email already exists.";
    return "A record with these details already exists. Please use different values.";
  }

  // Foreign key / missing reference
  if (lower.includes("foreign key") || lower.includes("violates foreign key")) {
    return "This record refers to something that no longer exists. Please refresh and try again.";
  }

  // Not null
  if (lower.includes("null value in column")) {
    const m = raw.match(/column "([^"]+)"/);
    return m ? `The field "${m[1].replace(/_/g, " ")}" is required.` : "A required field is missing.";
  }

  // Validation
  if (lower.includes("validation") || lower.includes("invalid input") || lower.includes("check constraint")) {
    return `Some details look incorrect: ${raw}`;
  }

  // Not found
  if (lower.includes("not found") || lower.includes("no rows")) {
    return "That record could not be found. It may have been deleted.";
  }

  // Email specific
  if (lower.includes("missing_unsubscribe")) {
    return "Email could not be sent because it is missing required unsubscribe information. Contact your administrator.";
  }
  if (lower.includes("suppressed") || lower.includes("bounced")) {
    return "Email could not be delivered to this address (previous bounce or unsubscribe). Use a different address.";
  }
  if (lower.includes("domain not verified") || lower.includes("unverified domain")) {
    return "The sending email domain is not verified yet. Ask your administrator to verify it in Email settings.";
  }
  if (lower.includes("lovable_api_key") || lower.includes("email_queue_service_role_key")) {
    return "Email service is not configured. Contact your administrator.";
  }

  // Domain-specific business rules
  if (lower.includes("administrators cannot remove their own")) {
    return "Administrators cannot remove their own administrator role. Ask another administrator to do this.";
  }
  if (lower.includes("at least one administrator")) {
    return "At least one administrator must remain — promote another user to admin first.";
  }

  // Strip Postgres prefixes
  let cleaned = raw
    .replace(/^Error:\s*/i, "")
    .replace(/^pgrst.*?:\s*/i, "")
    .replace(/^postgres error:?\s*/i, "")
    .replace(/^\[?\d{2,5}\]?\s*/i, "")
    .trim();

  // Keep it short
  if (cleaned.length > 220) cleaned = cleaned.slice(0, 217) + "...";
  return cleaned || fallback;
}
