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
    isValidEmail,
    isValidMergeRepository
};
