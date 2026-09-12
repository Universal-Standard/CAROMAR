/**
 * Security utilities for CAROMAR
 * Provides enhanced security features and validation
 * @module utils/security
 */

/**
 * Check if a string contains potentially dangerous patterns
 * @param {string} input - String to check
 * @returns {boolean} - True if suspicious patterns detected
 */
function containsSuspiciousPatterns(input) {
    if (typeof input !== 'string') {
        return false;
    }
    
    const dangerousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /on\w+\s*=/i, // Event handlers like onclick=
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /eval\s*\(/i,
        /document\.cookie/i,
        /window\.location/i
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Validate and sanitize URL parameters
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is safe
 */
function isValidURL(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    try {
        const parsedURL = new URL(url);
        // Only allow https and http protocols
        return ['http:', 'https:'].includes(parsedURL.protocol);
    } catch {
        return false;
    }
}

/**
 * Rate limit check per user/token
 * Simple in-memory rate limiter (use Redis in production)
 */
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.windowMs = 60 * 1000; // 1 minute
        this.maxRequests = 60; // 60 requests per minute per token
        
        // Clean up old entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
        
        // Allow cleanup interval to not block process exit
        this.cleanupInterval.unref();
    }
    
    /**
     * Check if request should be allowed
     * @param {string} identifier - Unique identifier (token hash, IP, etc.)
     * @returns {boolean} - True if request is allowed
     */
    checkLimit(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];
        
        // Filter out old requests
        const recentRequests = userRequests.filter(
            timestamp => now - timestamp < this.windowMs
        );
        
        if (recentRequests.length >= this.maxRequests) {
            return false;
        }
        
        recentRequests.push(now);
        this.requests.set(identifier, recentRequests);
        return true;
    }
    
    /**
     * Clean up expired entries
     * @private
     */
    cleanup() {
        const now = Date.now();
        for (const [identifier, timestamps] of this.requests.entries()) {
            const recent = timestamps.filter(
                timestamp => now - timestamp < this.windowMs
            );
            if (recent.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, recent);
            }
        }
    }
    
    /**
     * Get remaining requests for identifier
     * @param {string} identifier - Unique identifier
     * @returns {number} - Remaining requests in current window
     */
    getRemaining(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];
        const recentRequests = userRequests.filter(
            timestamp => now - timestamp < this.windowMs
        );
        return Math.max(0, this.maxRequests - recentRequests.length);
    }
}

/**
 * Hash a string securely for rate limiting
 * Uses Node.js crypto module for cryptographically secure hashing
 * @param {string} input - String to hash
 * @returns {string} - Hashed string
 */
function simpleHash(input) {
    if (!input || input.length === 0) return '0';
    
    // Use crypto module for secure hashing
    const crypto = require('crypto');
    return crypto.createHash('sha256')
        .update(input)
        .digest('hex')
        .substring(0, 16); // Use first 16 chars for shorter identifier
}

/**
 * Validate request origin for CSRF protection
 * @param {string} origin - Request origin header
 * @param {Array<string>} allowedOrigins - List of allowed origins
 * @returns {boolean} - True if origin is allowed
 */
function isAllowedOrigin(origin, allowedOrigins = []) {
    if (!origin) return true; // Allow same-origin requests
    
    // Check if origin is in allowed list
    return allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.endsWith('*')) {
            const prefix = allowed.slice(0, -1);
            return origin.startsWith(prefix);
        }
        return origin === allowed;
    });
}

/**
 * Sanitize object to prevent prototype pollution.
 * Recurses into plain objects (removing __proto__/constructor/prototype
 * own-keys at every level) and into arrays (preserving array-ness and
 * element order — a naive Object.entries()-based rebuild would otherwise
 * collapse arrays into {"0": ..., "1": ...} plain objects, silently
 * breaking any downstream Array.isArray() check on the sanitized value).
 * @param {*} obj - Value to sanitize
 * @returns {*} - Sanitized value, with arrays remaining arrays
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (!dangerousKeys.includes(key)) {
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    
    return sanitized;
}

/**
 * Validate Content-Type header
 * @param {string} contentType - Content-Type header value
 * @param {Array<string>} allowed - Allowed content types
 * @returns {boolean} - True if content type is allowed
 */
function isAllowedContentType(contentType, allowed = ['application/json']) {
    if (!contentType) return false;
    
    // Extract base content type (remove charset, etc.)
    const baseType = contentType.split(';')[0].trim().toLowerCase();
    return allowed.some(type => baseType === type.toLowerCase());
}

module.exports = {
    containsSuspiciousPatterns,
    isValidURL,
    RateLimiter,
    simpleHash,
    isAllowedOrigin,
    sanitizeObject,
    isAllowedContentType
};
