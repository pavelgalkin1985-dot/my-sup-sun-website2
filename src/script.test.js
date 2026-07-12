const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert');
const test = require('node:test');

function createEnvironment() {
    const createdAudios = [];
    class MockAudio {
        constructor(src) {
            this.src = src;
            this.loop = false;
            this.volume = 1;
            this.currentTime = 0;
            this.duration = 10;
            this.listeners = {};
            createdAudios.push(this);
        }
        addEventListener(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        }
        play() {
            this.playCalled = true;
            return Promise.resolve();
        }
        pause() {
            this.pauseCalled = true;
        }
        cloneNode() {
            const clone = new MockAudio(this.src);
            clone.isClone = true;
            return clone;
        }
        triggerEvent(event) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb.call(this));
            }
        }
    }

    class MockElement {
        constructor(tagName = 'div', id = '') {
            this.tagName = tagName;
            this.id = id;
            this._classes = new Set();
            const self = this;
            this.classList = {
                add(...names) { names.forEach(n => self._classes.add(n)); },
                remove(...names) { names.forEach(n => self._classes.delete(n)); },
                contains(name) { return self._classes.has(name); }
            };
            this.style = {
                setProperty: (prop, value) => { this.style[prop] = value; }
            };
            this.listeners = {};
            this.children = [];
        }
        addEventListener(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        }
        trigger(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb(data));
            }
        }
        appendChild(child) {
            this.children.push(child);
        }
    }

    const elementsById = {};
    const querySelectors = {};
    const documentListeners = {};
    const document = {
        getElementById(id) {
            if (!elementsById[id]) {
                elementsById[id] = new MockElement('div', id);
            }
            return elementsById[id];
        },
        querySelectorAll(selector) {
            if (!querySelectors[selector]) {
                querySelectors[selector] = [];
            }
            return querySelectors[selector];
        },
        addEventListener(event, callback) {
            if (!documentListeners[event]) documentListeners[event] = [];
            documentListeners[event].push(callback);
        },
        createElement(tagName) {
            return new MockElement(tagName);
        },
        body: new MockElement('body'),
        documentElement: new MockElement('html')
    };

    const windowListeners = {};
    const window = {
        addEventListener(event, callback) {
            if (!windowListeners[event]) windowListeners[event] = [];
            windowListeners[event].push(callback);
        },
        trigger(event, data) {
            if (windowListeners[event]) {
                windowListeners[event].forEach(cb => cb(data));
            }
        },
        scrollTo: () => {},
        scrollY: 0,
        innerHeight: 600
    };

    const observers = [];
    class MockIntersectionObserver {
        constructor(callback) {
            this.callback = callback;
            this.observed = [];
            observers.push(this);
        }
        observe(el) {
            this.observed.push(el);
        }
        unobserve(el) {
            this.observed = this.observed.filter(e => e !== el);
        }
        trigger(entries) {
            this.callback(entries, this);
        }
    }

    let intervals = [];
    const setIntervalMock = (fn, delay) => {
        const id = intervals.length + 1;
        intervals.push({ id, fn, delay });
        return id;
    };
    const clearIntervalMock = (id) => {
        intervals = intervals.filter(it => it.id !== id);
    };

    let timeouts = [];
    const setTimeoutMock = (fn, delay) => {
        const id = timeouts.length + 1;
        timeouts.push({ id, fn, delay });
        return id;
    };
    const clearTimeoutMock = (id) => {
        timeouts = timeouts.filter(to => to.id !== id);
    };

    const requestAnimationFrameMock = (cb) => cb();

    const context = {
        Audio: MockAudio,
        document,
        window,
        IntersectionObserver: MockIntersectionObserver,
        setInterval: setIntervalMock,
        clearInterval: clearIntervalMock,
        setTimeout: setTimeoutMock,
        clearTimeout: clearTimeoutMock,
        requestAnimationFrame: requestAnimationFrameMock,
        console: { log: () => {}, error: () => {} }
    };
    context.window.document = document;

    // Pre-populate some standard elements
    document.getElementById('sound-icon-desktop');
    document.getElementById('sound-icon-mobile');
    document.getElementById('navbar');
    document.getElementById('bubbles');
    document.getElementById('mobile-menu-btn');
    document.getElementById('mobile-menu');
    document.getElementById('menu-icon');

    return {
        context,
        createdAudios,
        elementsById,
        querySelectors,
        documentListeners,
        windowListeners,
        observers,
        getIntervals: () => intervals,
        getTimeouts: () => timeouts,
        tickIntervals: () => {
            const current = [...intervals];
            current.forEach(it => it.fn());
        },
        tickTimeouts: () => {
            const current = [...timeouts];
            timeouts.length = 0;
            current.forEach(to => to.fn());
        }
    };
}

const scriptCode = fs.readFileSync('src/script.js', 'utf8');

test('Audio engine - initialization', () => {
    const env = createEnvironment();
    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Three audios should be created: bloop, ocean, seagulls
    assert.strictEqual(env.createdAudios.length, 3);

    const bloop = env.createdAudios.find(a => a.src.includes('2571'));
    const ocean = env.createdAudios.find(a => a.src.includes('1195'));
    const seagulls = env.createdAudios.find(a => a.src.includes('2384'));

    assert.ok(bloop, 'bloop audio exists');
    assert.ok(ocean, 'ocean audio exists');
    assert.ok(seagulls, 'seagulls audio exists');

    assert.strictEqual(ocean.loop, true);
    assert.strictEqual(ocean.volume, 0);
    assert.strictEqual(seagulls.volume, 0.05);
});

test('Audio engine - ocean timeupdate event loop logic', () => {
    const env = createEnvironment();
    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    const ocean = env.createdAudios.find(a => a.src.includes('1195'));

    // Simulate current time far from end
    ocean.currentTime = 2;
    ocean.duration = 10;
    ocean.triggerEvent('timeupdate');
    assert.strictEqual(ocean.currentTime, 2);

    // Simulate current time near end (buffer is 0.5s, so 9.6 is within 10 - 0.5)
    ocean.currentTime = 9.6;
    ocean.triggerEvent('timeupdate');
    assert.strictEqual(ocean.currentTime, 0.1);
    assert.ok(ocean.playCalled);
});

test('Audio engine - toggleSound on and off', () => {
    const env = createEnvironment();
    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    const toggleSound = vmContext.window.toggleSound;
    assert.strictEqual(typeof toggleSound, 'function');

    const ocean = env.createdAudios.find(a => a.src.includes('1195'));
    const seagulls = env.createdAudios.find(a => a.src.includes('2384'));

    // Desktop and mobile sound icons (pre-populated)
    const deskIcon = env.elementsById['sound-icon-desktop'];

    // 1. Toggle ON
    toggleSound();

    // Fading in ocean sound: Target volume 0.02, duration 1000ms.
    // Interval runs every 50ms, volume goes up.
    // Let's tick intervals
    assert.ok(env.getIntervals().length > 0, 'Fade in interval created');
    env.tickIntervals(); // current increases
    // Tick enough times to complete fade in (1000/50 = 20 times)
    for (let i = 0; i < 25; i++) {
        env.tickIntervals();
    }
    assert.strictEqual(ocean.volume, 0.02);

    // Seagulls should play and schedule timeout
    assert.ok(seagulls.playCalled, 'Seagulls play called');
    assert.strictEqual(env.getTimeouts().length, 1, 'Seagulls timeout scheduled');

    // Tick timeouts should play seagulls again
    seagulls.playCalled = false;
    env.tickTimeouts();
    assert.ok(seagulls.playCalled, 'Seagulls play called again on timeout');

    // Icons check
    assert.ok(deskIcon.classList.contains('fa-volume-high'));
    assert.ok(deskIcon.classList.contains('text-ocean-cyan'));
    assert.ok(!deskIcon.classList.contains('fa-volume-xmark'));

    // 2. Toggle OFF
    toggleSound();

    // Fading out ocean sound: interval is created to lower volume to 0.
    assert.ok(env.getIntervals().length > 0, 'Fade out interval created');
    for (let i = 0; i < 25; i++) {
        env.tickIntervals();
    }
    assert.strictEqual(ocean.volume, 0);
    assert.ok(ocean.pauseCalled, 'Ocean paused after fade out');

    // Icons check after toggle off
    assert.ok(!deskIcon.classList.contains('fa-volume-high'));
    assert.ok(deskIcon.classList.contains('fa-volume-xmark'));
});

test('DOM event listeners - Mouseenter on sound-hover elements', () => {
    const env = createEnvironment();

    const hoverEl = env.context.document.createElement('div');
    env.querySelectors['.sound-hover'] = [hoverEl];

    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Trigger DOMContentLoaded
    env.documentListeners['DOMContentLoaded'].forEach(cb => cb());

    // Initially sound is disabled, so entering hover element shouldn't trigger play on clones
    hoverEl.trigger('mouseenter');
    let clones = env.createdAudios.filter(a => a.isClone);
    assert.strictEqual(clones.length, 0);

    // Enable sound (which also plays 1 bloop sound internally)
    vmContext.window.toggleSound();

    // Now hover should trigger playBloopSound, which clones bloop and plays it (this will be clone #2)
    hoverEl.trigger('mouseenter');
    clones = env.createdAudios.filter(a => a.isClone);
    assert.strictEqual(clones.length, 2);
    assert.strictEqual(clones[0].volume, 0.3);
    assert.ok(clones[0].playCalled);
    assert.strictEqual(clones[1].volume, 0.3);
    assert.ok(clones[1].playCalled);
});

test('DOM event listeners - Scroll handler', () => {
    const env = createEnvironment();
    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Trigger DOMContentLoaded
    env.documentListeners['DOMContentLoaded'].forEach(cb => cb());

    const navbar = env.elementsById['navbar'];
    assert.ok(navbar, 'navbar element retrieved');

    // Scenario 1: scrollY <= 50
    env.context.window.scrollY = 30;
    env.context.document.body.scrollHeight = 1000;
    env.context.window.innerHeight = 400;
    env.windowListeners['scroll'].forEach(cb => cb());

    // Depth should be updated: maxScroll = 600, scrollY = 30 => ratio = 30/600 = 0.05
    assert.strictEqual(env.context.document.documentElement.style['--depth'], 0.05);
    assert.ok(navbar.classList.contains('py-4'));
    assert.ok(!navbar.classList.contains('py-2'));

    // Scenario 2: scrollY > 50
    env.context.window.scrollY = 120;
    env.windowListeners['scroll'].forEach(cb => cb());

    assert.strictEqual(env.context.document.documentElement.style['--depth'], 0.2);
    assert.ok(!navbar.classList.contains('py-4'));
    assert.ok(navbar.classList.contains('py-2'));
    assert.ok(navbar.classList.contains('bg-ocean-deep/80'));
});

test('DOM event listeners - Bubble generation', () => {
    const env = createEnvironment();
    const bubblesContainer = env.elementsById['bubbles'];

    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Trigger DOMContentLoaded
    env.documentListeners['DOMContentLoaded'].forEach(cb => cb());

    // 25 bubbles should have been generated and appended to the bubbles container
    assert.strictEqual(bubblesContainer.children.length, 25);
    bubblesContainer.children.forEach(b => {
        assert.ok(b.classList.contains('bubble'));
        assert.ok(b.style.width.endsWith('px'));
        assert.ok(b.style.height.endsWith('px'));
        assert.ok(b.style.left.endsWith('vw'));
        assert.ok(b.style.animationDuration.endsWith('s'));
        assert.ok(b.style.animationDelay.endsWith('s'));
    });
});

test('DOM event listeners - Mobile menu toggle', () => {
    const env = createEnvironment();
    const menuBtn = env.elementsById['mobile-menu-btn'];
    const mobileMenu = env.elementsById['mobile-menu'];
    const menuIcon = env.elementsById['menu-icon'];

    const linkEl = env.context.document.createElement('a');
    env.querySelectors['.mobile-link'] = [linkEl];

    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Trigger DOMContentLoaded
    env.documentListeners['DOMContentLoaded'].forEach(cb => cb());

    // 1. Initial state check - mobileMenu has Translate class
    // Trigger menu click to OPEN
    menuBtn.trigger('click');

    assert.ok(!mobileMenu.classList.contains('translate-x-full'));
    assert.ok(menuIcon.classList.contains('fa-xmark'));
    assert.ok(!menuIcon.classList.contains('fa-bars'));
    assert.strictEqual(env.context.document.body.style.overflow, 'hidden');

    // 2. Click a mobile link when open - should toggle CLOSED
    linkEl.trigger('click');
    assert.ok(mobileMenu.classList.contains('translate-x-full'));
    assert.ok(!menuIcon.classList.contains('fa-xmark'));
    assert.ok(menuIcon.classList.contains('fa-bars'));
    assert.strictEqual(env.context.document.body.style.overflow, '');
});

test('DOM event listeners - IntersectionObserver for reveal elements', () => {
    const env = createEnvironment();
    const revealEl = env.context.document.createElement('div');
    env.querySelectors['.reveal'] = [revealEl];

    const vmContext = vm.createContext(env.context);
    new vm.Script(scriptCode).runInContext(vmContext);

    // Trigger DOMContentLoaded
    env.documentListeners['DOMContentLoaded'].forEach(cb => cb());

    // Reveal element should initially have reveal-hidden
    assert.ok(revealEl.classList.contains('reveal-hidden'));

    // Verify IntersectionObserver is observing the element
    const observer = env.observers[0];
    assert.ok(observer);
    assert.strictEqual(observer.observed.length, 1);
    assert.strictEqual(observer.observed[0], revealEl);

    // Simulate element becoming visible in viewport (isIntersecting: true)
    observer.trigger([{ target: revealEl, isIntersecting: true }]);

    // Now reveal-hidden should be removed, and observer should stop observing it
    assert.ok(!revealEl.classList.contains('reveal-hidden'));
    assert.strictEqual(observer.observed.length, 0);
});
