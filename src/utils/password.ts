// Password obfuscation for the optional edit-mode lock. This is NOT
// real encryption — anyone with access to the source can recover the
// password. It's a deterrent that prevents casual users of the app
// from toggling Edit on a file they were given.
//
// Approach: XOR each character of the password against a fixed
// rotating key, then base64-encode the result. The key has to live in
// the source somewhere; we accept that.

const KEY = 'slinky-robot-deterrent-key-v1';

function xorString(plain: string, key: string): string {
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const code = plain.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    out += String.fromCharCode(code);
  }
  return out;
}

// Convert a plain-text password into the obfuscated cipher stored in
// FileMeta.passwordCipher. Empty input → null (no password set).
export function encodePassword(plain: string): string | null {
  if (!plain) return null;
  const xored = xorString(plain, KEY);
  // btoa needs ASCII; XOR can produce any char, so escape via Latin-1
  // round-trip (encodeURIComponent → unescape → btoa).
  try {
    return btoa(unescape(encodeURIComponent(xored)));
  } catch {
    return null;
  }
}

// Check whether a plain-text input matches the stored cipher.
export function verifyPassword(
  plain: string,
  cipher: string | null,
): boolean {
  if (!cipher) return true; // no lock = always allowed
  const expected = encodePassword(plain);
  return expected === cipher;
}
