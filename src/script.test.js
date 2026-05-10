const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// DOM Mocks
const mockWindow = {
    addEventListener: () => {},
    scrollY: 0,
    innerHeight: 1000,
    requestAnimationFrame: (cb) => cb()
};
const mockDocument = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: () => null,
    documentElement: { style: { setProperty: () => {} } },
    body: { scrollHeight: 2000, style: {} },
    createElement: () => ({ classList: { add: () => {} }, style: {} })
};
const mockIntersectionObserver = class {
    observe() {}
    unobserve() {}
};

// Base Mock Audio
class MockAudio {
    constructor(src) {
        this.src = src;
        this.volume = 1;
        this.loop = false;
        this.currentTime = 0;
        this.duration = 100;
        this.events = {};

        // tracking calls
        this.playCalled = 0;
        this.cloneNodeCalled = 0;
    }
    addEventListener(event, cb) {
        this.events[event] = cb;
    }
    play() {
        this.playCalled++;
        return Promise.resolve();
    }
    pause() {}
    cloneNode() {
        this.cloneNodeCalled++;
        const clone = new MockAudio(this.src);
        clone.original = this;
        return clone;
    }
}

// Extract the script content and convert variables to global
let scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');

// Hack to make module variables accessible
scriptContent = scriptContent.replace('let soundEnabled = false;', 'globalThis.soundEnabled = false;');
scriptContent = scriptContent.replace('const sounds = {', 'globalThis.sounds = {');

// Create a context for the script
const sandbox = {
    window: mockWindow,
    document: mockDocument,
    IntersectionObserver: mockIntersectionObserver,
    requestAnimationFrame: mockWindow.requestAnimationFrame,
    Audio: MockAudio,
    Math: Math,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    console: console,
    globalThis: {} // Will be populated with soundEnabled, sounds, playBloopSound, etc.
};
// Add global reference
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

vm.runInContext(scriptContent, sandbox);

test('playBloopSound - happy path', () => {
    // Reset call counts
    sandbox.sounds.bloop.playCalled = 0;
    sandbox.sounds.bloop.cloneNodeCalled = 0;

    // Enable sound
    sandbox.soundEnabled = true;

    // Call function
    sandbox.playBloopSound();

    // Verify cloneNode was called
    assert.strictEqual(sandbox.sounds.bloop.cloneNodeCalled, 1);
});

test('playBloopSound - does not play when soundEnabled is false', () => {
    // Reset call counts
    sandbox.sounds.bloop.playCalled = 0;
    sandbox.sounds.bloop.cloneNodeCalled = 0;

    // Disable sound
    sandbox.soundEnabled = false;

    // Call function
    sandbox.playBloopSound();

    // Verify cloneNode was NOT called
    assert.strictEqual(sandbox.sounds.bloop.cloneNodeCalled, 0);
});

test('playBloopSound - handles play promise rejection gracefully', async () => {
    // Reset call counts
    sandbox.sounds.bloop.playCalled = 0;
    sandbox.sounds.bloop.cloneNodeCalled = 0;

    // Enable sound
    sandbox.soundEnabled = true;

    // Save original cloneNode
    const originalCloneNode = sandbox.sounds.bloop.cloneNode;

    let caught = false;

    // Mock cloneNode to return an audio that rejects on play
    sandbox.sounds.bloop.cloneNode = function() {
        this.cloneNodeCalled++;
        const clone = new MockAudio(this.src);
        clone.original = this;
        clone.play = function() {
            this.playCalled++;
            return Promise.reject(new Error('Playback failed'));
        };
        return clone;
    };

    try {
        // Call function. The rejection should be caught by the `.catch(e => {})` inside `playBloopSound`
        sandbox.playBloopSound();
    } catch (e) {
        caught = true;
    }

    // Restore original cloneNode
    sandbox.sounds.bloop.cloneNode = originalCloneNode;

    // Verify no error was thrown out of playBloopSound
    assert.strictEqual(caught, false, 'Function should handle rejection without throwing');
    assert.strictEqual(sandbox.sounds.bloop.cloneNodeCalled, 1, 'cloneNode should have been called');
});
