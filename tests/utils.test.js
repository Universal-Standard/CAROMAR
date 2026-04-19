const RepositoryAnalytics = require('../utils/analytics');
const RepositoryComparison = require('../utils/comparison');
const { 
    isValidGitHubUsername, 
    isValidRepositoryName, 
    isValidGitHubToken,
    sanitizeString,
    validatePagination,
    validateSort,
    isValidGitHubCloneUrl,
    validateMergeRepositoryDescriptors
} = require('../utils/validation');

describe('Validation Utilities', () => {
    describe('isValidGitHubUsername', () => {
        it('should validate correct usernames', () => {
            expect(isValidGitHubUsername('octocat')).toBe(true);
            expect(isValidGitHubUsername('my-user')).toBe(true);
            expect(isValidGitHubUsername('user123')).toBe(true);
        });

        it('should reject invalid usernames', () => {
            expect(isValidGitHubUsername('-invalid')).toBe(false);
            expect(isValidGitHubUsername('invalid-')).toBe(false);
            expect(isValidGitHubUsername('')).toBe(false);
            expect(isValidGitHubUsername('a'.repeat(40))).toBe(false); // too long
        });
    });

    describe('isValidRepositoryName', () => {
        it('should validate correct repository names', () => {
            expect(isValidRepositoryName('hello-world')).toBe(true);
            expect(isValidRepositoryName('my.repo')).toBe(true);
            expect(isValidRepositoryName('repo_name')).toBe(true);
        });

        it('should reject invalid repository names', () => {
            expect(isValidRepositoryName('')).toBe(false);
            expect(isValidRepositoryName('a'.repeat(101))).toBe(false); // too long
        });
    });

    describe('isValidGitHubToken', () => {
        it('should validate token format', () => {
            const validToken = 'ghp_' + 'a'.repeat(40);
            expect(isValidGitHubToken(validToken)).toBe(true);
        });

        it('should reject invalid tokens', () => {
            expect(isValidGitHubToken('short')).toBe(false);
            expect(isValidGitHubToken('')).toBe(false);
            expect(isValidGitHubToken('a'.repeat(300))).toBe(false); // too long
        });
    });

    describe('sanitizeString', () => {
        it('should remove dangerous characters', () => {
            expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
            expect(sanitizeString('  hello  ')).toBe('hello');
        });

        it('should handle non-strings', () => {
            expect(sanitizeString(123)).toBe('');
            expect(sanitizeString(null)).toBe('');
        });
    });

    describe('validatePagination', () => {
        it('should return valid pagination parameters', () => {
            const result = validatePagination(5, 50);
            expect(result.page).toBe(5);
            expect(result.perPage).toBe(50);
        });

        it('should enforce limits', () => {
            const result = validatePagination(0, 200);
            expect(result.page).toBe(1); // min page
            expect(result.perPage).toBe(100); // max perPage
        });
    });

    describe('isValidGitHubCloneUrl', () => {
        it('should validate GitHub clone URLs', () => {
            expect(isValidGitHubCloneUrl('https://github.com/octocat/hello-world.git')).toBe(true);
            expect(isValidGitHubCloneUrl('https://github.com/octocat/hello-world')).toBe(true);
        });

        it('should reject non-GitHub or malformed clone URLs', () => {
            expect(isValidGitHubCloneUrl('https://gitlab.com/octocat/hello-world.git')).toBe(false);
            expect(isValidGitHubCloneUrl('ssh://github.com/octocat/hello-world.git')).toBe(false);
            expect(isValidGitHubCloneUrl('javascript:alert(1)')).toBe(false);
        });
    });

    describe('validateMergeRepositoryDescriptors', () => {
        it('should validate and sanitize repository descriptors', () => {
            const result = validateMergeRepositoryDescriptors([
                {
                    name: 'repo-one',
                    full_name: 'octocat/repo-one',
                    clone_url: 'https://github.com/octocat/repo-one.git'
                }
            ]);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
            expect(result.repositories).toHaveLength(1);
            expect(result.repositories[0].name).toBe('repo-one');
        });

        it('should fail on invalid repository descriptor', () => {
            const result = validateMergeRepositoryDescriptors([
                {
                    name: 'repo-one',
                    full_name: 'octocat/repo-one',
                    clone_url: 'https://evil.example.com/repo-one.git'
                }
            ]);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('invalid clone_url');
            expect(result.repositories).toHaveLength(0);
        });

        it('should fail when repository name is duplicated', () => {
            const result = validateMergeRepositoryDescriptors([
                {
                    name: 'repo-one',
                    full_name: 'octocat/repo-one',
                    clone_url: 'https://github.com/octocat/repo-one.git'
                },
                {
                    name: 'repo-one',
                    full_name: 'spurs/repo-one-alt',
                    clone_url: 'https://github.com/spurs/repo-one-alt.git'
                }
            ]);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('duplicate name');
        });
    });

    describe('validateSort', () => {
        it('should return valid sort parameter', () => {
            const allowed = ['updated', 'created', 'name'];
            expect(validateSort('updated', allowed)).toBe('updated');
            expect(validateSort('created', allowed)).toBe('created');
        });

        it('should return default for invalid sort', () => {
            const allowed = ['updated', 'created', 'name'];
            expect(validateSort('invalid', allowed)).toBe('updated');
            expect(validateSort(null, allowed)).toBe('updated');
        });
    });
});

describe('Repository Analytics', () => {
    const sampleRepos = [
        {
            name: 'repo1',
            stargazers_count: 100,
            forks_count: 20,
            watchers_count: 50,
            size: 1000,
            open_issues_count: 5,
            language: 'JavaScript',
            private: false,
            fork: false,
            archived: false,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        },
        {
            name: 'repo2',
            stargazers_count: 50,
            forks_count: 10,
            watchers_count: 25,
            size: 500,
            open_issues_count: 2,
            language: 'Python',
            private: true,
            fork: false,
            archived: false,
            created_at: '2023-06-01T00:00:00Z',
            updated_at: '2024-02-01T00:00:00Z'
        }
    ];

    describe('getTotalStats', () => {
        it('should calculate total statistics', () => {
            const analytics = new RepositoryAnalytics(sampleRepos);
            const stats = analytics.getTotalStats();
            
            expect(stats.totalRepos).toBe(2);
            expect(stats.totalStars).toBe(150);
            expect(stats.totalForks).toBe(30);
            expect(stats.privateRepos).toBe(1);
        });
    });

    describe('getLanguageDistribution', () => {
        it('should return language distribution', () => {
            const analytics = new RepositoryAnalytics(sampleRepos);
            const languages = analytics.getLanguageDistribution();
            
            expect(languages.JavaScript).toBe(1);
            expect(languages.Python).toBe(1);
        });
    });

    describe('getMostPopular', () => {
        it('should return most popular repositories', () => {
            const analytics = new RepositoryAnalytics(sampleRepos);
            const popular = analytics.getMostPopular(1);
            
            expect(popular.length).toBe(1);
            expect(popular[0].name).toBe('repo1');
        });
    });

    describe('getAverageMetrics', () => {
        it('should calculate average metrics', () => {
            const analytics = new RepositoryAnalytics(sampleRepos);
            const averages = analytics.getAverageMetrics();
            
            expect(averages.avgStars).toBe(75);
            expect(averages.avgForks).toBe(15);
        });
    });
});

describe('Repository Comparison', () => {
    const repo1 = {
        name: 'repo1',
        stargazers_count: 100,
        forks_count: 20,
        watchers_count: 50,
        size: 1000,
        open_issues_count: 5,
        language: 'JavaScript',
        private: false,
        fork: false,
        archived: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        topics: ['javascript', 'nodejs'],
        license: { name: 'MIT' }
    };

    const repo2 = {
        name: 'repo2',
        stargazers_count: 50,
        forks_count: 10,
        watchers_count: 25,
        size: 500,
        open_issues_count: 2,
        language: 'JavaScript',
        private: false,
        fork: false,
        archived: false,
        created_at: '2023-06-01T00:00:00Z',
        updated_at: '2024-02-01T00:00:00Z',
        topics: ['javascript', 'typescript'],
        license: { name: 'MIT' }
    };

    describe('compareTwo', () => {
        it('should compare two repositories', () => {
            const comparison = RepositoryComparison.compareTwo(repo1, repo2);
            
            expect(comparison.names.repo1).toBe('repo1');
            expect(comparison.names.repo2).toBe('repo2');
            expect(comparison.metrics.stars.winner).toBe('repo1');
            expect(comparison.attributes.languages.same).toBe(true);
        });
    });

    describe('calculateSimilarity', () => {
        it('should calculate similarity score', () => {
            const similarity = RepositoryComparison.calculateSimilarity(repo1, repo2);
            
            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThanOrEqual(100);
        });
    });

    describe('findBest', () => {
        it('should find best repository by criteria', () => {
            const result = RepositoryComparison.findBest([repo1, repo2], 'stars');
            
            expect(result.best.name).toBe('repo1');
            expect(result.rankings.length).toBe(2);
            expect(result.rankings[0].rank).toBe(1);
        });
    });

    describe('compareMultiple', () => {
        it('should create comparison matrix', () => {
            const matrix = RepositoryComparison.compareMultiple([repo1, repo2]);
            
            expect(matrix.stargazers_count).toBeDefined();
            expect(matrix.stargazers_count.length).toBe(2);
            expect(matrix.stargazers_count[0].rank).toBe(1);
        });
    });
});
