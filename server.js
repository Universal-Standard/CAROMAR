/**
 * CAROMAR Server - Copy A Repository Or Merge All Repositories
 * A Node.js/Express server for managing GitHub repositories
 * @module server
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import utilities
const logger = require('./utils/logger');
const RepositoryAnalytics = require('./utils/analytics');
const RepositoryComparison = require('./utils/comparison');
const PerformanceMonitor = require('./utils/performance');
const {
    buildMergePlan,
    mergeRepositoriesIntoTarget,
    getRepositoryTree,
    isRateLimitExceededError,
    MERGE_STRATEGIES
} = require('./utils/merge-automation');
const {
    isValidGitHubUsername,
    isValidRepositoryName,
    isValidGitHubToken,
    sanitizeString,
    isValidRepoPath,
    validatePagination,
    validateSort,
    validateMergeRepositoryDescriptors
} = require('./utils/validation');
const {
    isAllowedOrigin,
    sanitizeObject,
    isAllowedContentType,
    simpleHash,
    RateLimiter
} = require('./utils/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor();

// Initialize per-token/per-IP rate limiter (defense in depth alongside express-rate-limit)
const tokenRateLimiter = new RateLimiter();

// Rate limiting (IP-based, coarse-grained)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

/**
 * Parse ALLOWED_ORIGINS env var (comma-separated) into an array.
 * Defaults to an empty list, which combined with isAllowedOrigin's
 * "no Origin header => allow" rule permits same-origin browser usage
 * (the shipped frontend) while restricting cross-origin embedding
 * unless explicitly configured.
 * @returns {string[]} Configured allowed origins
 */
function getAllowedOrigins() {
    const raw = process.env.ALLOWED_ORIGINS;
    if (!raw) {
        return [];
    }
    return raw.split(',').map(origin => origin.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

// Middleware
// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdnjs.cloudflare.com'],
            scriptSrc: ['\'self\'', '\'unsafe-inline\''],
            fontSrc: ['\'self\'', 'https://cdnjs.cloudflare.com'],
            imgSrc: ['\'self\'', 'data:', 'https:'],
            connectSrc: ['\'self\'', 'https://api.github.com']
        }
    }
}));

// CORS: honor ALLOWED_ORIGINS when configured. When unset/empty, only
// same-origin requests (no Origin header) are allowed by default.
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
            return callback(null, true);
        }
        logger.warn('Blocked request from disallowed origin', { origin });
        return callback(null, false);
    }
}));

app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prototype-pollution guard: strip dangerous keys (__proto__, constructor,
// prototype) from parsed JSON/urlencoded bodies before any handler sees them.
app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
});

app.use(express.static('public'));

// Request logging and performance tracking middleware
app.use((req, res, next) => {
    const completeRequest = performanceMonitor.startRequest(req.path, req.method);
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logResponse(req, res, duration);
        completeRequest(res.statusCode);
    });
    
    next();
});

app.use('/api/', apiLimiter);

/**
 * Per-token/per-IP rate limiting middleware for state-changing API routes.
 * Applied in addition to the coarse IP-based apiLimiter above. Identifies
 * callers by a SHA-256 hash of their bearer token when present (never the
 * raw token, so nothing sensitive is retained in memory), falling back to
 * IP address for unauthenticated requests.
 */
function tokenAwareRateLimit(req, res, next) {
    const authHeader = req.headers.authorization;
    let headerToken = null;
    if (typeof authHeader === 'string') {
        if (authHeader.startsWith('Bearer ')) {
            headerToken = authHeader.substring(7);
        } else if (authHeader.startsWith('token ')) {
            headerToken = authHeader.substring(6);
        }
    }
    const bodyToken = typeof req.body?.token === 'string' ? req.body.token : null;
    const identifierSource = headerToken || bodyToken;
    const identifier = identifierSource ? `token:${simpleHash(identifierSource)}` : `ip:${req.ip}`;

    if (!tokenRateLimiter.checkLimit(identifier)) {
        logger.warn('Per-token rate limit exceeded', { identifier });
        return res.status(429).json({
            error: 'Too many requests for this token, please slow down.',
            remaining: tokenRateLimiter.getRemaining(identifier)
        });
    }

    next();
}

/**
 * Enforces that POST/PUT bodies are application/json, rejecting anything
 * else before it reaches route handlers.
 */
function requireJsonContentType(req, res, next) {
    const contentLength = req.headers['content-length'];
    const hasTransferEncoding = typeof req.headers['transfer-encoding'] === 'string';
    const hasBody = hasTransferEncoding || (typeof contentLength === 'string' && contentLength !== '0');

    if (!hasBody) {
        return next();
    }

    if (!isAllowedContentType(req.headers['content-type'])) {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
}

// Set view engine - use VIEWS_PATH for Netlify serverless compatibility
app.set('view engine', 'ejs');
app.set('views', process.env.VIEWS_PATH || path.join(__dirname, 'views'));

/**
 * Normalize a GitHub rate limit reset value to Unix seconds.
 * @param {string|number|undefined|null} value - Raw reset value
 * @returns {number|null} - Unix timestamp in seconds or null
 */
function normalizeRateLimitReset(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * Routes
 */

/**
 * Render main application page
 * @route GET /
 * @returns {HTML} Main application page
 */
app.get('/', (req, res) => {
    res.render('index');
});

/**
 * Search repositories for a GitHub user or organization
 * @route GET /api/search-repos
 * @param {string} req.query.username - GitHub username or organization
 * @param {string} req.headers.authorization - GitHub Personal Access Token (Bearer token)
 * @param {string} [req.query.type=all] - Repository type filter
 * @param {string} [req.query.sort=updated] - Sort order
 * @param {number} [req.query.per_page=100] - Results per page
 * @param {number} [req.query.page=1] - Page number
 * @returns {Object} Repository list with pagination info
 */
app.get('/api/search-repos', tokenAwareRateLimit, async (req, res) => {
    try {
        let { username, type = 'all', sort = 'updated', per_page = 100, page = 1 } = req.query;
        
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        // Validate username
        username = sanitizeString(username);
        if (!username || !isValidGitHubUsername(username)) {
            logger.warn('Invalid username provided', { username });
            return res.status(400).json({ error: 'Valid username is required' });
        }

        // Validate token format if provided
        if (token && !isValidGitHubToken(token)) {
            logger.warn('Invalid token format');
            return res.status(400).json({ error: 'Invalid token format' });
        }

        // Validate pagination
        const pagination = validatePagination(page, per_page);
        page = pagination.page;
        per_page = pagination.perPage;

        // Validate sort parameter
        const allowedSorts = ['updated', 'created', 'pushed', 'full_name'];
        sort = validateSort(sort, allowedSorts);

        const headers = token ? { 
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        } : {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        // Check if it's an organization or user
        let endpoint = `https://api.github.com/users/${username}/repos`;
        try {
            const userResponse = await axios.get(`https://api.github.com/users/${username}`, { headers });
            if (userResponse.data.type === 'Organization') {
                endpoint = `https://api.github.com/orgs/${username}/repos`;
            }
        } catch {
            // Fallback to user repos if organization check fails
        }

        const response = await axios.get(endpoint, {
            headers,
            params: {
                per_page: Math.min(per_page, 100),
                page,
                sort,
                type,
                direction: 'desc'
            }
        });

        const repos = response.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            clone_url: repo.clone_url,
            ssh_url: repo.ssh_url,
            html_url: repo.html_url,
            private: repo.private,
            fork: repo.fork,
            archived: repo.archived,
            disabled: repo.disabled,
            updated_at: repo.updated_at,
            created_at: repo.created_at,
            pushed_at: repo.pushed_at,
            language: repo.language,
            size: repo.size,
            stargazers_count: repo.stargazers_count,
            watchers_count: repo.watchers_count,
            forks_count: repo.forks_count,
            open_issues_count: repo.open_issues_count,
            license: repo.license,
            topics: repo.topics,
            default_branch: repo.default_branch,
            permissions: repo.permissions
        }));

        // Get rate limit info
        const rateLimitLimit = response.headers['x-ratelimit-limit'];
        const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
        const rateLimitReset = normalizeRateLimitReset(response.headers['x-ratelimit-reset']);

        res.json({ 
            repos,
            pagination: {
                page: parseInt(page),
                per_page: parseInt(per_page),
                total: repos.length,
                has_more: repos.length === parseInt(per_page)
            },
            rate_limit: {
                limit: rateLimitLimit ? Number(rateLimitLimit) : null,
                remaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
                reset: rateLimitReset
            }
        });
    } catch (error) {
        logger.error('Error fetching repositories', error);
        
        if (error.response?.status === 403) {
            res.status(403).json({ 
                error: 'API rate limit exceeded or insufficient permissions',
                rate_limit: {
                    limit: null,
                    remaining: null,
                    reset: normalizeRateLimitReset(error.response.headers?.['x-ratelimit-reset'])
                }
            });
        } else if (error.response?.status === 404) {
            res.status(404).json({ error: 'User not found' });
        } else {
            res.status(500).json({ error: 'Failed to fetch repositories', details: error.message });
        }
    }
});

/**
 * Fork a repository to the authenticated user's account
 * @route POST /api/fork-repo
 * @param {string} req.body.owner - Repository owner username
 * @param {string} req.body.repo - Repository name
 * @param {string} req.body.token - GitHub Personal Access Token
 * @param {string} [req.body.organization] - Optional organization to fork to
 * @returns {Object} Forked repository information
 */
app.post('/api/fork-repo', requireJsonContentType, tokenAwareRateLimit, async (req, res) => {
    try {
        let { owner, repo, token, organization } = req.body;
        
        // Validate inputs
        owner = sanitizeString(owner);
        repo = sanitizeString(repo);
        
        if (!owner || !isValidGitHubUsername(owner)) {
            return res.status(400).json({ error: 'Valid owner is required' });
        }
        
        if (!repo || !isValidRepositoryName(repo)) {
            return res.status(400).json({ error: 'Valid repository name is required' });
        }
        
        if (!token || !isValidGitHubToken(token)) {
            return res.status(400).json({ error: 'Valid token is required' });
        }
        
        if (organization) {
            organization = sanitizeString(organization);
            if (!isValidGitHubUsername(organization)) {
                return res.status(400).json({ error: 'Valid organization name is required' });
            }
        }

        const forkData = organization ? { organization } : {};

        logger.info('Forking repository', { owner, repo, organization });

        const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/forks`, forkData, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CAROMAR-App'
            }
        });

        logger.info('Repository forked successfully', { full_name: response.data.full_name });

        res.json({ 
            success: true, 
            fork_url: response.data.html_url,
            clone_url: response.data.clone_url,
            ssh_url: response.data.ssh_url,
            full_name: response.data.full_name,
            message: 'Repository forked successfully'
        });
    } catch (error) {
        logger.error('Error forking repository', error);
        
        let errorMessage = 'Failed to fork repository';
        let statusCode = 500;

        if (error.response?.status === 403) {
            errorMessage = 'Insufficient permissions or repository already forked';
            statusCode = 403;
        } else if (error.response?.status === 404) {
            errorMessage = 'Repository not found or not accessible';
            statusCode = 404;
        } else if (error.response?.status === 422) {
            errorMessage = 'Repository already exists or cannot be forked';
            statusCode = 422;
        }

        res.status(statusCode).json({ 
            error: errorMessage,
            details: error.response?.data?.message || error.message
        });
    }
});

// New API endpoint to create a merged repository
app.post('/api/create-merged-repo', requireJsonContentType, tokenAwareRateLimit, async (req, res) => {
    let targetRepositoryFullName = null;
    let createdRepositoryFullName = null;
    let headers = null;
    try {
        let {
            name,
            description,
            repositories,
            token,
            private: isPrivate = false,
            target = 'new',
            target_repository: targetRepository,
            merge_strategy: mergeStrategy = MERGE_STRATEGIES.SUBFOLDERS
        } = req.body;

        const validTargets = ['new', 'existing'];
        target = sanitizeString(target);
        if (!validTargets.includes(target)) {
            return res.status(400).json({ error: 'target must be either "new" or "existing"' });
        }

        const validMergeStrategies = Object.values(MERGE_STRATEGIES);
        mergeStrategy = sanitizeString(mergeStrategy);
        if (!validMergeStrategies.includes(mergeStrategy)) {
            return res.status(400).json({ error: `merge_strategy must be one of: ${validMergeStrategies.join(', ')}` });
        }
        
        // Validate inputs
        if (target === 'new') {
            name = sanitizeString(name);
            if (!name || !isValidRepositoryName(name)) {
                return res.status(400).json({ error: 'Valid repository name is required' });
            }
        } else {
            targetRepositoryFullName = sanitizeString(targetRepository);
            const targetParts = targetRepositoryFullName.split('/');

            if (
                targetParts.length !== 2 ||
                !isValidGitHubUsername(targetParts[0]) ||
                !isValidRepositoryName(targetParts[1]) ||
                targetParts[1] === '.' ||
                targetParts[1] === '..'
            ) {
                return res.status(400).json({ error: 'Valid target_repository (owner/repo) is required' });
            }
        }
        
        if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
            return res.status(400).json({ error: 'At least one repository is required' });
        }
        
        if (repositories.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 repositories can be merged at once' });
        }

        if (!token || !isValidGitHubToken(token)) {
            return res.status(400).json({ error: 'Valid token is required' });
        }

        const repositoryValidation = validateMergeRepositoryDescriptors(repositories);
        if (!repositoryValidation.isValid) {
            logger.warn('Invalid merge repository descriptors', { error: repositoryValidation.error });
            return res.status(400).json({ error: repositoryValidation.error });
        }

        const sanitizedRepositories = repositoryValidation.repositories;
        
        description = sanitizeString(description);

        if (target === 'existing') {
            const normalizedTarget = targetRepositoryFullName.toLowerCase();
            const includesTarget = sanitizedRepositories.some(repo => repo.full_name.toLowerCase() === normalizedTarget);
            if (includesTarget) {
                return res.status(400).json({ error: 'target_repository cannot also be included in repositories' });
            }
        }

        headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        let targetRepositoryResponse;

        if (target === 'existing') {
            logger.info('Merging into existing repository', { targetRepositoryFullName, repoCount: sanitizedRepositories.length });
            const [targetOwner, targetRepoName] = targetRepositoryFullName.split('/');
            const existingRepoApiUrl = `https://api.github.com/repos/${encodeURIComponent(targetOwner)}/${encodeURIComponent(targetRepoName)}`;
            const existingRepoResponse = await axios.get(existingRepoApiUrl, { headers });
            const canWrite = Boolean(existingRepoResponse.data?.permissions?.push || existingRepoResponse.data?.permissions?.admin);

            if (!canWrite) {
                return res.status(403).json({ error: 'Insufficient permissions to merge into target_repository' });
            }

            targetRepositoryResponse = existingRepoResponse.data;
        }

        const mergePlan = await buildMergePlan({
            axiosClient: axios,
            headers,
            sourceRepositories: sanitizedRepositories
        });

        if (target === 'new') {
            logger.info('Creating merged repository', { name, repoCount: sanitizedRepositories.length });

            const createRepoResponse = await axios.post('https://api.github.com/user/repos', {
                name,
                description: description || `Merged repository containing: ${sanitizedRepositories.map(r => r.name).join(', ')}`,
                private: isPrivate,
                auto_init: true
            }, {
                headers
            });

            targetRepositoryResponse = createRepoResponse.data;
            createdRepositoryFullName = targetRepositoryResponse.full_name;
            logger.info('Merged repository created successfully', { full_name: targetRepositoryResponse.full_name });
        }

        let targetRepositoryFiles = [];
        let initializeTargetRepository = false;

        try {
            ({ files: targetRepositoryFiles } = await getRepositoryTree(axios, headers, targetRepositoryResponse.full_name));
        } catch (error) {
            if (!(target === 'existing' && error.response?.status === 409)) {
                throw error;
            }

            initializeTargetRepository = true;
            logger.info('Existing target repository is empty; initializing on first merged file', {
                full_name: targetRepositoryResponse.full_name
            });
        }

        const reservedTargetPaths = targetRepositoryFiles.map(file => file.path);
        const mergeSummary = await mergeRepositoriesIntoTarget({
            axiosClient: axios,
            headers,
            sourceRepositories: sanitizedRepositories,
            targetFullName: targetRepositoryResponse.full_name,
            targetBranch: targetRepositoryResponse.default_branch || 'main',
            mergePlan,
            mergeStrategy,
            reservedTargetPaths,
            initializeTargetRepository
        });

        const mergeSubject = target === 'new' ? 'Repository created' : 'Repository updated';
        const mergeMessage = mergeSummary.aborted
            ? `${mergeSubject}, but automatic merge was aborted`
            : (mergeSummary.skippedFiles.length > 0
                ? `${mergeSubject} and partially merged automatically`
                : `${mergeSubject} and merged automatically`);

        res.json({
            success: true,
            repository: {
                name: targetRepositoryResponse.name,
                full_name: targetRepositoryResponse.full_name,
                html_url: targetRepositoryResponse.html_url,
                clone_url: targetRepositoryResponse.clone_url,
                ssh_url: targetRepositoryResponse.ssh_url
            },
            target,
            merge_strategy: mergeStrategy,
            message: mergeMessage,
            automated_merge: mergeSummary
        });
    } catch (error) {
        logger.error('Error creating merged repository', error);

        if (createdRepositoryFullName) {
            try {
                const [createdOwner, createdRepoName] = createdRepositoryFullName.split('/');
                const cleanupUrl = `https://api.github.com/repos/${encodeURIComponent(createdOwner)}/${encodeURIComponent(createdRepoName)}`;
                await axios.delete(cleanupUrl, { headers });
                logger.warn('Deleted partially created repository after merge failure', { full_name: createdRepositoryFullName });
            } catch (cleanupError) {
                logger.error('Failed to delete partially created repository after merge failure', cleanupError);
            }
        }
        
        if (error.statusCode) {
            res.status(error.statusCode).json({
                error: 'Unable to merge the selected repositories automatically',
                details: error.message
            });
        } else if (isRateLimitExceededError(error)) {
            res.status(429).json({
                error: 'GitHub API rate limit exceeded',
                reset_time: error.response?.headers?.['x-ratelimit-reset']
                    ? new Date(error.response.headers['x-ratelimit-reset'] * 1000)
                    : null
            });
        } else if (error.response?.status === 422) {
            res.status(422).json({ 
                error: 'Repository name already exists or is invalid',
                details: error.response?.data?.message || error.message
            });
        } else if (error.response?.status === 403) {
            res.status(403).json({ 
                error: 'Insufficient permissions to complete repository merge',
                details: error.response?.data?.message || error.message
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to complete repository merge',
                details: error.response?.data?.message || error.message
            });
        }
    }
});

// API endpoint to get repository content for preview
app.get('/api/repo-content', tokenAwareRateLimit, async (req, res) => {
    try {
        let { owner, repo, path = '' } = req.query;
        
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        // Validate inputs
        owner = sanitizeString(owner);
        repo = sanitizeString(repo);
        path = sanitizeString(path); // Note: Path is validated by GitHub API as well
        
        if (!owner || !isValidGitHubUsername(owner)) {
            return res.status(400).json({ error: 'Valid owner is required' });
        }
        
        if (!repo || !isValidRepositoryName(repo)) {
            return res.status(400).json({ error: 'Valid repository name is required' });
        }

        if (!isValidRepoPath(path)) {
            return res.status(400).json({ error: 'Valid repository path is required' });
        }

        const headers = token ? {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        } : {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        // Safe: Using official GitHub API with validated parameters
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers
        });

        res.json({ content: response.data });
    } catch (error) {
        logger.error('Error fetching repository content', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to fetch repository content',
            details: error.response?.data?.message || error.message
        });
    }
});

// Enhanced API endpoint to get user info with additional details
app.get('/api/user', tokenAwareRateLimit, async (req, res) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        if (!token || !isValidGitHubToken(token)) {
            return res.status(400).json({ error: 'Valid token is required' });
        }

        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        const userResponse = await axios.get('https://api.github.com/user', { headers });
        
        // Get rate limit info
        const rateLimitResponse = await axios.get('https://api.github.com/rate_limit', { headers });

        res.json({
            username: userResponse.data.login,
            name: userResponse.data.name,
            email: userResponse.data.email,
            avatar_url: userResponse.data.avatar_url,
            bio: userResponse.data.bio,
            company: userResponse.data.company,
            location: userResponse.data.location,
            public_repos: userResponse.data.public_repos,
            public_gists: userResponse.data.public_gists,
            followers: userResponse.data.followers,
            following: userResponse.data.following,
            created_at: userResponse.data.created_at,
            type: userResponse.data.type,
            plan: userResponse.data.plan,
            rate_limit: rateLimitResponse.data.rate
        });
    } catch (error) {
        logger.error('Error fetching user info', error);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid or expired token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'Token lacks required permissions' });
        } else {
            res.status(500).json({ error: 'Failed to fetch user information' });
        }
    }
});

// API endpoint to validate token permissions
app.get('/api/validate-token', tokenAwareRateLimit, async (req, res) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        // Check token validity and permissions
        const response = await axios.get('https://api.github.com/user', { headers });
        
        // Extract scopes from headers
        const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
        
        res.json({
            valid: true,
            scopes,
            required_scopes: ['repo', 'user'],
            has_required_permissions: scopes.includes('repo') && scopes.includes('user'),
            user: {
                login: response.data.login,
                type: response.data.type
            }
        });
    } catch (error) {
        res.json({
            valid: false,
            error: error.response?.data?.message || error.message
        });
    }
});

// API endpoint to analyze repositories
app.post('/api/analyze-repos', requireJsonContentType, tokenAwareRateLimit, async (req, res) => {
    try {
        const { repositories } = req.body;
        
        if (!repositories || !Array.isArray(repositories)) {
            return res.status(400).json({ error: 'Valid repositories array is required' });
        }
        
        const analytics = new RepositoryAnalytics(repositories);
        const report = analytics.generateReport();
        
        logger.info('Repository analysis completed', { count: repositories.length });
        
        res.json({
            success: true,
            analysis: report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error analyzing repositories', error);
        res.status(500).json({ 
            error: 'Failed to analyze repositories',
            details: error.message
        });
    }
});

// API endpoint to compare repositories
app.post('/api/compare-repos', requireJsonContentType, tokenAwareRateLimit, async (req, res) => {
    try {
        const { repositories, mode = 'two' } = req.body;
        
        if (!repositories || !Array.isArray(repositories)) {
            return res.status(400).json({ error: 'Valid repositories array is required' });
        }
        
        let comparison;
        
        if (mode === 'two' && repositories.length === 2) {
            comparison = RepositoryComparison.compareTwo(repositories[0], repositories[1]);
        } else if (mode === 'multiple') {
            comparison = RepositoryComparison.compareMultiple(repositories);
        } else if (mode === 'best') {
            const criteria = req.body.criteria || 'stars';
            comparison = RepositoryComparison.findBest(repositories, criteria);
        } else {
            return res.status(400).json({ 
                error: 'Invalid comparison mode or repository count',
                details: 'Mode "two" requires exactly 2 repositories'
            });
        }
        
        logger.info('Repository comparison completed', { mode, count: repositories.length });
        
        res.json({
            success: true,
            comparison,
            mode,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error comparing repositories', error);
        res.status(500).json({ 
            error: 'Failed to compare repositories',
            details: error.message
        });
    }
});

/**
 * Health check endpoint - optimized for Netlify serverless
 * @route GET /api/health
 * @returns {Object} Health status and metrics
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NETLIFY ? 'netlify-serverless' : 'local',
        version: require('./package.json').version,
        uptime: process.uptime()
    });
});

/**
 * Get performance metrics (useful for monitoring)
 * @route GET /api/metrics
 * @returns {Object} Performance metrics
 */
app.get('/api/metrics', (req, res) => {
    const summary = performanceMonitor.getSummary();
    const allMetrics = performanceMonitor.getAllMetrics();
    
    res.json({
        summary,
        endpoints: allMetrics,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware for undefined routes
app.use((req, res) => {
    logger.warn('Route not found', { path: req.path, method: req.method });
    res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handling middleware
app.use((err, req, res, _next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

// Export the app for Netlify Functions
module.exports = app;

// Only start the server if running locally (not in serverless environment)
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`CAROMAR server is running on http://localhost:${PORT}`);
    });
}
