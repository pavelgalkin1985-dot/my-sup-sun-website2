const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('fadeAudio function transitions volume correctly', async (t) => {
    // Read the script.js file
    const code = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    // Create a mock Audio class
    class MockAudio {
        constructor(src) {
            this.src = src;
            this.volume = 0;
            this.loop = false;
            this.currentTime = 0;
            this.duration = 100;
        }
        addEventListener() {}
        play() {
            return Promise.resolve();
        }
        pause() {}
        cloneNode() {
            return new MockAudio(this.src);
        }
    }

    // Mock document and window
    const mockElement = {
        classList: {
            add: () => {},
            remove: () => {},
        },
        addEventListener: () => {},
        appendChild: () => {},
        style: {
            setProperty: () => {}
        }
    };

    const mockDocument = {
        addEventListener: () => {},
        querySelectorAll: () => [],
        getElementById: () => mockElement,
        createElement: () => mockElement,
        body: {
            style: {
                overflow: ''
            }
        }
    };

    const mockWindow = {
        addEventListener: () => {},
        scrollTo: () => {},
        toggleSound: null,
        document: mockDocument,
    };

    class MockIntersectionObserver {
        observe() {}
        unobserve() {}
    }

    // Prepare sandbox context
    const context = {
        Audio: MockAudio,
        document: mockDocument,
        window: mockWindow,
        IntersectionObserver: MockIntersectionObserver,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        console: console,
        Math: Math,
    };

    vm.createContext(context);
    vm.runInContext(code, context);

    // Retrieve the fadeAudio function from the context
    const fadeAudio = context.fadeAudio;

    // Test fading in
    await t.test('fadeAudio fades in correctly', () => {
        const audio = new MockAudio();
        audio.volume = 0;

        // Call fadeAudio(audio, 0.5, 100)
        // With duration = 100, step is 0.5 / (100 / 50) = 0.25.
        // It runs in intervals of 50ms.
        fadeAudio(audio, 0.5, 100);

        return new Promise((resolve) => {
            setTimeout(() => {
                assert.strictEqual(audio.volume, 0.5);
                resolve();
            }, 150);
        });
    });

    // Test fading out
    await t.test('fadeAudio fades out correctly', () => {
        const audio = new MockAudio();
        audio.volume = 0.8;
        let pausedCalled = false;
        audio.pause = () => { pausedCalled = true; };

        // Call fadeAudio(audio, 0, 100)
        // step = (0 - 0.8) / 2 = -0.4
        fadeAudio(audio, 0, 100);

        return new Promise((resolve) => {
            setTimeout(() => {
                assert.strictEqual(audio.volume, 0);
                assert.strictEqual(pausedCalled, true);
                resolve();
            }, 150);
        });
    });

    // Test immediate completion if duration <= 0
    await t.test('fadeAudio completes immediately if duration is 0', () => {
        const audio = new MockAudio();
        audio.volume = 0.2;
        fadeAudio(audio, 0.6, 0);
        assert.strictEqual(audio.volume, 0.6);
    });
});
