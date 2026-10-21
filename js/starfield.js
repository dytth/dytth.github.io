import { CONFIG } from './config.js';

/**
 * High-performance Starfield Background
 * Optimized for 60/120/144 FPS with low GPU fill-rate overhead.
 */
export function startStarfield(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const colors = ['#ffffff', '#e2f8ff', '#d1c4e9', '#5ee7d7', '#93c5fd', '#a5f3fc', '#c4b5fd'];
  let width = 0;
  let height = 0;
  let stars = [];
  let sparks = [];
  let isRunning = true;
  let animationId = null;
  const pointer = { x: -9999, y: -9999, active: false };

  const makeSpark = (x, y) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.2 + 0.6;
    return {
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 2.0 + 0.8,
      alpha: 1,
      decay: Math.random() * 0.03 + 0.018,
      color: Math.random() > 0.4 ? '#5ee7d7' : '#9e8cff'
    };
  };

  function resize() {
    // Cap DPR at 1.5 to dramatically reduce fill-rate on 4K/Retina displays while maintaining crisp stars
    const ratio = Math.min(window.devicePixelRatio || 1, CONFIG.STARFIELD.MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const isMobile = width < 768;
    const count = isMobile
      ? CONFIG.STARFIELD.MOBILE_STAR_COUNT
      : CONFIG.STARFIELD.DESKTOP_STAR_COUNT;

    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.4,
      baseAlpha: Math.random() * 0.65 + 0.3,
      t: Math.random() * 6.28,
      s: Math.random() * 0.028 + 0.012,
      c: colors[Math.floor(Math.random() * colors.length)],
      glow: Math.random() < 0.16,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1
    }));
  }

  // Pointer tracking (desktop mouse only, ignored on touch for zero drag contention)
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') {
      pointer.active = false;
      return;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    if (sparks.length < 32 && Math.random() < 0.65) {
      sparks.push(makeSpark(pointer.x, pointer.y));
    }
  }, { passive: true });

  window.addEventListener('pointerleave', () => { pointer.active = false; });
  window.addEventListener('resize', resize, { passive: true });

  resize();

  const radius = CONFIG.STARFIELD.INTERACTION_RADIUS;
  const radiusSq = radius * radius;

  function frame() {
    // Skip all canvas calculations when tab is hidden or when modal dialog is open
    if (!document.hidden && !document.body.classList.contains('modal-open')) {
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, width, height);

      const hasPointer = pointer.active;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.x = (star.x + star.vx + width) % width;
        star.y = (star.y + star.vy + height) % height;
        star.t += star.s;

        let near = 0;
        if (hasPointer) {
          const dx = star.x - pointer.x;
          const dy = star.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < radiusSq) {
            const distance = Math.sqrt(distSq);
            near = Math.max(0, 1 - distance / radius);
            if (near > 0.14) {
              ctx.strokeStyle = `rgba(94, 231, 215, ${(near * 0.32).toFixed(3)})`;
              ctx.lineWidth = near * 1.1;
              ctx.beginPath();
              ctx.moveTo(star.x | 0, star.y | 0);
              ctx.lineTo(pointer.x | 0, pointer.y | 0);
              ctx.stroke();
            }
          }
        }

        const twinkle = 0.65 + 0.35 * Math.sin(star.t);
        const alpha = Math.min(1, star.baseAlpha * twinkle + near * 0.55);

        // Subtle glow for select stars
        if (star.glow) {
          ctx.globalAlpha = alpha * 0.22;
          ctx.fillStyle = star.c;
          ctx.beginPath();
          ctx.arc(star.x | 0, star.y | 0, star.r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.c;
        ctx.beginPath();
        ctx.arc(star.x | 0, star.y | 0, star.r + near * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cursor sparks (desktop pointer)
      if (sparks.length > 0) {
        for (let i = sparks.length - 1; i >= 0; i--) {
          const spark = sparks[i];
          spark.x += spark.vx;
          spark.y += spark.vy;
          spark.alpha -= spark.decay;
          if (spark.alpha <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = spark.alpha * 0.85;
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x | 0, spark.y | 0, spark.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
    }

    if (isRunning) {
      animationId = requestAnimationFrame(frame);
    }
  }

  animationId = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pointer.active = false;
    }
  });

  return () => {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
  };
}
