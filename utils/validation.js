/**
 * Validation utilities for CAROMAR
 */

/**
 * Validate GitHub username format
 * @param {string} username - GitHub username to validate
 * @returns {boolean} - True if valid
 */
function isValidGitHubUsername(username) {
    if (!username || typeof username !== 'string') {
        return false;
    }
    // GitHub username rules: alphanumeric + hyphens, 1-39 characters, cannot start/end with hyphen
    const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
    return usernameRegex.test(username);
}

/**
 * Validate repository name format
 * @param {string} repoName - Repository name to validate
 * @returns {boolean} - True if valid
 */
function isValidRepositoryName(repoName) {
    if (!repoName || typeof repoName !== 'string') {
        return false;
    }
    // Repository name rules: alphanumeric + hyphens/underscores/dots, 1-100 characters
    const repoNameRegex = /^[a-zA-Z0-9._-]{1,100}$/;
    return repoNameRegex.test(repoName);
}

/**
 * Validate GitHub token format
 * @param {string} token - GitHub token to validate
 * @returns {boolean} - True if valid format
 */
function isValidGitHubToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    // GitHub tokens are typically 40-255 characters
    // Classic tokens start with ghp_, fine-grained start with github_pat_
    return token.length >= 40 && token.length <= 255;
}

/**
 * Sanitize string input to prevent XSS
 * @param {string} input - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .trim()
        .substring(0, 1000); // Limit length
}

/**
 * Validate GitHub repository path
 * Allows nested paths within a repository while preventing path traversal.
 * @param {string} repoPath - Path within the repository
 * @returns {boolean} - True if valid
 */
function isValidRepoPath(repoPath) {
    // Empty or undefined path is allowed (root of the repository)
    if (repoPath === undefined || repoPath === null || repoPath === '') {
        return true;
    }
    if (typeof repoPath !== 'string') {
        return false;
    }
    // Disallow backslashes and leading slash
    if (repoPath.startsWith('/') || repoPath.includes('\\')) {
        return false;
    }
    // Disallow any path traversal segment
    const segments = repoPath.split('/');
    if (segments.some(segment => segment === '..')) {
        return false;
    }
    // Allow only common filename/path characters
    const repoPathRegex = /^[a-zA-Z0-9._/-]{1,1000}$/;
    return repoPathRegex.test(repoPath);
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} perPage - Items per page
 * @returns {object} - Validated parameters
 */
function validatePagination(page, perPage) {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validPerPage = Math.min(100, Math.max(1, parseInt(perPage) || 30));
    return { page: validPage, perPage: validPerPage };
}

/**
 * Validate sort parameter
 * @param {string} sort - Sort parameter
 * @param {Array<string>} allowedValues - Allowed sort values
 * @returns {string} - Validated sort parameter
 */
function validateSort(sort, allowedValues) {
    if (!sort || !allowedValues.includes(sort)) {
        return allowedValues[0] || 'updated';
    }
    return sort;
}

/**
 * Parse and validate a GitHub HTTPS clone URL.
 * Restricts merge inputs to HTTPS GitHub repository URLs and rejects unexpected remote targets
 * to reduce SSRF-style risk and ensure server-side merges only operate on supported GitHub clones.
 * @param {string} cloneUrl - Clone URL to validate
 * @returns {{owner: string, repositoryName: string} | null} - Parsed owner/repo when valid, otherwise null
 */
function parseGitHubCloneUrl(cloneUrl) {
    try {
        const parsedUrl = new URL(cloneUrl);
        if (
            parsedUrl.protocol !== 'https:' ||
            parsedUrl.hostname !== 'github.com' ||
            parsedUrl.search ||
            parsedUrl.hash
        ) {
            return null;
        }

        const pathSegments = parsedUrl.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        if (pathSegments.length !== 2) {
            return null;
        }

        const [owner, repositoryNameWithSuffix] = pathSegments;
        const repositoryName = repositoryNameWithSuffix.endsWith('.git')
            ? repositoryNameWithSuffix.slice(0, -4)
            : repositoryNameWithSuffix;

        if (!isValidGitHubUsername(owner) || !isValidRepositoryName(repositoryName)) {
            return null;
        }

        return {
            owner,
            repositoryName
        };
    } catch {
        return null;
    }
}

function isValidGitHubCloneUrl(cloneUrl) {
    if (!cloneUrl || typeof cloneUrl !== 'string') {
        return false;
    }

    return Boolean(parseGitHubCloneUrl(cloneUrl));
}

/**
 * Validate and sanitize repository descriptors used by merge operations
 * @param {Array<object>} repositories - Repository descriptors from request body
 * @returns {{isValid: boolean, repositories: Array<object>, error: string|null}}
 */
function validateMergeRepositoryDescriptors(repositories) {
    if (!Array.isArray(repositories) || repositories.length === 0) {
        return { isValid: false, repositories: [], error: 'At least one repository is required' };
    }

    const sanitizedRepositories = [];
    const seenNames = new Set();
    const seenFullNames = new Set();

    for (let index = 0; index < repositories.length; index += 1) {
        const repository = repositories[index] || {};
        const sanitizedName = sanitizeString(repository.name);
        const sanitizedFullName = sanitizeString(repository.full_name);
        const sanitizedCloneUrl = sanitizeString(repository.clone_url);

        if (!sanitizedName || !isValidRepositoryName(sanitizedName) || sanitizedName === '.' || sanitizedName === '..') {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has an invalid name` };
        }

        const fullNameParts = sanitizedFullName.split('/');
        if (
            fullNameParts.length !== 2 ||
            !isValidGitHubUsername(fullNameParts[0]) ||
            !isValidRepositoryName(fullNameParts[1])
        ) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has an invalid full_name` };
        }

        const cloneUrlParts = parseGitHubCloneUrl(sanitizedCloneUrl);
        if (!cloneUrlParts) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has an invalid clone_url` };
        }

        if (`${cloneUrlParts.owner}/${cloneUrlParts.repositoryName}`.toLowerCase() !== sanitizedFullName.toLowerCase()) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has a clone_url that does not match full_name` };
        }

        const normalizedName = sanitizedName.toLowerCase();

        if (seenNames.has(normalizedName)) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has a duplicate name` };
        }

        const normalizedFullName = sanitizedFullName.toLowerCase();

        if (seenFullNames.has(normalizedFullName)) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has a duplicate full_name` };
        }

        seenNames.add(normalizedName);
        seenFullNames.add(normalizedFullName);

        sanitizedRepositories.push({
            name: sanitizedName,
            full_name: sanitizedFullName,
            clone_url: sanitizedCloneUrl
        });
    }

    return { isValid: true, repositories: sanitizedRepositories, error: null };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate a repository descriptor used for manual merge instructions.
 * @param {object} repository - Repository descriptor to validate
 * @returns {boolean} - True if the descriptor is valid and safe to use
 */
function isValidMergeRepository(repository) {
    if (!repository || typeof repository !== 'object' || Array.isArray(repository)) {
        return false;
    }

    const name = typeof repository.name === 'string' ? repository.name.trim() : '';
    const fullName = typeof repository.full_name === 'string' ? repository.full_name.trim() : '';
    const cloneUrl = typeof repository.clone_url === 'string' ? repository.clone_url.trim() : '';

    if (!name || !fullName || !cloneUrl) {
        return false;
    }

    if (!isValidRepositoryName(name) || name === '.' || name === '..') {
        return false;
    }

    const fullNameParts = fullName.split('/');
    if (fullNameParts.length !== 2) {
        return false;
    }

    const [owner, repoName] = fullNameParts;
    if (!isValidGitHubUsername(owner) || !isValidRepositoryName(repoName) || repoName === '.' || repoName === '..') {
        return false;
    }

    if (repoName.toLowerCase() !== name.toLowerCase()) {
        return false;
    }

    try {
        const parsedCloneUrl = new URL(cloneUrl);
        const expectedPath = `/${owner}/${repoName}.git`;

        return parsedCloneUrl.protocol === 'https:' &&
            parsedCloneUrl.hostname === 'github.com' &&
            !parsedCloneUrl.username &&
            !parsedCloneUrl.password &&
            !parsedCloneUrl.port &&
            !parsedCloneUrl.search &&
            !parsedCloneUrl.hash &&
            parsedCloneUrl.pathname.toLowerCase() === expectedPath.toLowerCase();
    } catch {
        return false;
    }
}

module.exports = {
    isValidGitHubUsername,
    isValidRepositoryName,
    isValidGitHubToken,
    sanitizeString,
    isValidRepoPath,
    validatePagination,
    validateSort,
    isValidGitHubCloneUrl,
    validateMergeRepositoryDescriptors,
    isValidEmail
    isValidEmail,
    isValidMergeRepository
};
