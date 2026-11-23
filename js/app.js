/* Monaro Milk driver hub. Hash routes, no login, static files. */
(function () {
  'use strict';
  var U = window.MM;
  var state = { index: null, talks: {}, cor: null, systems: null, booted: false };

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var bits = raw.split('?');
    var parts = bits[0].split('/').filter(Boolean);
    var q = new URLSearchParams(bits[1] || '');
    return { parts: parts, q: q };
  }

  function setTab(name) {
    U.$all('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function showError(err, what) {
    console.error(err);
    var offline = !navigator.onLine || String(err && err.message) === 'offline';
    U.$('#main').innerHTML = '<section class="card"><h1>' + (offline ? 'You’re offline' : 'Couldn’t load ' + U.esc(what || 'that')) + '</h1>' +
      '<p>' + (offline
        ? 'This hasn’t been saved on this phone yet. Open it once on Wi-Fi or mobile data and it will be here next time.'
        : 'Pull to refresh, or try again in a moment.') + '</p>' +
      '<p><button class="btn" type="button" id="retry">Try again</button></p></section>';
    var b = U.$('#retry');
    if (b) b.onclick = function () { location.reload(); };
  }

  function loadIndex() {
    if (state.index) return Promise.resolve(state.index);
    return U.getJSON('talks/index.json').then(function (idx) {
      state.index = idx;
      warm(idx);
      return idx;
    });
  }
  function loadTalk(id) {
    if (state.talks[id]) return Promise.resolve(state.talks[id]);
    var entry = ((state.index && state.index.talks) || []).filter(function (t) { return t.id === id; })[0];
    var file = entry ? entry.file : id + '.json';
    return U.getJSON('talks/' + encodeURIComponent(file)).then(function (t) { state.talks[id] = t; return t; });
  }
  function loadCor() {
    if (state.cor) return Promise.resolve(state.cor);
    return U.getJSON('content/cor.json').then(function (c) { state.cor = c; return c; });
  }
  function loadSystems() {
    if (state.systems) return Promise.resolve(state.systems);
    return U.getJSON('content/systems.json').then(function (s) { state.systems = s; return s; });
  }
  function warm(idx) {
    var urls = (idx.talks || []).map(function (t) { return new URL('talks/' + t.file, location.href).href; });
    urls.forEach(function (u) { fetch(u, { cache: 'no-cache' }).catch(function () {}); });
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'warm', urls: urls });
    }
  }

  function latestTalk() {
    var idx = state.index;
    if (!idx || !idx.latest) return Promise.resolve(null);
    return loadTalk(idx.latest);
  }

  function renderHome() {
    setTab('home');
    document.title = 'Monaro Milk';
    window.MMTalks.destroyPad();
    return loadIndex().then(function () {
      return Promise.all([loadCor(), window.MMProgress.snapshot(state.index)]);
    }).then(function (res) {
      var snap = res[1];
      return latestTalk().then(function (t) {
        var hero = !t
          ? '<section class="card"><h1>No talk published yet</h1><p>When Monday’s talk is published, it will land here.</p></section>'
          : '<a class="hero-link" href="#/talk/' + encodeURIComponent(t.id) + '"><article class="card hero home-hero">' +
              '<p class="eyebrow">This week</p><h1>' + U.esc(t.title) + '</h1>' +
              '<p class="when">' + U.esc(t.week_label) + '</p>' +
              '<p class="risk-text">' + U.esc(t.key_risk) + '</p></article></a>' +
              '<div class="home-actions"><a class="btn big" href="#/talk/' + encodeURIComponent(t.id) + '">Read the talk</a>' +
              '<a class="btn big ghost" href="#/talk/' + encodeURIComponent(t.id) + '/signon">' + (snap.signedThisWeek ? 'You’re signed on' : 'Sign on') + '</a></div>';
        var weekPct = snap.signedThisWeek ? 1 : 0;
        var quizSub = snap.last ? (snap.last.score + '/' + snap.last.total + ' last go') : 'Not yet';
        U.$('#main').innerHTML =
          '<p class="hello">' + U.esc(U.greet()) + '</p>' +
          '<p class="hello-sub">Monaro Milk &amp; Juice · Cooma</p>' +
          hero +
          '<section class="card progress-card"><h2>My progress</h2><p class="hint">Saved on this phone. It does not leave the device.</p>' +
            '<div class="rings">' +
              window.MMProgress.ring(weekPct, snap.signedThisWeek ? 'Signed' : 'Not yet', 'This week’s talk', snap.signedThisWeek ? 'good' : '') +
              window.MMProgress.ring(snap.best, snap.best ? Math.round(snap.best * 100) + '%' : '—', quizSub, snap.best >= 1 ? 'good' : '') +
            '</div>' +
            '<p class="streak">' + (snap.streak ? '<strong>' + snap.streak + '</strong> talk' + (snap.streak === 1 ? '' : 's') + ' signed in a row' : 'Sign on to start a streak') + '</p>' +
            window.MMProgress.badgesHtml(snap.earned) +
            '<a class="btn ghost" href="#/rules/quiz?set=all">Quiz · ' + state.cor.quiz.length + ' questions</a>' +
          '</section>' +
          '<a class="soon-teaser" href="#/soon"><span class="kicker">Coming soon</span><strong>What’s next for this app</strong><span>SWMS, messages, hazard reports, your tickets, and more. A look at what’s being built. None of it is live.</span></a>' +
          '<div class="home-jumps">' +
            '<a href="#/speak"><strong>Speak up</strong><span>000, your manager, or the NHVR line. You can stop.</span></a>' +
            '<a href="#/rules"><strong>CoR rules</strong><span>By the job you are doing today.</span></a>' +
            '<a href="#/systems"><strong>Systems</strong><span>Tanda, Logmaster, Intellifleet, MiX.</span></a>' +
          '</div>';
        window.scrollTo(0, 0);
      });
    });
  }

  function renderSearch(q) {
    setTab('');
    document.title = 'Search – Monaro';
    window.MMTalks.destroyPad();
    U.$('#main').innerHTML = '<section class="card"><p class="eyebrow">Search</p><h1>Talks and rules</h1>' +
      '<label class="field"><span class="visually-hidden">Search</span><input id="q" type="search" enterkeyhint="search" placeholder="Try fatigue, pallets, PBS, doors…" value="' + U.esc(q) + '"></label>' +
      '<div id="hits"><p class="muted">Loading…</p></div></section>';
    var input = U.$('#q');
    input.focus();
    function go() {
      var query = input.value.trim();
      var box = U.$('#hits');
      if (query.length < 2) { box.innerHTML = '<p class="muted">Type at least two letters.</p>'; return; }
      var needle = query.toLowerCase();
      Promise.all([loadIndex(), loadCor()]).then(function () {
        var jobs = (state.index.talks || []).map(function (t) { return loadTalk(t.id); });
        return Promise.all(jobs);
      }).then(function (talks) {
        var hits = [];
        talks.forEach(function (t) {
          var text = window.MMTalks.searchBits(t);
          if ((t.title + ' ' + text).toLowerCase().indexOf(needle) !== -1) {
            hits.push({ href: '#/talk/' + encodeURIComponent(t.id), kind: 'Talk', title: t.title, text: t.week_label });
          }
        });
        window.MMRules.searchDocs(state.cor).forEach(function (d) {
          if ((d.title + ' ' + d.text).toLowerCase().indexOf(needle) !== -1) hits.push(d);
        });
        if (!hits.length) { box.innerHTML = '<p>Nothing matches <strong>' + U.esc(query) + '</strong>. Try a shorter word, like load, hours or speed.</p>'; return; }
        box.innerHTML = '<p class="muted">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</p><ul class="archive">' + hits.slice(0, 40).map(function (h) {
          return '<li><a class="archive-card" href="' + h.href + '"><span class="a-date">' + U.esc(h.kind) + '</span><span class="a-title">' + U.esc(h.title) + '</span>' +
            (h.text && h.kind !== 'Quiz' ? '<span class="a-meta">' + U.esc(String(h.text).slice(0, 140)) + '</span>' : '') + '</a></li>';
        }).join('') + '</ul>';
      }).catch(function (err) { showError(err, 'search'); });
    }
    input.addEventListener('input', go);
    go();
  }

  var SOON = [
    { id: 'swms', title: 'SWMS', benefit: 'The safe way to do the job, written in plain steps, before you start.', icon: 'clipboard' },
    { id: 'messages', title: 'Team messaging', benefit: 'Office-to-driver notices, with a read receipt so the office knows you saw it.', icon: 'chat' },
    { id: 'hazard', title: 'Hazard and incident reporting', benefit: 'Report a hazard or an incident with a photo and where you are.', icon: 'pin' },
    { id: 'wallet', title: 'Licence and ticket wallet', benefit: 'Your licence and tickets in one place, with a reminder before they run out.', icon: 'card' },
    { id: 'fatigue', title: 'Fatigue and break prompts', benefit: 'A nudge for a break. It supports the work diary. It does not replace the diary.', icon: 'clock' },
    { id: 'restraint', title: 'Load restraint photo checklist', benefit: 'Photos of the load before you leave, next to a simple checklist.', icon: 'camera' },
    { id: 'dashboard', title: 'Manager dashboard', benefit: 'See talk and quiz completions in one place, ready when you prepare for an audit.', icon: 'chart' },
    { id: 'recognition', title: 'Recognition', benefit: 'Badges and shout-outs when someone does the job well.', icon: 'star' },
    { id: 'connections', title: 'Tanda, Intellifleet and MiX', benefit: 'Rosters and timesheets from Tanda. Pre-starts and defects from Intellifleet and MiX.', icon: 'link' }
  ];
  var SOON_ICONS = {
    clipboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2zm0 2v1h8V5H8zm-3 4v10h14V9H5z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 9.5A2.5 2.5 0 1 0 12 6a2.5 2.5 0 0 0 0 5.5z"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 3v2h18V9H3zm0 5v2h8v-2H3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 5h-2v6l5 3 1-1.7-4-2.3V7z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H2V3h2v16zm4-3h2V9H8v7zm4 0h2V5h-2v11zm4 0h2v-6h-2v6z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.9 6.6L22 9.3l-5 4.6L18.2 21 12 17.3 5.8 21 7 13.9 2 9.3l7.1-.7L12 2z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1 1.4 1.4 1.1-1.1a3 3 0 0 1 4.2 4.2l-2 2A3 3 0 0 1 11.4 13L10 11.6A5 5 0 0 0 10 13zm4-2a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1-1.4-1.4-1.1 1.1a3 3 0 0 1-4.2-4.2l2-2A3 3 0 0 1 12.6 11L14 12.4A5 5 0 0 0 14 11z"/></svg>'
  };
  function soonWanted() {
    try { return JSON.parse(localStorage.getItem('mm-soon-wants') || '{}'); } catch (e) { return {}; }
  }
  function renderSoon() {
    setTab('');
    document.title = 'Coming soon – Monaro';
    window.MMTalks.destroyPad();
    var wanted = soonWanted();
    U.$('#main').innerHTML =
      '<p class="eyebrow">Coming soon</p><h1>A taste of what’s next</h1>' +
      '<p class="lede">None of these are live. The cards are here so the team can see what’s being built. “I want this” stays on this phone.</p>' +
      '<ul class="soon-list">' + SOON.map(function (item) {
        var on = !!wanted[item.id];
        return '<li class="soon-card" data-soon="' + U.esc(item.id) + '">' +
          '<span class="soon-icon">' + SOON_ICONS[item.icon] + '</span>' +
          '<div class="soon-copy"><h2>' + U.esc(item.title) + '</h2><p>' + U.esc(item.benefit) + '</p>' +
          '<button type="button" class="want' + (on ? ' on' : '') + '" data-want="' + U.esc(item.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          (on ? 'Saved on this phone' : 'I want this') + '</button></div>' +
          '<span class="soon-badge">Coming soon</span></li>';
      }).join('') + '</ul>' +
      '<p class="soon-foot">Concept features in development. Not live yet.</p>';
    U.$all('[data-want]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-want');
        var bag = soonWanted();
        bag[id] = !bag[id];
        if (!bag[id]) delete bag[id];
        localStorage.setItem('mm-soon-wants', JSON.stringify(bag));
        var on = !!bag[id];
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = on ? 'Saved on this phone' : 'I want this';
        U.toast(on ? 'Saved on this phone' : 'Removed on this phone');
      };
    });
    window.scrollTo(0, 0);
  }

  function renderSpeak() {
    setTab('speak');
    document.title = 'Speak up – Monaro';
    window.MMTalks.destroyPad();
    U.$('#main').innerHTML =
      '<p class="eyebrow">Speak up</p><h1>If it is not safe, stop.</h1>' +
      '<p class="lede">Saying something early is part of the job. If a truck, a load, or a driver is not safe, stop that job and tell someone.</p>' +
      '<a class="speak emergency" href="tel:000"><span class="kicker">Someone could be hurt right now</span><strong>Call 000</strong><span>The NHVR gives examples: a crash with a heavy vehicle, a heavy vehicle losing its load, or a heavy vehicle swerving across the road.</span></a>' +
      '<article class="speak manager"><span class="kicker">Tell us inside the business</span><strong>Tell your manager</strong><span>Tell your manager as soon as you can. If you cannot reach your manager, tell the General Manager. A failed pre-start in Intellifleet goes to the General Manager. Leave the failed record in place. The name of any extra internal form, phone, or after-hours contact is not in this app. Check with your manager.</span></article>' +
      '<a class="speak nhvr" href="tel:1800931785"><span class="kicker">Heavy Vehicle Confidential Reporting Line</span><strong>NHVR 1800 931 785</strong><span>Monday to Friday, 7.00am to 4.30pm (AEST). For procedures, practices, or conditions that might endanger a driver or someone else. Not for immediate danger. Call 000 for that. The NHVR says it protects your identity and cannot tell you the outcome.</span></a>' +
      '<article class="speak stop"><span class="kicker">Drivers can stop</span><strong>Stop the truck.</strong><span>If your health or fitness means you cannot drive safely, stop or do not start. Tell your manager. Do not keep going because the run is late or the customer is waiting. How the roster and your pay are handled when you stop is not in this app. Check with your manager.</span></article>' +
      '<p class="cite">Source: <a href="https://www.nhvr.gov.au/safety-accreditation-compliance/heavy-vehicle-confidential-reporting-line" target="_blank" rel="noopener">NHVR Heavy Vehicle Confidential Reporting Line</a></p>';
    window.scrollTo(0, 0);
  }

  function renderSystems() {
    setTab('systems');
    document.title = 'Systems – Monaro';
    window.MMTalks.destroyPad();
    return loadSystems().then(function (sys) {
      U.$('#main').innerHTML = '<p class="eyebrow">Systems</p><h1>The other tools</h1>' +
        '<p class="lede">These open the live system when a link has been set. Until then, the card says so. A tick in this app is not the record.</p>' +
        sys.links.map(function (link) {
          var ready = /^https?:\/\//.test(link.url || '');
          var action = ready
            ? '<a class="btn" href="' + U.esc(link.url) + '" target="_blank" rel="noopener">Open ' + U.esc(link.name) + '</a>'
            : '<p class="unset">Link not set yet</p>';
          return '<article class="card system"><h2>' + U.esc(link.name) + '</h2><p>' + U.esc(link.blurb) + '</p>' + action + '</article>';
        }).join('') +
        '<p class="hint">To set a link, edit <code>content/systems.json</code> and publish. Leave <code>url</code> empty until you have the real address.</p>';
      window.scrollTo(0, 0);
    });
  }

  function route() {
    var h = parseHash();
    var p = h.parts;
    var tab = 'home';
    if (p[0] === 'talks' || p[0] === 'archive' || p[0] === 'talk' || p[0] === 'supervisor') tab = 'talks';
    else if (p[0] === 'rules') tab = 'rules';
    else if (p[0] === 'speak') tab = 'speak';
    else if (p[0] === 'systems') tab = 'systems';
    else if (p[0] === 'soon' || p[0] === 'coming-soon' || p[0] === 'search') tab = '';
    setTab(tab);
    U.$('#main').innerHTML = '<p class="loading">Loading…</p>';

    var job;
    if (!p.length) job = renderHome();
    else if (p[0] === 'talks' || p[0] === 'archive') job = loadIndex().then(function (idx) { return window.MMTalks.renderArchive(idx); });
    else if (p[0] === 'talk' && p[1]) {
      job = loadIndex().then(function () { return loadTalk(decodeURIComponent(p[1])); }).then(function (t) {
        window.MMTalks.renderTalk(t, p[2], state.index && state.index.latest === t.id);
      });
    } else if (p[0] === 'supervisor') job = loadIndex().then(function (idx) { return window.MMTalks.renderSupervisor(idx, loadTalk); });
    else if (p[0] === 'rules' && p[1] === 'role' && p[2]) job = loadCor().then(function (c) {
      var r = c.roles.filter(function (x) { return x.id === decodeURIComponent(p[2]); })[0];
      if (!r) throw new Error('missing role');
      window.MMRules.renderParty(r, 'role');
    });
    else if (p[0] === 'rules' && p[1] === 'topic' && p[2]) job = loadCor().then(function (c) {
      var t = c.topics.filter(function (x) { return x.id === decodeURIComponent(p[2]); })[0];
      if (!t) throw new Error('missing topic');
      window.MMRules.renderParty(t, 'topic');
    });
    else if (p[0] === 'rules' && p[1] === 'quiz') job = loadCor().then(function (c) { window.MMRules.renderQuiz(c, h.q.get('set') || 'all', h.q.get('id') || ''); });
    else if (p[0] === 'rules') job = loadCor().then(function (c) { window.MMRules.renderHome(c); });
    else if (p[0] === 'soon' || p[0] === 'coming-soon') { renderSoon(); job = Promise.resolve(); }
    else if (p[0] === 'speak') { renderSpeak(); job = Promise.resolve(); }
    else if (p[0] === 'systems') job = renderSystems();
    else if (p[0] === 'search') { renderSearch(h.q.get('q') || ''); job = Promise.resolve(); }
    else { location.hash = '#/'; return; }

    Promise.resolve(job).catch(function (err) { showError(err, p[0] === 'talk' ? 'the talk' : 'the page'); });
  }

  function netStatus() {
    var n = U.$('#net');
    var off = !navigator.onLine;
    n.textContent = off ? 'Offline' : '';
    n.classList.toggle('off', off);
    n.hidden = !off;
  }

  var sizes = [1, 1.15, 1.3];
  function sizeIdx() { var i = Number(U.setting('size') || 0); return sizes[i] ? i : 0; }
  function applySize() { document.documentElement.style.setProperty('--scale', String(sizes[sizeIdx()])); }
  U.$('#textSize').onclick = function () {
    U.setting('size', String((sizeIdx() + 1) % sizes.length));
    applySize();
    U.toast('Text size ' + Math.round(sizes[sizeIdx()] * 100) + '%');
  };
  applySize();
  window.addEventListener('online', netStatus);
  window.addEventListener('offline', netStatus);
  netStatus();

  U.$('#openSearch').onclick = function () { location.hash = '#/search'; };

  function showVersion() {
    U.getJSON('version.json').then(function (v) {
      var el = U.$('#ver');
      if (el) el.textContent = v.cache_version + ' · published ' + U.fmtStamp(v.published_at);
    }).catch(function () {});
  }

  if ('serviceWorker' in navigator) {
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function (e) { console.warn('SW registration failed', e); });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) { had = true; if (state.index) warm(state.index); return; }
      if (window.MMTalks.isDirty()) {
        var b = U.$('#banner');
        b.hidden = false;
        b.innerHTML = '<strong>App updated.</strong> Tap to reload when you have finished signing on.';
        b.onclick = function () { location.reload(); };
      } else location.reload();
    });
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeprint', function () {
    U.$all('details').forEach(function (d) { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    U.$all('details').forEach(function (d) { if (d.dataset.wasOpen !== undefined) d.open = d.dataset.wasOpen === '1'; });
  });

  window.MMApp.route = route;
  route();
  showVersion();
})();
