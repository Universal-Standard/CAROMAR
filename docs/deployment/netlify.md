# Netlify Deployment Guide

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Universal-Standard/CAROMAR)

## Quick Deploy

Click the button above to deploy CAROMAR to Netlify with one click!

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Methods](#deployment-methods)
3. [Configuration](#configuration)
4. [Verification](#verification)
5. [Troubleshooting](#troubleshooting)
6. [Performance & Monitoring](#performance--monitoring)

---

## Prerequisites

- GitHub account
- Netlify account (free tier works perfectly)
- GitHub Personal Access Token (for GitHub API operations)

---

## Deployment Methods

### Method 1: One-Click Deploy (Fastest) ⚡

1. Click the "Deploy to Netlify" button above
2. Configure your site name
3. Deploy!

**Time:** ~2 minutes  
**Result:** Live site with unique URL

### Method 2: GitHub Integration (Recommended) 🔄

1. Push repository to GitHub (if not already done)
2. Go to [Netlify Dashboard](https://app.netlify.com/)
3. Click "Add new site" → "Import an existing project"
4. Choose GitHub → Select CAROMAR repository
5. Deploy settings are pre-configured in `netlify.toml`
6. Click "Deploy site"

**Benefits:**
- Automatic deployments on every push to `main`
- Deploy previews for pull requests
- Full CI/CD pipeline

### Method 3: Netlify CLI (Advanced) 💻

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

**Use case:** Manual deployment control, local testing

---

## Configuration

### Build Settings

The repository includes a comprehensive `netlify.toml` configuration:

```toml
[build]
  command = "npm ci --production=false"
  publish = "public"
  
[functions]
  directory = "functions"
  node_bundler = "esbuild"
  included_files = ["views/**", "utils/**"]
```

### Node.js Version

Specified in `.nvmrc` and `package.json`:
- **Node Version:** 18
- **npm Version:** >=9.0.0

### Environment Variables (Optional)

CAROMAR works without environment variables for basic functionality. Optional configuration:

Navigate to: **Site settings → Environment variables**

**Optional Variables:**
- `NODE_ENV` = `production` (automatically set by Netlify)
- `LOG_LEVEL` = `INFO` (control logging verbosity)

**Note:** Users provide their own GitHub Personal Access Tokens via the application UI.

For detailed environment configuration, see [environment.md](./environment.md).

### Security Headers

Applied automatically via `netlify.toml`:
- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Caching Strategy

- **Static Assets (CSS/JS):** 1 year cache with immutable flag
- **Images:** 1 week cache
- **API Endpoints:** No cache (always fresh)

---

## Verification

### Pre-Deployment Validation

Before deploying, validate your configuration:

```bash
# 1. Validate configuration
npm run validate

# 2. Run tests
npm test

# 3. Check linting
npm run lint

# 4. Test locally
npm start
# Visit http://localhost:3000
```

### Post-Deployment Verification

After deployment, verify everything works:

#### 1. Health Check
```bash
curl https://your-site.netlify.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-18T00:00:00.000Z",
  "environment": "netlify-serverless",
  "version": "1.0.0",
  "uptime": 123.45
}
```

#### 2. Main Page
```bash
curl https://your-site.netlify.app/
```

**Expected:** HTML content with "CAROMAR"

#### 3. Static Assets
```bash
curl https://your-site.netlify.app/css/style.css
```

**Expected:** CSS content

#### 4. Functional Testing

1. Visit site in browser
2. Enter GitHub token
3. Validate token
4. Search for repositories
5. Select repositories
6. Execute fork operation
7. Verify success

---

## Troubleshooting

### Common Issues

#### Build Fails with "Module not found"

**Solution:**
```bash
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

#### Views Not Rendering (404 Error)

**Cause:** Views directory not accessible to serverless functions

**Solution:** Already fixed with `VIEWS_PATH` environment variable in `functions/server.js`

**Verify:**
- Check that `views/` directory exists in repository
- Verify `netlify.toml` has `included_files = ["views/**", "utils/**"]`

#### API Endpoints Returning 404

**Solution:** Check redirect configuration in `netlify.toml`:
```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/server/:splat"
  status = 200
  force = true
```

#### Rate Limiting Issues with GitHub API

**Cause:** GitHub API has different rate limits for authenticated vs unauthenticated requests

**Solution:**
- Users must provide their own GitHub Personal Access Tokens
- Authenticated requests: 5,000/hour
- Unauthenticated requests: 60/hour

#### Function Size Too Large

**Current Status:** Function size should be well under 50MB limit

**Verify:**
- Check Netlify dashboard for actual function size
- Ensure `npm ci --production` is used
- Remove unnecessary `node_modules`

### Debug Mode

Enable detailed logging by checking function logs in Netlify Dashboard:
1. Go to your site dashboard
2. Navigate to **Functions** tab
3. View logs for each function invocation

Or use Netlify CLI:
```bash
netlify functions:log
```

---

## Performance & Monitoring

### Expected Performance Metrics

- **Cold Start:** ~1-2 seconds (first request after idle)
- **Warm Response:** ~50-200ms (subsequent requests)
- **Static Assets:** <50ms (served from CDN)
- **Build Time:** ~30-60 seconds

### Netlify Free Tier Limits

**Includes:**
- Bandwidth: 100 GB/month
- Build Minutes: 300 minutes/month
- Function Invocations: 125,000/month
- Function Runtime: 100 hours/month

**Expected Usage (Low-Medium Traffic):**
- Function Invocations: ~1,000-10,000/month
- Bandwidth: ~1-10 GB/month
- Build Minutes: ~1-5 minutes/month

**Result:** CAROMAR runs completely free on Netlify's free tier for typical usage.

### Monitoring

#### Health Check Endpoint

Monitor application health:
```bash
GET https://your-site.netlify.app/api/health
```

#### Function Logs

View real-time function logs:
```bash
netlify functions:log
```

#### Build Logs

View build logs in Netlify Dashboard:
1. Go to **Deploys** tab
2. Click on any deploy
3. View full build log output

---

## Continuous Deployment

### Automatic Deployments

Netlify automatically deploys when you push to GitHub:

1. **Push to Main Branch:**
   ```bash
   git push origin main
   ```
   → Triggers production deployment

2. **Push to Feature Branch:**
   ```bash
   git push origin feature-branch
   ```
   → Creates deploy preview

3. **Pull Request:**
   → Automatic deploy preview linked in PR

### Deploy Contexts

Configured in `netlify.toml`:
- **Production:** Main branch deployments
- **Deploy Preview:** Branch and PR deployments
- **Development:** Local development context

---

## Rollback Strategy

### Roll Back to Previous Deploy

#### Via Netlify Dashboard:
1. Go to **Deploys** tab
2. Find the deploy you want to restore
3. Click **"..."** menu → **"Publish deploy"**

#### Via Netlify CLI:
```bash
netlify rollback
```

#### Via Git:
```bash
git revert HEAD
git push origin main
```

---

## Scaling & Costs

### Upgrade Triggers

Only upgrade if you exceed:
- 100 GB bandwidth/month (very high traffic)
- 125,000 function calls/month (enterprise-level usage)

### Cost Optimization

CAROMAR is optimized for cost-efficiency:
- Static assets served from CDN
- Serverless functions only run when needed
- Efficient bundling with esbuild
- No database or additional services required

---

## Support & Resources

### Documentation
- [Setup Guide](../guides/setup.md)
- [Development Guide](../guides/development.md)
- [API Documentation](../api/endpoints.md)
- [Environment Configuration](./environment.md)

### External Resources
- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [Netlify CLI Reference](https://docs.netlify.com/cli/get-started/)

### Support Channels
- **GitHub Issues:** [Report bugs or request features](https://github.com/Universal-Standard/CAROMAR/issues)
- **Netlify Community:** [Netlify Support Forum](https://answers.netlify.com/)

---

## Deployment Fixes Applied

All critical deployment issues have been resolved:

### ✅ Critical Fixes
1. **netlify.toml Configuration** - Completely rewrote with proper TOML formatting
2. **Node.js Version Specification** - Added `.nvmrc` and `package.json` engines field
3. **Build Process** - Updated build command to `npm ci --production=false`
4. **Views Directory Access** - Configured `VIEWS_PATH` for serverless context
5. **Environment Variables** - Documented all optional variables

### ✅ Security Enhancements
- Applied security headers via `netlify.toml`
- Configured Content Security Policy
- Implemented rate limiting (100 requests per 15 minutes per IP)
- Input validation and sanitization

### ✅ Performance Optimizations
- Static asset caching (1 year for CSS/JS)
- CDN delivery for all static assets
- Function bundling with esbuild
- Optimized build process

---

## License

This deployment guide is part of the CAROMAR project and follows the same MIT license.

---

**Last Updated:** February 18, 2026  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
