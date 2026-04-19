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
const { mergeRepositoriesIntoTarget } = require('./utils/merge-automation');
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

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor();

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

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

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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

// Set view engine - use VIEWS_PATH for Netlify serverless compatibility
app.set('view engine', 'ejs');
app.set('views', process.env.VIEWS_PATH || path.join(__dirname, 'views'));

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
app.get('/api/search-repos', async (req, res) => {
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
        const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
        const rateLimitReset = response.headers['x-ratelimit-reset'];

        res.json({ 
            repos,
            pagination: {
                page: parseInt(page),
                per_page: parseInt(per_page),
                total: repos.length,
                has_more: repos.length === parseInt(per_page)
            },
            rate_limit: {
                remaining: rateLimitRemaining,
                reset: rateLimitReset ? new Date(rateLimitReset * 1000) : null
            }
        });
    } catch (error) {
        logger.error('Error fetching repositories', error);
        
        if (error.response?.status === 403) {
            res.status(403).json({ 
                error: 'API rate limit exceeded or insufficient permissions',
                reset_time: error.response.headers['x-ratelimit-reset'] ? 
                    new Date(error.response.headers['x-ratelimit-reset'] * 1000) : null
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
app.post('/api/fork-repo', async (req, res) => {
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
app.post('/api/create-merged-repo', async (req, res) => {
    try {
        let { name, description, repositories, token, private: isPrivate = false } = req.body;
        
        // Validate inputs
        name = sanitizeString(name);
        if (!name || !isValidRepositoryName(name)) {
            return res.status(400).json({ error: 'Valid repository name is required' });
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

        logger.info('Creating merged repository', { name, repoCount: sanitizedRepositories.length });

        // Create the new repository
        const createRepoResponse = await axios.post('https://api.github.com/user/repos', {
            name,
            description: description || `Merged repository containing: ${sanitizedRepositories.map(r => r.name).join(', ')}`,
            private: isPrivate,
            auto_init: true
        }, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CAROMAR-App'
            }
        });

        const newRepo = createRepoResponse.data;

        logger.info('Merged repository created successfully', { full_name: newRepo.full_name });

        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CAROMAR-App'
        };

        const mergeSummary = await mergeRepositoriesIntoTarget({
            axiosClient: axios,
            headers,
            sourceRepositories: sanitizedRepositories,
            targetFullName: newRepo.full_name,
            targetBranch: newRepo.default_branch || 'main'
        });

        res.json({
            success: true,
            repository: {
                name: newRepo.name,
                full_name: newRepo.full_name,
                html_url: newRepo.html_url,
                clone_url: newRepo.clone_url,
                ssh_url: newRepo.ssh_url
            },
            message: 'Repository created and merged automatically',
            automated_merge: mergeSummary
        });
    } catch (error) {
        logger.error('Error creating merged repository', error);
        
        if (error.response?.status === 422) {
            res.status(422).json({ 
                error: 'Repository name already exists or is invalid',
                details: error.response?.data?.message || error.message
            });
        } else if (error.response?.status === 403) {
            res.status(403).json({ 
                error: 'Insufficient permissions to create repository',
                details: error.response?.data?.message || error.message
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to create merged repository',
                details: error.response?.data?.message || error.message
            });
        }
    }
});

// API endpoint to get repository content for preview
app.get('/api/repo-content', async (req, res) => {
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
app.get('/api/user', async (req, res) => {
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
app.get('/api/validate-token', async (req, res) => {
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
app.post('/api/analyze-repos', async (req, res) => {
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
app.post('/api/compare-repos', async (req, res) => {
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
