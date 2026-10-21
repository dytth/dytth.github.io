import { CONFIG } from './config.js';
import { initTracker } from './tracker.js?v=20261021-2';
import { DiscordProfile } from './discord.js';
import { startStarfield } from './starfield.js';
import { loadProjects } from './projects.js?v=20261019-43';

/**
 * Reveal Observer for Smooth Scroll Entrances & Exits
 * - Scrolling down: Category title slides in from LEFT, cards jump up from BOTTOM sequentially
 * - Scrolling up: As elements leave towards bottom, category title slides back LEFT & vanishes
 */
let revealObserver = null;

export function initReveal() {
  const nodes = document.querySelectorAll('.reveal, .reveal-from-left, .reveal-up');
  if (!('IntersectionObserver' in window)) {
    nodes.forEach(node => node.classList.add('on'));
    return;
  }

  if (revealObserver) {
    revealObserver.disconnect();
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const { isIntersecting, target, boundingClientRect } = entry;
      if (isIntersecting) {
        target.classList.add('on');
      } else {
        // Only remove 'on' when element leaves through the bottom (user scrolling up)
        // Keep 'on' when element is above the top of the viewport
        if (boundingClientRect.top > 0) {
          target.classList.remove('on');
        }
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -70px 0px'
  });

  nodes.forEach(node => {
    revealObserver.observe(node);
  });
}
window.initReveal = initReveal;

/**
 * Copy Discord Tag to Clipboard
 */
function initCopy() {
  const toast = document.getElementById('toast');
  let timer;

  document.querySelectorAll('[data-action="copy-discord"]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(CONFIG.DISCORD_TAG);
      } catch {
        const area = Object.assign(document.createElement('textarea'), { value: CONFIG.DISCORD_TAG });
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      if (toast) {
        toast.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => toast.classList.remove('show'), 1800);
      }
    });
  });
}

/**
 * Refine section subtitles
 */
function refineSectionHeadings() {
  const sections = { certs: ['Certificates', 'Proof that I occasionally finish the course'] };
  Object.entries(sections).forEach(([id, [title, subtitle]]) => {
    const head = document.querySelector(`#${id} .section-head`);
    if (!head) return;
    head.querySelector('h2').textContent = title;
    if (!head.querySelector('p')) head.insertAdjacentHTML('beforeend', `<p>${subtitle}</p>`);
  });
}

/**
 * Contact Spotlight Slogan Effect
 * Optimized: Eliminates layout thrashing by caching bounding boxes and scheduling style writes via requestAnimationFrame.
 */
function initContactSpotlight() {
  const heading = document.querySelector('.contact h2');
  if (!heading) return;

  const lines = [...heading.querySelectorAll('.slogan-line')];
  let lineBoxes = [];
  let leaveTimer = null;
  let rafId = null;

  function updateBoxes() {
    lineBoxes = lines.map(line => line.getBoundingClientRect());
  }

  heading.addEventListener('pointerenter', () => {
    clearTimeout(leaveTimer);
    updateBoxes();
  });

  window.addEventListener('resize', updateBoxes, { passive: true });

  heading.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    clearTimeout(leaveTimer);

    if (!heading.classList.contains('is-lit')) {
      heading.classList.add('is-lit');
    }

    if (rafId) return;
    const clientX = event.clientX;
    const clientY = event.clientY;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      lines.forEach((line, index) => {
        const box = lineBoxes[index] || line.getBoundingClientRect();
        line.style.setProperty('--light-x', `${clientX - box.left}px`);
        line.style.setProperty('--light-y', `${clientY - box.top}px`);
      });
    });
  });

  heading.addEventListener('pointerleave', () => {
    leaveTimer = setTimeout(() => {
      heading.classList.remove('is-lit');
    }, 70);
  });
}

/**
 * Typewriter Bio Animation
 * Runs gracefully after the initial loading screen completes.
 */
export function startTypewriterBio() {
  const el = document.getElementById('discordBio');
  if (!el || el.dataset.typed === 'true') return;
  el.dataset.typed = 'true';

  const text = CONFIG.BIO_TEXT;
  el.textContent = "";

  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.textContent = '_';
  el.appendChild(cursor);

  let i = 0;
  setTimeout(() => {
    const timer = setInterval(() => {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i]);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(() => cursor.classList.add('cursor-idle'), 800);
      }
    }, CONFIG.TYPEWRITER_SPEED_MS);
  }, CONFIG.TYPEWRITER_INITIAL_DELAY_MS);
}
window.startTypewriterBio = startTypewriterBio;

/**
 * Scroll Scatter Hero Title Animation
 * Optimized: Releases GPU compositing layers when scrolled past the hero section.
 */
function initScrollScatter() {
  const chars = document.querySelectorAll('#hero-title .scatter-char');
  const alias = document.getElementById('heroAlias') || document.querySelector('.hero-center .alias');
  if (!chars.length) return;

  const vectors = [
    { dx: -75, dy: -200, rot: -32 },
    { dx: -55, dy: -240, rot: -18 },
    { dx: -35, dy: -170, rot: -12 },
    { dx: -18, dy: -270, rot: 15 },
    { dx: -6,  dy: -210, rot: -8 },
    { dx: 0,   dy: -300, rot: 45 },
    { dx: 14,  dy: -215, rot: 14 },
    { dx: 34,  dy: -260, rot: -16 },
    { dx: 54,  dy: -185, rot: 22 },
    { dx: 76,  dy: -235, rot: -25 },
    { dx: 102, dy: -205, rot: 35 }
  ];

  let ticking = false;
  let isFullyScattered = false;
  let isAtTop = true;

  function update() {
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Lock into final scattered state when past the hero, release will-change GPU layers
    if (scrollY > 340) {
      if (!isFullyScattered) {
        chars.forEach((char, i) => {
          const v = vectors[i % vectors.length];
          char.style.transform = `translate3d(${v.dx}px, ${v.dy}px, 0) rotate(${v.rot}deg) scale(0.85)`;
          char.style.opacity = '0';
          char.style.willChange = 'auto';
        });
        if (alias) {
          alias.style.transform = 'translate3d(0, -35px, 0)';
          alias.style.opacity = '0';
          alias.style.willChange = 'auto';
        }
        isFullyScattered = true;
        isAtTop = false;
      }
      return;
    }

    // Lock into top state when at scroll top
    if (scrollY <= 0) {
      if (!isAtTop) {
        chars.forEach(char => {
          char.style.transform = 'none';
          char.style.opacity = '1';
          char.style.willChange = 'transform, opacity';
        });
        if (alias) {
          alias.style.transform = 'none';
          alias.style.opacity = '1';
          alias.style.willChange = 'transform, opacity';
        }
        isAtTop = true;
        isFullyScattered = false;
      }
      return;
    }

    isFullyScattered = false;
    isAtTop = false;

    const progress = Math.min(1.4, scrollY / 260);
    const ease = Math.pow(Math.min(1, progress), 1.15);
    const opacity = Math.max(0, 1 - progress * 1.18);

    chars.forEach((char, i) => {
      char.style.willChange = 'transform, opacity';
      const v = vectors[i % vectors.length];
      const curDx = v.dx * ease;
      const curDy = v.dy * ease;
      const curRot = v.rot * ease;
      const curScale = 1 - 0.15 * ease;
      char.style.transform = `translate3d(${curDx.toFixed(1)}px, ${curDy.toFixed(1)}px, 0) rotate(${curRot.toFixed(1)}deg) scale(${curScale.toFixed(2)})`;
      char.style.opacity = opacity.toFixed(3);
    });

    if (alias) {
      alias.style.willChange = 'transform, opacity';
      const aliasEase = Math.pow(Math.min(1, progress), 1.1);
      const aliasOpacity = Math.max(0, 1 - progress * 1.35);
      alias.style.transform = `translate3d(0, ${(-35 * aliasEase).toFixed(1)}px, 0)`;
      alias.style.opacity = aliasOpacity.toFixed(3);
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  update();
}

/**
 * Application Bootstrap
 */
async function boot() {
  try { initTracker(CONFIG.TRACKING_URL); } catch (e) { console.warn(e); }
  try { initScrollScatter(); } catch (e) { console.warn(e); }
  try { initCopy(); } catch (e) { console.warn(e); }
  try { window.lucide?.createIcons(); } catch (e) {}
  try { startStarfield(document.getElementById('starfield')); } catch (e) { console.warn(e); }
  try { refineSectionHeadings(); } catch (e) {}
  try { initContactSpotlight(); } catch (e) {}

  try {
    const discord = new DiscordProfile();
    discord.start();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) discord.resume();
    });
    window.addEventListener('pagehide', () => discord.stop(), { once: true });
  } catch (e) {
    console.error('Discord Lanyard init error:', e);
  }

  try { initReveal(); } catch (e) {}
  try { await loadProjects(); } catch (e) { console.warn(e); }
  try { initReveal(); } catch (e) {}
  try { startTypewriterBio(); } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
