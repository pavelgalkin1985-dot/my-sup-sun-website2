const { performance } = require('perf_hooks');

// In a real browser, document.getElementById('navbar') has to traverse the DOM tree/hash map,
// and cross the JavaScript-to-C++ boundary (JS-Blink / JS-Gecko bridge).
// Crossing this boundary is notoriously expensive, and avoiding it inside high-frequency scroll listeners is a standard practice.
// Let's model a simplified DOM query tree traversal of 100 elements to find 'navbar'.

const domTree = [];
for (let i = 0; i < 100; i++) {
  domTree.push({ id: `element-${i}`, classList: { add() {}, remove() {} } });
}
domTree.push({ id: 'navbar', classList: { add() {}, remove() {} } });

const documentMock = {
  getElementById(id) {
    // Traverse the mock DOM to find the ID
    for (const el of domTree) {
      if (el.id === id) return el;
    }
    return null;
  }
};

function runUncachedBenchmark(iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const navbar = documentMock.getElementById('navbar');
    if (navbar) {
      navbar.classList.add('bg-ocean-deep/80');
      navbar.classList.remove('py-4');
    }
  }
  const end = performance.now();
  return end - start;
}

function runCachedBenchmark(iterations) {
  const start = performance.now();
  const navbar = documentMock.getElementById('navbar');
  for (let i = 0; i < iterations; i++) {
    if (navbar) {
      navbar.classList.add('bg-ocean-deep/80');
      navbar.classList.remove('py-4');
    }
  }
  const end = performance.now();
  return end - start;
}

console.log('Starting simulated DOM traversal benchmark (1,000,000 iterations)...');
const iterations = 1000000;

// Warm-up
runUncachedBenchmark(10000);
runCachedBenchmark(10000);

const uncachedTime = runUncachedBenchmark(iterations);
console.log(`Uncached DOM query duration: ${uncachedTime.toFixed(2)} ms`);

const cachedTime = runCachedBenchmark(iterations);
console.log(`Cached DOM query duration: ${cachedTime.toFixed(2)} ms`);

const difference = uncachedTime - cachedTime;
const percentage = ((difference / uncachedTime) * 100).toFixed(2);
console.log(`Performance Improvement: ${difference.toFixed(2)} ms saved with caching (${percentage}% faster)`);
