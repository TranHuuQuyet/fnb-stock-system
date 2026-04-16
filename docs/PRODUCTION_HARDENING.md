# Production Hardening Notes

This repository now includes the following production-focused changes:

- Login sets an `HttpOnly` cookie and no longer returns `accessToken` in the response body.
- JWT payloads include `sessionVersion`, and server-side session revocation is enforced in `JwtStrategy`.
- `logout`, password change, password reset, user lock/unlock, and security-sensitive user updates rotate `sessionVersion`.
- Production Docker healthcheck now uses `/api/v1/health/ready` so database readiness is part of container health.
- Staging env file placeholders were restored to remove committed secrets from tracked files.
- Backup and restore PowerShell helpers were added under `deploy/scripts/`.

Before go-live:

1. Rotate any staging or production secrets that were ever committed or shared insecurely.
2. Run `npx prisma migrate deploy` so the new `sessionVersion` column exists in production.
3. Verify login, logout, forced password change, user lock/unlock, and password reset flows on staging.
4. Test one backup and one restore using the new scripts before opening production traffic.
