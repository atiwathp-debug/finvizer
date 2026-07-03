/**
 * The raw token is shown to the Owner exactly once (in the invite link) and
 * never persisted anywhere — only its SHA-256 hash is stored, in both real
 * Supabase mode (invitations.token_hash) and Mock Mode. Accepting an invite
 * re-hashes the token from the URL and compares hashes, so the server (or
 * mock store) never needs to see the raw token again after creation.
 */
export function generateInviteToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
}

export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
