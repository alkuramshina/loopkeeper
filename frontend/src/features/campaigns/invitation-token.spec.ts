import { describe, expect, it } from 'vitest';
import { invitationToken } from './invitation-token';

describe('invitationToken', () => {
  it('accepts a token or a copied invitation link', () => {
    expect(invitationToken(' abc_123-DEF ')).toBe('abc_123-DEF');
    expect(
      invitationToken('https://loopkeeper.example/invitations/abc_123-DEF'),
    ).toBe('abc_123-DEF');
    expect(invitationToken('/invitations/abc_123-DEF')).toBe('abc_123-DEF');
    expect(invitationToken('abc-123.signature_456')).toBe(
      'abc-123.signature_456',
    );
  });

  it('rejects unrelated links and extra path segments', () => {
    expect(invitationToken('https://example.com/campaigns/123')).toBeNull();
    expect(
      invitationToken('https://example.com/invitations/abc/more'),
    ).toBeNull();
    expect(invitationToken('')).toBeNull();
  });
});
