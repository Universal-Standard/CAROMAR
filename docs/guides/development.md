# CAROMAR Development Documentation

## Architecture Overview

CAROMAR is built as a modern web application with a clean separation between frontend and backend components.

### Backend Architecture (Node.js/Express)

```
server.js
├── Security Middleware (helmet, cors allowlist, prototype-pollution guard)
├── Rate Limiting (express-rate-limit per-IP + utils/security.js RateLimiter per-token)
├── API Routes
│   ├── /api/user - User information and validation
│   ├── /api/validate-token - Token permission checking
│   ├── /api/search-repos - Repository discovery with filtering
│   ├── /api/fork-repo - Individual repository forking
│   ├── /api/create-merged-repo - Merged repository creation
│   ├── /api/repo-content - Repository content preview
│   ├── /api/analyze-repos - Repository analytics
│   ├── /api/compare-repos - Repository comparison
│   ├── /api/health - Health check
│   └── /api/metrics - Performance metrics
└── Static File Serving
```

### Frontend Architecture (Enhanced JavaScript)

```
enhanced-app.js (EnhancedCaromarApp class)
├── Core Features
│   ├── GitHub Authentication
│   ├── Repository Search & Discovery
│   ├── Advanced Filtering & Sorting
│   └── Batch Operations
├── UI Components
│   ├── Progressive Disclosure
│   ├── Real-time Progress Tracking
│   ├── Responsive Design
│   └── Accessibility Features
└── Data Management
    ├── Local Storage Integration
    ├── Auto-save Functionality
    ├── Import/Export Capabilities
    └── Search History
```

## Key Features Implemented

### 🔐 Enhanced Authentication System
- GitHub Personal Access Token validation
- Permission scope checking
- Rate limit monitoring and display
- Token persistence with security considerations

### 🔍 Advanced Repository Discovery
- User and Organization repository support
- Real-time filtering by type, language, and text
- Advanced sorting options (stars, updated, created, etc.)
- Pagination and rate limit handling
- Repository metadata display (stars, forks, size, topics)

### 📊 Smart Repository Management
- Interactive grid with enhanced repository cards
- Bulk selection with keyboard shortcuts (Ctrl+A, Ctrl+D)
- Live search and filtering
- Repository preview and content inspection
- Import/Export functionality for repository lists

### 🚀 Dual Operation Modes

#### Individual Repository Forking
- Batch processing with progress tracking
- Error handling and retry logic
- Success/failure reporting with direct links
- Rate limit respect with delays

#### Repository Merging (Advanced)
- New repository creation via GitHub API
- Merge preview with folder structure visualization
- Repository name availability checking
- Detailed merge instructions with copy-to-clipboard, gated on
  `isValidMergeRepository` passing for every selected repository
- Support for private repository creation

### 💻 User Experience Enhancements
- Responsive design for all device sizes
- Dark mode support (CSS media queries)
- Loading states and skeleton loaders
- Real-time notifications with animations
- Keyboard shortcuts and accessibility features
- Auto-save functionality with local storage

### 🧪 Comprehensive Testing
- Unit tests for API endpoints (`tests/app.test.js`, `tests/server.test.js`)
- Security module tests (`tests/security.test.js`, `tests/token-security.test.js`)
- Merge-instruction contract tests (`tests/merge-contract.test.js`)
- Frontend component testing framework
- Mock services for reliable testing
- Coverage reporting with Jest

## API Documentation

**Note:** all authenticated requests use the `Authorization: Bearer <token>`
header, never a `token` query parameter (query parameters can leak into
server/proxy logs and browser history). See
[docs/api/endpoints.md](../api/endpoints.md) for the authoritative,
kept-in-sync API reference including `/api/analyze-repos`,
`/api/compare-repos`, `/api/health`, and `/api/metrics`.

### Authentication Endpoints

#### `GET /api/user`
Returns comprehensive user information including rate limits.

**Headers:**
- `Authorization: Bearer <token>` (required): GitHub Personal Access Token

**Response:**
```json
{
  "username": "string",
  "name": "string",
  "email": "string",
  "avatar_url": "string",
  "public_repos": "number",
  "rate_limit": {
    "remaining": "number",
    "reset": "timestamp"
  }
}
```

#### `GET /api/validate-token`
Validates token permissions and scopes.

**Headers:**
- `Authorization: Bearer <token>` (required): GitHub Personal Access Token

**Response:**
```json
{
  "valid": "boolean",
  "scopes": "array",
  "required_scopes": "array",
  "has_required_permissions": "boolean"
}
```

### Repository Management Endpoints

#### `GET /api/search-repos`
Advanced repository search with filtering and pagination.

**Headers:**
- `Authorization: Bearer <token>` (optional): GitHub Personal Access Token — increases GitHub API rate limits

**Query Parameters:**
- `username` (required): GitHub username or organization
- `type`: Repository type filter (all, owner, member, public, private)
- `sort`: Sort order (updated, created, pushed, full_name)
- `per_page`: Results per page (default: 100, max: 100)
- `page`: Page number for pagination

**Response:**
```json
{
  "repos": "array of repository objects",
  "pagination": {
    "page": "number",
    "per_page": "number",
    "has_more": "boolean"
  },
  "rate_limit": {
    "remaining": "number",
    "reset": "timestamp"
  }
}
```

#### `POST /api/fork-repo`
Fork a repository with enhanced error handling.

**Request Body** (`Content-Type: application/json` required):
```json
{
  "owner": "string",
  "repo": "string",
  "token": "string",
  "organization": "string (optional)"
}
```

#### `POST /api/create-merged-repo`
Create a new repository or merge into an existing writable repository.

**Request Body** (`Content-Type: application/json` required):
```json
{
  "target": "new | existing",
  "name": "string (required when target = new)",
  "target_repository": "owner/repo (required when target = existing)",
  "merge_strategy": "subfolders | cohesive",
  "description": "string",
  "repositories": "array of repository objects",
  "token": "string",
  "private": "boolean"
}
```

**Response notes:**
- Each entry in `repositories` must pass descriptor validation (valid `name`, matching `owner/repo` `full_name`, and GitHub HTTPS `clone_url` with no credentials/query/fragment) or the whole request is rejected.
- Successful responses return `automated_merge` with `mergedFiles`, `skippedFiles`, `aborted`, `abortReason`, and per-repository results.
- Treat responses with `automated_merge.aborted === true` or non-empty `automated_merge.skippedFiles` as incomplete and requiring follow-up.

## Frontend JavaScript API

### EnhancedCaromarApp Class

#### Core Methods
- `validateToken()` - Enhanced token validation with permission checking
- `searchRepositories()` - Advanced repository search with filtering
- `applyFilters()` / `applySorting()` - Dynamic content filtering
- `forkRepositories()` - Batch forking with progress tracking
- `mergeRepositories()` - Repository merging with instructions

#### Utility Methods
- `exportRepositoryList()` - Export selected repositories as JSON
- `importRepositoryList()` - Import repository selections
- `previewSelected()` - Open preview window for selected repositories
- `autoSaveSelections()` - Automatic state persistence

#### Event Handling
- Keyboard shortcuts (Ctrl+A, Ctrl+D, Ctrl+F)
- Dynamic DOM manipulation
- Real-time search and filtering
- Progress tracking and notifications

## Performance Optimizations

### Backend Optimizations
- Express rate limiting to prevent API abuse (per-IP and per-token, see Security below)
- Efficient GitHub API usage with proper headers
- Error handling with specific HTTP status codes
- Compression and caching headers for static assets

### Frontend Optimizations
- Lazy loading with skeleton screens
- Debounced search input to reduce API calls
- Local storage caching for user preferences
- Efficient DOM manipulation and event delegation
- CSS transitions and animations for smooth UX

### GitHub API Best Practices
- User-Agent headers for API identification
- Rate limit monitoring and display
- Exponential backoff for failed requests
- Efficient batch processing with delays

## Security Considerations

### Token Handling
- Client-side token storage with localStorage
- No server-side token persistence
- Secure token transmission via HTTPS
- Permission validation before operations
- When a token is used as a rate-limit identifier, only a truncated
  SHA-256 hash of it is retained in memory (`simpleHash`), never the
  raw value

### API Security
- Two-layer rate limiting: per-IP (`express-rate-limit`, 100/15min) and
  per-token-or-IP (`utils/security.js`'s `RateLimiter`, 60/min),
  applied via the `tokenAwareRateLimit` middleware to every `/api/*` route
- Input validation and sanitization (`utils/validation.js`)
- Prototype-pollution guard (`sanitizeObject`) applied to every parsed
  request body
- Configurable CORS allowlist via `ALLOWED_ORIGINS` (`isAllowedOrigin`),
  defaulting to allow-all for backward compatibility
- `Content-Type: application/json` enforced on all state-changing POST routes
- Error message sanitization to prevent information disclosure

Full details: [SECURITY.md](../../SECURITY.md).

### Data Privacy
- No personal data stored on server
- All GitHub operations performed via official API
- User data only cached locally in browser
- Clear data export/import functionality

## Deployment Considerations

### Environment Variables

See [docs/deployment/environment.md](../deployment/environment.md) for the full reference. Summary:

```bash
PORT=3000                     # Local dev server port (ignored on Netlify)
NODE_ENV=development           # development | production | test
LOG_LEVEL=INFO                 # DEBUG | INFO | WARN | ERROR
ALLOWED_ORIGINS=                # Comma-separated CORS allowlist; unset = allow all

# Reserved for future features — not read by server.js yet:
GITHUB_CLIENT_ID=optional      # For OAuth (not implemented)
GITHUB_CLIENT_SECRET=optional  # For OAuth (not implemented)
SESSION_SECRET=optional        # For sessions (not implemented)
```

### Production Recommendations
1. Use HTTPS for all connections
2. Implement proper logging and monitoring
3. Set up health check endpoints
4. Set `ALLOWED_ORIGINS` to your production frontend origin(s)
5. Add CSP headers for security (already configured via Helmet)
6. Implement proper error tracking

### Scaling Considerations
- Stateless architecture allows horizontal scaling
- The current `RateLimiter` and per-token counters are in-process
  memory — on Netlify Functions each invocation may get a fresh
  instance, so rate limiting is best-effort per warm function
  instance rather than globally exact. Redis or a similar shared
  store would be needed for cluster-wide exact limits.
- GitHub API rate limits are per-token, not per-server
- CDN can be used for static asset delivery

## Testing Strategy

### Unit Tests
- API endpoint validation
- Authentication flow testing
- Error handling verification
- Utility function testing

### Integration Tests
- GitHub API integration testing
- Full workflow testing (auth -> search -> fork)
- Error scenario testing
- Rate limit handling testing

### Frontend Tests
- User interaction simulation
- State management testing
- Local storage functionality
- Export/import feature testing

## Future Enhancement Opportunities

### Advanced Features
- OAuth authentication flow
- Webhook support for repository events
- Advanced merge conflict resolution
- Repository template system
- Team collaboration features

### Performance Improvements
- Server-side rendering for better SEO
- Progressive Web App (PWA) capabilities
- Offline functionality with service workers
- Advanced caching strategies
- Shared/distributed rate-limit store (e.g. Redis) for exact
  cluster-wide limits on serverless deployments

### User Experience
- Drag-and-drop repository organization
- Advanced filtering with Boolean logic
- Repository comparison tools
- Integration with other Git platforms (GitLab, Bitbucket)

## Troubleshooting Guide

### Common Issues

#### "Font Awesome icons not loading"
- **Solution**: Application includes fallback emoji icons
- **Prevention**: Icons-fallback.css provides universal support

#### "Rate limit exceeded" (GitHub API, HTTP 403)
- **Solution**: Wait for rate limit reset or use authenticated requests
- **Prevention**: Monitor rate limit display in application

#### "Too many requests" (CAROMAR's own limiter, HTTP 429)
- **Solution**: Wait roughly a minute (per-token limiter) or 15
  minutes (per-IP limiter) and retry; check the `remaining` field in
  the response body
- **Cause**: `utils/security.js`'s `RateLimiter` or the IP-based
  `express-rate-limit` middleware, not GitHub's own limits

#### "Token validation failed"
- **Solution**: Generate new token with proper scopes (repo, user)
- **Prevention**: Use token validation endpoint to check permissions

#### "Repository merge not working"
- **Solution**: Inspect `automated_merge.skippedFiles` and `automated_merge.abortReason`, then retry with reduced scope or complete follow-up actions for skipped files
- **Context**: Merges execute server-side and can still be partial when files are unsupported, oversized, or blocked by API errors

### Debug Mode
Enable debug logging by setting `localStorage.setItem('debug', 'true')` in browser console (frontend) or `LOG_LEVEL=DEBUG` (backend).

## Contributing Guidelines

### Code Style
- Use ES6+ features consistently
- Implement proper error handling
- Add JSDoc comments for functions
- Follow RESTful API conventions
- Write tests for new features
- If you add a new security control, wire it into `server.js` (or
  another live code path) in the same change — see the contributor
  checklist in [SECURITY.md](../../SECURITY.md)

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request with detailed description

### Issue Reporting
- Use provided issue templates
- Include steps to reproduce
- Provide environment information
- Add screenshots for UI issues
