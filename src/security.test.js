const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Helper to check target="_blank" links in a given HTML file
function checkHtmlFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');

    // Find all <a ...> tags
    const anchorRegex = /<a\s+[^>]*>/gi;
    let match;
    const failures = [];

    while ((match = anchorRegex.exec(content)) !== null) {
        const tag = match[0];

        // Check if target="_blank" is present
        const hasTargetBlank = /target\s*=\s*["']_blank["']/i.test(tag);
        if (hasTargetBlank) {
            // Must contain rel with both noopener and noreferrer
            const relMatch = /rel\s*=\s*["']([^"']+)["']/i.exec(tag);
            if (!relMatch) {
                failures.push({ tag, reason: 'Missing rel attribute' });
            } else {
                const relValue = relMatch[1].toLowerCase();
                const hasNoopener = relValue.includes('noopener');
                const hasNoreferrer = relValue.includes('noreferrer');
                if (!hasNoopener || !hasNoreferrer) {
                    failures.push({ tag, reason: `rel attribute "${relValue}" is missing noopener or noreferrer` });
                }
            }
        }
    }

    return failures;
}

test('Security Vulnerability Check - index.html', () => {
    const filePath = path.join(__dirname, '../index.html');
    const failures = checkHtmlFile(filePath);

    assert.deepStrictEqual(failures, [], `Vulnerable links found in index.html: ${JSON.stringify(failures, null, 2)}`);
});

test('Security Vulnerability Check - dist/index.html', () => {
    const filePath = path.join(__dirname, '../dist/index.html');
    // Ensure the build file exists
    if (fs.existsSync(filePath)) {
        const failures = checkHtmlFile(filePath);
        assert.deepStrictEqual(failures, [], `Vulnerable links found in dist/index.html: ${JSON.stringify(failures, null, 2)}`);
    } else {
        console.warn('dist/index.html does not exist. Skipping test.');
    }
});
