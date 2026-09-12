#!/usr/bin/env node

/**
 * CAROMAR Deployment Validation Script
 * Validates that all required files and configurations exist for successful Netlify deployment
 * Run with: npm run validate
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Validation results
const results = {
    passed: [],
    failed: [],
    warnings: []
};

/**
 * Log functions with colors
 */
function logSuccess(message) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    results.passed.push(message);
}

function logError(message) {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    results.failed.push(message);
}

function logWarning(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
    results.warnings.push(message);
}

function logInfo(message) {
    console.log(`${colors.cyan}ℹ${colors.reset} ${message}`);
}

function logHeader(message) {
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}${message}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
    return fs.existsSync(path.join(process.cwd(), filePath));
}

/**
 * Read and parse JSON file
 */
function readJSON(filePath) {
    try {
        const content = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

/**
 * Read file content
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
    } catch (error) {
        return null;
    }
}

/**
 * Recursively find files matching a predicate, skipping common
 * dependency/build/version-control directories.
 */
function findFiles(dir, predicate, results = [], depth = 0) {
    if (depth > 6) {
        return results;
    }
    const skipDirs = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', '.netlify']);
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name)) {
                findFiles(fullPath, predicate, results, depth + 1);
            }
        } else if (predicate(entry.name)) {
            results.push(path.relative(process.cwd(), fullPath));
        }
    }
    return results;
}

/**
 * Validation tests
 */

// 1. Check required files exist
function validateRequiredFiles() {
    logHeader('Validating Required Files');
    
    const requiredFiles = [
        'package.json',
        'netlify.toml',
        '.nvmrc',
        'server.js',
        'functions/server.js',
        'views/index.ejs',
        'public/robots.txt',
        'public/sitemap.xml',
        'README.md',
        'docs/README.md',
        'docs/deployment/netlify.md'
    ];
    
    requiredFiles.forEach(file => {
        if (fileExists(file)) {
            logSuccess(`File exists: ${file}`);
        } else {
            logError(`Missing required file: ${file}`);
        }
    });

    if (fileExists('package-lock.json')) {
        logSuccess('package-lock.json present (npm ci will be reproducible)');
    } else {
        logWarning('package-lock.json missing — npm ci requires a lockfile to be reproducible');
    }
}

// 2. Validate package.json
function validatePackageJSON() {
    logHeader('Validating package.json');
    
    const pkg = readJSON('package.json');
    if (!pkg) {
        logError('Failed to read package.json');
        return;
    }
    
    // Check engines
    if (pkg.engines && pkg.engines.node) {
        logSuccess(`Node.js engine specified: ${pkg.engines.node}`);
    } else {
        logError('Missing engines.node in package.json');
    }
    
    // Check required dependencies
    const requiredDeps = ['express', 'serverless-http', 'ejs', 'axios', 'cors', 'helmet'];
    requiredDeps.forEach(dep => {
        if (pkg.dependencies && pkg.dependencies[dep]) {
            logSuccess(`Required dependency found: ${dep}`);
        } else {
            logError(`Missing required dependency: ${dep}`);
        }
    });
    
    // Check scripts
    if (pkg.scripts && pkg.scripts.build) {
        logSuccess(`Build script defined: ${pkg.scripts.build}`);
    } else {
        logWarning('No build script defined in package.json');
    }

    // Check repository metadata isn't pointing at a stale org/host
    const metaUrls = [
        pkg.repository && pkg.repository.url,
        pkg.bugs && pkg.bugs.url,
        pkg.homepage
    ].filter(Boolean);
    if (metaUrls.length > 0) {
        if (metaUrls.every(url => url.includes('github.com/Universal-Standard/CAROMAR'))) {
            logSuccess('package.json repository/bugs/homepage point at Universal-Standard/CAROMAR');
        } else {
            logWarning('package.json repository/bugs/homepage metadata may be stale — verify it matches the current repo location');
        }
    }
}

// 3. Validate .nvmrc
function validateNvmrc() {
    logHeader('Validating .nvmrc');
    
    const nvmrc = readFile('.nvmrc');
    if (!nvmrc) {
        logError('Failed to read .nvmrc');
        return;
    }
    
    const version = nvmrc.trim();
    if (version.match(/^\d+(\.\d+)?(\.\d+)?$/)) {
        logSuccess(`Valid Node.js version specified: ${version}`);
    } else {
        logError(`Invalid Node.js version in .nvmrc: ${version}`);
    }
}

// 4. Validate netlify.toml
function validateNetlifyToml() {
    logHeader('Validating netlify.toml');
    
    const toml = readFile('netlify.toml');
    if (!toml) {
        logError('Failed to read netlify.toml');
        return;
    }
    
    // Check for key sections
    if (toml.includes('[build]')) {
        logSuccess('Build section found in netlify.toml');
    } else {
        logError('Missing [build] section in netlify.toml');
    }
    
    if (toml.includes('[functions]')) {
        logSuccess('Functions section found in netlify.toml');
    } else {
        logError('Missing [functions] section in netlify.toml');
    }
    
    if (toml.includes('[[redirects]]')) {
        logSuccess('Redirects configured in netlify.toml');
    } else {
        logWarning('No redirects configured in netlify.toml');
    }
    
    if (toml.includes('[[headers]]')) {
        logSuccess('Headers configured in netlify.toml');
    } else {
        logWarning('No headers configured in netlify.toml');
    }
}

// 5. Validate serverless function
function validateServerlessFunction() {
    logHeader('Validating Serverless Function');
    
    const functionFile = readFile('functions/server.js');
    if (!functionFile) {
        logError('Failed to read functions/server.js');
        return;
    }
    
    if (functionFile.includes('serverless-http')) {
        logSuccess('serverless-http import found');
    } else {
        logError('Missing serverless-http import in functions/server.js');
    }
    
    if (functionFile.includes('VIEWS_PATH')) {
        logSuccess('VIEWS_PATH environment variable configured');
    } else {
        logWarning('VIEWS_PATH not set - views may not render correctly');
    }
    
    if (functionFile.includes('exports.handler')) {
        logSuccess('Handler export found');
    } else {
        logError('Missing exports.handler in functions/server.js');
    }
}

// 6. Validate server.js
function validateServerJS() {
    logHeader('Validating server.js');
    
    const serverFile = readFile('server.js');
    if (!serverFile) {
        logError('Failed to read server.js');
        return;
    }
    
    if (serverFile.includes('module.exports = app')) {
        logSuccess('App export found for serverless compatibility');
    } else {
        logError('Missing module.exports = app');
    }
    
    if (serverFile.includes('process.env.VIEWS_PATH')) {
        logSuccess('VIEWS_PATH environment variable used');
    } else {
        logWarning('Server may not use VIEWS_PATH correctly');
    }

    // Guard against utils/security.js existing but not actually being
    // required by server.js (the exact gap fixed in v1.2.0 — see
    // CHANGELOG.md). This is a warning, not a hard failure, since a
    // future refactor could legitimately move this wiring elsewhere.
    if (fileExists('utils/security.js')) {
        if (serverFile.includes("require('./utils/security')") || serverFile.includes('require("./utils/security")')) {
            logSuccess('utils/security.js is imported by server.js');
        } else {
            logWarning('utils/security.js exists but does not appear to be imported by server.js — security protections it documents may not be active. See SECURITY.md.');
        }
    }
}

// 7. Check for sensitive data
function checkSensitiveData() {
    logHeader('Checking for Sensitive Data');
    
    const gitignore = readFile('.gitignore');
    if (!gitignore) {
        logError('No .gitignore file found');
        return;
    }
    
    const requiredIgnores = ['.env', 'node_modules'];
    requiredIgnores.forEach(pattern => {
        if (gitignore.includes(pattern)) {
            logSuccess(`${pattern} is in .gitignore`);
        } else {
            logError(`${pattern} should be in .gitignore`);
        }
    });
    
    // Check if .env file exists (it shouldn't be committed)
    if (fileExists('.env')) {
        logWarning('.env file exists - ensure it\'s in .gitignore');
    } else {
        logSuccess('No .env file in repository (good for security)');
    }
}

// 8. Validate utilities
function validateUtilities() {
    logHeader('Validating Utility Modules');
    
    const utils = ['logger', 'validation', 'analytics', 'comparison', 'performance', 'security'];
    utils.forEach(util => {
        const filePath = `utils/${util}.js`;
        if (fileExists(filePath)) {
            logSuccess(`Utility module exists: ${util}.js`);
        } else {
            logWarning(`Utility module missing: ${util}.js`);
        }
    });
}

// 9. Check for OS/editor junk artifacts that shouldn't be committed
function checkForJunkArtifacts() {
    logHeader('Checking for OS/Editor Artifacts');

    const junkPatterns = [
        name => name.toLowerCase() === 'desktop.ini',
        name => name.toLowerCase() === 'thumbs.db',
        name => name.endsWith('.DS_Store')
    ];

    const found = junkPatterns.flatMap(predicate => findFiles(process.cwd(), predicate));

    if (found.length === 0) {
        logSuccess('No desktop.ini/Thumbs.db/.DS_Store artifacts found in the repository');
    } else {
        found.forEach(file => logWarning(`Junk artifact committed: ${file} (add to .gitignore and remove it)`));
    }
}

/**
 * Run all validations
 */
function runValidations() {
    console.log(`\n${colors.cyan}╔${'═'.repeat(58)}╗${colors.reset}`);
    console.log(`${colors.cyan}║${' '.repeat(10)}CAROMAR Deployment Validation${' '.repeat(17)}║${colors.reset}`);
    console.log(`${colors.cyan}╚${'═'.repeat(58)}╝${colors.reset}\n`);
    
    validateRequiredFiles();
    validatePackageJSON();
    validateNvmrc();
    validateNetlifyToml();
    validateServerlessFunction();
    validateServerJS();
    checkSensitiveData();
    validateUtilities();
    checkForJunkArtifacts();
    
    // Summary
    logHeader('Validation Summary');
    console.log(`${colors.green}Passed:${colors.reset}   ${results.passed.length}`);
    console.log(`${colors.red}Failed:${colors.reset}   ${results.failed.length}`);
    console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings.length}\n`);
    
    if (results.failed.length === 0) {
        console.log(`${colors.green}✓ All critical validations passed!${colors.reset}`);
        console.log(`${colors.cyan}Your project is ready for Netlify deployment.${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}✗ Validation failed with ${results.failed.length} error(s).${colors.reset}`);
        console.log(`${colors.yellow}Please fix the issues above before deploying.${colors.reset}\n`);
        process.exit(1);
    }
}

// Run validations
runValidations();
