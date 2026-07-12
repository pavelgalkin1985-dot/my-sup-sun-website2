// --- 1. АУДИО ДВИЖОК: ПРЕМИАЛЬНЫЙ БУЛЬК, ТИХОЕ МОРЕ, ЧАЙКИ ---
let soundEnabled = false;
let seagullsInterval = null;

// Загружаем реальные звуки высокого качества 
const sounds = {
    bloop: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
    ocean: new Audio('https://assets.mixkit.co/active_storage/sfx/1195/1195-preview.mp3'),
    seagulls: new Audio('https://assets.mixkit.co/active_storage/sfx/2384/2384-preview.mp3')
};

// Настройки 
sounds.ocean.loop = true;
sounds.ocean.volume = 0; 
sounds.seagulls.volume = 0.05; // Чайки еле слышно 

// Идеальное зацикливание моря (убирает щелчок в конце mp3)
sounds.ocean.addEventListener('timeupdate', function() {
    let buffer = 0.5; // за полсекунды до конца
    if(this.currentTime > this.duration - buffer) {
        this.currentTime = 0.1;
        this.play();
    }
});

function playBloopSound() {
    if (!soundEnabled) return;
    const drop = sounds.bloop.cloneNode();
    drop.volume = 0.3; // Сочный, не громкий бульк
    drop.play().catch(e => {});
}

function playSeagulls() {
    if (!soundEnabled) return;
    sounds.seagulls.play().catch(e => {});
    const nextTime = Math.random() * 15000 + 15000;
    seagullsInterval = setTimeout(playSeagulls, nextTime);
}

function fadeAudio(audioNode, targetVolume, duration) {
    const startVolume = audioNode.volume;
    if (targetVolume > startVolume) {
        audioNode.play().catch(e => {});
    }
    if (duration <= 0 || startVolume === targetVolume) {
        audioNode.volume = targetVolume;
        if (targetVolume === 0) {
            audioNode.pause();
        }
        return;
    }
    const step = (targetVolume - startVolume) / (duration / 50);
    let current = startVolume;
    const fader = setInterval(() => {
        current += step;
        if ((step > 0 && current >= targetVolume) || (step < 0 && current <= targetVolume)) {
            audioNode.volume = targetVolume;
            if (targetVolume === 0) {
                audioNode.pause();
            }
            clearInterval(fader);
        } else {
            audioNode.volume = current;
        }
    }, 50);
}

function toggleSound() {
    if (soundEnabled) {
        fadeAudio(sounds.ocean, 0, 1000);
        clearTimeout(seagullsInterval);
        soundEnabled = false;
    } else {
        fadeAudio(sounds.ocean, 0.02, 1000); // Громкость моря 2% (очень тихий фон)
        soundEnabled = true;
        playSeagulls();
    }
    updateSoundIcons();
    playBloopSound();
}

function updateSoundIcons() {
    const deskIcon = document.getElementById('sound-icon-desktop');
    const mobIcon = document.getElementById('sound-icon-mobile');
    
    [deskIcon, mobIcon].forEach(icon => {
        if(!icon) return;
        icon.classList.remove('animate-pulse-icon');
        
        if(soundEnabled) {
            icon.classList.remove('fa-volume-xmark');
            icon.classList.add('fa-volume-high', 'text-ocean-cyan');
        } else {
            icon.classList.remove('fa-volume-high', 'text-ocean-cyan');
            icon.classList.add('fa-volume-xmark');
        }
    });
}

// Сделаем функцию глобальной для вызова из HTML
window.toggleSound = toggleSound;

// --- 2. ВИЗУАЛ И ЛОГИКА ---
document.addEventListener('DOMContentLoaded', () => {
    
    document.querySelectorAll('.sound-hover').forEach(el => {
        el.addEventListener('mouseenter', playBloopSound);
    });

    window.addEventListener('scroll', () => {
        requestAnimationFrame(() => {
            let maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
            let scrollY = window.scrollY;
            let depthRatio = Math.min(Math.max(scrollY / maxScroll, 0), 1);
            document.documentElement.style.setProperty('--depth', depthRatio);

            const navbar = document.getElementById('navbar');
            if (scrollY > 50) {
                navbar.classList.add('bg-ocean-deep/80', 'backdrop-blur-xl', 'border-b', 'border-white/5');
                navbar.classList.remove('py-4');
                navbar.classList.add('py-2');
            } else {
                navbar.classList.remove('bg-ocean-deep/80', 'backdrop-blur-xl', 'border-b', 'border-white/5');
                navbar.classList.add('py-4');
                navbar.classList.remove('py-2');
            }
        });
    }, { passive: true });

    const container = document.getElementById('bubbles');
    if (container) {
        for(let i=0; i<25; i++) {
            let bubble = document.createElement('div');
            bubble.classList.add('bubble');
            let size = Math.random() * 12 + 4; 
            let left = Math.random() * 100; 
            let duration = Math.random() * 12 + 12; 
            let delay = Math.random() * 15; 
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${left}vw`;
            bubble.style.animationDuration = `${duration}s`;
            bubble.style.animationDelay = `${delay}s`;
            container.appendChild(bubble);
        }
    }

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    let isMenuOpen = false;

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) {
            mobileMenu.classList.remove('translate-x-full');
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-xmark');
            document.body.style.overflow = 'hidden';
        } else {
            mobileMenu.classList.add('translate-x-full');
            menuIcon.classList.remove('fa-xmark');
            menuIcon.classList.add('fa-bars');
            document.body.style.overflow = '';
        }
        playBloopSound();
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => { if(isMenuOpen) toggleMenu(); });
    });

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => el.classList.add('reveal-hidden'));

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('reveal-hidden');
                obs.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.1 });
    
    revealElements.forEach(el => observer.observe(el));
});
