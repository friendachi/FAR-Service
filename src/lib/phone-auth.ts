/*
  Sign-in uses the mobile number only (see startSession in app/actions/auth.ts). Supabase Auth still needs an email or a phone identity, and
  phone identities require an SMS provider, so each account gets an internal email derived from its
  mobile number. Nothing is ever sent to it.
*/
export const PHONE_EMAIL_DOMAIN = "phone.farservice.app";

/** "081-234-5678" → "0812345678", or null when it is not a Thai mobile number. */
export function normalizePhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("66") && d.length === 11) d = `0${d.slice(2)}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

export const phoneToAuthEmail = (phone: string) => `${phone}@${PHONE_EMAIL_DOMAIN}`;

export const formatPhone = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
