/* On-device progress: sign-on streak, quiz scores, badges. Nothing here is uploaded. */
(function () {
  'use strict';
  var U = function () { return window.MM; };
  var QUIZ_KEY = 'mm-quiz-log';

  var BADGES = [
    { id: 'first', name: 'First sign-on', hint: 'Sign on to any talk' },
    { id: 'week', name: 'On the sheet', hint: 'Sign on to this week’s talk' },
    { id: 'streak3', name: 'Three straight', hint: 'Sign on to three talks in a row' },
    { id: 'quiz', name: 'Had a go', hint: 'Finish a quiz' },
    { id: 'ace', name: 'Full marks', hint: 'Score 100% on a quiz of 5 or more' },
    { id: 'set45', name: 'Full set', hint: 'Finish all 100 questions' }
  ];

  function quizLog() {
    try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveQuiz(entry) {
    var rows = quizLog();
    rows.unshift(entry);
    localStorage.setItem(QUIZ_KEY, JSON.stringify(rows.slice(0, 40)));
  }

  function streakFrom(index, signons) {
    var talks = (index && index.talks) || [];
    var signed = {};
    signons.forEach(function (s) { signed[s.talkId] = true; });
    var n = 0;
    for (var i = 0; i < talks.length; i++) {
      if (!signed[talks[i].id]) break;
      n++;
    }
    return n;
  }

  function snapshot(index) {
    return window.MMDB.allSignons().then(function (signons) {
      var latest = index && index.latest;
      var signedThisWeek = !!(latest && signons.some(function (s) { return s.talkId === latest; }));
      var log = quizLog();
      var best = 0;
      var last = log[0] || null;
      log.forEach(function (r) { if (r.total) best = Math.max(best, r.score / r.total); });
      var streak = streakFrom(index, signons);
      var earned = {
        first: signons.length > 0,
        week: signedThisWeek,
        streak3: streak >= 3,
        quiz: log.length > 0,
        ace: log.some(function (r) { return r.total >= 5 && r.score === r.total; }),
        set45: log.some(function (r) { return r.total >= 100 && r.score != null; })
      };
      return {
        signons: signons,
        signedThisWeek: signedThisWeek,
        signonCount: latest ? signons.filter(function (s) { return s.talkId === latest; }).length : 0,
        streak: streak,
        best: best,
        last: last,
        earned: earned,
        log: log
      };
    });
  }

  function ring(pct, label, sub, tone) {
    var p = Math.max(0, Math.min(1, pct || 0));
    var c = 326.7;
    var off = c * (1 - p);
    return '<div class="ring ' + (tone || '') + '" role="img" aria-label="' + U().esc(label) + ' ' + Math.round(p * 100) + ' percent">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"></circle>' +
      '<circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + off.toFixed(1) + '"></circle></svg>' +
      '<div class="ring-label"><strong>' + U().esc(label) + '</strong><span>' + U().esc(sub) + '</span></div></div>';
  }

  function badgesHtml(earned) {
    return '<ul class="badges">' + BADGES.map(function (b) {
      var on = earned && earned[b.id];
      return '<li class="badge' + (on ? ' on' : '') + '"><span class="badge-mark" aria-hidden="true">' + (on ? '★' : '☆') + '</span><span><strong>' + U().esc(b.name) + '</strong><small>' + U().esc(on ? 'Earned on this phone' : b.hint) + '</small></span></li>';
    }).join('') + '</ul>';
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('canvas');
    c.className = 'confetti';
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var bits = [];
    var colors = ['#0E6B32', '#3FA34D', '#E25C12', '#F6A04D', '#084422', '#fff'];
    for (var i = 0; i < 70; i++) {
      bits.push({
        x: c.width * Math.random(), y: -20 - Math.random() * 80,
        r: 4 + Math.random() * 5, v: 2 + Math.random() * 3.2,
        w: (Math.random() - 0.5) * 2, color: colors[i % colors.length], a: Math.random() * 6
      });
    }
    var frames = 0;
    function tick() {
      frames++;
      ctx.clearRect(0, 0, c.width, c.height);
      bits.forEach(function (b) {
        b.y += b.v; b.x += b.w; b.a += 0.1;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.color;
        ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
        ctx.restore();
      });
      if (frames < 90) requestAnimationFrame(tick);
      else c.remove();
    }
    requestAnimationFrame(tick);
  }

  function celebrate(opts) {
    var pct = opts.total ? opts.score / opts.total : 1;
    var title = opts.title || 'Done';
    var host = document.getElementById('celebrate');
    if (!host) {
      host = document.createElement('div');
      host.id = 'celebrate';
      document.body.appendChild(host);
    }
    var missed = (opts.missed || []).slice(0, 6);
    host.innerHTML = '<div class="celebrate-card" role="dialog" aria-modal="true" aria-labelledby="cele-title">' +
      ring(pct, opts.score + '/' + opts.total, pct === 1 ? 'Full marks' : 'Your score', pct === 1 ? 'good' : '') +
      '<h2 id="cele-title">' + U().esc(title) + '</h2>' +
      '<p>' + U().esc(opts.message || '') + '</p>' +
      (missed.length ? '<ul class="missed">' + missed.map(function (m) {
        return '<li><strong>' + U().esc(m.prompt) + '</strong><span>Answer: ' + U().esc(m.answer) + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<div class="cele-actions"><button type="button" class="btn" id="celeClose">Keep going</button>' +
      (opts.again ? '<button type="button" class="btn ghost" id="celeAgain">Try this set again</button>' : '') +
      '</div></div>';
    host.hidden = false;
    if (pct >= 0.8) confetti();
    var closeBtn = document.getElementById('celeClose');
    closeBtn.focus();
    closeBtn.onclick = function () { host.hidden = true; if (opts.onClose) opts.onClose(); };
    var again = document.getElementById('celeAgain');
    if (again) again.onclick = function () { host.hidden = true; if (opts.onAgain) opts.onAgain(); };
  }

  window.MMProgress = {
    BADGES: BADGES,
    snapshot: snapshot,
    ring: ring,
    badgesHtml: badgesHtml,
    saveQuiz: saveQuiz,
    quizLog: quizLog,
    celebrate: celebrate,
    confetti: confetti
  };
})();
