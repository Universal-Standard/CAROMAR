# CAROMAR Environment Configuration Guide

Complete guide for configuring CAROMAR in different environments.

## Table of Contents
- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Netlify Deployment](#netlify-deployment)
- [Production Configuration](#production-configuration)
- [Security Best Practices](#security-best-practices)

---

## Overview

CAROMAR is designed to work with **minimal configuration**. The application functions perfectly without any environment variables - users provide their GitHub tokens directly through the UI.

However, for advanced features and production optimization, you can configure the following environment variables.

---

## Environment Variables

### Core Application

#### `PORT` (Optional)
- **Default:** `3000`
- **Description:** Port number for local server
- **Example:** `PORT=3001`
- **When to use:** Local development when port 3000 is occupied
- **Note:** Ignored on Netlify, which manages its own port for serverless functions.

#### `NODE_ENV` (Optional)
- **Default:** `development`
- **Values:** `development` | `production` | `test`
- **Description:** Application environment mode. In `development`, unhandled-error responses include the underlying error message; in any other value they return a generic message.
- **Example:** `NODE_ENV=production`
- **When to use:** Automatically set by Netlify, but can override locally

#### `ALLOWED_ORIGINS` (Optional)
- **Default:** Unset (all origins allowed — matches CAROMAR's historical behavior)
- **Description:** Comma-separated allowlist of origins permitted to call the API cross-origin. Actually enforced by `server.js`'s CORS configuration via `utils/security.js`'s `isAllowedOrigin`.
- **Example:** `ALLOWED_ORIGINS=https://caromar.netlify.app,https://app.example.com`
- **When to use:** Recommended for production deployments that don't need to be embeddable/callable from arbitrary origins. Supports trailing-`*` prefix wildcards (e.g. `https://*.example.com*`).

### GitHub OAuth (Future Feature - Not Implemented)

#### `GITHUB_CLIENT_ID` (Optional)
- **Default:** Not used
- **Description:** GitHub OAuth App Client ID
- **Example:** `GITHUB_CLIENT_ID=Iv1.abc123def456`
- **When to use:** When implementing OAuth authentication flow
- **Status:** Placeholder for future enhancement — not read anywhere in `server.js` today.

#### `GITHUB_CLIENT_SECRET` (Optional)
- **Default:** Not used
- **Description:** GitHub OAuth App Client Secret
- **Example:** `GITHUB_CLIENT_SECRET=abc123...`
- **When to use:** When implementing OAuth authentication flow
- **Status:** Placeholder for future enhancement — not read anywhere in `server.js` today.
- **⚠️ Security:** Never commit this to version control

### Session Management (Future Feature - Not Implemented)

#### `SESSION_SECRET` (Optional)
- **Default:** Not used
- **Description:** Secret key for session encryption
- **Example:** `SESSION_SECRET=your-super-secret-random-string-here`
- **When to use:** When implementing server-side sessions
- **Status:** Placeholder for future enhancement — not read anywhere in `server.js` today.
- **⚠️ Security:** Use cryptographically random string

### Logging

#### `LOG_LEVEL` (Optional)
- **Default:** `INFO`
- **Values:** `DEBUG` | `INFO` | `WARN` | `ERROR`
- **Description:** Logging verbosity level. Only `DEBUG` currently changes behavior — it enables `logger.debug()` output (see `utils/logger.js`); all other levels log at their own call sites regardless of this setting.
- **Example:** `LOG_LEVEL=DEBUG`
- **When to use:** Debugging or reducing log noise in production

### Netlify-Specific

#### `NETLIFY` (Auto-set by Netlify)
- **Default:** Not set locally
- **Description:** Indicates running in Netlify environment; used by the `/api/health` endpoint to report `environment: "netlify-serverless"` vs `"local"`.
- **Example:** `NETLIFY=true`
- **When to use:** Automatically set - do not manually configure

#### `VIEWS_PATH` (Internal - Auto-configured)
- **Default:** Set by `functions/server.js`
- **Description:** Path to EJS templates in serverless context
- **Example:** `VIEWS_PATH=/var/task/views`
- **When to use:** Automatically configured - do not manually set

---

## Local Development

### Setup

1. **Create `.env` file** (optional):
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file**:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   LOG_LEVEL=DEBUG
   ALLOWED_ORIGINS=

   # GitHub OAuth (Placeholder for future)
   # GITHUB_CLIENT_ID=
   # GITHUB_CLIENT_SECRET=

   # Session Secret (Placeholder for future)
   # SESSION_SECRET=
   ```

3. **Start application**:
   ```bash
   npm start
   # or with nodemon for auto-reload
   npm run dev
   ```

### Environment Variable Loading

The application uses `dotenv` package to load `.env` file:
- Variables loaded at application start
- Only used in local development
- Not needed for Netlify deployment

### Example `.env` for Development

```env
# Basic Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=DEBUG
ALLOWED_ORIGINS=

# Future OAuth Configuration (not implemented)
# GITHUB_CLIENT_ID=your_client_id
# GITHUB_CLIENT_SECRET=your_client_secret

# Future Session Configuration (not implemented)
# SESSION_SECRET=generate-a-random-secret-key-here
```

---

## Netlify Deployment

### Setting Environment Variables

#### Method 1: Netlify Dashboard (Recommended)

1. Go to your site in Netlify Dashboard
2. Navigate to **Site settings → Environment variables**
3. Click **"Add a variable"**
4. Add variables:
   - `NODE_ENV` = `production` (auto-set)
   - `ALLOWED_ORIGINS` = your production frontend origin(s), if you want to restrict CORS
   - Other variables as needed

#### Method 2: netlify.toml

Environment variables can be configured in `netlify.toml`:

```toml
[build.environment]
  NODE_ENV = "production"
  LOG_LEVEL = "INFO"

[context.production.environment]
  NODE_VERSION = "18"

[context.deploy-preview.environment]
  NODE_ENV = "preview"
```

#### Method 3: Netlify CLI

```bash
# Set environment variable
netlify env:set VARIABLE_NAME "value"

# List environment variables
netlify env:list

# Import from .env file (careful with secrets!)
netlify env:import .env
```

### Required vs Optional

**For Netlify, NO environment variables are required.** The application works perfectly without any configuration.

**Optional enhancements:**
- `LOG_LEVEL=INFO` - Control logging verbosity
- `ALLOWED_ORIGINS` - Restrict CORS to specific origins
- Future: OAuth credentials for enhanced authentication

---

## Production Configuration

### Recommended Production Setup

```env
# Environment
NODE_ENV=production

# Logging
LOG_LEVEL=INFO

# CORS allowlist (recommended for production)
ALLOWED_ORIGINS=https://your-production-domain.netlify.app

# Future OAuth (when implemented)
# GITHUB_CLIENT_ID=production_client_id
# GITHUB_CLIENT_SECRET=production_secret

# Future Sessions (when implemented)
# SESSION_SECRET=cryptographically-random-secret-here
```

### Security Checklist

- [ ] Never commit `.env` files to version control
- [ ] Use `.env.example` for documentation only
- [ ] Store secrets in Netlify Dashboard (encrypted)
- [ ] Rotate secrets periodically
- [ ] Use different secrets for dev/staging/prod
- [ ] Limit access to production environment variables
- [ ] Enable Netlify's secret scanning
- [ ] Set `ALLOWED_ORIGINS` if the API should not be callable from arbitrary origins

### Performance Optimization

- Set `NODE_ENV=production` for optimized Express.js behavior
- Use `LOG_LEVEL=WARN` or `ERROR` to reduce log volume
- Monitor application with health check endpoint

---

## Security Best Practices

### 1. Never Commit Secrets

**.gitignore** should include:
```gitignore
.env
.env.local
.env.*.local
.env.production
```

### 2. Use Strong Secrets

Generate random secrets:
```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use
openssl rand -hex 32
```

### 3. Environment-Specific Configuration

Use different secrets for each environment:
- **Development:** `.env` (local, not committed)
- **Staging:** Netlify environment variables (branch deploys)
- **Production:** Netlify environment variables (main branch)

### 4. Least Privilege Access

- Limit who can view/edit production environment variables
- Use Netlify Teams for access control
- Audit access logs regularly

### 5. Secret Rotation

Rotate secrets periodically:
1. Generate new secret
2. Update in Netlify Dashboard
3. Deploy new version
4. Verify functionality
5. Delete old secret

---

## Configuration Validation

### Validate Local Configuration

```bash
# Run validation script
npm run validate

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env.PORT)"
```

### Validate Netlify Configuration

```bash
# Check Netlify environment variables
netlify env:list

# Test build locally with Netlify CLI
netlify build

# Test functions locally
netlify dev
```

### Health Check

After deployment, verify configuration:
```bash
# Check health endpoint
curl https://your-site.netlify.app/api/health

# Or use monitoring script
npm run monitor https://your-site.netlify.app
```

---

## Troubleshooting

### Issue: Environment Variables Not Loading

**Local Development:**
- Ensure `.env` file exists in project root
- Check file is not ignored by `.gitignore`
- Restart server after changing `.env`
- Verify `dotenv` package is installed

**Netlify:**
- Check variables in Site settings → Environment variables
- Verify variable names match (case-sensitive)
- Clear cache and redeploy: `netlify deploy --prod --clear-cache`

### Issue: PORT Already in Use

Change port in local `.env`:
```env
PORT=3001
```

Or use environment variable directly:
```bash
PORT=3001 npm start
```

### Issue: Requests Blocked by CORS

If you set `ALLOWED_ORIGINS` and requests start failing with CORS
errors, double-check the origin string matches exactly (scheme +
host + port), including no trailing slash. Leave `ALLOWED_ORIGINS`
unset to restore the previous "allow all origins" behavior while
debugging.

### Issue: Secrets Exposed in Logs

- Never log `process.env` in production
- Sanitize error messages
- Use `LOG_LEVEL=WARN` or higher in production
- Review Netlify function logs for accidental leaks

---

## Quick Reference

### Common Commands

```bash
# Local development with custom port
PORT=3001 npm start

# Production mode locally
NODE_ENV=production npm start

# Debug mode
LOG_LEVEL=DEBUG npm run dev

# Set Netlify environment variable
netlify env:set VAR_NAME "value"

# List Netlify environment variables
netlify env:list
```

### Environment Variable Priority

1. Command line: `PORT=3001 npm start`
2. `.env` file: `PORT=3001`
3. Default values in code

### File Locations

- **Local config:** `.env` (project root, not committed)
- **Example config:** `.env.example` (committed to repo)
- **Netlify config:** `netlify.toml` (committed to repo)
- **Server code:** `server.js` (reads environment variables)

---

## Future Enhancements

### Planned Features Requiring Configuration

1. **OAuth Authentication**
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - Redirect URI configuration

2. **Server-Side Sessions**
   - `SESSION_SECRET`
   - Session store configuration (Redis, etc.)

3. **Database Integration**
   - Database connection strings
   - Pool configuration

4. **Email Notifications**
   - SMTP configuration
   - Email service API keys

---

## Support

For configuration issues:
1. Check this guide
2. Review [Setup Guide](../guides/setup.md)
3. See [Netlify Deployment Guide](./netlify.md)
4. Create an issue: https://github.com/Universal-Standard/CAROMAR/issues

---

**Last Updated:** 2026-09-11
**Version:** 1.2.0
**Status:** ✅ Production Ready
