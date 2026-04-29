// PKCE helpers (RFC 7636).
// generateVerifier() returns a 43+ char URL-safe random string.
// challengeFromVerifier(v) returns base64url(sha256(v)).

function base64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) {
    s += String.fromCharCode(arr[i])
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateVerifier(): string {
  const buf = new Uint8Array(48)
  crypto.getRandomValues(buf)
  return base64url(buf.buffer)
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64url(digest)
}
