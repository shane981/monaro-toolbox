/* Shared helpers. No personal data leaves the device from here. */
(function () {
  'use strict';
  var TZ = 'Australia/Sydney';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setting(k, v) {
    if (v === undefined) return localStorage.getItem('mm-set-' + k) || '';
    localStorage.setItem('mm-set-' + k, v);
  }
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, ms || 3200);
  }
  function fmtTalkDate(iso) {
    var p = String(iso).split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  }
  function fmtStamp(iso, withSeconds) {
    var o = { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short' };
    if (withSeconds) o.second = '2-digit';
    return new Intl.DateTimeFormat('en-AU', o).format(new Date(iso));
  }
  function fmtSourceDate(d) {
    if (!d || d === 'undated') return 'undated';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var p = d.split('-').map(Number);
      return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
    }
    if (/^\d{4}-\d{2}$/.test(d)) {
      var q = d.split('-').map(Number);
      return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(q[0], q[1] - 1, 1)));
    }
    return d;
  }
  function asList(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
  function actionText(a) { return typeof a === 'string' ? { action: a } : a; }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 503 ? 'offline' : 'HTTP ' + r.status);
      return r.json();
    });
  }
  function greet() {
    var h = Number(new Intl.DateTimeFormat('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(new Date()));
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
  function sourceLine(s) {
    if (!s) return '';
    var label = esc(s.name) + (s.title ? ' — ' + esc(s.title) : '');
    if (!s.url) return '<p class="cite">Source: ' + label + '</p>';
    return '<p class="cite">Source: <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + label + '</a></p>';
  }

  window.MM = {
    $: $, $all: $all, esc: esc, setting: setting, toast: toast,
    fmtTalkDate: fmtTalkDate, fmtStamp: fmtStamp, fmtSourceDate: fmtSourceDate,
    asList: asList, actionText: actionText, getJSON: getJSON, greet: greet, sourceLine: sourceLine, TZ: TZ
  };
})();
