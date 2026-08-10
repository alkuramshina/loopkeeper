# Backlog: Authentication Improvements

1. Implement refresh-token flow (rotation)
	- Short-lived access token + rotating refresh tokens stored as hashed values.
	- Endpoint: `POST /auth/refresh`, rotate token, invalidate old.

2. Add rate-limiting / throttling
	- Apply to `/auth/login` and `/auth/refresh` using `@nestjs/throttler` or middleware.

3. Implement token revocation (jti / blacklist)
	- Add `jti` claim to JWTs, store revoked IDs in Redis for quick checks.

4. Support RS256 key rotation (kid)
	- Switch to asymmetric signing for production, support key rotation and `kid` header.

5. Enable Helmet and secure CORS
	- Configure `helmet()` and strict CORS in `main.ts`.

6. Add auth audit logging
	- Log login attempts (success/failure), IP, user-agent, timestamp.

7. Add metrics and monitoring
	- Counters for login attempts, failed attempts, refresh usages, revocations.

8. Write e2e tests for auth flows
	- Tests for login, protected routes, refresh, logout, rate-limits.

9. Document auth flow and endpoints
	- README or Swagger: describe access/refresh tokens, cookie usage, headers.

10. Add bootstrap with admin user creation

11. An endpoint for Change password

Notes:
- Current state: `argon2` is used for hashing; `LocalAuthGuard` validates `LoginDto`.
- No user data exists yet; no fallback for bcrypt required.

Next step suggestions (pick one):
- Implement refresh-token flow (secure, highest impact).
- Add throttling to `/auth/login` (quick win).
