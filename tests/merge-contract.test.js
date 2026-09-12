const request = require('supertest');
const axios = require('axios');

jest.mock('axios');
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logResponse: jest.fn()
}));

const app = require('../server');

describe('Merge and rate-limit contract', () => {
    const validToken = 'ghp_' + 'a'.repeat(40);
    const validRepositories = [
        {
            name: 'repo-one',
            full_name: 'octocat/repo-one',
            clone_url: 'https://github.com/octocat/repo-one.git',
            description: 'Repository one'
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/create-merged-repo', () => {
        it('should reject clone URLs with credentials', async () => {
            const res = await request(app)
                .post('/api/create-merged-repo')
                .send({
                    name: 'merged-repo',
                    repositories: [
                        {
                            ...validRepositories[0],
                            clone_url: 'https://octocat@github.com/octocat/repo-one.git'
                        }
                    ],
                    token: validToken
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('invalid clone_url');
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should reject clone URLs with explicit ports', async () => {
            const res = await request(app)
                .post('/api/create-merged-repo')
                .send({
                    name: 'merged-repo',
                    repositories: [
                        {
                            ...validRepositories[0],
                            clone_url: 'https://github.com:8443/octocat/repo-one.git'
                        }
                    ],
                    token: validToken
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('invalid clone_url');
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should return automated merge messaging for successful repository creation', async () => {
            axios.post.mockResolvedValue({
                data: {
                    name: 'merged-repo',
                    full_name: 'testuser/merged-repo',
                    html_url: 'https://github.com/testuser/merged-repo',
                    clone_url: 'https://github.com/testuser/merged-repo.git',
                    ssh_url: 'git@github.com:testuser/merged-repo.git',
                    default_branch: 'main'
                }
            });

            axios.get.mockImplementation(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-one') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url === 'https://api.github.com/repos/testuser/merged-repo') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/octocat/repo-one/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            truncated: false,
                            tree: [
                                { type: 'blob', path: 'README.md', sha: 'blob-sha', size: 20, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/testuser/merged-repo/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            truncated: false,
                            tree: []
                        }
                    });
                }

                if (url.includes('/git/blobs/blob-sha')) {
                    return Promise.resolve({
                        data: {
                            content: Buffer.from('hello').toString('base64'),
                            encoding: 'base64'
                        }
                    });
                }

                throw new Error(`Unexpected axios.get URL in test: ${url}`);
            });

            axios.put.mockResolvedValue({ data: { content: { path: 'repo-one/README.md' } } });

            const res = await request(app)
                .post('/api/create-merged-repo')
                .send({
                    name: 'merged-repo',
                    repositories: validRepositories,
                    token: validToken
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Repository created and merged automatically');
            expect(res.body.automated_merge.aborted).toBe(false);
            expect(res.body.automated_merge.mergedFiles).toBe(1);
        });
    });

    describe('GET /api/search-repos', () => {
        it('should return numeric rate limit fields safe for frontend formatting', async () => {
            axios.get
                .mockResolvedValueOnce({
                    data: {
                        type: 'User'
                    }
                })
                .mockResolvedValueOnce({
                    data: [
                        {
                            id: 1,
                            name: 'repo-one',
                            full_name: 'octocat/repo-one',
                            description: 'Repository one',
                            clone_url: 'https://github.com/octocat/repo-one.git',
                            ssh_url: 'git@github.com:octocat/repo-one.git',
                            html_url: 'https://github.com/octocat/repo-one',
                            private: false,
                            fork: false,
                            archived: false,
                            disabled: false,
                            updated_at: '2024-01-01T00:00:00Z',
                            created_at: '2024-01-01T00:00:00Z',
                            pushed_at: '2024-01-01T00:00:00Z',
                            language: 'JavaScript',
                            size: 1,
                            stargazers_count: 2,
                            watchers_count: 3,
                            forks_count: 4,
                            open_issues_count: 5,
                            license: null,
                            topics: [],
                            default_branch: 'main',
                            permissions: {}
                        }
                    ],
                    headers: {
                        'x-ratelimit-limit': '5000',
                        'x-ratelimit-remaining': '4999',
                        'x-ratelimit-reset': '1704070800'
                    }
                });

            const res = await request(app)
                .get('/api/search-repos')
                .query({ username: 'octocat' });

            expect(res.statusCode).toBe(200);
            expect(res.body.rate_limit).toEqual({
                limit: 5000,
                remaining: 4999,
                reset: 1704070800
            });
        });

        it('should keep the rate limit error payload aligned with the success contract', async () => {
            const error = new Error('Forbidden');
            error.response = {
                status: 403,
                headers: {
                    'x-ratelimit-reset': '1704070800'
                }
            };

            axios.get
                .mockResolvedValueOnce({
                    data: {
                        type: 'User'
                    }
                })
                .mockRejectedValueOnce(error);

            const res = await request(app)
                .get('/api/search-repos')
                .query({ username: 'octocat' });

            expect(res.statusCode).toBe(403);
            expect(res.body.rate_limit).toEqual({
                limit: null,
                remaining: null,
                reset: 1704070800
            });
        });
    });
});
