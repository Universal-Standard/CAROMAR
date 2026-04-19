/**
 * Automated repository merge utilities for CAROMAR
 */

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB safety limit per file

function normalizeBase64Content(content = '') {
    return content.replace(/\n/g, '');
}

function encodeContentPath(path) {
    return path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
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
        throw new Error(`Tree listing for ${sourceFullName} is truncated by GitHub API`);
    }

    const files = (treeResponse.data.tree || []).filter(item => item.type === 'blob');

    return {
        files,
        defaultBranch
    };
}

async function mergeRepositoriesIntoTarget({ axiosClient, headers, sourceRepositories, targetFullName, targetBranch = 'main' }) {
    const summary = {
        mergedFiles: 0,
        skippedFiles: [],
        sourceRepositories: sourceRepositories.length,
        repositoryResults: [],
        aiInsights: []
    };

    for (const sourceRepository of sourceRepositories) {
        const repositoryResult = {
            full_name: sourceRepository.full_name,
            folder: sourceRepository.name,
            mergedFiles: 0,
            skippedFiles: [],
            capabilities: [],
            riskScore: 0
        };

        try {
            const { files } = await getRepositoryTree(axiosClient, headers, sourceRepository.full_name);
            repositoryResult.capabilities = inferRepositoryCapabilities(files);

            for (const file of files) {
                const targetPath = `${sourceRepository.name}/${file.path}`;

                if (file.size > MAX_FILE_SIZE_BYTES) {
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
                    const reason = `Skipped ${targetPath}: ${error.response?.data?.message || error.message}`;
                    summary.skippedFiles.push(reason);
                    repositoryResult.skippedFiles.push(reason);
                }
            }
        } catch (error) {
            const reason = `Failed merging ${sourceRepository.full_name}: ${error.response?.data?.message || error.message}`;
            summary.skippedFiles.push(reason);
            repositoryResult.skippedFiles.push(reason);
        }

        repositoryResult.riskScore = computeRepositoryRiskScore(repositoryResult);
        summary.repositoryResults.push(repositoryResult);
    }

    summary.aiInsights = generateAIMergeInsights(summary.repositoryResults);

    return summary;
}

module.exports = {
    MAX_FILE_SIZE_BYTES,
    normalizeBase64Content,
    encodeContentPath,
    getRepositoryTree,
    inferRepositoryCapabilities,
    computeRepositoryRiskScore,
    generateAIMergeInsights,
    mergeRepositoriesIntoTarget
};
