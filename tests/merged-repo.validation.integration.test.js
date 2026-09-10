const request = require('supertest');
const axios = require('axios');
const { MAX_MERGE_API_REQUESTS, MAX_MERGE_FILES } = require('../utils/merge-automation');

jest.mock('axios');

const app = require('../server');

describe('Merged Repository Endpoint Validation (Real Server)', () => {
    const validToken = `test_${'x'.repeat(40)}`;

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

    it('rejects reserved dot-segment repository names', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                token: validToken,
                repositories: [
                    {
                        name: '..',
                        full_name: 'octocat/unsafe-repo',
                        clone_url: 'https://github.com/octocat/unsafe-repo.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('invalid name');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects repositories whose clone_url does not match full_name', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                token: validToken,
                repositories: [
                    {
                        name: 'repo-one',
                        full_name: 'octocat/repo-one',
                        clone_url: 'https://github.com/spurs/repo-two.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('clone_url that does not match full_name');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects oversized automated merges before creating the target repository', async () => {
        axios.get.mockImplementation(url => {
            if (url === 'https://api.github.com/repos/octocat/repo-one') {
                return Promise.resolve({ data: { default_branch: 'main' } });
            }

            if (url.includes('/git/trees/main?recursive=1')) {
                return Promise.resolve({
                    data: {
                        truncated: false,
                        tree: Array.from({ length: MAX_MERGE_FILES + 1 }, (_, index) => ({
                            type: 'blob',
                            path: `file-${index}.txt`,
                            sha: `sha-${index}`,
                            size: 20,
                            mode: '100755'
                        }))
                    }
                });
            }

            throw new Error(`Unexpected axios.get URL in test: ${url}`);
        });

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

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Unable to merge');
        expect(response.body.details).toContain(`at most ${MAX_MERGE_FILES} files`);
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects automated merges that would exceed the synchronous GitHub request budget before creating the target repository', async () => {
        const fileCountThatExceedsRequestBudget = Math.floor((MAX_MERGE_API_REQUESTS - 2) / 2);

        axios.get.mockImplementation(url => {
            if (url === 'https://api.github.com/repos/octocat/repo-one') {
                return Promise.resolve({ data: { default_branch: 'main' } });
            }

            if (url.includes('/git/trees/main?recursive=1')) {
                return Promise.resolve({
                    data: {
                        truncated: false,
                        tree: Array.from({ length: fileCountThatExceedsRequestBudget }, (_, index) => ({
                            type: 'blob',
                            path: `file-${index}.txt`,
                            sha: `sha-${index}`,
                            size: 20,
                            mode: '100644'
                        }))
                    }
                });
            }

            throw new Error(`Unexpected axios.get URL in test: ${url}`);
        });

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

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Unable to merge');
        expect(response.body.details).toContain(`at most ${MAX_MERGE_API_REQUESTS} GitHub API requests`);
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

            if (url === 'https://api.github.com/repos/octocat/secure-merge') {
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

            if (url.includes('/octocat/secure-merge/git/trees/main?recursive=1')) {
                return Promise.resolve({
                    data: {
                        truncated: false,
                        tree: []
                    }
                });
            }

            if (url.includes('/git/blobs/blob-sha')) {
                return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64'), encoding: 'base64' } });
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
        expect(response.body.merge_strategy).toBe('subfolders');
        expect(response.body.message).toContain('automatically');
        expect(response.body.automated_merge.mergedFiles).toBe(1);
        expect(response.body.automated_merge.aiInsights).toHaveLength(1);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.put).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid existing target repository format', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                target: 'existing',
                target_repository: 'not-a-valid-target',
                token: validToken,
                repositories: [
                    {
                        name: 'repo-one',
                        full_name: 'octocat/repo-one',
                        clone_url: 'https://github.com/octocat/repo-one.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('target_repository');
    });

    it('rejects unsupported merge strategy values', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                name: 'secure-merge',
                merge_strategy: 'unsupported',
                token: validToken,
                repositories: [
                    {
                        name: 'repo-one',
                        full_name: 'octocat/repo-one',
                        clone_url: 'https://github.com/octocat/repo-one.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('merge_strategy');
    });

    it('merges into an existing repository when target mode is existing', async () => {
        axios.get.mockImplementation(url => {
            if (url === 'https://api.github.com/repos/octocat/repo-one') {
                return Promise.resolve({ data: { default_branch: 'main' } });
            }

            if (url === 'https://api.github.com/repos/octocat/existing-target') {
                return Promise.resolve({
                    data: {
                        name: 'existing-target',
                        full_name: 'octocat/existing-target',
                        html_url: 'https://github.com/octocat/existing-target',
                        clone_url: 'https://github.com/octocat/existing-target.git',
                        ssh_url: 'git@github.com:octocat/existing-target.git',
                        default_branch: 'main',
                        permissions: {
                            push: true
                        }
                    }
                });
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

            if (url.includes('/octocat/existing-target/git/trees/main?recursive=1')) {
                return Promise.resolve({
                    data: {
                        truncated: false,
                        tree: []
                    }
                });
            }

            if (url.includes('/git/blobs/blob-sha')) {
                return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64'), encoding: 'base64' } });
            }

            throw new Error(`Unexpected axios.get URL in test: ${url}`);
        });

        axios.put.mockResolvedValue({ data: { content: { path: 'README.md' } } });

        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                target: 'existing',
                target_repository: 'octocat/existing-target',
                merge_strategy: 'cohesive',
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
        expect(response.body.target).toBe('existing');
        expect(response.body.merge_strategy).toBe('cohesive');
        expect(response.body.repository.full_name).toBe('octocat/existing-target');
        expect(response.body.message).toContain('updated');
        expect(axios.post).not.toHaveBeenCalled();
        expect(axios.put).toHaveBeenCalledTimes(1);
    });

    it('rejects merging into an existing repository without write permissions', async () => {
        axios.get.mockImplementation(url => {
            if (url === 'https://api.github.com/repos/octocat/repo-one') {
                return Promise.resolve({ data: { default_branch: 'main' } });
            }

            if (url === 'https://api.github.com/repos/octocat/existing-target') {
                return Promise.resolve({
                    data: {
                        full_name: 'octocat/existing-target',
                        default_branch: 'main',
                        permissions: {
                            push: false,
                            admin: false
                        }
                    }
                });
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

            throw new Error(`Unexpected axios.get URL in test: ${url}`);
        });

        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                target: 'existing',
                target_repository: 'octocat/existing-target',
                token: validToken,
                repositories: [
                    {
                        name: 'repo-one',
                        full_name: 'octocat/repo-one',
                        clone_url: 'https://github.com/octocat/repo-one.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(403);
        expect(response.body.error).toContain('Insufficient permissions');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects existing-target merges when target repository is included as a source', async () => {
        const response = await request(app)
            .post('/api/create-merged-repo')
            .send({
                target: 'existing',
                target_repository: 'octocat/existing-target',
                token: validToken,
                repositories: [
                    {
                        name: 'existing-target',
                        full_name: 'octocat/existing-target',
                        clone_url: 'https://github.com/octocat/existing-target.git'
                    }
                ]
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('target_repository cannot also be included');
        expect(axios.post).not.toHaveBeenCalled();
    });
});
