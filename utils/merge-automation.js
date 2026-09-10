/**
 * Automated repository merge utilities for CAROMAR
 */

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB safety limit per file
const MAX_MERGE_FILES = 250;
const SUPPORTED_CONTENTS_FILE_MODE = '100644';

function normalizeBase64Content(content = '') {
    return content.replace(/\s+/g, '');
}

function getBase64DecodedByteLength(base64Content = '') {
    const normalized = normalizeBase64Content(base64Content);
    if (!normalized) {
        return 0;
    }

    const paddingLength = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    return Math.floor((normalized.length * 3) / 4) - paddingLength;
}

function exceedsMaxFileSize(sizeInBytes) {
    return typeof sizeInBytes === 'number' && sizeInBytes > MAX_FILE_SIZE_BYTES;
}

function encodeContentPath(path) {
    return path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
}

function createMergeLimitError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function isRateLimitExceededError(error) {
    return error.response?.status === 403 && String(error.response?.headers?.['x-ratelimit-remaining']) === '0';
}

function getRateLimitAbortReason(error) {
    if (!isRateLimitExceededError(error)) {
        return null;
    }

    const resetAt = error.response?.headers?.['x-ratelimit-reset'];
    const resetMessage = resetAt
        ? ` Rate limit resets at ${new Date(Number(resetAt) * 1000).toISOString()}.`
        : '';

    return `Aborted automated merge: GitHub API rate limit exhausted.${resetMessage}`;
}

function isSupportedContentsMode(mode) {
    return mode === SUPPORTED_CONTENTS_FILE_MODE;
}

async function buildMergePlan({ axiosClient, headers, sourceRepositories }) {
    const repositories = [];
    let totalFiles = 0;

    for (const sourceRepository of sourceRepositories) {
        const { files } = await getRepositoryTree(axiosClient, headers, sourceRepository.full_name);
        totalFiles += files.length;

        if (totalFiles > MAX_MERGE_FILES) {
            throw createMergeLimitError(
                `Automated merge supports at most ${MAX_MERGE_FILES} files per request. ` +
                `The selected repositories contain ${totalFiles} files.`
            );
        }

        repositories.push({
            sourceRepository,
            files
        });
    }

    return {
        totalFiles,
        repositories
    };
}

function inferRepositoryCapabilities(files) {
    const capabilitySignals = [
        { key: 'api', patterns: ['openapi', 'swagger', 'routes/', '/api/'] },
        { key: 'frontend', patterns: ['package.json', 'src/components', 'public/', '.css', '.tsx', '.jsx'] },
        { key: 'ci_cd', patterns: ['.github/workflows', 'jenkinsfile', 'dockerfile'] },
        { key: 'testing', patterns: ['__tests__', '.test.', '.spec.', 'jest.config', 'pytest.ini'] },
        { key: 'infrastructure', patterns: ['terraform', '.tf', 'k8s', 'helm', 'docker-compose'] }
    ];

    const filePaths = files.map(file => (file.path || '').toLowerCase());

    return capabilitySignals
        .filter(signal => signal.patterns.some(pattern => filePaths.some(path => path.includes(pattern.toLowerCase()))))
        .map(signal => signal.key);
}

function computeRepositoryRiskScore(repositoryResult) {
    const skipWeight = repositoryResult.skippedFiles.length * 0.2;
    const mergePenalty = repositoryResult.mergedFiles === 0 ? 0.4 : 0;
    const score = Math.min(1, 0.1 + skipWeight + mergePenalty);
    return Number(score.toFixed(2));
}

function generateAIMergeInsights(repositoryResults) {
    const insights = [];

    for (const result of repositoryResults) {
        const skippedCount = result.skippedFiles.length;
        const riskScore = typeof result.riskScore === 'number'
            ? result.riskScore
            : computeRepositoryRiskScore(result);

        if (skippedCount === 0) {
            insights.push({
                repository: result.full_name,
                recommendation: 'Repository merged cleanly. No additional remediation required.',
                confidence: 0.98,
                riskScore
            });
            continue;
        }

        const oversizedSkips = result.skippedFiles.filter(reason => reason.includes('exceeds')).length;

        insights.push({
            repository: result.full_name,
            recommendation: oversizedSkips > 0
                ? 'Large binary files were skipped. Consider Git LFS migration for complete fidelity.'
                : 'Repository had merge exceptions. Review skipped files and retry with reduced scope.',
            confidence: oversizedSkips > 0 ? 0.92 : 0.76,
            riskScore
        });
    }

    return insights;
}

async function getRepositoryTree(axiosClient, headers, sourceFullName) {
    const repoResponse = await axiosClient.get(`https://api.github.com/repos/${sourceFullName}`, { headers });
    const defaultBranch = repoResponse.data.default_branch || 'main';

    const treeResponse = await axiosClient.get(
        `https://api.github.com/repos/${sourceFullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
        { headers }
    );

    if (treeResponse.data?.truncated) {
        throw createMergeLimitError(
            `Tree listing for ${sourceFullName} is truncated by GitHub API. ` +
            'Repository is too large for automated merge. Use manual merge or reduce repository size.'
        );
    }

    const files = (treeResponse.data.tree || []).filter(item => item.type === 'blob');

    return {
        files,
        defaultBranch
    };
}

async function mergeRepositoriesIntoTarget({
    axiosClient,
    headers,
    sourceRepositories,
    targetFullName,
    targetBranch = 'main',
    mergePlan = null
}) {
    const summary = {
        mergedFiles: 0,
        skippedFiles: [],
        sourceRepositories: sourceRepositories.length,
        repositoryResults: [],
        aiInsights: [],
        aborted: false,
        abortReason: null
    };

    const plannedRepositories = mergePlan?.repositories || (await buildMergePlan({
        axiosClient,
        headers,
        sourceRepositories
    })).repositories;

    for (const plannedRepository of plannedRepositories) {
        const sourceRepository = plannedRepository.sourceRepository;
        const repositoryResult = {
            full_name: sourceRepository.full_name,
            folder: sourceRepository.name,
            mergedFiles: 0,
            skippedFiles: [],
            capabilities: [],
            riskScore: 0
        };

        try {
            const files = plannedRepository.files;
            repositoryResult.capabilities = inferRepositoryCapabilities(files);

            for (const file of files) {
                const targetPath = `${sourceRepository.name}/${file.path}`;

                if (!isSupportedContentsMode(file.mode)) {
                    const reason = `Skipped ${targetPath}: unsupported git mode ${file.mode}`;
                    summary.skippedFiles.push(reason);
                    repositoryResult.skippedFiles.push(reason);
                    continue;
                }

                if (exceedsMaxFileSize(file.size)) {
                    const reason = `Skipped ${targetPath}: file exceeds ${MAX_FILE_SIZE_BYTES} bytes`;
                    summary.skippedFiles.push(reason);
                    repositoryResult.skippedFiles.push(reason);
                    continue;
                }

                try {
                    const blobResponse = await axiosClient.get(
                        `https://api.github.com/repos/${sourceRepository.full_name}/git/blobs/${file.sha}`,
                        { headers }
                    );

                    if (blobResponse.data.encoding !== 'base64') {
                        const reason = `Skipped ${targetPath}: unsupported blob encoding ${blobResponse.data.encoding || 'unknown'}`;
                        summary.skippedFiles.push(reason);
                        repositoryResult.skippedFiles.push(reason);
                        continue;
                    }

                    if (exceedsMaxFileSize(getBase64DecodedByteLength(blobResponse.data.content))) {
                        const reason = `Skipped ${targetPath}: file exceeds ${MAX_FILE_SIZE_BYTES} bytes`;
                        summary.skippedFiles.push(reason);
                        repositoryResult.skippedFiles.push(reason);
                        continue;
                    }

                    await axiosClient.put(
                        `https://api.github.com/repos/${targetFullName}/contents/${encodeContentPath(targetPath)}`,
                        {
                            message: `Merge ${sourceRepository.full_name}: add ${file.path}`,
                            content: normalizeBase64Content(blobResponse.data.content),
                            branch: targetBranch
                        },
                        { headers }
                    );

                    summary.mergedFiles += 1;
                    repositoryResult.mergedFiles += 1;
                } catch (error) {
                    const abortReason = getRateLimitAbortReason(error);
                    if (abortReason) {
                        summary.aborted = true;
                        summary.abortReason = abortReason;
                        summary.skippedFiles.push(abortReason);
                        repositoryResult.skippedFiles.push(abortReason);
                        break;
                    }

                    const reason = `Skipped ${targetPath}: ${error.response?.data?.message || error.message}`;
                    summary.skippedFiles.push(reason);
                    repositoryResult.skippedFiles.push(reason);
                }
            }
        } catch (error) {
            const abortReason = getRateLimitAbortReason(error);
            if (abortReason) {
                summary.aborted = true;
                summary.abortReason = abortReason;
                summary.skippedFiles.push(abortReason);
                repositoryResult.skippedFiles.push(abortReason);
            } else {
                const reason = `Failed merging ${sourceRepository.full_name}: ${error.response?.data?.message || error.message}`;
                summary.skippedFiles.push(reason);
                repositoryResult.skippedFiles.push(reason);
            }
        }

        repositoryResult.riskScore = computeRepositoryRiskScore(repositoryResult);
        summary.repositoryResults.push(repositoryResult);

        if (summary.aborted) {
            break;
        }
    }

    summary.aiInsights = generateAIMergeInsights(summary.repositoryResults);

    return summary;
}

module.exports = {
    MAX_FILE_SIZE_BYTES,
    MAX_MERGE_FILES,
    normalizeBase64Content,
    getBase64DecodedByteLength,
    exceedsMaxFileSize,
    encodeContentPath,
    getRepositoryTree,
    buildMergePlan,
    inferRepositoryCapabilities,
    computeRepositoryRiskScore,
    generateAIMergeInsights,
    mergeRepositoriesIntoTarget,
    isRateLimitExceededError
};
