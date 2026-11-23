/* Chain of Responsibility rules, topics and the on-device quiz. */
(function () {
  'use strict';
  var U = function () { return window.MM; };
  var RUN = 'mm-quiz-run';

  function kindLabel(k) {
    if (k === 'do') return 'Do';
    if (k === 'dont') return 'Don’t';
    return 'Ask your manager';
  }

  function cardsHtml(cards) {
    var order = ['do', 'dont', 'ask'];
    return order.map(function (k) {
      var rows = (cards || []).filter(function (c) { return c.kind === k; });
      if (!rows.length) return '';
      return '<section class="stack stack-' + k + '" aria-label="' + kindLabel(k) + '"><h2>' + kindLabel(k) + '</h2>' +
        rows.map(function (c) { return '<article class="do-card">' + U().esc(c.text) + '</article>'; }).join('') + '</section>';
    }).join('');
  }

  function renderHome(cor) {
    document.title = 'CoR rules – Monaro';
    var roles = cor.roles.map(function (r) {
      return '<a class="pick" href="#/rules/role/' + encodeURIComponent(r.id) + '"><span class="kicker">' + U().esc(r.kicker) + '</span><strong>' + U().esc(r.title) + '</strong><span>' + U().esc(r.summary) + '</span></a>';
    }).join('');
    var topics = cor.topics.map(function (t) {
      var hot = (t.id === 'pbs' || t.id === 'interstate' || t.id === 'hard-sided') ? ' hot' : '';
      return '<a class="pick topic' + hot + '" href="#/rules/topic/' + encodeURIComponent(t.id) + '"><span class="kicker">' + U().esc(t.kicker) + '</span><strong>' + U().esc(t.title) + '</strong></a>';
    }).join('');
    U().$('#main').innerHTML =
      '<section class="card hero"><p class="eyebrow">Chain of Responsibility</p><h1>Rules for the job you’re doing</h1>' +
      '<p>' + U().esc(cor.disclaimer) + '</p>' +
      '<a class="btn big" href="#/rules/quiz?set=all">Start the 45-question quiz</a></section>' +
      '<h2 class="section-label">Pick your job</h2><div class="picks">' + roles + '</div>' +
      '<h2 class="section-label">Topics</h2><div class="picks topics">' + topics + '</div>' +
      '<section class="card note"><p>' + U().esc(cor.business_note) + '</p></section>';
    window.scrollTo(0, 0);
  }

  function renderParty(item, kind) {
    document.title = item.title + ' – Monaro';
    var back = '#/rules';
    var quiz = kind === 'role'
      ? '#/rules/quiz?set=role&id=' + encodeURIComponent(item.id)
      : '#/rules/quiz?set=topic&id=' + encodeURIComponent(item.id);
    U().$('#main').innerHTML =
      '<p class="back"><a href="' + back + '">All rules</a></p>' +
      '<header class="card hero"><p class="eyebrow">' + U().esc(item.kicker) + '</p><h1>' + U().esc(item.title) + '</h1>' +
      '<p class="summary">' + U().esc(item.summary) + '</p>' +
      '<a class="btn" href="' + quiz + '">Quiz this ' + (kind === 'role' ? 'job' : 'topic') + '</a></header>' +
      '<section class="card law"><h2>The rule, in short</h2><p>' + U().esc(item.law) + '</p>' + U().sourceLine(item.source) + '</section>' +
      cardsHtml(item.cards);
    window.scrollTo(0, 0);
  }

  function questionsFor(cor, set, id) {
    var all = cor.quiz;
    if (set === 'role') return all.filter(function (q) { return q.roles.indexOf(id) !== -1; });
    if (set === 'topic') return all.filter(function (q) { return q.topic === id; });
    return all.slice();
  }

  function labelFor(cor, set, id) {
    if (set === 'role') {
      var r = cor.roles.filter(function (x) { return x.id === id; })[0];
      return r ? r.title + ' quiz' : 'Quiz';
    }
    if (set === 'topic') {
      var t = cor.topics.filter(function (x) { return x.id === id; })[0];
      return t ? t.title + ' quiz' : 'Quiz';
    }
    return 'All ' + cor.quiz.length + ' questions';
  }

  function loadRun() {
    try { return JSON.parse(sessionStorage.getItem(RUN) || 'null'); } catch (e) { return null; }
  }
  function saveRun(run) { sessionStorage.setItem(RUN, JSON.stringify(run)); }
  function clearRun() { sessionStorage.removeItem(RUN); }

  function renderQuiz(cor, set, id) {
    var pool = questionsFor(cor, set, id);
    if (!pool.length) {
      U().$('#main').innerHTML = '<section class="card"><h1>No questions for that yet</h1><p><a class="btn" href="#/rules/quiz?set=all">Do the full set</a></p></section>';
      return;
    }
    var key = set + ':' + (id || 'all');
    var run = loadRun();
    if (!run || run.key !== key) {
      run = { key: key, label: labelFor(cor, set, id), ids: pool.map(function (q) { return q.id; }), i: 0, picks: [], set: set, id: id || '' };
      saveRun(run);
    }
    var q = cor.quiz.filter(function (item) { return item.id === run.ids[run.i]; })[0];
    if (!q) { clearRun(); renderQuiz(cor, set, id); return; }
    var picked = run.picks[run.i];
    var done = typeof picked === 'number';
    document.title = 'Quiz – Monaro';
    U().$('#main').innerHTML =
      '<p class="back"><a href="#/rules">Rules</a></p>' +
      '<section class="card quiz" id="quizCard">' +
        '<p class="eyebrow">' + U().esc(run.label) + '</p>' +
        '<p class="quiz-progress"><span>Question ' + (run.i + 1) + ' of ' + run.ids.length + '</span></p>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + Math.round((run.i / run.ids.length) * 100) + '%"></i></div>' +
        '<h1>' + U().esc(q.prompt) + '</h1>' +
        '<div class="choices" role="group" aria-label="Answers">' + q.choices.map(function (c, n) {
          var cls = 'choice';
          if (done && n === q.answer) cls += ' right';
          else if (done && n === picked) cls += ' wrong';
          return '<button type="button" class="' + cls + '" data-n="' + n + '"' + (done ? ' disabled' : '') + '>' + U().esc(c) + '</button>';
        }).join('') + '</div>' +
        (done ? '<div class="why"><p>' + U().esc(q.why) + '</p>' + U().sourceLine(q.source) +
          '<button type="button" class="btn big" id="quizNext">' + (run.i + 1 === run.ids.length ? 'See my score' : 'Next') + '</button></div>' : '') +
      '</section>';
    window.scrollTo(0, 0);
    U().$all('.choice').forEach(function (b) {
      b.onclick = function () {
        if (typeof run.picks[run.i] === 'number') return;
        run.picks[run.i] = Number(b.getAttribute('data-n'));
        saveRun(run);
        renderQuiz(cor, set, id);
      };
    });
    var next = U().$('#quizNext');
    if (next) next.onclick = function () {
      if (run.i + 1 < run.ids.length) {
        run.i++;
        saveRun(run);
        renderQuiz(cor, set, id);
        return;
      }
      finish(cor, run);
    };
  }

  function finish(cor, run) {
    var score = 0;
    var missed = [];
    run.ids.forEach(function (id, i) {
      var q = cor.quiz.filter(function (item) { return item.id === id; })[0];
      if (run.picks[i] === q.answer) score++;
      else missed.push({ prompt: q.prompt, answer: q.choices[q.answer] });
    });
    window.MMProgress.saveQuiz({ at: new Date().toISOString(), score: score, total: run.ids.length, label: run.label });
    clearRun();
    var perfect = score === run.ids.length;
    var message = perfect
      ? 'Every one. That’s the sheet learned, not just tapped.'
      : 'You finished. Have another look at the ones below, then the card is still there if you want it.';
    window.MMProgress.celebrate({
      title: perfect ? 'Nailed it' : 'Quiz done',
      message: message,
      score: score,
      total: run.ids.length,
      missed: missed,
      again: true,
      onClose: function () { location.hash = '#/rules'; },
      onAgain: function () {
        var next = '#/rules/quiz?set=' + encodeURIComponent(run.set) + (run.id ? '&id=' + encodeURIComponent(run.id) : '');
        if (location.hash === next) window.MMApp.route();
        else location.hash = next;
      }
    });
    U().$('#main').innerHTML = '<section class="card"><h1>Score saved on this phone</h1><p>' + score + ' of ' + run.ids.length + '.</p><p><a class="btn" href="#/">Back home</a></p></section>';
  }

  function searchDocs(cor) {
    var docs = [];
    (cor.roles || []).forEach(function (r) {
      docs.push({ href: '#/rules/role/' + encodeURIComponent(r.id), kind: 'Rule', title: r.title, text: [r.summary, r.law].concat((r.cards || []).map(function (c) { return c.text; })).join(' ') });
    });
    (cor.topics || []).forEach(function (t) {
      docs.push({ href: '#/rules/topic/' + encodeURIComponent(t.id), kind: 'Topic', title: t.title, text: [t.summary, t.law].concat((t.cards || []).map(function (c) { return c.text; })).join(' ') });
    });
    (cor.quiz || []).forEach(function (q) {
      docs.push({ href: '#/rules/quiz?set=topic&id=' + encodeURIComponent(q.topic), kind: 'Quiz', title: q.prompt, text: q.choices.join(' ') + ' ' + q.why });
    });
    return docs;
  }

  window.MMRules = { renderHome: renderHome, renderParty: renderParty, renderQuiz: renderQuiz, searchDocs: searchDocs };
})();
