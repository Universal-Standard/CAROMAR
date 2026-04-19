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
 * Validate GitHub clone URL format
 * Restricts merge inputs to HTTPS GitHub repository URLs and rejects unexpected remote targets
 * to reduce SSRF-style risk and ensure server-side merges only operate on supported GitHub clones.
 * @param {string} cloneUrl - Clone URL to validate
 * @returns {boolean} - True if valid GitHub HTTPS clone URL
 */
function isValidGitHubCloneUrl(cloneUrl) {
    if (!cloneUrl || typeof cloneUrl !== 'string') {
        return false;
    }

    const gitHubCloneUrlRegex = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
    return gitHubCloneUrlRegex.test(cloneUrl);
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

        if (!sanitizedName || !isValidRepositoryName(sanitizedName)) {
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

        if (!isValidGitHubCloneUrl(sanitizedCloneUrl)) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has an invalid clone_url` };
        }

        if (seenNames.has(sanitizedName)) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has a duplicate name` };
        }

        if (seenFullNames.has(sanitizedFullName)) {
            return { isValid: false, repositories: [], error: `Repository at index ${index} has a duplicate full_name` };
        }

        seenNames.add(sanitizedName);
        seenFullNames.add(sanitizedFullName);

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
};
