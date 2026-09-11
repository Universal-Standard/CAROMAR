# Changelog

All notable changes to the CAROMAR project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-11

### Fixed

#### Security Module Actually Wired In
- **`utils/security.js` is now imported and used by `server.js`.** It was
  fully built and unit-tested (29 cases in `tests/security.test.js`)
  since 1.1.0, but never `require()`'d anywhere in the running
  application — meaning the protections this CHANGELOG and SECURITY.md
  described (per-token rate limiting, prototype-pollution guarding,
  CORS origin validation) were not actually in effect. This release
  closes that gap:
  - `sanitizeObject` now runs on every parsed JSON/urlencoded request
    body before any route handler sees it (prototype-pollution guard).
  - A new `tokenAwareRateLimit` middleware, backed by `RateLimiter` and
    `simpleHash`, applies per-token (SHA-256 hash of the bearer/body
    token — the raw token itself is never retained) or per-IP rate
    limiting to every `/api/*` route, in addition to the existing
    coarse IP-based `express-rate-limit`.
  - CORS now uses a real origin callback backed by `isAllowedOrigin`
    and a new `ALLOWED_ORIGINS` environment variable, replacing the
    previous bare `cors()` (which reflected any origin). Default
    behavior when `ALLOWED_ORIGINS` is unset is unchanged (all origins
    allowed) to avoid a breaking change for existing deployments.
  - `isAllowedContentType` now enforces `Content-Type: application/json`
    on all state-changing `POST` endpoints. Verified against
    `public/js/enhanced-app.js`, which already sends this header on
    every POST call, so no frontend changes were required.

#### Repository Hygiene
- Removed 11 stray `desktop.ini` Windows Explorer artifacts that had
  been committed across the repo root, `.github/`, `.github/workflows/`,
  `functions/`, `public/`, `public/css/`, `public/js/`, `scripts/`,
  `tests/`, `utils/`, and `views/`. `.gitignore` now ignores
  `desktop.ini`, `Thumbs.db`, and common editor/OS artifacts so they
  can't reappear.
- Removed `SWARM_CONSOLIDATION_PACKET.md`, a misplaced planning
  document for an unrelated project (a separate SWARM/ATLANTIS-AI
  monorepo migration) that did not describe CAROMAR.
- Removed `.github/workflows/jekyll-gh-pages.yml`, a leftover default
  GitHub Pages template irrelevant to this Node.js/Express/Netlify
  project. It also granted the `GITHUB_TOKEN` broad write permissions
  (`contents`, `packages`, `issues`, `security-events`, etc.) that the
  project never needed. Replaced by `.github/workflows/ci.yml`, which
  runs lint, tests, `npm run validate`, and a build check with
  `contents: read` only.

#### Stale Cross-References
- `package.json` `repository`/`bugs`/`homepage` URLs updated from the
  old `US-SPURS/CAROMAR` location to `Universal-Standard/CAROMAR`.
- `README.md`: all GitHub links updated to `Universal-Standard/CAROMAR`;
  the "Project Structure" tree — which still listed root-level
  `NETLIFY_DEPLOYMENT.md`, `DEPLOYMENT_FIXES.md`, `SETUP.md`,
  `DEVELOPMENT.md`, and `API.md` from before the Feb 18 docs
  reorganization — now reflects the actual current layout (`docs/`,
  the full `tests/` suite, `.github/workflows/`, `package-lock.json`).
- `CONTRIBUTING.md` prerequisite corrected from "Node.js v16+" to
  "Node.js v18+" to match `package.json`'s `engines.node` requirement.
- `.env.example` rewritten to match what `server.js` actually reads:
  added the new `ALLOWED_ORIGINS` and `NODE_ENV` variables, and
  clearly labeled `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/
  `SESSION_SECRET` as reserved for a not-yet-implemented OAuth/session
  feature rather than implying they're required today.

### Added
- `.github/workflows/ci.yml` — lint, test, `npm run validate`, and
  `npm run build` on every push/PR to `main`.
- `ALLOWED_ORIGINS` environment variable for configuring the CORS
  allowlist in production.

## [1.1.0] - 2024-12-03

### Added

#### Security Enhancements
- **New Security Module** (`utils/security.js`)
  - Suspicious pattern detection for XSS prevention
  - URL validation for safe external links
  - Per-user/token rate limiting with cryptographic hashing
  - CSRF protection with origin validation
  - Prototype pollution prevention with object sanitization
  - Content-Type validation
  - 29 comprehensive security tests

#### Performance & Monitoring
- **New Performance Monitor** (`utils/performance.js`)
  - Real-time request tracking per endpoint
  - Error rate monitoring and alerting
  - Slow request detection
  - Incremental slowest request tracking for efficiency
  - Health status evaluation
  - Comprehensive metrics collection
  - New `/api/metrics` endpoint for performance data
  - Enhanced `/api/health` endpoint with performance metrics

#### Documentation
- **JSDoc Comments** throughout codebase
  - All frontend classes and methods
  - All server endpoints with route documentation
  - All utility functions with parameters and return types
  - Usage examples and security notes
- **SECURITY.md** with comprehensive security policy
- **CHANGELOG.md** for tracking changes
- Enhanced inline comments for complex logic

#### Testing
- **Expanded Test Suite** from 31 to 75 tests (144% increase)
  - `tests/server.test.js` - Server endpoint integration tests
  - `tests/security.test.js` - Security module tests with 29 test cases
  - Edge case coverage for input validation
  - Rate limiting tests
  - Object sanitization tests
  - Timer leak prevention in tests

### Changed

#### Security Improvements
- Upgraded hash function from simple DJB2 to cryptographic SHA-256
- Enhanced token validation with permission scope checking
- Improved input sanitization with length limits
- Better error message handling to prevent information leakage
- Removed unnecessary conditional checks (unref method)

#### Performance Optimizations
- Incremental tracking of slowest requests (removed O(n) reduce operation)
- Memory-efficient request storage with automatic cleanup
- Timer leak fixes with proper interval cleanup
- Optimized rate limiter with automatic garbage collection

#### Code Quality
- Fixed all ESLint warnings (0 warnings, 0 errors)
- Improved code organization and modularity
- Enhanced error handling across all endpoints
- Better separation of concerns

### Fixed
- Timer leaks in test suite
- Memory cleanup in RateLimiter class
- Proper cleanup of intervals to prevent process hanging
- Test flakiness with proper mocking

### Security

#### Vulnerabilities Addressed
- **npm audit**: 0 vulnerabilities found
- **CodeQL Analysis**: 0 alerts (passed static analysis)
- **XSS Protection**: Enhanced input sanitization
- **Prototype Pollution**: Added object sanitization
- **Rate Limiting**: Cryptographically secure identifier hashing

#### Security Scans Performed
- ESLint security rules
- npm security audit
- CodeQL static analysis
- Manual security code review
- Input validation testing

### Testing

#### Test Coverage
- **Total Tests**: 75 (previously 31)
- **Test Suites**: 4 comprehensive test files
- **Pass Rate**: 100% (75/75 tests passing)
- **Coverage Areas**:
  - API endpoints
  - Utility functions
  - Security features
  - Input validation
  - Error handling
  - Edge cases

### Quality Metrics
- ✅ 100% test pass rate (75/75)
- ✅ 0 ESLint errors
- ✅ 0 ESLint warnings
- ✅ 0 npm vulnerabilities
- ✅ 0 CodeQL alerts
- ✅ Server starts successfully
- ✅ No memory leaks
- ✅ No timer leaks

## [1.0.0] - 2024-11-01

### Added

#### Core Features
- **GitHub Authentication**
  - Personal Access Token validation
  - User profile display
  - Token storage for session persistence
  
- **Repository Discovery**
  - Search repositories by username
  - Support for users and organizations
  - Advanced filtering (type, language, status)
  - Real-time search with progress indicators
  
- **Repository Operations**
  - Individual repository forking
  - Batch forking with progress tracking
  - Merged repository creation
  - Repository content preview
  
- **Advanced Features**
  - Repository analytics and statistics
  - Repository comparison tools
  - Language distribution analysis
  - Activity timeline visualization
  - Import/Export functionality

#### User Interface
- **Modern Design**
  - GitHub-inspired styling
  - Responsive layout for all devices
  - Dark mode support
  - Skeleton loaders for better UX
  
- **Accessibility**
  - ARIA labels and roles
  - Keyboard navigation support
  - Screen reader compatibility
  - Skip links for navigation
  
- **Interactive Elements**
  - Real-time progress bars
  - Detailed status messages
  - Success/error notifications
  - Help modal with shortcuts

#### API Endpoints
- `GET /` - Main application page
- `GET /api/user` - User information
- `GET /api/validate-token` - Token validation
- `GET /api/search-repos` - Repository search
- `POST /api/fork-repo` - Fork repository
- `POST /api/create-merged-repo` - Create merged repository
- `GET /api/repo-content` - Repository content
- `POST /api/analyze-repos` - Repository analytics
- `POST /api/compare-repos` - Repository comparison
- `GET /api/health` - Health check

#### Utilities
- **Logger** (`utils/logger.js`)
  - Structured logging
  - Multiple log levels
  - Request/response logging
  
- **Analytics** (`utils/analytics.js`)
  - Repository statistics
  - Language distribution
  - Activity analysis
  - Trend detection
  
- **Comparison** (`utils/comparison.js`)
  - Two-way repository comparison
  - Multiple repository ranking
  - Similarity calculation
  
- **Validation** (`utils/validation.js`)
  - GitHub username validation
  - Repository name validation
  - Token format validation
  - Input sanitization
  - Pagination validation

#### Testing
- Jest test framework
- Supertest for API testing
- 31 initial tests covering:
  - API endpoints
  - Utility functions
  - Input validation

#### Documentation
- **README.md** - Project overview and setup
- **API.md** - Comprehensive API documentation
- **DEVELOPMENT.md** - Development guide
- **CONTRIBUTING.md** - Contribution guidelines
- **SETUP.md** - Detailed setup instructions
- **LICENSE** - MIT License

#### Configuration
- ESLint for code quality
- Jest for testing
- Helmet for security headers
- CORS configuration
- Rate limiting
- Environment variable support

### Technical Stack
- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Templating**: EJS
- **HTTP Client**: Axios
- **Security**: Helmet, express-rate-limit, CORS
- **Testing**: Jest, Supertest
- **Linting**: ESLint
- **Package Manager**: npm

### Dependencies
#### Production
- axios: ^1.5.0
- cors: ^2.8.5
- dotenv: ^16.3.1
- ejs: ^3.1.10
- express: ^4.18.2
- express-rate-limit: ^8.1.0
- helmet: ^8.1.0

#### Development
- eslint: ^9.38.0
- jest: ^30.1.3
- nodemon: ^3.0.1
- supertest: ^7.1.4

## Release Notes

### Version 1.2.0 Highlights

This release is a **production-hardening pass** focused on closing the
gap between what the project *documented* and what it actually *did*,
and on repository hygiene:

1. **Security module wired in**: `utils/security.js` protections
   (rate limiting, prototype-pollution guard, CORS allowlist,
   content-type enforcement) now actually run in `server.js`.
2. **Repository cleanup**: removed junk files (`desktop.ini` × 11),
   a misplaced unrelated planning document, and an irrelevant,
   overprivileged CI workflow.
3. **Stale references fixed**: org URLs, project-structure docs, and
   Node version requirements now match reality across `package.json`,
   `README.md`, `CONTRIBUTING.md`, and `.env.example`.
4. **New CI**: `.github/workflows/ci.yml` actually validates the
   project on every push/PR.

No breaking changes to API request/response shapes. The CORS default
(no `ALLOWED_ORIGINS` set) is unchanged from prior behavior.

### Version 1.1.0 Highlights

This release focuses on **production readiness** with significant improvements in:

1. **Security**: New security module with comprehensive protection against common vulnerabilities
2. **Performance**: Performance monitoring with real-time metrics and health checks
3. **Testing**: 144% increase in test coverage with focus on edge cases
4. **Documentation**: Complete JSDoc coverage and security documentation
5. **Quality**: Zero linting warnings, zero security vulnerabilities, zero code alerts

### Upgrade Guide

Upgrading to 1.2.0:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Run tests to verify
npm test

# Start the server
npm start
```

No breaking changes. If you deploy behind a specific set of frontend
origins, set `ALLOWED_ORIGINS` (comma-separated) in your environment;
otherwise CORS behavior is unchanged from 1.1.0.

### Migration Notes

- No database migrations required
- No configuration changes required
- Token format remains unchanged
- API endpoints are backward compatible
- New endpoints are additive only

### Known Issues

None at this time.

### Future Plans

See [docs/guides/development.md](docs/guides/development.md) for planned features and enhancements.

---

For more information, see:
- [README.md](README.md) - Project overview
- [SECURITY.md](SECURITY.md) - Security policy
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
