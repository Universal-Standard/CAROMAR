/**
 * Security utility tests
 */

const {
    containsSuspiciousPatterns,
    isValidURL,
    RateLimiter,
    simpleHash,
    isAllowedOrigin,
    sanitizeObject,
    isAllowedContentType
} = require('../utils/security');

describe('Security Utilities', () => {
    describe('containsSuspiciousPatterns', () => {
        it('should detect javascript: protocol', () => {
            expect(containsSuspiciousPatterns('javascript:alert(1)')).toBe(true);
        });

        it('should detect data: protocol', () => {
            expect(containsSuspiciousPatterns('data:text/html,<script>')).toBe(true);
        });

        it('should detect event handlers', () => {
            expect(containsSuspiciousPatterns('onclick=alert(1)')).toBe(true);
            expect(containsSuspiciousPatterns('onload=malicious()')).toBe(true);
        });

        it('should detect dangerous tags', () => {
            expect(containsSuspiciousPatterns('<iframe src="evil">')).toBe(true);
            expect(containsSuspiciousPatterns('<object data="evil">')).toBe(true);
        });

        it('should allow safe strings', () => {
            expect(containsSuspiciousPatterns('hello world')).toBe(false);
            expect(containsSuspiciousPatterns('user@example.com')).toBe(false);
        });

        it('should handle non-string input', () => {
            expect(containsSuspiciousPatterns(null)).toBe(false);
            expect(containsSuspiciousPatterns(123)).toBe(false);
        });
    });

    describe('isValidURL', () => {
        it('should accept valid HTTP URLs', () => {
            expect(isValidURL('http://example.com')).toBe(true);
            expect(isValidURL('https://github.com/user/repo')).toBe(true);
        });

        it('should reject invalid protocols', () => {
            expect(isValidURL('file:///etc/passwd')).toBe(false);
            expect(isValidURL('ftp://example.com')).toBe(false);
            expect(isValidURL('javascript:alert(1)')).toBe(false);
        });

        it('should reject malformed URLs', () => {
            expect(isValidURL('not a url')).toBe(false);
            expect(isValidURL('')).toBe(false);
            expect(isValidURL(null)).toBe(false);
        });
    });

    describe('RateLimiter', () => {
        let limiter;

        beforeEach(() => {
            limiter = new RateLimiter();
            limiter.maxRequests = 5; // Lower limit for testing
            limiter.windowMs = 1000; // 1 second window
        });

        afterEach(() => {
            // Clean up any intervals to prevent timer leaks
            if (limiter && limiter.cleanupInterval) {
                clearInterval(limiter.cleanupInterval);
            }
        });

        it('should allow requests within limit', () => {
            expect(limiter.checkLimit('user1')).toBe(true);
            expect(limiter.checkLimit('user1')).toBe(true);
            expect(limiter.checkLimit('user1')).toBe(true);
        });

        it('should block requests exceeding limit', () => {
            for (let i = 0; i < 5; i++) {
                limiter.checkLimit('user2');
            }
            expect(limiter.checkLimit('user2')).toBe(false);
        });

        it('should track different users separately', () => {
            for (let i = 0; i < 5; i++) {
                limiter.checkLimit('user3');
            }
            expect(limiter.checkLimit('user3')).toBe(false);
            expect(limiter.checkLimit('user4')).toBe(true);
        });

        it('should return remaining requests', () => {
            limiter.checkLimit('user5');
            limiter.checkLimit('user5');
            const remaining = limiter.getRemaining('user5');
            expect(remaining).toBe(3);
        });

        it('should allow requests after window expires', async () => {
            for (let i = 0; i < 5; i++) {
                limiter.checkLimit('user6');
            }
            expect(limiter.checkLimit('user6')).toBe(false);
            
            // Wait for window to expire
            await new Promise(resolve => setTimeout(resolve, 1100));
            expect(limiter.checkLimit('user6')).toBe(true);
        }, 2000);
    });

    describe('simpleHash', () => {
        it('should generate consistent hash', () => {
            const hash1 = simpleHash('test');
            const hash2 = simpleHash('test');
            expect(hash1).toBe(hash2);
        });

        it('should generate different hashes for different inputs', () => {
            const hash1 = simpleHash('test1');
            const hash2 = simpleHash('test2');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty string', () => {
            const hash = simpleHash('');
            expect(hash).toBeDefined();
        });

        it('should handle null/undefined', () => {
            expect(simpleHash(null)).toBe('0');
            expect(simpleHash(undefined)).toBe('0');
        });
    });

    describe('isAllowedOrigin', () => {
        it('should allow same-origin requests', () => {
            expect(isAllowedOrigin(null, [])).toBe(true);
            expect(isAllowedOrigin(undefined, [])).toBe(true);
        });

        it('should allow wildcard', () => {
            expect(isAllowedOrigin('http://example.com', ['*'])).toBe(true);
        });

        it('should check exact origin match', () => {
            const allowed = ['https://example.com'];
            expect(isAllowedOrigin('https://example.com', allowed)).toBe(true);
            expect(isAllowedOrigin('https://evil.com', allowed)).toBe(false);
        });

        it('should support prefix wildcards', () => {
            const allowed = ['https://example.com*'];
            expect(isAllowedOrigin('https://example.com', allowed)).toBe(true);
            expect(isAllowedOrigin('https://example.com:3000', allowed)).toBe(true);
            expect(isAllowedOrigin('https://evil.com', allowed)).toBe(false);
        });
    });

    describe('sanitizeObject', () => {
        it('should remove dangerous keys', () => {
            const obj = {
                name: 'test',
                constructor: 'evil',
                prototype: 'bad'
            };
            
            const sanitized = sanitizeObject(obj);
            expect(sanitized.name).toBe('test');
            // Check that dangerous keys are not in the sanitized object as own properties
            expect(Object.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
            expect(Object.hasOwnProperty.call(sanitized, 'prototype')).toBe(false);
        });

        it('should handle nested objects', () => {
            const obj = {
                user: {
                    name: 'test',
                    constructor: 'evil',
                    prototype: 'bad'
                }
            };
            
            const sanitized = sanitizeObject(obj);
            expect(sanitized.user.name).toBe('test');
            expect(Object.hasOwnProperty.call(sanitized.user, 'constructor')).toBe(false);
            expect(Object.hasOwnProperty.call(sanitized.user, 'prototype')).toBe(false);
        });

        it('should handle non-objects', () => {
            expect(sanitizeObject(null)).toBe(null);
            expect(sanitizeObject('string')).toBe('string');
            expect(sanitizeObject(123)).toBe(123);
        });

        it('should preserve top-level arrays as arrays', () => {
            const arr = [{ name: 'repo-one' }, { name: 'repo-two' }];
            const sanitized = sanitizeObject(arr);

            expect(Array.isArray(sanitized)).toBe(true);
            expect(sanitized).toHaveLength(2);
            expect(sanitized[0].name).toBe('repo-one');
            expect(sanitized[1].name).toBe('repo-two');
        });

        it('should preserve nested arrays as arrays (regression: array fields must stay Array.isArray-true)', () => {
            // Mirrors the real-world shape of POST /api/create-merged-repo's
            // body: { name, repositories: [ {...}, {...} ], token }.
            // A naive Object.entries()-based rebuild would silently turn
            // `repositories` into {"0": {...}, "1": {...}}, breaking every
            // Array.isArray(repositories) check in server.js.
            const body = {
                name: 'merged-repo',
                repositories: [
                    { name: 'repo-one', full_name: 'octocat/repo-one' },
                    { name: 'repo-two', full_name: 'octocat/repo-two' }
                ],
                token: 'ghp_' + 'a'.repeat(40)
            };

            const sanitized = sanitizeObject(body);

            expect(Array.isArray(sanitized.repositories)).toBe(true);
            expect(sanitized.repositories).toHaveLength(2);
            expect(sanitized.repositories[0].full_name).toBe('octocat/repo-one');
            expect(sanitized.repositories[1].full_name).toBe('octocat/repo-two');
        });

        it('should still strip dangerous keys from objects inside arrays', () => {
            const arr = [{ name: 'ok', constructor: 'evil' }];
            const sanitized = sanitizeObject(arr);

            expect(Array.isArray(sanitized)).toBe(true);
            expect(sanitized[0].name).toBe('ok');
            expect(Object.hasOwnProperty.call(sanitized[0], 'constructor')).toBe(false);
        });
    });

    describe('isAllowedContentType', () => {
        it('should accept allowed content types', () => {
            expect(isAllowedContentType('application/json')).toBe(true);
            expect(isAllowedContentType('application/json; charset=utf-8')).toBe(true);
        });

        it('should reject disallowed content types', () => {
            expect(isAllowedContentType('text/html')).toBe(false);
            expect(isAllowedContentType('application/xml')).toBe(false);
        });

        it('should handle custom allowed types', () => {
            const allowed = ['application/xml', 'text/plain'];
            expect(isAllowedContentType('application/xml', allowed)).toBe(true);
            expect(isAllowedContentType('text/plain', allowed)).toBe(true);
            expect(isAllowedContentType('application/json', allowed)).toBe(false);
        });

        it('should handle missing content type', () => {
            expect(isAllowedContentType(null)).toBe(false);
            expect(isAllowedContentType('')).toBe(false);
        });
    });
});
