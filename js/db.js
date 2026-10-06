/* Local storage for sign-ons and follow-up ticks (IndexedDB, with localStorage fallback). */
(function () {
  'use strict';
  var DB_NAME = 'mm-toolbox';
  var DB_VERSION = 1;
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) return reject(new Error('no-idb'));
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('signons')) {
          var s = db.createObjectStore('signons', { keyPath: 'id' });
          s.createIndex('talkId', 'talkId', { unique: false });
        }
        if (!db.objectStoreNames.contains('followups')) {
          var f = db.createObjectStore('followups', { keyPath: 'key' });
          f.createIndex('talkId', 'talkId', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }).catch(function (err) { console.warn('IndexedDB unavailable, using localStorage', err); return null; });
    return dbPromise;
  }

  // ---- localStorage fallback ----
  function lsAll(store) { try { return JSON.parse(localStorage.getItem('mm-' + store) || '[]'); } catch (e) { return []; } }
  function lsSave(store, rows) { localStorage.setItem('mm-' + store, JSON.stringify(rows)); }

  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var os = t.objectStore(store);
        var result;
        Promise.resolve(fn(os)).then(function (r) { result = r; });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('aborted')); };
      });
    });
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }

  function put(store, keyName, row) {
    return tx(store, 'readwrite', function (os) {
      if (!os) { var rows = lsAll(store).filter(function (x) { return x[keyName] !== row[keyName]; }); rows.push(row); lsSave(store, rows); return row; }
      return reqP(os.put(row)).then(function () { return row; });
    });
  }
  function byTalk(store, talkId) {
    return tx(store, 'readonly', function (os) {
      if (!os) return lsAll(store).filter(function (x) { return x.talkId === talkId; });
      return reqP(os.index('talkId').getAll(talkId));
    });
  }
  function all(store) {
    return tx(store, 'readonly', function (os) { return os ? reqP(os.getAll()) : lsAll(store); });
  }
  function del(store, keyName, key) {
    return tx(store, 'readwrite', function (os) {
      if (!os) { lsSave(store, lsAll(store).filter(function (x) { return x[keyName] !== key; })); return; }
      return reqP(os.delete(key));
    });
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function deviceId() {
    var id = localStorage.getItem('mm-device-id');
    if (!id) { id = 'dev-' + uuid().slice(0, 8); localStorage.setItem('mm-device-id', id); }
    return id;
  }

  window.MMDB = {
    addSignon: function (row) { row.id = row.id || uuid(); row.deviceId = deviceId(); return put('signons', 'id', row); },
    signonsForTalk: function (talkId) { return byTalk('signons', talkId).then(function (r) { return r.sort(function (a, b) { return a.signedAt.localeCompare(b.signedAt); }); }); },
    allSignons: function () { return all('signons'); },
    deleteSignon: function (id) { return del('signons', 'id', id); },
    setFollowup: function (talkId, index, data) {
      var row = Object.assign({ key: talkId + '#' + index, talkId: talkId, index: index }, data);
      return put('followups', 'key', row);
    },
    followupsForTalk: function (talkId) { return byTalk('followups', talkId); },
    deviceId: deviceId,
    persist: function () { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); }
  };
})();
