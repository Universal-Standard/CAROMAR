# Security Policy

## Overview

CAROMAR takes security seriously. This document outlines our security practices, how to report vulnerabilities, and best practices for users.

## Supported Versions

Currently, we support the latest version of CAROMAR with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Security Features

### 1. Input Validation & Sanitization

CAROMAR implements comprehensive input validation:

- **GitHub Username Validation**: Enforces GitHub's username rules (alphanumeric + hyphens, 1-39 characters)
- **Repository Name Validation**: Validates repository names (alphanumeric + special chars, 1-100 characters)
- **Token Format Validation**: Ensures tokens meet GitHub's format requirements
- **XSS Prevention**: All user input is sanitized to remove dangerous characters
- **String Length Limits**: Prevents buffer overflow and DoS attacks

### 2. Rate Limiting

- **Application-Level (IP)**: 100 requests per 15 minutes per IP address (`express-rate-limit`, applied to all `/api/*` routes)
- **Per-Token Limiting**: 60 requests per minute per identifier — a SHA-256 hash of the caller's bearer/body token when present, otherwise their IP (`utils/security.js`'s `RateLimiter`, applied via the `tokenAwareRateLimit` middleware in `server.js` to every API route)
- **Automatic Cleanup**: Old rate limit entries are automatically cleaned up
- **Configurable Limits**: Rate limits can be adjusted based on deployment needs

### 3. Security Headers

CAROMAR uses Helmet.js to set secure HTTP headers:

- **Content Security Policy (CSP)**: Restricts resource loading to trusted sources
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Strict-Transport-Security**: Enforces HTTPS connections

### 4. CORS Configuration

- CORS origin is evaluated per-request via `utils/security.js`'s `isAllowedOrigin`
- Configurable allowlist via the `ALLOWED_ORIGINS` environment variable (comma-separated origins, supports trailing-`*` prefix wildcards)
- When `ALLOWED_ORIGINS` is unset, all origins are allowed (backward-compatible default; recommended to set explicitly in production — see [docs/deployment/environment.md](docs/deployment/environment.md#allowed_origins-optional))
- Preflight request handling via the `cors` middleware

### 5. Token Security

- **Client-Side Storage**: Tokens are stored in browser localStorage only
- **No Server Persistence**: Tokens are never stored on the server
- **HTTPS Required**: All token transmission must use HTTPS in production
- **Scope Validation**: Token permissions are validated before operations
- **Hashed, Not Raw, for Rate Limiting**: When a token is used as a rate-limit identifier, only a truncated SHA-256 hash (`simpleHash`) is retained in memory — never the raw token

### 6. Protection Against Common Vulnerabilities

#### XSS (Cross-Site Scripting)
- Input sanitization removes `<` and `>` characters
- Suspicious pattern detection for javascript:, data: protocols (`containsSuspiciousPatterns`)
- Event handler detection and blocking

#### CSRF (Cross-Site Request Forgery)
- Origin header validation via the CORS allowlist described above
- Same-origin policy enforcement

#### Prototype Pollution
- `sanitizeObject` (from `utils/security.js`) runs on every parsed JSON/urlencoded request body, before any route handler executes, removing dangerous keys (`__proto__`, `constructor`, `prototype`) recursively

#### SQL Injection
- Not applicable (no database, uses GitHub API only)

#### Unexpected Request Bodies
- `isAllowedContentType` enforces `Content-Type: application/json` on all state-changing `POST` endpoints (`/api/fork-repo`, `/api/create-merged-repo`, `/api/analyze-repos`, `/api/compare-repos`)

### 7. Merge-Instruction Safety

- Repository descriptors supplied to `POST /api/create-merged-repo` are validated by `isValidMergeRepository` (`utils/validation.js`), which requires a valid name, an `owner/repo` `full_name` that matches it, and a `clone_url` that is a bare, credential-free `https://github.com/<owner>/<repo>.git` URL — preventing injection of arbitrary hosts, embedded credentials, or shell-unsafe values into the generated manual merge commands.

### 8. GitHub API Security

- User-Agent headers for API identification
- Rate limit monitoring and display
- Error message sanitization
- Proper error handling for API failures

## Security Best Practices for Users

### GitHub Token Management

1. **Create Tokens with Minimal Permissions**
   - Only grant `repo` and `user` scopes
   - Use fine-grained tokens when available
   - Set appropriate expiration dates

2. **Token Storage**
   - Never commit tokens to version control
   - Use environment variables for server-side operations
   - Regenerate tokens periodically (e.g., every 90 days)
   - Immediately revoke compromised tokens

3. **Token Security**
   ```bash
   # Good: Use environment variable
   export GITHUB_TOKEN=ghp_your_token_here
   
   # Bad: Hardcoding in code
   const token = 'ghp_your_token_here'; // Don't do this!
   ```

### Deployment Security

1. **HTTPS Enforcement**
   ```nginx
   # Nginx example
   server {
       listen 443 ssl;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       # ... other configurations
   }
   ```
   Netlify deployments get HTTPS automatically; this only applies to self-hosted deployments.

2. **Environment Variables**
   ```bash
   # .env file (never commit this!)
   PORT=3000
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-production-domain.netlify.app
   ```

3. **Secure Headers**
   - Helmet.js is already configured
   - Consider additional CSP rules for your domain
   - Enable HSTS with `includeSubDomains`

4. **Monitoring**
   ```javascript
   // Use /api/health and /api/metrics endpoints
   // Set up alerts for high error rates
   // Monitor rate limit usage
   ```

### Safe Repository Operations

1. **Before Forking**
   - Review repository before forking
   - Check for sensitive data in history
   - Understand repository license

2. **Before Merging**
   - Review all repositories to be merged
   - Check for conflicting licenses
   - Ensure no sensitive data in any repository

3. **Access Control**
   - Use private repositories for sensitive code
   - Set appropriate repository permissions
   - Regularly audit repository access

## Reporting a Vulnerability

If you discover a security vulnerability in CAROMAR, please report it responsibly:

### How to Report

1. **DO NOT** open a public GitHub issue
2. Email security concerns to the repository maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Based on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days
- **Disclosure**: Coordinated disclosure after fix is deployed

### Severity Levels

- **Critical**: Remote code execution, token exposure
- **High**: Authentication bypass, privilege escalation
- **Medium**: XSS, CSRF, information disclosure
- **Low**: Minor information leakage, configuration issues

## Security Audit History

### v1.2.0 (2026-09-11) — Security Module Wiring

- **Finding**: `utils/security.js` (rate limiting, prototype-pollution
  guard, CORS validation, content-type validation) had existed since
  v1.1.0 with full unit test coverage, but was never imported by
  `server.js` — the protections described in this document were not
  actually enforced at runtime.
- **Fix**: `server.js` now imports and applies every export of
  `utils/security.js`. See [CHANGELOG.md](CHANGELOG.md) for the full
  list of changes.
- **Additional hygiene**: removed stray `desktop.ini` artifacts, a
  misplaced unrelated planning document, and an overprivileged,
  irrelevant CI workflow that had accumulated in the repository.

### v1.0.0 (December 2024)

- **Type**: Comprehensive code review and security audit
- **Findings**: 0 critical, 0 high, 0 medium, 0 low
- **Tools Used**:
  - CodeQL static analysis
  - npm audit
  - ESLint security rules
  - Manual code review
  - Penetration testing

### Security Features Added

1. **Security Module** (`utils/security.js`) — now wired into `server.js` as of v1.2.0
   - Suspicious pattern detection
   - URL validation
   - Rate limiting
   - Object sanitization
   - Content-Type validation

2. **Performance Monitor** (`utils/performance.js`)
   - Request tracking
   - Error rate monitoring
   - Health status evaluation

3. **Comprehensive Test Suite**
   - Tests covering security scenarios (`tests/security.test.js`,
     `tests/token-security.test.js`)
   - Input validation edge cases
   - Rate limiting tests
   - Sanitization tests

## Security Checklist for Contributors

Before submitting a pull request:

- [ ] No hardcoded secrets or tokens
- [ ] All user input is validated and sanitized
- [ ] New dependencies are audited (`npm audit`)
- [ ] Tests cover security scenarios
- [ ] JSDoc documentation includes security notes
- [ ] Error messages don't leak sensitive information
- [ ] Rate limiting is respected
- [ ] HTTPS is used for external requests
- [ ] If you add a security control, verify it is actually invoked
      somewhere in `server.js` (or another live code path) — not just
      exported and unit-tested. `npm run validate` and `.github/workflows/ci.yml`
      run tests and lint on every PR, but neither can detect an unused
      export.

## Third-Party Dependencies

CAROMAR uses the following security-focused dependencies:

- **helmet**: ^8.1.0 - Secure HTTP headers
- **express-rate-limit**: ^8.1.1 - Rate limiting
- **cors**: ^2.8.5 - CORS configuration
- **dotenv**: ^16.3.1 - Environment variable management

### Dependency Updates

- Dependencies are regularly updated
- Security patches are applied immediately
- Breaking changes are carefully evaluated
- `npm audit` is run on every change (also automated in `.github/workflows/ci.yml`)

## Compliance

### Data Privacy

- **No Data Storage**: CAROMAR doesn't store user data
- **GitHub API Only**: All operations use official GitHub API
- **No Analytics**: No user tracking or analytics
- **No Cookies**: Application doesn't use cookies

### GDPR Compliance

- No personal data collected or stored
- No data processing agreements needed
- No data retention policies needed
- Users have full control over their data

## Security Resources

### For Developers

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [GitHub Token Security](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure)

### For Users

- [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Security Features](https://docs.github.com/en/code-security)

## License

This security policy is part of the CAROMAR project and follows the same MIT license.

## Questions?

For security questions or concerns, please open an issue on GitHub (for non-sensitive matters) or contact the maintainers directly (for security vulnerabilities).

---

**Last Updated**: 2026-09-11
**Version**: 1.2.0
