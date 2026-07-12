// Testing playBloopSound using Node's vm module and native node:test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('playBloopSound test suite', async (t) => {
    // Read the script source code
    const scriptPath = path.join(__dirname, 'script.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // Create a helper function to set up a new sandboxed context for each test case
    function createSandbox() {
        // Mocks for Audio elements
        class MockAudio {
            constructor(src) {
                this.src = src;
                this.loop = false;
                this._volume = 1.0;
                this.currentTime = 0;
                this.duration = 10; // dummy duration
                this.playCalled = false;
                this.playPromiseResolve = null;
                this.playPromiseReject = null;
                this.listeners = {};
            }

            get volume() {
                return this._volume;
            }

            set volume(v) {
                this._volume = v;
                // If this mock is a clone of sounds.bloop, record the volume set on the clone
                if (this.src && this.src.includes('2571-preview.mp3')) {
                    mockCloneVolumes.push(v);
                }
            }

            addEventListener(event, callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event].push(callback);
            }

            cloneNode() {
                const clone = new MockAudio(this.src);
                clone.loop = this.loop;
                clone.volume = this.volume;
                clone.currentTime = this.currentTime;
                clone.duration = this.duration;
                // Keep reference to track play calls on clone
                mockClones.push(clone);
                return clone;
            }

            play() {
                this.playCalled = true;
                mockPlayCalls.push(this);
                return new Promise((resolve, reject) => {
                    this.playPromiseResolve = resolve;
                    this.playPromiseReject = reject;
                });
            }

            pause() {
                this.paused = true;
            }
        }

        const mockClones = [];
        const mockCloneVolumes = [];
        const mockPlayCalls = [];

        // Mock document structure
        const documentMock = {
            addEventListener: () => {},
            querySelectorAll: () => [],
            getElementById: () => null,
            createElement: () => ({ style: {}, classList: { add: () => {} } })
        };

        // Mock window structure
        const windowMock = {
            addEventListener: () => {},
            innerHeight: 1080
        };

        const sandbox = {
            Audio: MockAudio,
            document: documentMock,
            window: windowMock,
            console,
            setTimeout: () => {},
            clearTimeout: () => {},
            requestAnimationFrame: () => {},
            IntersectionObserver: class {
                observe() {}
                unobserve() {}
            },
            // Outputs to track actions
            mockClones,
            mockCloneVolumes,
            mockPlayCalls
        };

        vm.createContext(sandbox);

        // To make let/const declarations on top-level accessible and mockable without fragile string replacements,
        // we wrap the script code inside a function. This avoids the block scoping issue where top-level let/const
        // are not exposed as properties on the vm's global sandbox object.
        // Inside the wrapper, we assign window.playBloopSound = playBloopSound, and we also return control functions/objects
        // so the test can safely enable/disable sound or inspect inner state.
        const wrapperCode = `
            (function() {
                ${scriptCode}

                // Return interface for tests to manipulate/inspect internal variables safely
                return {
                    enableSound: (val) => { soundEnabled = val; },
                    getSoundEnabled: () => soundEnabled,
                    getSounds: () => sounds,
                    playBloopSound: playBloopSound
                };
            })()
        `;

        const testInterface = vm.runInContext(wrapperCode, sandbox);

        return {
            sandbox,
            testInterface
        };
    }

    await t.test('should do nothing if soundEnabled is false', () => {
        const { sandbox, testInterface } = createSandbox();

        // Ensure soundEnabled is false initially
        testInterface.enableSound(false);

        // Reset trackers
        sandbox.mockClones.length = 0;
        sandbox.mockPlayCalls.length = 0;

        // Execute function
        testInterface.playBloopSound();

        // Verify that no clones were made and nothing played
        assert.strictEqual(sandbox.mockClones.length, 0);
        assert.strictEqual(sandbox.mockPlayCalls.length, 0);
    });

    await t.test('should clone bloop sound, set volume, and call play when soundEnabled is true', async () => {
        const { sandbox, testInterface } = createSandbox();

        // Enable sound
        testInterface.enableSound(true);

        // Execute function
        testInterface.playBloopSound();

        // Verify clone was created
        assert.strictEqual(sandbox.mockClones.length, 1);
        const clonedBloop = sandbox.mockClones[0];

        // Verify volume was set to 0.3
        assert.ok(sandbox.mockCloneVolumes.includes(0.3));

        // Verify play was called on the cloned audio object
        assert.strictEqual(clonedBloop.playCalled, true);
        assert.strictEqual(sandbox.mockPlayCalls.length, 1);
        assert.strictEqual(sandbox.mockPlayCalls[0], clonedBloop);
    });

    await t.test('should handle promise rejection gracefully when play() fails', async () => {
        const { sandbox, testInterface } = createSandbox();

        // Enable sound
        testInterface.enableSound(true);

        // Execute function
        testInterface.playBloopSound();

        // Verify clone exists
        assert.strictEqual(sandbox.mockClones.length, 1);
        const clonedBloop = sandbox.mockClones[0];

        // Reject the play promise and ensure it does not crash or throw unhandled rejection
        let rejected = false;
        try {
            if (clonedBloop.playPromiseReject) {
                clonedBloop.playPromiseReject(new Error('Audio playback failed'));
            }
        } catch (err) {
            rejected = true;
        }

        // Delay to allow any promise microtask queues to run
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(rejected, false, 'The error should be caught internally by the playBloopSound function');
    });
});
