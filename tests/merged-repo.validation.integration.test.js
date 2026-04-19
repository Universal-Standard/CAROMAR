const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const app = require('../server');

describe('Merged Repository Endpoint Validation (Real Server)', () => {
    const validToken = `ghp_${'a'.repeat(40)}`;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects repositories with non-GitHub clone URLs', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                token: validToken,
                repositories: [
                    {
                        name: 'unsafe-repo',
                        full_name: 'octocat/unsafe-repo',
                        clone_url: 'https://evil.example.com/repo.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('invalid clone_url');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects duplicate repository names to prevent folder collisions', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                token: validToken,
                repositories: [
                    {
                        name: 'api',
                        full_name: 'octocat/api',
                        clone_url: 'https://github.com/octocat/api.git'
                    },
                    {
                        name: 'api',
                        full_name: 'spurs/api',
                        clone_url: 'https://github.com/spurs/api.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('duplicate name');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('automatically merges repository content when descriptors are valid', async () => {
        axios.post.mockResolvedValue({
            data: {
                name: 'secure-merge',
                full_name: 'octocat/secure-merge',
                html_url: 'https://github.com/octocat/secure-merge',
                clone_url: 'https://github.com/octocat/secure-merge.git',
                ssh_url: 'git@github.com:octocat/secure-merge.git',
                default_branch: 'main'
            }
        });

        axios.get.mockImplementation(url => {
            if (url === 'https://api.github.com/repos/octocat/repo-one') {
                return Promise.resolve({ data: { default_branch: 'main' } });
            }

            if (url.includes('/git/trees/main?recursive=1')) {
                return Promise.resolve({
                    data: {
                        truncated: false,
                        tree: [
                            { type: 'blob', path: 'README.md', sha: 'blob-sha', size: 20 }
                        ]
                    }
                });
            }

            if (url.includes('/git/blobs/blob-sha')) {
                return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64') } });
            }

            throw new Error(`Unexpected axios.get URL in test: ${url}`);
        });

        axios.put.mockResolvedValue({ data: { content: { path: 'repo-one/README.md' } } });

        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                token: validToken,
                repositories: [
                    {
                        name: 'repo-one',
                        full_name: 'octocat/repo-one',
                        clone_url: 'https://github.com/octocat/repo-one.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('automatically');
        expect(response.body.automated_merge.mergedFiles).toBe(1);
        expect(response.body.automated_merge.aiInsights).toHaveLength(1);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.put).toHaveBeenCalledTimes(1);
    });
});
