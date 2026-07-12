const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

function createSandbox() {
    const audioInstances = [];

    class MockAudio {
        constructor(src) {
            this.src = src;
            this.loop = false;
            this.volume = 1;
            this.currentTime = 0;
            this.duration = 10;
            this.isPlaying = false;
            this.isPaused = false;
            audioInstances.push(this);
            this.eventListeners = {};
        }

        addEventListener(event, callback) {
            if (!this.eventListeners[event]) {
                this.eventListeners[event] = [];
            }
            this.eventListeners[event].push(callback);
        }

        dispatchEvent(event) {
            if (this.eventListeners[event]) {
                this.eventListeners[event].forEach(cb => cb.call(this));
            }
        }

        play() {
            this.isPlaying = true;
            this.isPaused = false;
            return Promise.resolve();
        }

        pause() {
            this.isPlaying = false;
            this.isPaused = true;
        }

        cloneNode() {
            const clone = new MockAudio(this.src);
            clone.loop = this.loop;
            clone.volume = this.volume;
            clone.duration = this.duration;
            return clone;
        }
    }

    const elements = {};
    function mockElement(id) {
        if (!elements[id]) {
            elements[id] = {
                id: id,
                classList: {
                    classes: new Set(),
                    add(...names) {
                        names.forEach(n => this.classes.add(n));
                    },
                    remove(...names) {
                        names.forEach(n => this.classes.delete(n));
                    },
                    contains(name) {
                        return this.classes.has(name);
                    }
                },
                addEventListener: () => {},
                appendChild: () => {},
                style: {}
            };
        }
        return elements[id];
    }

    const documentMock = {
        getElementById: (id) => mockElement(id),
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({
            classList: { add: () => {} },
            style: {}
        }),
        documentElement: {
            style: {
                setProperty: () => {}
            }
        },
        body: {
            style: {}
        }
    };

    const windowMock = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => cb(),
        scrollY: 0,
        innerHeight: 800,
    };

    const timeouts = [];
    const intervals = [];

    const setTimeoutMock = (fn, delay) => {
        const id = timeouts.length + 1;
        timeouts.push({ id, fn, delay, cleared: false });
        return id;
    };

    const clearTimeoutMock = (id) => {
        const t = timeouts.find(item => item.id === id);
        if (t) t.cleared = true;
    };

    const setIntervalMock = (fn, delay) => {
        const id = intervals.length + 1;
        intervals.push({ id, fn, delay, cleared: false, runs: 0 });
        return id;
    };

    const clearIntervalMock = (id) => {
        const i = intervals.find(item => item.id === id);
        if (i) i.cleared = true;
    };

    class MockIntersectionObserver {
        constructor() {}
        observe() {}
        unobserve() {}
    }

    const sandbox = {
        Audio: MockAudio,
        document: documentMock,
        window: windowMock,
        IntersectionObserver: MockIntersectionObserver,
        setTimeout: setTimeoutMock,
        clearTimeout: clearTimeoutMock,
        setInterval: setIntervalMock,
        clearInterval: clearIntervalMock,
        console: console,
        Math: Math,
        getAudioInstances: () => audioInstances,
        getTimeouts: () => timeouts,
        getIntervals: () => intervals,
        triggerInterval: (id) => {
            const i = intervals.find(item => item.id === id);
            if (i && !i.cleared) {
                i.runs++;
                i.fn();
            }
        },
        triggerTimeout: (id) => {
            const t = timeouts.find(item => item.id === id);
            if (t && !t.cleared) {
                t.fn();
            }
        }
    };

    vm.createContext(sandbox);
    return sandbox;
}

test('toggleSound - toggling sound ON', () => {
    const sandbox = createSandbox();

    // Execute script in sandbox context
    vm.runInContext(scriptContent, sandbox);

    const deskIcon = sandbox.document.getElementById('sound-icon-desktop');
    const mobIcon = sandbox.document.getElementById('sound-icon-mobile');

    // Initially soundEnabled is false
    assert.strictEqual(vm.runInContext('soundEnabled', sandbox), false);

    // Call toggleSound to turn it ON
    vm.runInContext('toggleSound()', sandbox);

    // Verify state transitioned to true
    assert.strictEqual(vm.runInContext('soundEnabled', sandbox), true);

    // Verify icons updated to sound enabled state
    assert.ok(deskIcon.classList.contains('fa-volume-high'));
    assert.ok(deskIcon.classList.contains('text-ocean-cyan'));
    assert.ok(!deskIcon.classList.contains('fa-volume-xmark'));

    assert.ok(mobIcon.classList.contains('fa-volume-high'));
    assert.ok(mobIcon.classList.contains('text-ocean-cyan'));
    assert.ok(!mobIcon.classList.contains('fa-volume-xmark'));

    // Check sounds: we should find the ocean, seagulls, and bloop audio instances.
    const audios = sandbox.getAudioInstances();
    const oceanAudio = audios.find(a => a.src.includes('1195-preview.mp3'));
    const seagullsAudio = audios.find(a => a.src.includes('2384-preview.mp3'));

    assert.ok(oceanAudio, 'Ocean audio should exist');
    assert.ok(seagullsAudio, 'Seagulls audio should exist');

    // Check fadeAudioIn was triggered on oceanAudio
    // Since fadeAudioIn uses setInterval, let's verify intervals was registered.
    const intervalsList = sandbox.getIntervals();
    assert.ok(intervalsList.length > 0, 'An interval should be created for fade-in');

    // Let's trigger the interval to complete the fade in.
    const fadeInterval = intervalsList[0];
    assert.strictEqual(fadeInterval.cleared, false);

    // Run the interval callback until it is cleared.
    let safetyCounter = 0;
    while (!fadeInterval.cleared && safetyCounter < 100) {
        sandbox.triggerInterval(fadeInterval.id);
        safetyCounter++;
    }
    // Verify target volume is reached
    assert.strictEqual(oceanAudio.volume, 0.02);
    assert.strictEqual(oceanAudio.isPlaying, true);

    // Verify seagull sound was played and next scheduled
    assert.strictEqual(seagullsAudio.isPlaying, true);
    const timeoutsList = sandbox.getTimeouts();
    assert.strictEqual(timeoutsList.length, 1, 'Seagulls playSeagulls should set a timeout');
    assert.strictEqual(timeoutsList[0].cleared, false);
});

test('toggleSound - toggling sound OFF', () => {
    const sandbox = createSandbox();
    vm.runInContext(scriptContent, sandbox);

    // Turn sound ON first
    vm.runInContext('toggleSound()', sandbox);
    assert.strictEqual(vm.runInContext('soundEnabled', sandbox), true);

    // Turn sound OFF
    vm.runInContext('toggleSound()', sandbox);
    assert.strictEqual(vm.runInContext('soundEnabled', sandbox), false);

    // Icons should update back to disabled style
    const deskIcon = sandbox.document.getElementById('sound-icon-desktop');
    assert.ok(deskIcon.classList.contains('fa-volume-xmark'));
    assert.ok(!deskIcon.classList.contains('fa-volume-high'));
    assert.ok(!deskIcon.classList.contains('text-ocean-cyan'));

    // Verify seagulls timeout is cleared
    const timeoutsList = sandbox.getTimeouts();
    assert.ok(timeoutsList.every(t => t.cleared === true), 'All timeouts should be cleared');

    // Check fadeAudioOut interval was triggered on oceanAudio
    const intervalsList = sandbox.getIntervals();
    // The second interval would be for fade out
    assert.ok(intervalsList.length >= 2, 'Fade-out interval should be created');

    const oceanAudio = sandbox.getAudioInstances().find(a => a.src.includes('1195-preview.mp3'));
    assert.ok(oceanAudio, 'Ocean audio should exist');

    const fadeOutInterval = intervalsList[intervalsList.length - 1];
    assert.strictEqual(fadeOutInterval.cleared, false);

    // Run the interval callback until it is cleared.
    let safetyCounter = 0;
    while (!fadeOutInterval.cleared && safetyCounter < 100) {
        sandbox.triggerInterval(fadeOutInterval.id);
        safetyCounter++;
    }
    // Verify audio volume is faded to 0 and paused
    assert.strictEqual(oceanAudio.volume, 0);
    assert.strictEqual(oceanAudio.isPlaying, false);
});
