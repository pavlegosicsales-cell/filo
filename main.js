/* ============================================================
   Mala matura NBG - main.js
   ============================================================ */

// Paste the Apps Script URL here after running Skill 03
const ENDPOINT = '';

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = function (v, min, max) { return v < min ? min : (v > max ? max : v); };

  /* ============================================================
     Smooth skrol sa inercijom
     ============================================================ */
  const smooth = (function initSmoothScroll() {
    const api = { to: null, sync: null, enabled: false };
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    /* Skrol do odredista, koristi se i kad inercija nije ukljucena */
    function animateTo(destination, duration) {
      const start = window.scrollY;
      const distance = destination - start;
      if (Math.abs(distance) < 1) return;
      const time = duration || clamp(Math.abs(distance) * 0.6, 420, 1100);
      const t0 = performance.now();

      function step(now) {
        const p = clamp((now - t0) / time, 0, 1);
        // easeInOutCubic
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, start + distance * e);
        if (p < 1) window.requestAnimationFrame(step);
        else if (api.sync) api.sync();
      }
      window.requestAnimationFrame(step);
    }

    api.to = animateTo;

    if (reduceMotion || !finePointer) {
      api.sync = function () {};
      return api;
    }

    /* Inercija na tocku misa */
    document.documentElement.classList.add('js-lenis');
    api.enabled = true;

    let target = window.scrollY;
    let currentPos = target;
    let running = false;
    let wheelActive = false;
    let idleTimer = null;

    api.sync = function () { target = currentPos = window.scrollY; };

    function frame() {
      const diff = target - currentPos;
      if (Math.abs(diff) < 0.35) {
        currentPos = target;
        window.scrollTo(0, currentPos);
        running = false;
        return;
      }
      currentPos += diff * 0.115;
      window.scrollTo(0, currentPos);
      window.requestAnimationFrame(frame);
    }

    /* Ako rAF ne radi (npr. kartica u pozadini), skrol ne sme da ostane mrtav */
    let watchdog = null;
    function armWatchdog() {
      window.clearTimeout(watchdog);
      const snapshot = currentPos;
      watchdog = window.setTimeout(function () {
        if (running && Math.abs(currentPos - snapshot) < 0.5 && Math.abs(target - currentPos) > 1) {
          currentPos = target;
          window.scrollTo(0, currentPos);
          running = false;
        }
      }, 320);
    }

    function start() {
      armWatchdog();
      if (!running) { running = true; window.requestAnimationFrame(frame); }
    }

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;
      if (document.body.style.overflow === 'hidden') return;
      // pusti nativni skrol unutar elemenata koji imaju svoj skrol
      let node = e.target;
      while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight + 1) {
          const style = window.getComputedStyle(node).overflowY;
          if (style === 'auto' || style === 'scroll') return;
        }
        node = node.parentElement;
      }

      e.preventDefault();
      const unit = e.deltaMode === 1 ? 18 : (e.deltaMode === 2 ? window.innerHeight : 1);
      target = clamp(target + e.deltaY * unit, 0, maxScroll());
      wheelActive = true;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () { wheelActive = false; }, 220);
      start();
    }, { passive: false });

    /* Ako korisnik skroluje na drugi nacin (traka, tastatura, dodir), uskladi se */
    window.addEventListener('scroll', function () {
      if (!running && !wheelActive) { currentPos = target = window.scrollY; }
    }, { passive: true });

    window.addEventListener('resize', function () { api.sync(); });

    return api;
  })();

  /* Klik na sidro */
  (function initAnchors() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href*="#"]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname || url.origin !== window.location.origin) return;

      const el = document.getElementById(url.hash.slice(1));
      if (!el) return;

      e.preventDefault();
      /* Donja ivica zaglavlja, racuna i crvenu traku iznad nava */
      const nav = document.getElementById('nav');
      const offset = nav ? nav.getBoundingClientRect().bottom + 10 : 0;
      const dest = window.scrollY + el.getBoundingClientRect().top - offset;

      if (reduceMotion) { window.scrollTo(0, dest); }
      else { smooth.to(dest); }

      history.pushState(null, '', url.hash);
    });
  })();

  /* ============================================================
     Mobilni meni
     ============================================================ */
  (function initNav() {
    const burger = document.getElementById('burger');
    const menu = document.getElementById('menu');
    const overlay = document.getElementById('navOverlay');
    if (!burger || !menu) return;

    function setOpen(open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Zatvori meni' : 'Otvori meni');
      menu.classList.toggle('is-open', open);
      if (overlay) overlay.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });

    if (overlay) overlay.addEventListener('click', function () { setOpen(false); });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1200) setOpen(false);
    });
  })();

  /* ============================================================
     Pozadina nava na skrol
     ============================================================ */
  (function initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav || nav.classList.contains('is-solid')) return;
    let ticking = false;

    function update() {
      nav.classList.toggle('is-solid', window.scrollY > 20);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ============================================================
     Reveal na skrol
     ============================================================ */
  (function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ============================================================
     Vijugava traka sa tekstom
     ============================================================ */
  (function initTicker() {
    const svg = document.getElementById('tickerSvg');
    const band = document.getElementById('tickerPath');
    const text = document.getElementById('tickerText');
    if (!svg || !band || !text) return;

    /* Sinusna putanja, isti oblik kao na inspo sajtu */
    const W = 1600, H = 300, AMP = 74, PERIODS = 3, STEPS = 180;
    let d = '';
    for (let i = 0; i <= STEPS; i++) {
      const x = 30 + (i / STEPS) * (W - 60);
      const y = H / 2 + AMP * Math.sin((i / STEPS) * PERIODS * 2 * Math.PI);
      d += (i === 0 ? 'M ' : ' L ') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    band.setAttribute('d', d);

    /* Tekst se ponavlja dok ne prekrije celu putanju */
    const pathLen = band.getTotalLength();
    const unit = text.getAttribute('data-unit') || '';
    const probe = text.querySelector('textPath');
    probe.textContent = unit;
    let guard = 0;
    while (probe.getComputedTextLength() < pathLen * 2 && guard < 40) {
      probe.textContent += unit;
      guard++;
    }

    if (reduceMotion) return;

    let offset = 0;
    let last = performance.now();
    let running = true;
    const loopLen = probe.getComputedTextLength() / (guard + 1);

    function frame(now) {
      const dt = Math.min(now - last, 60);
      last = now;
      if (running) {
        offset -= dt * 0.045;
        if (offset < -loopLen) offset += loopLen;
        probe.setAttribute('startOffset', offset);
      }
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      last = performance.now();
    });
  })();

  /* ============================================================
     Galerija poruka roditelja
     ============================================================ */
  (function initSlider() {
    const root = document.getElementById('viberSlider');
    if (!root) return;

    const viewport = root.querySelector('.slider__viewport');
    const slides = Array.prototype.slice.call(root.querySelectorAll('.slider__slide'));
    const arrows = Array.prototype.slice.call(root.querySelectorAll('.slider__arrow'));
    const dotsBox = document.getElementById('viberDots');
    if (!viewport || !slides.length) return;

    /* Tackice */
    const dots = slides.map(function (slide, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider__dot';
      dot.setAttribute('aria-label', 'Poruka ' + (i + 1));
      dot.addEventListener('click', function () { goTo(i); });
      if (dotsBox) dotsBox.appendChild(dot);
      return dot;
    });

    function step() {
      if (slides.length < 2) return slides[0].offsetWidth;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }

    function currentIndex() {
      const s = step() || 1;
      return Math.round(viewport.scrollLeft / s);
    }

    function goTo(index) {
      const max = slides.length - 1;
      const i = index < 0 ? 0 : (index > max ? max : index);
      viewport.scrollTo({ left: i * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    arrows.forEach(function (btn) {
      btn.addEventListener('click', function () {
        goTo(currentIndex() + Number(btn.getAttribute('data-dir')));
      });
    });

    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex() - 1); }
    });

    function paint() {
      const i = currentIndex();
      dots.forEach(function (dot, n) { dot.classList.toggle('is-active', n === i); });
      const atStart = viewport.scrollLeft <= 2;
      const atEnd = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 2;
      arrows.forEach(function (btn) {
        const dir = Number(btn.getAttribute('data-dir'));
        btn.disabled = (dir < 0 && atStart) || (dir > 0 && atEnd);
      });
    }

    let raf = false;
    viewport.addEventListener('scroll', function () {
      if (!raf) { raf = true; window.requestAnimationFrame(function () { paint(); raf = false; }); }
    }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  })();

  /* ============================================================
     FAQ akordeon
     ============================================================ */
  (function initFaq() {
    const items = document.querySelectorAll('.faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      const btn = item.querySelector('.faq__q');
      if (!btn) return;
      btn.addEventListener('click', function () {
        const isOpen = item.classList.contains('is-open');
        items.forEach(function (other) {
          other.classList.remove('is-open');
          const b = other.querySelector('.faq__q');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  })();

  /* ============================================================
     Wizard forma
     ============================================================ */
  (function initWizard() {
    const wizard = document.getElementById('wizard');
    if (!wizard) return;

    const form = document.getElementById('prijava');
    const steps = Array.prototype.slice.call(wizard.querySelectorAll('.wizard__step'));
    const dots = Array.prototype.slice.call(wizard.querySelectorAll('.wizard__dot'));
    const bar = document.getElementById('wizardBar');
    const backBtn = document.getElementById('wizardBack');
    const nextBtn = document.getElementById('wizardNext');
    const submitBtn = document.getElementById('wizardSubmit');
    const doneBox = document.getElementById('wizardDone');
    const alertBox = document.getElementById('formAlert');

    const answers = {};
    let current = 0;
    const last = steps.length - 1;

    function paint() {
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === current);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-done', i <= current);
      });
      if (bar) bar.setAttribute('aria-valuenow', String(current + 1));

      backBtn.hidden = current === 0;
      nextBtn.hidden = current === last;
      submitBtn.hidden = current !== last;

      const heading = steps[current].querySelector('.wizard__q');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }

    function goTo(index) {
      current = clamp(index, 0, last);
      paint();
    }

    wizard.querySelectorAll('.choice').forEach(function (choice) {
      choice.addEventListener('click', function () {
        const name = choice.getAttribute('data-name');
        answers[name] = choice.getAttribute('data-value');

        const group = choice.closest('.choices');
        if (group) {
          group.querySelectorAll('.choice').forEach(function (c) { c.classList.remove('is-picked'); });
        }
        choice.classList.add('is-picked');
        hideAlert();

        if (current < last) {
          window.setTimeout(function () { goTo(current + 1); }, 180);
        }
      });
    });

    backBtn.addEventListener('click', function () { goTo(current - 1); });

    nextBtn.addEventListener('click', function () {
      const group = steps[current].querySelector('.choices');
      if (group) {
        const name = group.querySelector('.choice').getAttribute('data-name');
        if (!answers[name]) {
          showAlert('Izaberite jednu opciju da nastavite.');
          return;
        }
      }
      hideAlert();
      goTo(current + 1);
    });

    function showAlert(msg) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.classList.add('is-visible');
    }
    function hideAlert() {
      if (!alertBox) return;
      alertBox.classList.remove('is-visible');
      alertBox.textContent = '';
    }
    function markField(id, bad) {
      const wrap = document.getElementById(id);
      if (wrap) wrap.classList.toggle('field--error', bad);
    }

    function validateDetails() {
      const ime = document.getElementById('ime');
      const telefon = document.getElementById('telefon');
      const email = document.getElementById('email');

      const imeBad = ime.value.trim().length < 2;
      const telBad = telefon.value.replace(/[^0-9]/g, '').length < 8;
      const mailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());

      markField('f-ime', imeBad);
      markField('f-telefon', telBad);
      markField('f-email', mailBad);

      const firstBad = imeBad ? ime : (telBad ? telefon : (mailBad ? email : null));
      if (firstBad) firstBad.focus();

      return !(imeBad || telBad || mailBad);
    }

    ['ime', 'telefon', 'email'].forEach(function (id) {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', function () { markField('f-' + id, false); hideAlert(); });
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateDetails()) {
        showAlert('Proverite obavezna polja.');
        return;
      }
      hideAlert();

      /* Imena polja moraju da se poklapaju sa readParams_ u apps-script/Code.gs */
      const payload = {
        ime: document.getElementById('ime').value.trim(),
        telefon: document.getElementById('telefon').value.trim(),
        email: document.getElementById('email').value.trim(),
        predmet: answers.predmet || '',
        termin: answers.termin || '',
        cilj: answers.cilj || '',
        poruka: document.getElementById('poruka').value.trim(),
        strana: window.location.href
      };

      if (!ENDPOINT) {
        console.warn('ENDPOINT nije postavljen. Prijava:', payload);
        finish();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Šalje se...';

      /* Salje se kao GET sa parametrima. Apps Script svaki POST preusmerava
         na sesijski URL i pretvara ga u GET, cime se gubi e.postData. */
      fetch(ENDPOINT + '?' + new URLSearchParams(payload).toString(), {
        method: 'GET',
        mode: 'no-cors'
      })
        .then(function () { finish(); })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pošalji prijavu';
          showAlert('Slanje nije uspelo. Pozovite nas na 064 130 8896 ili pokušajte ponovo.');
        });
    });

    function finish() {
      form.hidden = true;
      if (bar) bar.hidden = true;
      doneBox.classList.add('is-visible');
      doneBox.setAttribute('tabindex', '-1');
      doneBox.focus({ preventScroll: true });
      const dest = window.scrollY + wizard.getBoundingClientRect().top - 120;
      if (reduceMotion) window.scrollTo(0, dest);
      else smooth.to(dest);
    }

    paint();
  })();

})();
