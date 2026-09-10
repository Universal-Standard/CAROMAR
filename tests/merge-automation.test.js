const {
    MAX_FILE_SIZE_BYTES,
    MAX_MERGE_FILES,
    MERGE_STRATEGIES,
    normalizeBase64Content,
    getBase64DecodedByteLength,
    buildMergePlan,
    encodeContentPath,
    inferRepositoryCapabilities,
    computeRepositoryRiskScore,
    generateAIMergeInsights,
    getRepositoryTree,
    mergeRepositoriesIntoTarget
} = require('../utils/merge-automation');

describe('Merge Automation Utilities', () => {
    it('normalizes base64 content by removing line breaks and whitespace', () => {
        expect(normalizeBase64Content('YWJj\r\nZ GVm\n')).toBe('YWJjZGVm');
    });

    it('encodes nested content path safely', () => {
        expect(encodeContentPath('repo name/src/file one.js')).toBe('repo%20name/src/file%20one.js');
    });

    it('calculates decoded byte length from base64', () => {
        expect(getBase64DecodedByteLength(Buffer.from('hello').toString('base64'))).toBe(5);
    });

    it('returns null for malformed base64 payloads', () => {
        expect(getBase64DecodedByteLength('abc')).toBeNull();
        expect(getBase64DecodedByteLength('YWJj*')).toBeNull();
    });

    it('infers repository capabilities from file paths', () => {
        const capabilities = inferRepositoryCapabilities([
            { path: 'src/components/App.tsx' },
            { path: '.github/workflows/ci.yml' },
            { path: 'openapi.yaml' }
        ]);

        expect(capabilities).toEqual(expect.arrayContaining(['frontend', 'ci_cd', 'api']));
    });

    it('computes repository risk score using skipped files and merge count', () => {
        expect(computeRepositoryRiskScore({ mergedFiles: 5, skippedFiles: [] })).toBeGreaterThan(0);
        expect(computeRepositoryRiskScore({ mergedFiles: 0, skippedFiles: ['failure'] })).toBeGreaterThan(0.4);
    });

    it('uses precomputed risk score when generating AI merge insights', () => {
        const insights = generateAIMergeInsights([
            { full_name: 'octocat/repo-a', skippedFiles: [], mergedFiles: 3, riskScore: 0.33 }
        ]);

        expect(insights[0].riskScore).toBe(0.33);
    });

    it('fails when GitHub tree response is truncated', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({ data: { truncated: true, tree: [] } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            })
        };

        await expect(getRepositoryTree(axiosClient, {}, 'octocat/repo-a'))
            .rejects.toThrow('truncated');
    });

    it('fails planning when the total merge file count exceeds the budget', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a' || url === 'https://api.github.com/repos/octocat/repo-b') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/octocat/repo-a/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: Array.from({ length: MAX_MERGE_FILES }, (_, index) => ({
                                type: 'blob',
                                path: `file-${index}.txt`,
                                sha: `sha-a-${index}`,
                                size: 1
                            }))
                        }
                    });
                }

                if (url.includes('/octocat/repo-b/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'overflow.txt', sha: 'sha-overflow', size: 1 }
                            ]
                        }
                    });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            })
        };

        await expect(buildMergePlan({
            axiosClient,
            headers: {},
            sourceRepositories: [
                { name: 'repo-a', full_name: 'octocat/repo-a' },
                { name: 'repo-b', full_name: 'octocat/repo-b' }
            ]
        })).rejects.toThrow(`at most ${MAX_MERGE_FILES} files`);
    });

    it('continues merging remaining files when one file fails', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'tests/ok.test.js', sha: 'sha-ok', size: 32, mode: '100644' },
                                { type: 'blob', path: 'bad.bin', sha: 'sha-bad', size: 64, mode: '100644' },
                                { type: 'blob', path: 'large.bin', sha: 'sha-large', size: MAX_FILE_SIZE_BYTES + 1, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-ok')) {
                    return Promise.resolve({ data: { content: Buffer.from('small').toString('base64'), encoding: 'base64' } });
                }

                if (url.includes('/git/blobs/sha-bad')) {
                    return Promise.reject(new Error('blob fetch failed'));
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.mergedFiles).toBe(1);
        expect(result.skippedFiles.length).toBe(2);
        expect(result.skippedFiles.some(reason => reason.includes('blob fetch failed'))).toBe(true);
        expect(result.skippedFiles.some(reason => reason.includes('exceeds'))).toBe(true);
        expect(axiosClient.put).toHaveBeenCalledTimes(1);
    });

    it('skips oversized blobs even when tree size is missing', async () => {
        const oversizedContent = Buffer.alloc(MAX_FILE_SIZE_BYTES + 10, 1).toString('base64');
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'missing-size.bin', sha: 'sha-big', mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-big')) {
                    return Promise.resolve({ data: { content: oversizedContent, encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.mergedFiles).toBe(0);
        expect(result.skippedFiles.some(reason => reason.includes('exceeds'))).toBe(true);
        expect(axiosClient.put).not.toHaveBeenCalled();
    });

    it('aborts remaining work after a GitHub rate-limit response', async () => {
        const rateLimitError = new Error('API rate limit exceeded');
        rateLimitError.response = {
            status: 403,
            headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': '1735689600'
            },
            data: {
                message: 'API rate limit exceeded'
            }
        };

        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'README.md', sha: 'sha-1', size: 10, mode: '100644' },
                                { type: 'blob', path: 'SECOND.md', sha: 'sha-2', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-1')) {
                    return Promise.reject(rateLimitError);
                }

                if (url.includes('/git/blobs/sha-2')) {
                    return Promise.resolve({ data: { content: Buffer.from('ok').toString('base64'), encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.aborted).toBe(true);
        expect(result.abortReason).toContain('rate limit exhausted');
        expect(result.mergedFiles).toBe(0);
        expect(axiosClient.put).not.toHaveBeenCalled();
        expect(axiosClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/git/blobs/sha-2'));
    });

    it('skips unsupported git blob modes that cannot be recreated via contents API', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'bin/run.sh', sha: 'sha-run', size: 12, mode: '100755' },
                                { type: 'blob', path: 'current-link', sha: 'sha-link', size: 10, mode: '120000' },
                                { type: 'blob', path: 'README.md', sha: 'sha-readme', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-readme')) {
                    return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64'), encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.mergedFiles).toBe(1);
        expect(result.skippedFiles.some(reason => reason.includes('git mode 100755 cannot be recreated via contents API'))).toBe(true);
        expect(result.skippedFiles.some(reason => reason.includes('git mode 120000 cannot be recreated via contents API'))).toBe(true);
        expect(axiosClient.put).toHaveBeenCalledTimes(1);
    });

    it('skips blobs returned with unsupported encodings', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'README.md', sha: 'sha-readme', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-readme')) {
                    return Promise.resolve({ data: { content: 'hello', encoding: 'utf-8' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.mergedFiles).toBe(0);
        expect(result.skippedFiles.some(reason => reason.includes('unsupported blob encoding utf-8'))).toBe(true);
        expect(axiosClient.put).not.toHaveBeenCalled();
    });

    it('skips blobs returned with malformed base64 payloads', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'README.md', sha: 'sha-readme', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-readme')) {
                    return Promise.resolve({ data: { content: 'abc', encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        const result = await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main'
        });

        expect(result.mergedFiles).toBe(0);
        expect(result.skippedFiles.some(reason => reason.includes('unsupported base64 payload'))).toBe(true);
        expect(axiosClient.put).not.toHaveBeenCalled();
    });

    it('uses cohesive strategy to merge into target root', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'README.md', sha: 'sha-readme', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-readme')) {
                    return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64'), encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main',
            mergeStrategy: MERGE_STRATEGIES.COHESIVE
        });

        const targetUrl = axiosClient.put.mock.calls[0][0];
        expect(targetUrl).toContain('/contents/README.md');
    });

    it('falls back to source folder on cohesive path conflicts', async () => {
        const axiosClient = {
            get: jest.fn(url => {
                if (url === 'https://api.github.com/repos/octocat/repo-a' || url === 'https://api.github.com/repos/octocat/repo-b') {
                    return Promise.resolve({ data: { default_branch: 'main' } });
                }

                if (url.includes('/octocat/repo-a/git/trees/main?recursive=1') || url.includes('/octocat/repo-b/git/trees/main?recursive=1')) {
                    return Promise.resolve({
                        data: {
                            tree: [
                                { type: 'blob', path: 'README.md', sha: url.includes('repo-a') ? 'sha-a' : 'sha-b', size: 10, mode: '100644' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-a') || url.includes('/git/blobs/sha-b')) {
                    return Promise.resolve({ data: { content: Buffer.from('hello').toString('base64'), encoding: 'base64' } });
                }

                throw new Error(`Unexpected get URL: ${url}`);
            }),
            put: jest.fn(() => Promise.resolve({ data: {} }))
        };

        await mergeRepositoriesIntoTarget({
            axiosClient,
            headers: {},
            sourceRepositories: [
                {
                    name: 'repo-a',
                    full_name: 'octocat/repo-a',
                    clone_url: 'https://github.com/octocat/repo-a.git'
                },
                {
                    name: 'repo-b',
                    full_name: 'octocat/repo-b',
                    clone_url: 'https://github.com/octocat/repo-b.git'
                }
            ],
            targetFullName: 'octocat/merged-repo',
            targetBranch: 'main',
            mergeStrategy: MERGE_STRATEGIES.COHESIVE
        });

        expect(axiosClient.put).toHaveBeenCalledTimes(2);
        const targetUrls = axiosClient.put.mock.calls.map(call => call[0]);
        expect(targetUrls.some(url => url.includes('/contents/README.md'))).toBe(true);
        expect(targetUrls.some(url => url.includes('/contents/repo-b/README.md'))).toBe(true);
    });
});
