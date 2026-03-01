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
Include the token in the JSON request body.

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
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0"
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
    "remaining": 4998,
    "reset": "2024-01-01T01:00:00.000Z"
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
Create a new repository that will contain multiple repositories as subdirectories.

**Endpoint:** `POST /create-merged-repo`

**Request Body:**
```json
{
  "name": "merged-repo",
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

**Response:**
```json
{
  "success": true,
  "repository": {
    "name": "merged-repo",
    "full_name": "your-username/merged-repo",
    "html_url": "https://github.com/your-username/merged-repo",
    "clone_url": "https://github.com/your-username/merged-repo.git"
  },
  "message": "Repository created successfully",
  "merge_instructions": {
    "repositories": [...],
    "steps": ["git clone ...", "cd ...", ...]
  }
}
```

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
- `422` - Unprocessable Entity (validation error)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:
- 100 requests per 15 minutes per IP address
- GitHub API rate limits also apply (5000 requests per hour for authenticated requests)

## Security Best Practices

1. **Never transmit tokens via query parameters** - Always use the `Authorization` header for GET requests to prevent token leakage through server logs, proxy logs, and browser history
2. Never commit your GitHub token to version control
3. Use environment variables for sensitive configuration
4. Regenerate tokens periodically
5. Use fine-grained tokens with minimal required permissions
6. Monitor your GitHub security settings regularly

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
- GitHub Issues: https://github.com/US-SPURS/CAROMAR/issues
- Documentation: https://github.com/US-SPURS/CAROMAR
