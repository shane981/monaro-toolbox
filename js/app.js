/* Monaro Milk Toolbox Talks – app logic (vanilla JS, no build step). */
(function () {
  'use strict';
  var TZ = 'Australia/Sydney';
  var main = document.getElementById('main');
  var state = { index: null, talks: {}, currentId: null, formDirty: false, pad: null };

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setting(k, v) { if (v === undefined) return localStorage.getItem('mm-set-' + k) || ''; localStorage.setItem('mm-set-' + k, v); }
  function fmtTalkDate(iso) {
    var p = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  }
  function fmtStamp(iso, withSeconds) {
    var o = { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short' };
    if (withSeconds) o.second = '2-digit';
    return new Intl.DateTimeFormat('en-AU', o).format(new Date(iso));
  }
  function fmtSourceDate(d) {
    if (!d || d === 'undated') return 'undated';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { var p = d.split('-').map(Number); return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2]))); }
    if (/^\d{4}-\d{2}$/.test(d)) { var q = d.split('-').map(Number); return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(q[0], q[1] - 1, 1))); }
    return d;
  }
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }
  function banner(html, onClick) {
    var b = document.getElementById('banner');
    b.innerHTML = html; b.hidden = false;
    b.onclick = function () { b.hidden = true; if (onClick) onClick(); };
  }
  function asList(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
  function actionText(a) { return typeof a === 'string' ? { action: a } : a; }

  // ---------- data ----------
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 503 ? 'offline' : 'HTTP ' + r.status);
      return r.json();
    });
  }
  function loadIndex() {
    return getJSON('talks/index.json').then(function (idx) {
      state.index = idx;
      warmCache(idx);
      return idx;
    });
  }
  function loadTalk(id) {
    if (state.talks[id]) return Promise.resolve(state.talks[id]);
    var entry = (state.index && state.index.talks || []).find(function (t) { return t.id === id; });
    var file = entry ? entry.file : id + '.json';
    return getJSON('talks/' + encodeURIComponent(file)).then(function (t) { state.talks[id] = t; return t; });
  }
  function warmCache(idx) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    var urls = (idx.talks || []).slice(0, 12).map(function (t) { return new URL('talks/' + t.file, location.href).href; });
    navigator.serviceWorker.controller.postMessage({ type: 'warm', urls: urls });
  }

  // ---------- routing ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    $all('.tabs a').forEach(function (a) { a.removeAttribute('aria-current'); });
    var tab = 'current';
    if (state.pad) { state.pad.destroy(); state.pad = null; }
    state.formDirty = false;
    var p;
    if (parts[0] === 'archive') { tab = 'archive'; p = renderArchive(); }
    else if (parts[0] === 'supervisor') { tab = 'supervisor'; p = renderSupervisor(); }
    else if (parts[0] === 'talk' && parts[1]) {
      var id = decodeURIComponent(parts[1]);
      tab = state.index && state.index.latest === id ? 'current' : 'archive';
      p = renderTalk(id, parts[2]);
    } else { p = renderCurrent(); }
    var a = $('.tabs a[data-tab="' + tab + '"]'); if (a) a.setAttribute('aria-current', 'page');
    return Promise.resolve(p).catch(showError);
  }
  function showError(err) {
    console.error(err);
    var offline = !navigator.onLine || String(err && err.message) === 'offline';
    main.innerHTML = '<section class="card"><h1>' + (offline ? 'You\u2019re offline' : 'Couldn\u2019t load the talk') + '</h1>' +
      '<p>' + (offline ? 'This talk hasn\u2019t been saved to this device yet. Connect to mobile data or Wi-Fi once and it will be available offline after that.' : 'Something went wrong loading the toolbox talk. Pull down to refresh or try again shortly.') + '</p>' +
      '<p><button class="btn" type="button" onclick="location.reload()">Try again</button></p></section>';
  }

  function ensureIndex() { return state.index ? Promise.resolve(state.index) : loadIndex(); }

  function renderCurrent() {
    return ensureIndex().then(function (idx) {
      if (!idx.latest) { main.innerHTML = '<section class="card"><h1>No talks yet</h1><p>The first toolbox talk hasn\u2019t been published.</p></section>'; return; }
      return renderTalk(idx.latest);
    });
  }

  // ---------- talk page ----------
  function listHTML(items, cls) {
    return '<ul class="' + (cls || 'bullets') + '">' + asList(items).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
  }
  function section(id, title, body, extraClass) {
    return '<section class="card ' + (extraClass || '') + '" id="' + id + '" aria-labelledby="' + id + '-h"><h2 id="' + id + '-h">' + esc(title) + '</h2>' + body + '</section>';
  }

  function renderTalk(id, anchor) {
    return ensureIndex().then(function () { return loadTalk(id); }).then(function (t) {
      state.currentId = t.id;
      var isLatest = state.index && state.index.latest === t.id;
      document.title = t.title + ' \u2013 MM Toolbox';
      var checklist = '<ul class="checklist">' + t.practical_checklist.map(function (c, i) {
        return '<li><label><input type="checkbox" data-check="' + i + '"><span>' + esc(c) + '</span></label></li>';
      }).join('') + '</ul>';
      var followups = '<p class="hint">Supervisors: tick each action when it\u2019s done. Ticks are saved on this device.</p><ul class="followups">' +
        t.follow_up_actions.map(function (a, i) {
          a = actionText(a);
          var meta = [a.owner ? 'Owner: ' + esc(a.owner) : '', a.due ? 'Due: ' + esc(a.due) : ''].filter(Boolean).join(' \u00b7 ');
          return '<li data-fu="' + i + '"><label><input type="checkbox" data-fu-box="' + i + '"><span class="fu-text">' + esc(a.action) +
            (meta ? '<small class="fu-meta">' + meta + '</small>' : '') + '<small class="fu-done" hidden></small></span></label></li>';
        }).join('') + '</ul>';
      var sources = '<details class="sources" open><summary>' + t.sources_reviewed.length + ' sources reviewed</summary><ol>' +
        t.sources_reviewed.map(function (s) {
          return '<li><strong>' + esc(s.name) + '</strong>' + (s.type === 'industry' ? ' <span class="tag">industry context</span>' : '') +
            ' \u2013 <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a> <span class="muted">(' + esc(fmtSourceDate(s.date)) + ')</span>' +
            '<span class="print-url">' + esc(s.url) + '</span>' + (s.note ? '<br><small>' + esc(s.note) + '</small>' : '') + '</li>';
        }).join('') + '</ol></details>';

      main.innerHTML =
        '<article class="talk">' +
        '<header class="card hero">' +
          (isLatest ? '<p class="eyebrow">This week\u2019s toolbox talk</p>' : '<p class="eyebrow archive-flag">Archived talk</p>') +
          '<h1>' + esc(t.title) + '</h1>' +
          '<p class="when">' + esc(t.week_label) + (t.week_label.indexOf(fmtTalkDate(t.date).replace(/^\w+ /, '')) >= 0 ? '' : ' \u00b7 ' + esc(fmtTalkDate(t.date))) + '</p>' +
          (t.summary ? '<p class="summary">' + esc(t.summary) + '</p>' : '') +
          '<div class="hero-actions no-print"><a class="btn" href="#/talk/' + encodeURIComponent(t.id) + '/signon">Sign on</a>' +
          '<button class="btn ghost" type="button" id="printBtn">Print / save PDF</button></div>' +
        '</header>' +
        section('risk', 'Key risk this week', '<p class="risk-text">' + esc(t.key_risk) + '</p>', 'risk') +
        section('drivers', 'What drivers need to know', listHTML(t.drivers_need_to_know)) +
        section('supervisors', 'What supervisors must check', listHTML(t.supervisors_must_check)) +
        section('questions', 'Discussion questions', '<ol class="questions">' + t.discussion_questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol>') +
        section('checklist', 'Practical checklist', checklist) +
        section('records', 'Required records', listHTML(asList(t.required_records))) +
        section('followups', 'Follow-up actions', followups) +
        section('sources', 'Sources reviewed', sources, 'sources-card') +
        signonSection(t) +
        printRegister(t) +
        '</article>';

      $('#printBtn').onclick = function () { window.print(); };
      wireFollowups(t);
      wireSignon(t);
      refreshSignons(t);
      if (anchor === 'signon') setTimeout(function () { var s = document.getElementById('signon'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 50);
      else window.scrollTo(0, 0);
    });
  }

  // ---------- follow-up actions ----------
  function wireFollowups(t) {
    MMDB.followupsForTalk(t.id).then(function (rows) {
      rows.forEach(function (r) { paintFollowup(r.index, r); });
    });
    $all('[data-fu-box]').forEach(function (box) {
      box.addEventListener('change', function () {
        var i = Number(box.getAttribute('data-fu-box'));
        var who = setting('supervisor');
        if (box.checked && !who) {
          who = (prompt('Your name (saved on this device for ticking off actions):') || '').trim();
          if (!who) { box.checked = false; return; }
          setting('supervisor', who);
        }
        var row = { done: box.checked, by: who, at: new Date().toISOString() };
        MMDB.setFollowup(t.id, i, row).then(function () { paintFollowup(i, row); toast(box.checked ? 'Action ticked off' : 'Action re-opened'); });
      });
    });
  }
  function paintFollowup(i, r) {
    var li = $('[data-fu="' + i + '"]'); if (!li) return;
    var box = $('input', li); var d = $('.fu-done', li);
    box.checked = !!r.done; li.classList.toggle('done', !!r.done);
    if (r.done) { d.textContent = 'Done \u2013 ' + (r.by || '') + ', ' + fmtStamp(r.at); d.hidden = false; } else { d.hidden = true; }
  }

  // ---------- sign-on ----------
  function signonSection(t) {
    var depot = esc(setting('depot'));
    return '<section class="card signon no-print" id="signon" aria-labelledby="signon-h">' +
      '<h2 id="signon-h">Sign on to this talk</h2>' +
      '<form id="signonForm" novalidate autocomplete="on">' +
        '<label class="field"><span>Your name <b aria-hidden="true">*</b></span><input name="name" required autocomplete="name" maxlength="80" enterkeyhint="next"></label>' +
        '<fieldset class="field roles"><legend>Role <b aria-hidden="true">*</b></legend>' +
          '<label class="pill"><input type="radio" name="role" value="Driver" required><span>Driver</span></label>' +
          '<label class="pill"><input type="radio" name="role" value="Supervisor"><span>Supervisor</span></label>' +
          '<label class="pill"><input type="radio" name="role" value="Other"><span>Other</span></label>' +
          '<input name="roleOther" class="role-other" placeholder="Role (e.g. yard hand, mechanic)" maxlength="60" hidden>' +
        '</fieldset>' +
        '<label class="field"><span>Depot <small>(optional)</small></span><input name="depot" maxlength="60" value="' + depot + '" autocomplete="off"></label>' +
        '<label class="tick"><input type="checkbox" name="attended" required><span>I attended this toolbox talk and understood it.</span></label>' +
        '<div class="field"><span class="label-row"><span>Signature <b aria-hidden="true">*</b></span><button type="button" class="link" id="sigClear">Clear</button></span>' +
          '<canvas id="sigPad" class="sigpad" aria-label="Signature pad: sign with your finger"></canvas>' +
          '<small class="hint">Sign with your finger in the box.</small></div>' +
        '<p class="stamp">Time: <strong id="stamp"></strong></p>' +
        '<p id="formError" class="error" role="alert" hidden></p>' +
        '<button class="btn big" type="submit">Sign on</button>' +
      '</form>' +
      '<div class="signed"><h3>Signed on (this device) <span id="signCount" class="count">0</span></h3><ul id="signList" class="signlist"></ul>' +
      '<div class="sup-tools"><button type="button" class="btn ghost" data-export="' + esc(t.id) + '">Download CSV</button>' +
      '<button type="button" class="btn ghost" data-share="' + esc(t.id) + '">Share / email CSV</button></div></div>' +
      '</section>';
  }
  function printRegister(t) {
    return '<section class="print-only register" aria-hidden="true"><h2>Sign-on register \u2013 ' + esc(t.title) + ' (' + esc(fmtTalkDate(t.date)) + ')</h2>' +
      '<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Depot</th><th>Attended &amp; understood</th><th>Signed (Sydney time)</th><th>Signature</th></tr></thead><tbody id="printRows"></tbody></table>' +
      '<p class="muted">Supervisor: ______________________ Signature: ______________________ Date: ____________</p></section>';
  }
  function wireSignon(t) {
    var form = $('#signonForm');
    var canvas = $('#sigPad');
    state.pad = new SignaturePad(canvas, function () { state.formDirty = true; });
    $('#sigClear').onclick = function () { state.pad.clear(); };
    var stampEl = $('#stamp');
    function tick() { if (document.body.contains(stampEl)) { stampEl.textContent = fmtStamp(new Date().toISOString(), true); setTimeout(tick, 1000); } }
    tick();
    form.addEventListener('input', function () { state.formDirty = true; });
    $all('input[name="role"]', form).forEach(function (r) {
      r.addEventListener('change', function () { var o = $('.role-other', form); o.hidden = form.role.value !== 'Other'; if (!o.hidden) o.focus(); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#formError');
      var name = form.name.value.trim().replace(/\s+/g, ' ');
      var role = form.role.value;
      var roleOther = form.roleOther.value.trim();
      var problems = [];
      if (name.length < 2) problems.push('enter your name');
      if (!role) problems.push('choose your role');
      if (role === 'Other' && !roleOther) problems.push('type your role');
      if (!form.attended.checked) problems.push('tick that you attended and understood');
      if (state.pad.isEmpty()) problems.push('sign in the box');
      if (problems.length) { err.textContent = 'Please ' + problems.join(', ') + '.'; err.hidden = false; return; }
      err.hidden = true;
      MMDB.signonsForTalk(t.id).then(function (rows) {
        var dup = rows.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); });
        if (dup && !confirm(name + ' has already signed on to this talk on this device. Sign on again?')) return;
        var depot = form.depot.value.trim();
        if (depot) setting('depot', depot);
        var row = {
          talkId: t.id, talkTitle: t.title, talkDate: t.date, weekLabel: t.week_label,
          name: name, role: role === 'Other' ? 'Other: ' + roleOther : role, depot: depot,
          attended: true, signedAt: new Date().toISOString(), signature: state.pad.toDataURL()
        };
        return MMDB.addSignon(row).then(function () {
          MMDB.persist();
          toast('Signed on: ' + name + ' \u2013 ' + fmtStamp(row.signedAt));
          form.name.value = ''; form.attended.checked = false;
          $all('input[name="role"]', form).forEach(function (r) { r.checked = false; });
          form.roleOther.value = ''; $('.role-other', form).hidden = true;
          state.pad.clear(); state.formDirty = false;
          refreshSignons(t);
        });
      }).catch(function (ex) { err.textContent = 'Could not save the sign-on on this device: ' + ex.message; err.hidden = false; });
    });
    $all('[data-export]').forEach(function (b) { b.onclick = function () { exportCSV(t, false); }; });
    $all('[data-share]').forEach(function (b) { b.onclick = function () { exportCSV(t, true); }; });
  }
  function refreshSignons(t) {
    return MMDB.signonsForTalk(t.id).then(function (rows) {
      var list = $('#signList'); var count = $('#signCount'); var pr = $('#printRows');
      if (count) count.textContent = rows.length;
      if (list) list.innerHTML = rows.length ? rows.map(function (r) {
        return '<li><img src="' + esc(r.signature) + '" alt="" class="sig-thumb"><span><strong>' + esc(r.name) + '</strong> \u2013 ' + esc(r.role) +
          (r.depot ? ' \u00b7 ' + esc(r.depot) : '') + '<br><small>' + esc(fmtStamp(r.signedAt)) + '</small></span></li>';
      }).join('') : '<li class="muted">No sign-ons yet on this device.</li>';
      if (pr) {
        var html = rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.role) + '</td><td>' + esc(r.depot) + '</td><td>Yes</td><td>' + esc(fmtStamp(r.signedAt)) +
            '</td><td><img src="' + esc(r.signature) + '" alt="signature"></td></tr>';
        }).join('');
        for (var i = rows.length; i < Math.max(rows.length + 6, 12); i++) html += '<tr class="blank"><td>' + (i + 1) + '</td><td></td><td></td><td></td><td>\u2610</td><td></td><td></td></tr>';
        pr.innerHTML = html;
      }
      return rows;
    });
  }

  // ---------- CSV export / share ----------
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(t, rows, withSignatures) {
    var head = ['talk_id', 'talk_title', 'talk_date', 'week_label', 'worker_name', 'role', 'depot', 'attended_and_understood', 'signed_at_sydney', 'signed_at_utc_iso', 'device_id', 'signon_id'];
    if (withSignatures) head.push('signature_png_data_url');
    var lines = [head.join(',')];
    rows.forEach(function (r) {
      var cells = [t.id, t.title, t.date, t.week_label, r.name, r.role, r.depot, r.attended ? 'Yes' : 'No', fmtStamp(r.signedAt, true), r.signedAt, r.deviceId, r.id];
      if (withSignatures) cells.push(r.signature);
      lines.push(cells.map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }
  function download(name, text) {
    var blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function exportCSV(t, share) {
    return MMDB.signonsForTalk(t.id).then(function (rows) {
      if (!rows.length) { toast('No sign-ons on this device for this talk yet.'); return; }
      var name = 'monaro-toolbox-signons-' + t.id + '.csv';
      var csv = buildCSV(t, rows, true);
      var subject = 'Toolbox talk sign-ons: ' + t.title + ' (' + fmtTalkDate(t.date) + ')';
      var summary = rows.length + ' sign-on(s) for "' + t.title + '" \u2013 ' + t.week_label + '.';
      window.__lastCSV = csv; // used by automated checks
      if (!share) { download(name, csv); toast('CSV downloaded (' + rows.length + ' sign-ons)'); return; }
      var file;
      try { file = new File(['\ufeff' + csv], name, { type: 'text/csv' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: subject, text: summary }).catch(function (e) {
          if (e && e.name === 'AbortError') return;
          mailtoFallback(t, rows, name, csv, subject, summary);
        });
      }
      mailtoFallback(t, rows, name, csv, subject, summary);
    });
  }
  function mailtoFallback(t, rows, name, csv, subject, summary) {
    download(name, csv);
    var plain = buildCSV(t, rows, false);
    var body = summary + '\n\nThe full CSV (with signatures) has been downloaded as ' + name + ' \u2013 please attach it to this email.\n\nSummary (no signatures):\n' + plain;
    if (body.length > 1800) body = body.slice(0, 1750) + '\n\u2026 (truncated \u2013 see attached CSV)';
    var to = setting('email');
    location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  // ---------- archive ----------
  function renderArchive() {
    return ensureIndex().then(function (idx) {
      document.title = 'Archive \u2013 MM Toolbox';
      return MMDB.allSignons().then(function (all) {
        var counts = {}; all.forEach(function (r) { counts[r.talkId] = (counts[r.talkId] || 0) + 1; });
        main.innerHTML = '<section class="card"><h1>Archive</h1><p class="muted">' + idx.count + ' talk' + (idx.count === 1 ? '' : 's') + ', newest first.</p>' +
          '<ul class="archive">' + idx.talks.map(function (t, i) {
            return '<li><a href="#/talk/' + encodeURIComponent(t.id) + '"><span class="a-date">' + esc(fmtTalkDate(t.date)) + (i === 0 ? ' <span class="tag now">This week</span>' : '') + '</span>' +
              '<span class="a-title">' + esc(t.title) + '</span><span class="a-meta">' + esc(t.week_label) + ' \u00b7 ' + (counts[t.id] || 0) + ' sign-on(s) on this device</span></a></li>';
          }).join('') + '</ul></section>';
        window.scrollTo(0, 0);
      });
    });
  }

  // ---------- supervisor ----------
  function renderSupervisor() {
    return ensureIndex().then(function (idx) {
      document.title = 'Supervisor \u2013 MM Toolbox';
      return MMDB.allSignons().then(function (all) {
        var by = {}; all.forEach(function (r) { (by[r.talkId] = by[r.talkId] || []).push(r); });
        main.innerHTML = '<section class="card"><h1>Supervisor tools</h1>' +
          '<p>Sign-ons are saved on <strong>this device only</strong>. Export them after each talk and file the CSV (or printed register) with your WHS/CoR records.</p>' +
          '<form id="supSettings" class="settings"><label class="field"><span>Supervisor name (used when ticking off follow-up actions)</span><input name="supervisor" value="' + esc(setting('supervisor')) + '" maxlength="80"></label>' +
          '<label class="field"><span>Default email for CSV exports (mailto fallback)</span><input name="email" type="email" value="' + esc(setting('email')) + '" maxlength="120" placeholder="e.g. office@example.com.au"></label>' +
          '<button class="btn ghost" type="submit">Save settings</button></form></section>' +
          '<section class="card"><h2>Sign-on registers</h2><div class="sup-table">' + idx.talks.map(function (t) {
            var rows = (by[t.id] || []).sort(function (a, b) { return a.signedAt.localeCompare(b.signedAt); });
            return '<details class="sup-talk"><summary><span>' + esc(fmtTalkDate(t.date)) + ' \u2013 ' + esc(t.title) + '</span><span class="count">' + rows.length + '</span></summary>' +
              '<div class="sup-tools"><button class="btn ghost" data-sexport="' + esc(t.id) + '">Download CSV</button><button class="btn ghost" data-sshare="' + esc(t.id) + '">Share / email CSV</button>' +
              '<a class="btn ghost" href="#/talk/' + encodeURIComponent(t.id) + '" data-print="' + esc(t.id) + '">Print register</a></div>' +
              (rows.length ? '<ul class="signlist">' + rows.map(function (r) {
                return '<li><img src="' + esc(r.signature) + '" alt="" class="sig-thumb"><span><strong>' + esc(r.name) + '</strong> \u2013 ' + esc(r.role) + (r.depot ? ' \u00b7 ' + esc(r.depot) : '') +
                  '<br><small>' + esc(fmtStamp(r.signedAt)) + '</small></span><button class="link danger" data-del="' + esc(r.id) + '">Delete</button></li>';
              }).join('') + '</ul>' : '<p class="muted">No sign-ons on this device.</p>') + '</details>';
          }).join('') + '</div></section>' +
          '<section class="card"><h2>Install on your phone</h2><ul class="bullets"><li><strong>Android (Chrome):</strong> tap \u22ee menu \u2192 <em>Install app</em> / <em>Add to Home screen</em>.</li>' +
          '<li><strong>iPhone (Safari):</strong> tap the Share button \u2192 <em>Add to Home Screen</em>.</li><li>Open it once with signal so the talk is saved for offline use in the yard.</li></ul></section>';
        $('#supSettings').onsubmit = function (e) { e.preventDefault(); setting('supervisor', this.supervisor.value.trim()); setting('email', this.email.value.trim()); toast('Settings saved on this device'); };
        $all('[data-sexport],[data-sshare]').forEach(function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-sexport') || b.getAttribute('data-sshare');
            loadTalk(id).then(function (t) { exportCSV(t, b.hasAttribute('data-sshare')); });
          };
        });
        $all('[data-print]').forEach(function (a) {
          a.onclick = function (e) { e.preventDefault(); location.hash = '#/talk/' + encodeURIComponent(a.getAttribute('data-print')); setTimeout(function () { window.print(); }, 700); };
        });
        $all('[data-del]').forEach(function (b) {
          b.onclick = function () {
            if (!confirm('Delete this sign-on from this device? Export the CSV first if you need a record.')) return;
            MMDB.deleteSignon(b.getAttribute('data-del')).then(function () { toast('Sign-on deleted'); renderSupervisor(); });
          };
        });
      });
    });
  }

  // ---------- chrome: text size, network, SW, updates ----------
  var sizes = [1, 1.15, 1.3];
  function sizeIdx() { var i = Number(setting('size') || 0); return sizes[i] ? i : 0; }
  function applySize() { document.documentElement.style.setProperty('--scale', String(sizes[sizeIdx()])); }
  document.getElementById('textSize').onclick = function () { setting('size', String((sizeIdx() + 1) % sizes.length)); applySize(); toast('Text size ' + Math.round(sizes[sizeIdx()] * 100) + '%'); };
  applySize();

  function netStatus() { var n = document.getElementById('net'); n.textContent = navigator.onLine ? '' : 'Offline'; n.classList.toggle('off', !navigator.onLine); }
  window.addEventListener('online', function () { netStatus(); checkForNewTalk(); });
  window.addEventListener('offline', netStatus);
  netStatus();

  function showVersion() {
    getJSON('version.json').then(function (v) {
      document.getElementById('ver').textContent = 'Last published ' + fmtStamp(v.published_at) + ' \u00b7 ' + v.cache_version;
    }).catch(function () {});
  }
  function checkForNewTalk() {
    if (!state.index) return;
    var old = state.index.latest;
    getJSON('talks/index.json').then(function (idx) {
      if (idx.latest && idx.latest !== old) {
        state.index = idx; warmCache(idx);
        banner('<strong>New toolbox talk published.</strong> Tap to open it.', function () { location.hash = '#/'; route(); });
      } else { state.index = idx; }
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkForNewTalk(); });

  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function (e) { console.warn('SW registration failed', e); });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; if (state.index) warmCache(state.index); return; }
      if (state.formDirty) banner('<strong>App updated.</strong> Tap to reload when you\u2019ve finished signing on.', function () { location.reload(); });
      else location.reload();
    });
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeprint', function () { $all('details').forEach(function (d) { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; }); });
  window.addEventListener('afterprint', function () { $all('details').forEach(function (d) { if (d.dataset.wasOpen !== undefined) d.open = d.dataset.wasOpen === '1'; }); });
  route();
  showVersion();
  window.MMApp = { buildCSV: buildCSV, state: state };
})();
