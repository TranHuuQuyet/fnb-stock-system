import { AUTH_COOKIE_NAME, extractJwtFromCookie } from './auth-cookie';

describe('auth cookie helpers', () => {
  it('extracts the auth cookie token from a valid cookie header', () => {
    expect(
      extractJwtFromCookie({
        headers: {
          cookie: `other=value; ${AUTH_COOKIE_NAME}=token-123`
        }
      } as never)
    ).toBe('token-123');
  });

  it('ignores malformed cookie values instead of throwing', () => {
    expect(() =>
      extractJwtFromCookie({
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=%E0%A4%A`
        }
      } as never)
    ).not.toThrow();

    expect(
      extractJwtFromCookie({
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=%E0%A4%A`
        }
      } as never)
    ).toBeNull();
  });
});
