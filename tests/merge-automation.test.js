const {
    MAX_FILE_SIZE_BYTES,
    normalizeBase64Content,
    getBase64DecodedByteLength,
    encodeContentPath,
    inferRepositoryCapabilities,
    computeRepositoryRiskScore,
    generateAIMergeInsights,
    getRepositoryTree,
    mergeRepositoriesIntoTarget
} = require('../utils/merge-automation');

describe('Merge Automation Utilities', () => {
    it('normalizes base64 content by removing new lines', () => {
        expect(normalizeBase64Content('YWJj\nZGVm')).toBe('YWJjZGVm');
    });

    it('encodes nested content path safely', () => {
        expect(encodeContentPath('repo name/src/file one.js')).toBe('repo%20name/src/file%20one.js');
    });

    it('calculates decoded byte length from base64', () => {
        expect(getBase64DecodedByteLength(Buffer.from('hello').toString('base64'))).toBe(5);
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
                                { type: 'blob', path: 'tests/ok.test.js', sha: 'sha-ok', size: 32 },
                                { type: 'blob', path: 'bad.bin', sha: 'sha-bad', size: 64 },
                                { type: 'blob', path: 'large.bin', sha: 'sha-large', size: MAX_FILE_SIZE_BYTES + 1 }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-ok')) {
                    return Promise.resolve({ data: { content: Buffer.from('small').toString('base64') } });
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
                                { type: 'blob', path: 'missing-size.bin', sha: 'sha-big' }
                            ]
                        }
                    });
                }

                if (url.includes('/git/blobs/sha-big')) {
                    return Promise.resolve({ data: { content: oversizedContent } });
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
});
