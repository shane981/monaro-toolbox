/* Toolbox talks, finger sign-on, and the CSV / print register.
   CSV columns match the previous Monaro toolbox app. */
(function () {
  'use strict';
  var U = function () { return window.MM; };
  var pad = null;
  var formDirty = false;
  var io = null;

  function destroyPad() {
    if (io) { io.disconnect(); io = null; }
    if (pad) { pad.destroy(); pad = null; }
    formDirty = false;
  }

  function listHTML(items) {
    return '<ul class="bullets">' + U().asList(items).map(function (i) { return '<li>' + U().esc(i) + '</li>'; }).join('') + '</ul>';
  }
  function section(id, title, body, extra) {
    return '<section class="card ' + (extra || '') + '" id="' + id + '" aria-labelledby="' + id + '-h"><h2 id="' + id + '-h">' + U().esc(title) + '</h2>' + body + '</section>';
  }

  function signonSection(t) {
    var depot = U().esc(U().setting('depot'));
    return '<section class="card signon no-print" id="signon" aria-labelledby="signon-h">' +
      '<h2 id="signon-h">Sign on to this talk</h2>' +
      '<p class="hint">Your name and signature stay on this phone until a supervisor exports the register.</p>' +
      '<form id="signonForm" novalidate autocomplete="on">' +
        '<label class="field"><span>Your name <b aria-hidden="true">*</b></span><input name="name" required autocomplete="name" maxlength="80" enterkeyhint="next"></label>' +
        '<fieldset class="field roles"><legend>Role <b aria-hidden="true">*</b></legend>' +
          '<label class="pill"><input type="radio" name="role" value="Driver" required><span>Driver</span></label>' +
          '<label class="pill"><input type="radio" name="role" value="Supervisor"><span>Supervisor</span></label>' +
          '<label class="pill"><input type="radio" name="role" value="Other"><span>Other</span></label>' +
          '<input name="roleOther" class="role-other" placeholder="Role (for example yard, mechanic)" maxlength="60" hidden>' +
        '</fieldset>' +
        '<label class="field"><span>Depot <small>(optional)</small></span><input name="depot" maxlength="60" value="' + depot + '" autocomplete="off"></label>' +
        '<label class="tick"><input type="checkbox" name="attended" required><span>I attended this toolbox talk and understood it.</span></label>' +
        '<div class="field"><span class="label-row"><span>Signature <b aria-hidden="true">*</b></span><button type="button" class="link" id="sigClear">Clear</button></span>' +
          '<canvas id="sigPad" class="sigpad" aria-label="Signature pad. Sign with your finger."></canvas>' +
          '<small class="hint">Sign with your finger in the box.</small></div>' +
        '<p class="stamp">Time: <strong id="stamp"></strong></p>' +
        '<p id="formError" class="error" role="alert" hidden></p>' +
        '<button class="btn big" type="submit">Sign on</button>' +
      '</form>' +
      '<div class="signed"><h3>Signed on (this phone) <span id="signCount" class="count">0</span></h3><ul id="signList" class="signlist"></ul>' +
      '<div class="sup-tools"><button type="button" class="btn ghost" data-export="' + U().esc(t.id) + '">Download CSV</button>' +
      '<button type="button" class="btn ghost" data-share="' + U().esc(t.id) + '">Share / email CSV</button></div></div>' +
      '</section>';
  }

  function printRegister(t) {
    return '<section class="print-only register" aria-hidden="true"><h2>Sign-on register — ' + U().esc(t.title) + ' (' + U().esc(U().fmtTalkDate(t.date)) + ')</h2>' +
      '<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Depot</th><th>Attended &amp; understood</th><th>Signed (Sydney time)</th><th>Signature</th></tr></thead><tbody id="printRows"></tbody></table>' +
      '<p class="muted">Supervisor: ______________________ Signature: ______________________ Date: ____________</p></section>';
  }

  function paintFollowup(i, r) {
    var li = U().$('[data-fu="' + i + '"]'); if (!li) return;
    var box = U().$('input', li); var d = U().$('.fu-done', li);
    box.checked = !!r.done; li.classList.toggle('done', !!r.done);
    if (r.done) { d.textContent = 'Done — ' + (r.by || '') + ', ' + U().fmtStamp(r.at); d.hidden = false; } else d.hidden = true;
  }

  function wireFollowups(t) {
    window.MMDB.followupsForTalk(t.id).then(function (rows) { rows.forEach(function (r) { paintFollowup(r.index, r); }); });
    U().$all('[data-fu-box]').forEach(function (box) {
      box.addEventListener('change', function () {
        var i = Number(box.getAttribute('data-fu-box'));
        var who = U().setting('supervisor');
        if (box.checked && !who) {
          who = (prompt('Your name (saved on this phone for ticking off actions):') || '').trim();
          if (!who) { box.checked = false; return; }
          U().setting('supervisor', who);
        }
        var row = { done: box.checked, by: who, at: new Date().toISOString() };
        window.MMDB.setFollowup(t.id, i, row).then(function () { paintFollowup(i, row); U().toast(box.checked ? 'Action ticked off' : 'Action re-opened'); });
      });
    });
  }

  function refreshSignons(t) {
    return window.MMDB.signonsForTalk(t.id).then(function (rows) {
      var list = U().$('#signList'); var count = U().$('#signCount'); var pr = U().$('#printRows');
      if (count) count.textContent = rows.length;
      if (list) list.innerHTML = rows.length ? rows.map(function (r) {
        return '<li><img src="' + U().esc(r.signature) + '" alt="" class="sig-thumb"><span><strong>' + U().esc(r.name) + '</strong> — ' + U().esc(r.role) +
          (r.depot ? ' · ' + U().esc(r.depot) : '') + '<br><small>' + U().esc(U().fmtStamp(r.signedAt)) + '</small></span></li>';
      }).join('') : '<li class="muted">No sign-ons yet on this phone.</li>';
      if (pr) {
        var html = rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + U().esc(r.name) + '</td><td>' + U().esc(r.role) + '</td><td>' + U().esc(r.depot) + '</td><td>Yes</td><td>' + U().esc(U().fmtStamp(r.signedAt)) +
            '</td><td><img src="' + U().esc(r.signature) + '" alt="signature"></td></tr>';
        }).join('');
        for (var i = rows.length; i < Math.max(rows.length + 6, 12); i++) html += '<tr class="blank"><td>' + (i + 1) + '</td><td></td><td></td><td></td><td>□</td><td></td><td></td></tr>';
        pr.innerHTML = html;
      }
      return rows;
    });
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(t, rows, withSignatures) {
    var head = ['talk_id', 'talk_title', 'talk_date', 'week_label', 'worker_name', 'role', 'depot', 'attended_and_understood', 'signed_at_sydney', 'signed_at_utc_iso', 'device_id', 'signon_id'];
    if (withSignatures) head.push('signature_png_data_url');
    var lines = [head.join(',')];
    rows.forEach(function (r) {
      var cells = [t.id, t.title, t.date, t.week_label, r.name, r.role, r.depot, r.attended ? 'Yes' : 'No', U().fmtStamp(r.signedAt, true), r.signedAt, r.deviceId, r.id];
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
  function mailtoFallback(t, rows, name, csv, subject, summary) {
    download(name, csv);
    var plain = buildCSV(t, rows, false);
    var body = summary + '\n\nThe full CSV (with signatures) has been downloaded as ' + name + ' — please attach it to this email.\n\nSummary (no signatures):\n' + plain;
    if (body.length > 1800) body = body.slice(0, 1750) + '\n… (truncated — see attached CSV)';
    var to = U().setting('email');
    location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function exportCSV(t, share) {
    return window.MMDB.signonsForTalk(t.id).then(function (rows) {
      if (!rows.length) { U().toast('No sign-ons on this phone for this talk yet.'); return; }
      var name = 'monaro-toolbox-signons-' + t.id + '.csv';
      var csv = buildCSV(t, rows, true);
      var subject = 'Toolbox talk sign-ons: ' + t.title + ' (' + U().fmtTalkDate(t.date) + ')';
      var summary = rows.length + ' sign-on(s) for "' + t.title + '" — ' + t.week_label + '.';
      window.__lastCSV = csv;
      if (!share) { download(name, csv); U().toast('CSV downloaded (' + rows.length + ' sign-ons)'); return; }
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

  function wireSignon(t) {
    var form = U().$('#signonForm');
    var canvas = U().$('#sigPad');
    pad = new window.SignaturePad(canvas, function () { formDirty = true; });
    U().$('#sigClear').onclick = function () { pad.clear(); };
    var stampEl = U().$('#stamp');
    function tick() { if (document.body.contains(stampEl)) { stampEl.textContent = U().fmtStamp(new Date().toISOString(), true); setTimeout(tick, 1000); } }
    tick();
    form.addEventListener('input', function () { formDirty = true; });
    U().$all('input[name="role"]', form).forEach(function (r) {
      r.addEventListener('change', function () {
        var o = U().$('.role-other', form);
        o.hidden = form.role.value !== 'Other';
        if (!o.hidden) o.focus();
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = U().$('#formError');
      var name = form.name.value.trim().replace(/\s+/g, ' ');
      var role = form.role.value;
      var roleOther = form.roleOther.value.trim();
      var problems = [];
      if (name.length < 2) problems.push('enter your name');
      if (!role) problems.push('choose your role');
      if (role === 'Other' && !roleOther) problems.push('type your role');
      if (!form.attended.checked) problems.push('tick that you attended and understood');
      if (pad.isEmpty()) problems.push('sign in the box');
      if (problems.length) { err.textContent = 'Please ' + problems.join(', ') + '.'; err.hidden = false; return; }
      err.hidden = true;
      window.MMDB.signonsForTalk(t.id).then(function (rows) {
        var dup = rows.some(function (r) { return r.name.toLowerCase() === name.toLowerCase(); });
        if (dup && !confirm(name + ' has already signed on to this talk on this phone. Sign on again?')) return;
        var depot = form.depot.value.trim();
        if (depot) U().setting('depot', depot);
        var row = {
          talkId: t.id, talkTitle: t.title, talkDate: t.date, weekLabel: t.week_label,
          name: name, role: role === 'Other' ? 'Other: ' + roleOther : role, depot: depot,
          attended: true, signedAt: new Date().toISOString(), signature: pad.toDataURL()
        };
        return window.MMDB.addSignon(row).then(function () {
          window.MMDB.persist();
          formDirty = false;
          U().toast('Signed on, ' + name + '. You’re on the sheet.');
          window.MMProgress.confetti();
          form.name.value = ''; form.attended.checked = false;
          U().$all('input[name="role"]', form).forEach(function (r) { r.checked = false; });
          form.roleOther.value = ''; U().$('.role-other', form).hidden = true;
          pad.clear();
          refreshSignons(t);
        });
      }).catch(function (ex) { err.textContent = 'Could not save the sign-on on this phone: ' + ex.message; err.hidden = false; });
    });
    U().$all('[data-export]').forEach(function (b) { b.onclick = function () { exportCSV(t, false); }; });
    U().$all('[data-share]').forEach(function (b) { b.onclick = function () { exportCSV(t, true); }; });
  }

  function renderTalk(t, anchor, isLatest) {
    destroyPad();
    document.title = t.title + ' – Monaro';
    var checklist = '<ul class="checklist">' + t.practical_checklist.map(function (c, i) {
      return '<li><label><input type="checkbox" data-check="' + i + '"><span>' + U().esc(c) + '</span></label></li>';
    }).join('') + '</ul>';
    var followups = '<p class="hint">Supervisors: tick each action when it’s done. Ticks are saved on this phone.</p><ul class="followups">' +
      t.follow_up_actions.map(function (a, i) {
        a = U().actionText(a);
        var meta = [a.owner ? 'Owner: ' + U().esc(a.owner) : '', a.due ? 'Due: ' + U().esc(a.due) : ''].filter(Boolean).join(' · ');
        return '<li data-fu="' + i + '"><label><input type="checkbox" data-fu-box="' + i + '"><span class="fu-text">' + U().esc(a.action) +
          (meta ? '<small class="fu-meta">' + meta + '</small>' : '') + '<small class="fu-done" hidden></small></span></label></li>';
      }).join('') + '</ul>';
    var sources = '<details class="sources"><summary>' + t.sources_reviewed.length + ' sources reviewed</summary><ol>' +
      t.sources_reviewed.map(function (s) {
        return '<li><strong>' + U().esc(s.name) + '</strong>' + (s.type === 'industry' ? ' <span class="tag">industry context</span>' : '') +
          ' — <a href="' + U().esc(s.url) + '" target="_blank" rel="noopener">' + U().esc(s.title) + '</a> <span class="muted">(' + U().esc(U().fmtSourceDate(s.date)) + ')</span>' +
          '<span class="print-url">' + U().esc(s.url) + '</span>' + (s.note ? '<br><small>' + U().esc(s.note) + '</small>' : '') + '</li>';
      }).join('') + '</ol></details>';

    U().$('#main').innerHTML =
      '<article class="talk">' +
      '<header class="card hero">' +
        (isLatest ? '<p class="eyebrow">This week’s toolbox talk</p>' : '<p class="eyebrow archive-flag">From the archive</p>') +
        '<h1>' + U().esc(t.title) + '</h1>' +
        '<p class="when">' + U().esc(t.week_label) + (t.week_label.indexOf(U().fmtTalkDate(t.date).replace(/^\w+ /, '')) >= 0 ? '' : ' · ' + U().esc(U().fmtTalkDate(t.date))) + '</p>' +
        (t.summary ? '<p class="summary">' + U().esc(t.summary) + '</p>' : '') +
        '<div class="hero-actions no-print"><a class="btn" href="#/talk/' + encodeURIComponent(t.id) + '/signon">Sign on</a>' +
        '<button class="btn ghost" type="button" id="printBtn">Print / save PDF</button></div>' +
      '</header>' +
      section('risk', 'Key risk this week', '<p class="risk-text">' + U().esc(t.key_risk) + '</p>', 'risk') +
      section('drivers', 'What drivers need to know', listHTML(t.drivers_need_to_know)) +
      section('supervisors', 'What supervisors must check', listHTML(t.supervisors_must_check)) +
      section('questions', 'Discussion questions', '<ol class="questions">' + t.discussion_questions.map(function (q) { return '<li>' + U().esc(q) + '</li>'; }).join('') + '</ol>') +
      section('checklist', 'Practical checklist', '<p class="hint">Tick as you go. These ticks are not saved.</p>' + checklist) +
      section('records', 'Required records', listHTML(U().asList(t.required_records))) +
      section('followups', 'Follow-up actions', followups) +
      section('sources', 'Sources reviewed', sources, 'sources-card') +
      signonSection(t) +
      printRegister(t) +
      '<div class="sticky-action no-print" id="stickySign"><a class="btn big" href="#/talk/' + encodeURIComponent(t.id) + '/signon">Sign on</a></div>' +
      '</article>';

    U().$('#printBtn').onclick = function () { window.print(); };
    wireFollowups(t);
    wireSignon(t);
    refreshSignons(t);
    var target = document.getElementById('signon');
    var bar = document.getElementById('stickySign');
    if (target && bar && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) { bar.hidden = entries[0].isIntersecting; }, { rootMargin: '0px 0px -80px 0px' });
      io.observe(target);
    }
    if (anchor === 'signon') setTimeout(function () { target && target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    else window.scrollTo(0, 0);
  }

  function renderArchive(index) {
    destroyPad();
    document.title = 'Toolbox talks – Monaro';
    return window.MMDB.allSignons().then(function (all) {
      var counts = {};
      all.forEach(function (r) { counts[r.talkId] = (counts[r.talkId] || 0) + 1; });
      U().$('#main').innerHTML = '<section class="card"><p class="eyebrow">Toolbox talks</p><h1>This week and the archive</h1>' +
        '<p class="muted">' + index.count + ' talk' + (index.count === 1 ? '' : 's') + ', newest first. Sign-on counts are for this phone only.</p></section>' +
        '<ul class="archive">' + index.talks.map(function (t, i) {
          return '<li><a class="archive-card" href="#/talk/' + encodeURIComponent(t.id) + '"><span class="a-date">' + U().esc(U().fmtTalkDate(t.date)) +
            (i === 0 ? ' <span class="tag now">This week</span>' : '') + '</span><span class="a-title">' + U().esc(t.title) + '</span>' +
            '<span class="a-meta">' + U().esc(t.week_label) + ' · ' + (counts[t.id] || 0) + ' sign-on' + ((counts[t.id] || 0) === 1 ? '' : 's') + '</span></a></li>';
        }).join('') + '</ul>' +
        '<p class="pad-more"><a class="btn ghost" href="#/supervisor">Supervisor register and export</a></p>';
      window.scrollTo(0, 0);
    });
  }

  function renderSupervisor(index, loadTalk) {
    destroyPad();
    document.title = 'Register – Monaro';
    return window.MMDB.allSignons().then(function (all) {
      var by = {};
      all.forEach(function (r) { (by[r.talkId] = by[r.talkId] || []).push(r); });
      U().$('#main').innerHTML = '<section class="card"><p class="eyebrow">Supervisor</p><h1>Sign-on register</h1>' +
        '<p>Sign-ons are saved on <strong>this phone only</strong>. Export them after each talk and file the CSV, or the printed register, with your records.</p>' +
        '<form id="supSettings" class="settings"><label class="field"><span>Supervisor name <small>(used when ticking off follow-up actions)</small></span><input name="supervisor" value="' + U().esc(U().setting('supervisor')) + '" maxlength="80"></label>' +
        '<label class="field"><span>Email for the CSV share fallback</span><input name="email" type="email" value="' + U().esc(U().setting('email')) + '" maxlength="120" placeholder="name@monaromilk.com.au" autocomplete="email"></label>' +
        '<button class="btn ghost" type="submit">Save on this phone</button></form></section>' +
        '<section class="card"><h2>By talk</h2>' + index.talks.map(function (t) {
          var rows = (by[t.id] || []).slice().sort(function (a, b) { return a.signedAt.localeCompare(b.signedAt); });
          return '<details class="sup-talk"><summary><span>' + U().esc(U().fmtTalkDate(t.date)) + ' — ' + U().esc(t.title) + '</span><span class="count">' + rows.length + '</span></summary>' +
            '<div class="sup-tools"><button type="button" class="btn ghost" data-sexport="' + U().esc(t.id) + '">Download CSV</button>' +
            '<button type="button" class="btn ghost" data-sshare="' + U().esc(t.id) + '">Share / email CSV</button>' +
            '<a class="btn ghost" href="#/talk/' + encodeURIComponent(t.id) + '" data-print="' + U().esc(t.id) + '">Print register</a></div>' +
            (rows.length ? '<ul class="signlist">' + rows.map(function (r) {
              return '<li><img src="' + U().esc(r.signature) + '" alt="" class="sig-thumb"><span><strong>' + U().esc(r.name) + '</strong> — ' + U().esc(r.role) +
                (r.depot ? ' · ' + U().esc(r.depot) : '') + '<br><small>' + U().esc(U().fmtStamp(r.signedAt)) + '</small></span>' +
                '<button type="button" class="link danger" data-del="' + U().esc(r.id) + '">Delete</button></li>';
            }).join('') + '</ul>' : '<p class="muted">No sign-ons on this phone.</p>') + '</details>';
        }).join('') + '</section>';
      U().$('#supSettings').onsubmit = function (e) {
        e.preventDefault();
        U().setting('supervisor', this.supervisor.value.trim());
        U().setting('email', this.email.value.trim());
        U().toast('Saved on this phone');
      };
      U().$all('[data-sexport],[data-sshare]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-sexport') || b.getAttribute('data-sshare');
          loadTalk(id).then(function (t) { exportCSV(t, b.hasAttribute('data-sshare')); });
        };
      });
      U().$all('[data-print]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          location.hash = '#/talk/' + encodeURIComponent(a.getAttribute('data-print'));
          setTimeout(function () { window.print(); }, 700);
        });
      });
      U().$all('[data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Delete this sign-on from this phone? Export the CSV first if you need a record.')) return;
          window.MMDB.deleteSignon(b.getAttribute('data-del')).then(function () { U().toast('Sign-on deleted'); location.hash = '#/supervisor'; window.MMApp.route(); });
        };
      });
      window.scrollTo(0, 0);
    });
  }

  function searchBits(t) {
    var bits = [t.title, t.week_label, t.summary, t.key_risk, t.prepared_by].concat(t.drivers_need_to_know || [], t.supervisors_must_check || [], t.discussion_questions || [], t.practical_checklist || []);
    U().asList(t.required_records).forEach(function (r) { bits.push(r); });
    (t.follow_up_actions || []).forEach(function (a) { bits.push(typeof a === 'string' ? a : a.action); });
    return bits.filter(Boolean).join(' \n ');
  }

  window.MMTalks = {
    renderTalk: renderTalk,
    renderArchive: renderArchive,
    renderSupervisor: renderSupervisor,
    destroyPad: destroyPad,
    isDirty: function () { return formDirty; },
    searchBits: searchBits,
    buildCSV: buildCSV
  };
  window.MMApp = window.MMApp || {};
})();
