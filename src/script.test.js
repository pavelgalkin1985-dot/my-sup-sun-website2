const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');

// Helper function to load and execute the script inside a mocked environment
function loadScriptWithMockedDOM() {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    // Setup basic mock DOM
    const elements = {};

    class MockClassList {
        constructor() {
            this.classes = new Set();
        }
        add(...classNames) {
            classNames.forEach(c => this.classes.add(c));
        }
        remove(...classNames) {
            classNames.forEach(c => this.classes.delete(c));
        }
        contains(className) {
            return this.classes.has(className);
        }
    }

    class MockElement {
        constructor(id) {
            this.id = id;
            this.classList = new MockClassList();
        }
    }

    const documentMock = {
        getElementById: (id) => {
            if (id in elements) {
                return elements[id];
            }
            return null;
        },
        // For DOMContentLoaded listener registration
        addEventListener: () => {}
    };

    const windowMock = {
        addEventListener: () => {}
    };

    class AudioMock {
        constructor(url) {
            this.url = url;
            this.loop = false;
            this.volume = 1;
            this.currentTime = 0;
            this.duration = 10;
        }
        addEventListener(event, callback) {
            // Noop or track callback if needed
        }
        play() {
            return Promise.resolve();
        }
        pause() {}
        cloneNode() {
            return new AudioMock(this.url);
        }
    }

    // Context / Sandbox for VM
    const context = {
        window: windowMock,
        document: documentMock,
        Audio: AudioMock,
        setTimeout: () => {},
        clearTimeout: () => {},
        setInterval: () => {},
        clearInterval: () => {},
        requestAnimationFrame: (cb) => cb(),
        IntersectionObserver: class {
            observe() {}
            unobserve() {}
        },
        console: console
    };

    vm.createContext(context);

    // Evaluate script.js inside the sandbox context
    vm.runInContext(scriptContent, context);

    return {
        context,
        elements,
        MockElement
    };
}

test('updateSoundIcons updates icon classes correctly when sound is enabled', () => {
    const { context, elements, MockElement } = loadScriptWithMockedDOM();

    // Create desktop and mobile sound icon elements
    const desktopIcon = new MockElement('sound-icon-desktop');
    const mobileIcon = new MockElement('sound-icon-mobile');

    // Preset some classes to check if they get removed correctly
    desktopIcon.classList.add('animate-pulse-icon', 'fa-volume-xmark');
    mobileIcon.classList.add('animate-pulse-icon', 'fa-volume-xmark');

    elements['sound-icon-desktop'] = desktopIcon;
    elements['sound-icon-mobile'] = mobileIcon;

    // Call window.toggleSound() which will set soundEnabled to true and update icons
    context.window.toggleSound();

    // Assert classes on desktop icon
    assert.strictEqual(desktopIcon.classList.contains('animate-pulse-icon'), false);
    assert.strictEqual(desktopIcon.classList.contains('fa-volume-xmark'), false);
    assert.strictEqual(desktopIcon.classList.contains('fa-volume-high'), true);
    assert.strictEqual(desktopIcon.classList.contains('text-ocean-cyan'), true);

    // Assert classes on mobile icon
    assert.strictEqual(mobileIcon.classList.contains('animate-pulse-icon'), false);
    assert.strictEqual(mobileIcon.classList.contains('fa-volume-xmark'), false);
    assert.strictEqual(mobileIcon.classList.contains('fa-volume-high'), true);
    assert.strictEqual(mobileIcon.classList.contains('text-ocean-cyan'), true);
});

test('updateSoundIcons updates icon classes correctly when sound is disabled', () => {
    const { context, elements, MockElement } = loadScriptWithMockedDOM();

    // Create desktop and mobile sound icon elements
    const desktopIcon = new MockElement('sound-icon-desktop');
    const mobileIcon = new MockElement('sound-icon-mobile');

    elements['sound-icon-desktop'] = desktopIcon;
    elements['sound-icon-mobile'] = mobileIcon;

    // Enable sound first (false -> true)
    context.window.toggleSound();

    // Preset classes indicating sound is enabled and pulse animation is there
    desktopIcon.classList.add('animate-pulse-icon');
    mobileIcon.classList.add('animate-pulse-icon');

    // Toggle sound back off (true -> false)
    context.window.toggleSound();

    // Assert classes on desktop icon
    assert.strictEqual(desktopIcon.classList.contains('animate-pulse-icon'), false);
    assert.strictEqual(desktopIcon.classList.contains('fa-volume-high'), false);
    assert.strictEqual(desktopIcon.classList.contains('text-ocean-cyan'), false);
    assert.strictEqual(desktopIcon.classList.contains('fa-volume-xmark'), true);

    // Assert classes on mobile icon
    assert.strictEqual(mobileIcon.classList.contains('animate-pulse-icon'), false);
    assert.strictEqual(mobileIcon.classList.contains('fa-volume-high'), false);
    assert.strictEqual(mobileIcon.classList.contains('text-ocean-cyan'), false);
    assert.strictEqual(mobileIcon.classList.contains('fa-volume-xmark'), true);
});

test('updateSoundIcons handles missing DOM elements gracefully', () => {
    const { context, elements, MockElement } = loadScriptWithMockedDOM();

    // Only one of the icons is present (e.g., desktop only)
    const desktopIcon = new MockElement('sound-icon-desktop');
    desktopIcon.classList.add('animate-pulse-icon', 'fa-volume-xmark');
    elements['sound-icon-desktop'] = desktopIcon;
    // sound-icon-mobile is not added to the elements map, meaning document.getElementById will return null for it

    // This should not throw an error, even though sound-icon-mobile is null
    assert.doesNotThrow(() => {
        context.window.toggleSound();
    });

    // Verify desktop icon was updated successfully
    assert.strictEqual(desktopIcon.classList.contains('animate-pulse-icon'), false);
    assert.strictEqual(desktopIcon.classList.contains('fa-volume-high'), true);
});
