# CAROMAR API Documentation

## Overview
CAROMAR provides a comprehensive REST API for managing GitHub repositories, including forking, merging, and analyzing repositories.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All API endpoints require a GitHub Personal Access Token for authentication.

**Security Requirement:** Tokens must be transmitted via the `Authorization` header for GET requests, or in the request body for POST requests. **Never send tokens via query parameters** as they can be logged by servers, proxies, and browser history.

**For GET requests:**
```
Authorization: Bearer ghp_your_token_here
```

**For POST requests:**
Include the token in the JSON request body. `Content-Type: application/json` is required — requests with any other Content-Type receive `415 Unsupported Media Type`.

Required scopes:
- `repo` - Full control of private repositories
- `user` - Read/write user profile data

## Endpoints

### Health Check
Get the current status of the API server.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-11T00:00:00.000Z",
  "environment": "netlify-serverless",
  "uptime": 123.456,
  "version": "1.2.0"
}
```

### Performance Metrics
Get aggregated request performance metrics (uptime monitoring / debugging).

**Endpoint:** `GET /api/metrics`

**Response:**
```json
{
  "summary": { "totalRequests": 4213, "errorRate": 0.004, "avgDuration": 87 },
  "endpoints": { "GET /api/search-repos": { "count": 512, "avgDuration": 210 } },
  "timestamp": "2026-09-11T00:00:00.000Z"
}
```

### User Information
Get authenticated user information.

**Endpoint:** `GET /user`

**Headers:**
- `Authorization: Bearer <token>` (required) - GitHub Personal Access Token

**Response:**
```json
{
  "username": "octocat",
  "name": "The Octocat",
  "email": "octocat@github.com",
  "avatar_url": "https://github.com/images/error/octocat_happy.gif",
  "bio": "GitHub mascot",
  "public_repos": 8,
  "followers": 1000,
  "following": 10,
  "rate_limit": {
    "limit": 5000,
    "remaining": 4999,
    "reset": 1234567890
  }
}
```

### Validate Token
Validate a GitHub Personal Access Token and check permissions.

**Endpoint:** `GET /validate-token`

**Headers:**
- `Authorization: Bearer <token>` (required) - GitHub Personal Access Token

**Response:**
```json
{
  "valid": true,
  "scopes": ["repo", "user"],
  "required_scopes": ["repo", "user"],
  "has_required_permissions": true,
  "user": {
    "login": "octocat",
    "type": "User"
  }
}
```

### Search Repositories
Search for repositories owned by a user or organization.

**Endpoint:** `GET /search-repos`

**Headers:**
- `Authorization: Bearer <token>` (optional) - GitHub Personal Access Token (increases rate limits)

**Query Parameters:**
- `username` (required) - GitHub username or organization name
- `type` (optional) - Repository type: `all`, `owner`, `member`, `public`, `private` (default: `all`)
- `sort` (optional) - Sort by: `updated`, `created`, `pushed`, `full_name` (default: `updated`)
- `per_page` (optional) - Results per page (1-100, default: 100)
- `page` (optional) - Page number (default: 1)

**Response:**
```json
{
  "repos": [
    {
      "id": 123456,
      "name": "repo-name",
      "full_name": "octocat/repo-name",
      "description": "Repository description",
      "language": "JavaScript",
      "stargazers_count": 100,
      "forks_count": 20,
      "watchers_count": 50,
      "size": 1024,
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 100,
    "total": 1,
    "has_more": false
  },
  "rate_limit": {
    "limit": 5000,
    "remaining": 4998,
    "reset": 1704070800
  }
}
```

### Fork Repository
Fork a single repository to your account.

**Endpoint:** `POST /fork-repo`

**Request Body:**
```json
{
  "owner": "octocat",
  "repo": "Hello-World",
  "token": "ghp_...",
  "organization": "my-org" // optional
}
```

**Response:**
```json
{
  "success": true,
  "fork_url": "https://github.com/your-username/Hello-World",
  "clone_url": "https://github.com/your-username/Hello-World.git",
  "ssh_url": "git@github.com:your-username/Hello-World.git",
  "full_name": "your-username/Hello-World",
  "message": "Repository forked successfully"
}
```

### Create Merged Repository
Create a new target repository or merge directly into an existing one. Use `subfolders` to keep each source repository under its own folder, or `cohesive` to merge at the target root and fall back to source-repository folders on path conflicts.

**Endpoint:** `POST /api/create-merged-repo`

Each entry in `repositories` is validated (`isValidMergeRepository`): it
must include a `name`, an `owner/repo`-shaped `full_name` matching that
name, and a bare `https://github.com/<owner>/<repo>.git` `clone_url`
with no embedded credentials, query string, or fragment. Invalid
entries cause the whole request to be rejected with `400`.

**Request Body:**
```json
{
  "target": "new",
  "name": "merged-repo",
  "merge_strategy": "subfolders",
  "description": "Merged repository containing multiple projects",
  "token": "ghp_...",
  "private": false,
  "repositories": [
    {
      "name": "repo1",
      "full_name": "owner/repo1",
      "clone_url": "https://github.com/owner/repo1.git"
    },
    {
      "name": "repo2",
      "full_name": "owner/repo2",
      "clone_url": "https://github.com/owner/repo2.git"
    }
  ]
}
```

`target` options:
- `"new"` (default): create a new repository using `name`
- `"existing"`: merge into an existing repository you can push to, using `target_repository`

`merge_strategy` options:
- `"subfolders"` (default): each source repo merges under `<repo-name>/...`
- `"cohesive"`: merge at target root; path conflicts fall back to `<repo-name>/...`

**Validation Rules (repositories[]):**
- `name` must be a valid GitHub repository name (`[A-Za-z0-9._-]`, max 100 chars)
- `full_name` must match `owner/repository`
- `clone_url` must be an HTTPS GitHub URL (`https://github.com/<owner>/<repo>[.git]`)
- `name` and `full_name` must be unique within the request

Invalid descriptors return `400` with an indexed error message (example: `Repository at index 0 has an invalid clone_url`).

**Response:**
```json
{
  "success": true,
  "repository": {
    "name": "merged-repo",
    "full_name": "your-username/merged-repo",
    "html_url": "https://github.com/your-username/merged-repo",
    "clone_url": "https://github.com/your-username/merged-repo.git",
    "ssh_url": "git@github.com:your-username/merged-repo.git"
  },
  "target": "new",
  "merge_strategy": "subfolders",
  "message": "Repository created and merged automatically",
  "automated_merge": {
    "mergedFiles": 42,
    "sourceRepositories": 2,
    "skippedFiles": [],
    "aborted": false,
    "abortReason": null,
    "repositoryResults": [
      {
        "full_name": "owner/repo1",
        "folder": "repo1",
        "mergedFiles": 12,
        "skippedFiles": [],
        "capabilities": ["frontend", "testing"],
        "riskScore": 0.1
      }
    ],
    "aiInsights": [
      {
        "repository": "owner/repo1",
        "recommendation": "Repository merged cleanly. No additional remediation required.",
        "confidence": 0.98,
        "riskScore": 0.1
      }
    ]
  }
}
```

Clients must inspect `message` and `automated_merge.aborted`/`automated_merge.skippedFiles` before treating a `200` response with `success: true` as a completed automatic merge. Partial and aborted automatic merges still return `200` and require follow-up based on those fields.

### Get Repository Content
Get the contents of a specific file or directory in a repository.

**Endpoint:** `GET /repo-content`

**Headers:**
- `Authorization: Bearer <token>` (optional) - GitHub Personal Access Token (increases rate limits)

**Query Parameters:**
- `owner` (required) - Repository owner
- `repo` (required) - Repository name
- `path` (optional) - Path to file/directory (default: root)

**Response:**
```json
{
  "content": [
    {
      "name": "README.md",
      "path": "README.md",
      "type": "file",
      "size": 1024
    }
  ]
}
```

### Analyze Repositories
Perform analytics on a collection of repositories.

**Endpoint:** `POST /analyze-repos`

**Request Body:**
```json
{
  "repositories": [...]
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "overview": {
      "totalRepos": 10,
      "totalStars": 500,
      "totalForks": 100,
      "privateRepos": 2,
      "archivedRepos": 1
    },
    "languages": {
      "JavaScript": 5,
      "Python": 3,
      "Go": 2
    },
    "topRepositories": [...],
    "averages": {
      "avgStars": 50,
      "avgForks": 10
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Compare Repositories
Compare two or more repositories.

**Endpoint:** `POST /api/compare-repos`

**Request Body:**
```json
{
  "repositories": [ /* 2 repos for "two", 2+ for "multiple"/"best" */ ],
  "mode": "two",       // "two" | "multiple" | "best"
  "criteria": "stars"  // only used when mode is "best"
}
```

**Response (`mode: "two"` example):**
```json
{
  "success": true,
  "mode": "two",
  "comparison": {
    "names": { "repo1": "owner/repo-a", "repo2": "owner/repo-b" },
    "metrics": { "stars": { "repo1": 120, "repo2": 80, "winner": "owner/repo-a" } },
    "attributes": { "language": { "repo1": "JavaScript", "repo2": "Python" } },
    "similarity": 62
  },
  "timestamp": "2026-09-11T00:00:00.000Z"
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions or rate limit exceeded)
- `404` - Not Found (resource not found)
- `415` - Unsupported Media Type (POST body Content-Type is not `application/json`)
- `422` - Unprocessable Entity (validation error)
- `429` - Too Many Requests (CAROMAR's own rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

CAROMAR applies two layers of its own rate limiting, independent of GitHub's:

- **Per-IP (coarse):** 100 requests per 15 minutes per IP address, applied to all `/api/*` routes (`express-rate-limit`).
- **Per-token (fine):** 60 requests per minute, keyed by a SHA-256 hash of the caller's bearer/body token when present, otherwise by IP (`utils/security.js`'s `RateLimiter`). A `429` response from this layer includes a `remaining` field.

GitHub's own API rate limits also apply on top of these (5,000 requests/hour for authenticated requests, 60/hour unauthenticated) — see the `rate_limit` field returned by `/user` and `/search-repos`.

## Security Best Practices

1. **Never transmit tokens via query parameters** - Always use the `Authorization` header for GET requests to prevent token leakage through server logs, proxy logs, and browser history
2. Never commit your GitHub token to version control
3. Use environment variables for sensitive configuration
4. Regenerate tokens periodically
5. Use fine-grained tokens with minimal required permissions
6. Monitor your GitHub security settings regularly

See [SECURITY.md](../../SECURITY.md) for the full security policy.

## Examples

### Example: Fork a repository using cURL

```bash
curl -X POST http://localhost:3000/api/fork-repo \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "octocat",
    "repo": "Hello-World",
    "token": "ghp_your_token_here"
  }'
```

### Example: Search repositories using JavaScript

```javascript
const response = await fetch('/api/search-repos?username=octocat', {
  headers: {
    'Authorization': 'Bearer ghp_your_token_here'
  }
});
const data = await response.json();
console.log(data.repos);
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/Universal-Standard/CAROMAR/issues
- Documentation: [docs/README.md](../README.md)
