export function invitationToken(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  let token = input;
  if (input.includes('/') || input.includes('?') || input.includes('#')) {
    try {
      const url = new URL(input, window.location.origin);
      const match = /^\/invitations\/([^/]+)\/?$/.exec(url.pathname);
      if (!match || url.search || url.hash) return null;
      token = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9_.-]+$/.test(token) ? token : null;
}
