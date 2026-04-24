const PLACEHOLDER_PATTERN =
  /replace-with|change-me|super-secret-change-me|example\.com|db-host|staging-db-host|your_/i;

export const readBooleanEnv = (value: string | undefined, fallback = false) => {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
};

export const readTrustProxyEnv = (
  value: string | undefined,
  fallback: boolean | number | string = 1
) => {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return value.trim();
};

const assertStrongSecret = (name: string, value: string | undefined) => {
  if (!value || value.trim().length < 32) {
    throw new Error(`${name} must be at least 32 characters in protected environments`);
  }

  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} is still using a placeholder value`);
  }
};

export const validateRuntimeSecurityConfig = () => {
  const protectedRuntime =
    process.env.NODE_ENV === 'production' ||
    readBooleanEnv(process.env.REQUIRE_STRONG_SECRETS, false);

  if (!protectedRuntime) {
    return;
  }

  assertStrongSecret('JWT_SECRET', process.env.JWT_SECRET);
  assertStrongSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must not be identical');
  }

  if (!process.env.TRUST_PROXY?.trim()) {
    throw new Error('TRUST_PROXY is required in protected environments');
  }

  if (process.env.CORS_ORIGIN?.includes('localhost')) {
    throw new Error('CORS_ORIGIN must not point to localhost in protected environments');
  }
};
