/* Quartermaster marketing behaviour.
   1) Start-here dialog (unchanged behaviour, kept first so motion can never block it).
   2) Scroll-reveal system: IntersectionObserver, one class toggle, no layout reads.
   3) Hero product parallax: rAF-coalesced, reads window.scrollY only; geometry is
      cached on load/resize so the scroll path never triggers layout.
   All motion is opt-in via the .qm-motion class set in the document head, which is
   absent under prefers-reduced-motion or when scripting is unavailable. */
(() => {
  /* ---------- 1. Start-here dialog ---------- */
  const portfolioHandoffKey = 'quartermaster.pendingPortfolio.v1';
  const backdrop = document.getElementById('start-dialog');
  const dialog = backdrop?.querySelector('[role="dialog"]');
  if (backdrop && dialog) {
    // The source keeps the modal inside .marketing-page for readable markup,
    // but an inert ancestor also disables every control inside the dialog.
    // Promote it to a direct body child before making the page behind it inert.
    if (backdrop.parentElement !== document.body) document.body.appendChild(backdrop);
    let returnFocus = null;
    let inerted = [];

    const focusStops = () => Array.from(dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'))
      .filter(element => element.getClientRects().length && element.getAttribute('aria-hidden') !== 'true');

    const choosePortfolioFile = link => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.hidden = true;
      const finish = () => input.remove();
      input.oncancel = finish;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return finish();
        try {
          const text = typeof file.text === 'function'
            ? await file.text()
            : await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('Could not read the selected file.'));
                reader.readAsText(file);
              });
          sessionStorage.setItem(portfolioHandoffKey, JSON.stringify({
            name: String(file.name || 'my-portfolio.json').slice(0, 200),
            text,
          }));
          window.location.assign(link.href);
        } catch (_) {
          // Storage may be unavailable or the file may exceed its local quota.
          // The app's ordinary picker remains available as the safe fallback.
          window.location.assign(link.href);
        } finally {
          finish();
        }
      };
      document.body.appendChild(input);
      input.click();
    };

    const openDialog = () => {
      returnFocus = document.activeElement;
      backdrop.hidden = false;
      document.body.classList.add('dialog-open');
      inerted = Array.from(document.body.children).filter(element => element !== backdrop && !element.inert);
      inerted.forEach(element => { element.inert = true; });
      const first = focusStops()[0];
      (first || dialog).focus();
    };

    const closeDialog = () => {
      backdrop.hidden = true;
      document.body.classList.remove('dialog-open');
      inerted.forEach(element => { element.inert = false; });
      inerted = [];
      if (location.hash === '#start') history.replaceState(null, '', location.pathname + location.search);
      returnFocus?.focus?.();
    };

    document.addEventListener('click', event => {
      const openPortfolio = event.target.closest('[data-open-portfolio]');
      if (openPortfolio && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        choosePortfolioFile(openPortfolio);
        return;
      }
      const start = event.target.closest('a[href="#start"],a[href="/#start"]');
      if (start) {
        event.preventDefault();
        history.replaceState(null, '', '#start');
        openDialog();
        return;
      }
      if (event.target.closest('[data-close-start]') || event.target === backdrop) closeDialog();
    });
    document.addEventListener('keydown', event => {
      if (backdrop.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key === 'Tab') {
        const stops = focusStops();
        if (!stops.length) { event.preventDefault(); dialog.focus(); return; }
        const first = stops[0], last = stops[stops.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    if (location.hash === '#start') openDialog();
  }

  /* ---------- Motion gate ---------- */
  const root = document.documentElement;
  const reduceQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const motionOn = () => root.classList.contains('qm-motion') && !reduceQuery?.matches;
  if (!('IntersectionObserver' in window)) root.classList.remove('qm-motion');

  /* ---------- Landing story navigation ---------- */
  function initStoryNavigation() {
    const sections = Array.from(document.querySelectorAll('[data-story]'));
    if (!sections.length || !('IntersectionObserver' in window)) return;

    let active = null;
    let ticking = false;
    const setActive = section => {
      if (active === section) return;
      sections.forEach(item => item.classList.toggle('is-story-active', item === section));
      document.querySelectorAll('.marketing-nav a[href*="#lp-"]').forEach(link => {
        const match = section && link.hash === '#' + section.id;
        if (match) link.setAttribute('aria-current', 'location');
        else if (link.getAttribute('aria-current') === 'location') link.removeAttribute('aria-current');
      });
      active = section;
    };

    const updateActive = () => {
      ticking = false;
      const focusY = (window.innerHeight || 800) * .475;
      const section = sections.find(item => {
        const rect = item.getBoundingClientRect();
        return rect.top <= focusY && rect.bottom > focusY;
      }) || null;
      setActive(section);
    };

    const queueUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateActive);
    };

    const observer = new IntersectionObserver(queueUpdate, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate, { passive: true });
    updateActive();
  }

  /* ---------- Whole-portfolio focus rings ---------- */
  function initFocusRings() {
    const rings = Array.from(document.querySelectorAll('[data-focus-ring]'));
    const callouts = Array.from(document.querySelectorAll('[data-focus-target]'));
    if (rings.length < 2) return;
    const show = id => rings.forEach(ring => ring.classList.toggle('is-active', ring.dataset.focusRing === String(id)));
    if (!motionOn()) { rings.forEach(ring => ring.classList.add('is-active')); return; }
    let current = 1;
    let lockedUntil = 0;
    const timer = window.setInterval(() => {
      if (Date.now() < lockedUntil) return;
      current = current === 1 ? 2 : 1;
      show(current);
    }, 3400);
    callouts.forEach(callout => {
      const lock = () => {
        current = Number(callout.dataset.focusTarget) || 1;
        lockedUntil = Date.now() + 4000;
        show(current);
      };
      callout.addEventListener('mouseenter', lock);
      callout.addEventListener('focusin', lock);
    });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  /* ---------- 2. Scroll reveals ---------- */
  function initReveals() {
    // Stagger index per group: children of [data-reveal-group] inherit 0,1,2,…
    document.querySelectorAll('[data-reveal-group]').forEach(group => {
      group.querySelectorAll(':scope > [data-reveal]').forEach((el, i) => {
        el.style.setProperty('--i', String(Math.min(i, 8)));
      });
    });

    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    // The four outcome signposts are part of the page-load sequence, even on
    // shorter screens where their bottom edge begins just below the fold.
    const loadValues = document.querySelectorAll('.value-strip > [data-reveal]');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      loadValues.forEach(value => value.classList.add('is-in'));
    }));

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target); // reveal once; nothing re-animates on scroll-up
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    targets.forEach(el => observer.observe(el));
  }

  /* ---------- Hero product screenshots: settle in as each image lands ---------- */
  function initShots() {
    const shots = document.querySelectorAll('[data-shot]');
    if (!shots.length) return;
    shots.forEach(shot => {
      const img = shot.querySelector('img');
      const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => shot.classList.add('is-in')));
      if (!img || img.complete) settle();
      else {
        img.addEventListener('load', settle, { once: true });
        img.addEventListener('error', settle, { once: true }); // never leave a shot hidden
      }
    });
  }

  /* ---------- 3. Hero parallax ---------- */
  function initParallax() {
    const layers = Array.from(document.querySelectorAll('[data-parallax]'));
    const stage = document.querySelector('.landing-product-stage');
    if (!layers.length || !stage) return;

    let start = 0, range = 1, active = false, ticking = false;

    const measure = () => {
      // One layout read, off the scroll path.
      const rect = stage.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const vh = window.innerHeight || 800;
      start = top - vh * 0.85;
      range = Math.max(vh * 1.1, 1);
      active = window.innerWidth > 900 && motionOn();
      if (!active) layers.forEach(l => l.style.removeProperty('--parallax'));
      else apply();
    };

    const apply = () => {
      const p = Math.min(1, Math.max(0, (window.scrollY - start) / range));
      layers.forEach(layer => {
        const distance = parseFloat(layer.dataset.parallax) || 0;
        layer.style.setProperty('--parallax', (p * distance).toFixed(2));
      });
    };

    const onScroll = () => {
      if (!active || ticking) return;
      ticking = true;
      requestAnimationFrame(() => { apply(); ticking = false; });
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    reduceQuery?.addEventListener?.('change', () => {
      if (reduceQuery.matches) root.classList.remove('qm-motion');
      measure();
    });
  }

  initStoryNavigation();
  initFocusRings();
  if (motionOn()) {
    initReveals();
    initShots();
    initParallax();
  }
})();
