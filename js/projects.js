import { CONFIG } from './config.js';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const toList = value => {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value ?? '').split(/\r?\n|\s*[|;]\s*/).map(item => item.trim()).filter(Boolean);
};

function getDriveId(url) {
  const value = String(url ?? '').trim();
  return value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || value.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    || value.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || '';
}

/**
 * Security: Protocol & Hostname Allow-List for External URLs (CWE-79 / CWE-939)
 * Strictly disallows javascript:, data:, file:, and ensures only valid https: URLs are injected.
 */
export function safeExternalUrl(raw, allowedHosts = []) {
  if (!raw) return '';
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'https:') return '';
    if (allowedHosts.length > 0) {
      const hostname = url.hostname.toLowerCase();
      const isAllowed = allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
      if (!isAllowed) return '';
    }
    return url.href;
  } catch {
    return '';
  }
}

function normalizeMediaUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  const driveId = getDriveId(value);
  if (driveId) {
    // 1200px width thumbnail is ultra-crisp for max-width 820px dialogs, cuts payload by 50%
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  }
  return safeExternalUrl(value);
}

function mediaSource(project) {
  const raw = project.thumbnail || project.img_1 || project.screenshot_1 || project.image || project.video_demo_url || '';
  return normalizeMediaUrl(raw);
}

function formatParagraphs(text) {
  if (!text) return '';
  const clean = String(text).trim();
  const paragraphs = clean.split(/\n\s*\n|\r\n\s*\r\n/);
  return paragraphs
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const isList = lines.length > 1 && lines.every(l => /^[-*•]|\d+\./.test(l));
      if (isList) {
        return `<ul class="pillar-list">${lines.map(l => `<li>${escapeHtml(l.replace(/^[-*•]\s*|\d+\.\s*/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p class="pillar-paragraph">${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('');
}

function normalizeCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  if (['kiem-com', 'project', 'commercial', 'client'].includes(value)) return 'project';
  if (['bao-dong', 'community', 'for-community', 'for community', 'opensource', 'open-source'].includes(value)) return 'community';
  if (['vo-tri', 'personal', 'personal-project', 'personal project', 'lab', 'fun'].includes(value)) return 'personal';
  return 'project';
}

function projectMedia(project) {
  const url = mediaSource(project);
  const title = escapeHtml(project.title || project.name || 'Project demo');
  if (!url) return '<div class="project-media-missing">Image preview pending</div>';
  return `<img src="${escapeHtml(url)}" alt="${title}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

function renderProjectCard(project, index) {
  const title = project.title || project.name || 'Untitled Project';
  const id = project.id || `project-${index}`;
  const role = project.role || project.dev_role || '';
  const status = project.status || project.project_status || '';
  return `
    <article class="project-card reveal-up" style="--stagger:${index}" data-project-id="${escapeHtml(id)}" tabindex="0" role="button" aria-label="Open details for ${escapeHtml(title)}">
      <div class="project-card-media">
        ${projectMedia(project)}
        <div class="project-card-overlay">
          <span class="project-card-badge">View case study</span>
          <div class="project-card-arrow" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg></div>
        </div>
      </div>
      <div class="project-card-info"><div>
        <h3 class="project-card-title">${escapeHtml(title)}</h3>
        ${role || status ? `<p class="project-card-meta">${[role, status].filter(Boolean).map(escapeHtml).join(' · ')}</p>` : ''}
      </div></div>
    </article>`;
}

const projectsById = new Map();
let lastFocusedCard = null;

export function openProjectModal(project, trigger = null) {
  const modal = document.getElementById('projectModal');
  const content = document.getElementById('modalProjectContent');
  if (!modal || !content || !project) return;

  const title = project.title || project.name || 'Untitled Project';
  const role = project.role || project.dev_role || '';
  const liveUrl = safeExternalUrl(project.live_url || project.url || '');
  const githubUrl = safeExternalUrl(project.github_url || '', ['github.com', 'www.github.com']);
  const stack = toList(project.dev_tech_stack || project.stack);

  // Cover & Case study screenshots
  const coverUrl = normalizeMediaUrl(project.thumbnail || project.image || '');
  const img1 = normalizeMediaUrl(project.img_1 || project.screenshot_1 || '');
  const img2 = normalizeMediaUrl(project.img_2 || project.screenshot_2 || '');
  const img3 = normalizeMediaUrl(project.img_3 || project.screenshot_3 || '');

  // 4 technical case sections
  const story1 = project.story_ui || project.content_1 || '';
  const story2 = project.story_backend || project.content_2 || '';
  const story3 = project.story_mail_crm || project.content_3 || '';
  const story4 = project.story_security || project.content_4 || '';

  const sections = [
    { num: '01', content: story1, image: img1 },
    { num: '02', content: story2, image: img2 },
    { num: '03', content: story3, image: img3 },
    { num: '04', content: story4, image: '' }
  ].filter(s => Boolean(String(s.content || '').trim()));

  content.innerHTML = `
    <!-- Top Cover Image -->
    ${coverUrl ? `
      <div class="case-cover-wrap">
        <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" loading="eager" decoding="async" referrerpolicy="no-referrer">
      </div>
    ` : ''}

    <div class="modal-body">
      <!-- Header & Meta: Clean title + actions on left, role badge on right -->
      <div class="modal-header-meta">
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        <div class="modal-actions-bar">
          <div class="modal-actions">
            ${liveUrl ? `<a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" class="proj-btn proj-btn-primary"><span>View live</span><i data-lucide="arrow-up-right" width="15"></i></a>` : ''}
            ${githubUrl ? `<a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener noreferrer" class="proj-btn proj-btn-secondary"><span>GitHub</span></a>` : ''}
          </div>
          ${role ? `<div class="modal-role-badge">// ${escapeHtml(role)}</div>` : ''}
        </div>
      </div>

      <!-- Long-form Case Study Stream -->
      <div class="case-study-stream">
        ${sections.length > 0 ? sections.map(s => `
          <article class="case-article-section">
            <div class="case-section-body">
              ${formatParagraphs(s.content)}
            </div>
            ${s.image ? `
              <figure class="case-inline-media">
                <img src="${escapeHtml(s.image)}" alt="${escapeHtml(title)}" loading="eager" decoding="async" referrerpolicy="no-referrer">
              </figure>
            ` : ''}
          </article>
        `).join('') : `
          ${project.dev_tagline || project.description ? `
            <div class="case-section-body">
              <p class="pillar-paragraph">${escapeHtml(project.dev_tagline || project.description)}</p>
            </div>
          ` : ''}
        `}
      </div>

      <!-- Tech Stack Footer & Playground Link -->
      <div class="modal-footer-meta">
        ${stack.length ? `
          <div class="modal-tech-stack">
            ${stack.map(tag => `<span class="tech-pill">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="modal-playground-wrap">
          <a href="${CONFIG.PLAYGROUND_URL}" target="_blank" rel="noopener noreferrer" class="playground-link">
            <span>check out my playground</span>
            <i data-lucide="arrow-up-right" width="13" height="13"></i>
          </a>
        </div>
      </div>
    </div>`;

  lastFocusedCard = trigger;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');

  const dialog = modal.querySelector('.project-modal-dialog');
  if (dialog) dialog.scrollTop = 0;

  modal.querySelector('.project-modal-close')?.focus();
  window.lucide?.createIcons();
}

export function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');

  lastFocusedCard?.focus();
  lastFocusedCard = null;
}

function initModalListeners() {
  const modal = document.getElementById('projectModal');
  if (!modal || modal.dataset.listenersInit === 'true') return;
  modal.dataset.listenersInit = 'true';

  modal.addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) closeProjectModal();
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeProjectModal();
  });

  // Prevent background scroll bleed when modal is open
  modal.addEventListener('wheel', event => {
    if (!event.target.closest('.project-modal-dialog')) {
      event.preventDefault();
    }
  }, { passive: false });

  modal.addEventListener('touchmove', event => {
    if (!event.target.closest('.project-modal-dialog')) {
      event.preventDefault();
    }
  }, { passive: false });
}

function bindGridEventDelegation() {
  const grids = document.querySelectorAll('.projects-grid');
  grids.forEach(grid => {
    if (grid.dataset.delegationInit === 'true') return;
    grid.dataset.delegationInit = 'true';

    grid.addEventListener('click', event => {
      const card = event.target.closest('.project-card');
      if (!card) return;
      const project = projectsById.get(card.dataset.projectId);
      if (project) openProjectModal(project, card);
    });

    grid.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.project-card');
      if (!card) return;
      event.preventDefault();
      const project = projectsById.get(card.dataset.projectId);
      if (project) openProjectModal(project, card);
    });
  });
}

function renderProjects(projects) {
  const containers = {
    project: document.getElementById('list-project'),
    community: document.getElementById('list-community'),
    personal: document.getElementById('list-personal')
  };
  const buckets = { project: [], community: [], personal: [] };

  projectsById.clear();
  projects.forEach((project, index) => {
    const id = String(project.id || `project-${index}`);
    project.id = id;
    projectsById.set(id, project);
    const category = normalizeCategory(project.category);
    buckets[category].push(renderProjectCard(project, buckets[category].length));
  });

  Object.entries(containers).forEach(([category, container]) => {
    if (!container) return;
    const section = container.closest('.project-category-section');
    if (section) section.hidden = buckets[category].length === 0;
    container.innerHTML = buckets[category].join('');
  });

  bindGridEventDelegation();
  initModalListeners();
  window.initReveal?.();
}

/**
 * Genuine Asset Preloader: Preloads and decodes images and fonts
 * into browser and GPU memory during the loading screen.
 */
function preloadImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(null), 7000);
    img.onload = async () => {
      clearTimeout(timeout);
      try {
        if ('decode' in img) await img.decode();
      } catch (e) {}
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = url;
  });
}

function setLoadingState(state, message = '', pct = null) {
  const screen = document.getElementById('projectLoadingScreen');
  const textEl = document.getElementById('terminalLoadingText');
  const pctEl = document.getElementById('terminalLoadingPct');
  if (!screen) return;

  const retry = screen.querySelector('[data-retry-projects]');
  screen.dataset.state = state;
  screen.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

  if (message && textEl) textEl.textContent = message;
  if (pct !== null && pctEl) pctEl.textContent = `[${pct}%]`;

  if (state === 'loading') {
    if (retry) retry.hidden = true;
    screen.classList.remove('is-fading');
    screen.hidden = false;
    document.documentElement.classList.add('is-loading');
    document.body.classList.add('is-loading');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return;
  }

  if (state === 'error') {
    if (retry) retry.hidden = false;
    screen.classList.remove('is-fading');
    screen.hidden = false;
    if (pctEl) pctEl.textContent = '[FAILED]';
    return;
  }

  if (pctEl) pctEl.textContent = '[100%]';
  if (textEl) textEl.textContent = 'ALL SYSTEMS READY & CACHED';

  setTimeout(() => {
    screen.classList.add('is-fading');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setTimeout(() => {
      screen.hidden = true;
      screen.classList.remove('is-fading');
      document.documentElement.classList.remove('is-loading');
      document.body.classList.remove('is-loading');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      requestAnimationFrame(() => {
        window.initReveal?.();
        window.startTypewriterBio?.();
      });
    }, 450);
  }, 300);
}

const loadingScreen = document.getElementById('projectLoadingScreen');
if (loadingScreen) {
  loadingScreen.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  loadingScreen.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

const CACHE_KEY = 'DYTTH_PROJECTS_CACHE_V2';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10-minute cross-session cache to protect Apps Script quota (F-04)

function getStoredCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data)) {
      const isFresh = Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS;
      return { data: parsed.data, isFresh };
    }
  } catch {}
  return null;
}

function saveStoredCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

let cachedProjects = null;

export async function loadProjects(forceRefresh = false) {
  if (forceRefresh) {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    cachedProjects = null;
  } else {
    if (cachedProjects) {
      renderProjects(cachedProjects);
      setLoadingState('ready');
      return cachedProjects;
    }
    const stored = getStoredCache();
    if (stored?.isFresh && stored.data.length > 0) {
      cachedProjects = stored.data;
      renderProjects(cachedProjects);
      setLoadingState('ready');
      return cachedProjects;
    }
  }

  setLoadingState('loading', 'INITIALIZING PORTFOLIO GATEWAY...', 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Database returned HTTP ${response.status}`);
    const payload = await response.json();
    const projects = Array.isArray(payload) ? payload : payload?.projects;
    const activeProjects = Array.isArray(projects)
      ? projects.filter(project => project && project.is_active !== false && String(project.is_active).toLowerCase() !== 'false')
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      : [];

    if (!activeProjects.length) throw new Error('Database contains no active projects');

    setLoadingState('loading', 'PARSING ASSET MANIFEST...', 25);

    // Collect all critical image URLs to preload
    const urlsToPreload = [
      'https://cdn.discordapp.com/avatars/786538506851319818/a_99c952e43bb72e7728403345617a76bb.gif?size=256',
      'https://cdn.discordapp.com/banners/786538506851319818/a_16a50fff904041bce06831634317cb93.gif?size=1024'
    ];

    activeProjects.forEach(p => {
      urlsToPreload.push(mediaSource(p));
      urlsToPreload.push(normalizeMediaUrl(p.thumbnail || p.image));
      urlsToPreload.push(normalizeMediaUrl(p.img_1 || p.screenshot_1));
      urlsToPreload.push(normalizeMediaUrl(p.img_2 || p.screenshot_2));
      urlsToPreload.push(normalizeMediaUrl(p.img_3 || p.screenshot_3));
    });

    const uniqueUrls = [...new Set(urlsToPreload.filter(Boolean))];
    const totalAssets = uniqueUrls.length;
    let completedAssets = 0;

    const textEl = document.getElementById('terminalLoadingText');
    const pctEl = document.getElementById('terminalLoadingPct');

    if (textEl) textEl.textContent = `PRE-CACHING ASSETS (0/${totalAssets})...`;

    // Preload all assets in parallel with real-time UI tracking
    const preloads = uniqueUrls.map(url => {
      return preloadImage(url).then(res => {
        completedAssets++;
        const currentPct = Math.min(99, 25 + Math.floor((completedAssets / totalAssets) * 73));
        if (pctEl) pctEl.textContent = `[${currentPct}%]`;
        if (textEl) textEl.textContent = `PRE-CACHING ASSETS (${completedAssets}/${totalAssets})...`;
        return res;
      });
    });

    await Promise.all([
      Promise.all(preloads),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]);

    cachedProjects = activeProjects;
    saveStoredCache(activeProjects);
    renderProjects(activeProjects);
    setLoadingState('ready');
    return activeProjects;
  } catch (error) {
    console.error('[dytth_young] Project database load failed:', error);
    // Stale Fallback (F-04): If network failed or quota was reached, serve last known good cache
    const stale = getStoredCache();
    if (stale?.data && stale.data.length > 0) {
      console.warn('[dytth_young] Serving stale cache due to network or quota limit');
      cachedProjects = stale.data;
      renderProjects(cachedProjects);
      setLoadingState('ready');
      return cachedProjects;
    }
    setLoadingState('error', 'CONNECTION FAILED: RETRY AVAILABLE');
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-retry-projects]')) loadProjects(true);
});
