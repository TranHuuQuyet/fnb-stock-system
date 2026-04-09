import { describe, expect, it } from 'vitest';

import { shouldForcePasswordChange } from './auth';

describe('auth session helpers', () => {
  it('detects first login flow', () => {
    expect(
      shouldForcePasswordChange({
        accessToken: 'token',
        mustChangePassword: true,
        user: {
          id: '1',
          username: 'staff2',
          fullName: 'Staff 2',
          role: 'STAFF',
          status: 'MUST_CHANGE_PASSWORD'
        }
      })
    ).toBe(true);
  });
});
