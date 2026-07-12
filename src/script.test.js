const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('Audio play functions are successfully parsed and executed', (t) => {
    // Read the script file
    const scriptPath = path.join(__dirname, 'script.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // Create a mock window / document sandbox
    const domMock = {
        let: {},
        Audio: class {
            constructor(src) {
                this.src = src;
                this.loop = false;
                this.volume = 1;
                this.currentTime = 0;
                this.duration = 10;
                this._listeners = {};
            }
            addEventListener(event, callback) {
                this._listeners[event] = callback;
            }
            cloneNode() {
                const clone = new this.constructor(this.src);
                clone.volume = this.volume;
                return clone;
            }
            play() {
                return Promise.resolve();
            }
        },
        document: {
            addEventListener: () => {},
            querySelectorAll: () => [],
            getElementById: () => null
        },
        window: {
            addEventListener: () => {}
        },
        console: {
            error: (...args) => {
                // Log errors to process.stderr or keep silent if expected
            }
        },
        setTimeout: (fn, delay) => {
            return 1;
        },
        clearTimeout: () => {},
        requestAnimationFrame: (fn) => fn()
    };

    // Evaluate script.js inside the VM sandbox context
    const context = vm.createContext(domMock);
    vm.runInContext(scriptCode, context);

    // Verify functions exist on sandbox or window
    assert.strictEqual(typeof context.playBloopSound, 'function');
    assert.strictEqual(typeof context.playSeagulls, 'function');
    assert.strictEqual(typeof context.toggleSound, 'function');
    assert.strictEqual(typeof context.window.toggleSound, 'function');

    // Enable soundEnabled to test path with .play().catch()
    context.soundEnabled = true;

    // Test calling playBloopSound
    assert.doesNotThrow(() => {
        context.playBloopSound();
    });

    // Test calling playSeagulls
    assert.doesNotThrow(() => {
        context.playSeagulls();
    });
});
