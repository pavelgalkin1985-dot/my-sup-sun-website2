const fs = require('fs');
const path = require('path');

function verifyHtmlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Use a regex to find all <a ...> tags
  const anchorTags = content.match(/<a\s+[^>]*>/g) || [];

  for (const tag of anchorTags) {
    if (tag.includes('target="_blank"')) {
      if (!tag.includes('rel="noopener noreferrer"')) {
        throw new Error(`Security vulnerability found in ${filePath}: Tag '${tag}' has target="_blank" but is missing rel="noopener noreferrer"`);
      }
    }
  }
}

try {
  console.log('Verifying index.html...');
  verifyHtmlFile(path.join(__dirname, 'index.html'));

  console.log('Verifying dist/index.html...');
  verifyHtmlFile(path.join(__dirname, 'dist/index.html'));

  console.log('All checks passed successfully!');
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
