const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const vm = require('vm');

// Reads and runs the script in a simulated DOM sandbox
function loadScriptWithMocks() {
    const code = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    // Mocks for standard browser objects and APIs
    const mockAudioInstances = [];

    class MockAudio {
        constructor(src) {
            this.src = src;
            this.volume = 1.0;
            this.loop = false;
            this.currentTime = 0;
            this.duration = 100;
            this.paused = true;
            this.listeners = {};
            mockAudioInstances.push(this);
        }

        addEventListener(event, callback) {
            this.listeners[event] = callback;
        }

        dispatchEvent(event) {
            if (this.listeners[event]) {
                this.listeners[event].call(this);
            }
        }

        play() {
            this.paused = false;
            return Promise.resolve();
        }

        pause() {
            this.paused = true;
        }

        cloneNode() {
            return new MockAudio(this.src);
        }
    }

    const mockDocument = {
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    };

    const mockWindow = {
        addEventListener: () => {},
        requestAnimationFrame: (cb) => cb()
    };

    const intervalCallbacks = [];
    const intervalsActive = [];
    let intervalIdMock = 999;

    const mockSetInterval = (callback, delay) => {
        const id = intervalIdMock++;
        intervalCallbacks.push({ id, callback, delay });
        intervalsActive.push(id);
        return id;
    };

    const mockClearInterval = (id) => {
        const index = intervalsActive.indexOf(id);
        if (index !== -1) {
            intervalsActive.splice(index, 1);
        }
    };

    const sandbox = {
        Audio: MockAudio,
        document: mockDocument,
        window: mockWindow,
        let: {},
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: mockSetInterval,
        clearInterval: mockClearInterval,
        soundEnabled: false,
        seagullsInterval: null,
        sounds: null
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    return { sandbox, mockAudioInstances, intervalCallbacks, intervalsActive };
}

test('fadeAudioIn should fade volume in correctly using fake timers', (t, done) => {
    const { sandbox, intervalCallbacks, intervalsActive } = loadScriptWithMocks();
    const fadeAudioIn = sandbox.fadeAudioIn;

    if (typeof fadeAudioIn !== 'function') {
        assert.fail('fadeAudioIn is not a function or not loaded');
    }

    // Set up a custom mock audio node to inspect the volume steps
    const playCalls = [];
    const mockAudioNode = {
        volume: -1,
        play() {
            playCalls.push(true);
            return Promise.resolve();
        },
        pause() {}
    };

    // Run fadeAudioIn: targetVolume = 0.8, duration = 1000ms
    // Steps count = duration / 50 = 20 steps
    // Step size = 0.8 / 20 = 0.04
    fadeAudioIn(mockAudioNode, 0.8, 1000);

    // Verify initial setup
    assert.strictEqual(mockAudioNode.volume, 0, 'Initial volume should be set to 0');
    assert.strictEqual(playCalls.length, 1, 'play() should be called on the audio node');

    // Check if interval was set
    assert.strictEqual(intervalCallbacks.length, 1, 'An interval fader should be registered');
    const { callback, delay } = intervalCallbacks[0];
    assert.strictEqual(delay, 50, 'Fader interval delay should be 50ms');

    // Step through 10 iterations (should be exactly halfway: 0.04 * 10 = 0.40)
    for (let i = 1; i <= 10; i++) {
        callback();
        assert.ok(Math.abs(mockAudioNode.volume - (0.04 * i)) < 0.0001, `Volume at step ${i} should be ${(0.04 * i).toFixed(2)}, got ${mockAudioNode.volume}`);
    }

    // Run remaining steps to reach target volume (another 10 steps)
    for (let i = 11; i <= 20; i++) {
        callback();
    }

    // Verify we hit target volume and the interval was cleared
    assert.strictEqual(mockAudioNode.volume, 0.8, 'Volume should reach exactly 0.8');
    assert.strictEqual(intervalsActive.length, 0, 'Fader interval should be cleared after reaching targetVolume');

    done();
});

test('fadeAudioIn handles play rejection gracefully', (t, done) => {
    const { sandbox } = loadScriptWithMocks();
    const fadeAudioIn = sandbox.fadeAudioIn;

    const mockAudioNode = {
        volume: -1,
        play() {
            // Simulate a browser play rejection (e.g. user hasn't interacted yet)
            return Promise.reject(new Error('NotAllowedError'));
        }
    };

    // This should not crash or throw an unhandled promise rejection
    try {
        fadeAudioIn(mockAudioNode, 0.5, 500);
        assert.strictEqual(mockAudioNode.volume, 0, 'Volume should be initialized to 0 even if play fails');
    } catch (err) {
        assert.fail('fadeAudioIn threw an exception: ' + err.message);
    }

    done();
});
