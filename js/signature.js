/* Signature pad on a <canvas> using Pointer Events (finger, stylus or mouse). */
(function () {
  'use strict';
  function SignaturePad(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.empty = true;
    this.drawing = false;
    this.last = null;
    this.onChange = onChange || function () {};
    this.strokes = 0;
    var self = this;
    this.resize = function () { self._resize(); };
    this._resize();
    window.addEventListener('resize', this.resize);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) { self._down(e); });
    canvas.addEventListener('pointermove', function (e) { self._move(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { canvas.addEventListener(t, function (e) { self._up(e); }); });
  }
  SignaturePad.prototype._resize = function () {
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    var data = this.empty ? null : this.canvas.toDataURL();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this._style();
    this._fill();
    if (data) {
      var img = new Image(); var ctx = this.ctx; var w = rect.width; var h = rect.height;
      img.onload = function () { ctx.drawImage(img, 0, 0, w, h); };
      img.src = data;
    }
  };
  SignaturePad.prototype._style = function () {
    this.ctx.lineWidth = 2.6; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.strokeStyle = '#0b2545';
  };
  SignaturePad.prototype._fill = function () {
    var r = this.canvas.getBoundingClientRect();
    this.ctx.save(); this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(0, 0, r.width, r.height); this.ctx.restore();
  };
  SignaturePad.prototype._pt = function (e) {
    var r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  SignaturePad.prototype._down = function (e) {
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    this.drawing = true; this.last = this._pt(e);
    this.ctx.beginPath(); this.ctx.arc(this.last.x, this.last.y, 1.2, 0, Math.PI * 2); this.ctx.fillStyle = '#0b2545'; this.ctx.fill();
    this.points = 1;
  };
  SignaturePad.prototype._move = function (e) {
    if (!this.drawing) return;
    e.preventDefault();
    var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!events.length) events = [e];
    for (var i = 0; i < events.length; i++) {
      var p = this._pt(events[i]);
      this.ctx.beginPath(); this.ctx.moveTo(this.last.x, this.last.y); this.ctx.lineTo(p.x, p.y); this.ctx.stroke();
      this.last = p; this.points++;
    }
    if (this.empty && this.points > 3) { this.empty = false; this.onChange(false); }
  };
  SignaturePad.prototype._up = function () {
    if (!this.drawing) return;
    this.drawing = false; this.strokes++;
  };
  SignaturePad.prototype.clear = function () {
    var r = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, r.width, r.height); this._fill();
    this.empty = true; this.strokes = 0; this.onChange(true);
  };
  SignaturePad.prototype.isEmpty = function () { return this.empty; };
  // Export a compact PNG (max 600px wide) so CSVs and storage stay small.
  SignaturePad.prototype.toDataURL = function () {
    var maxW = 600;
    var w = this.canvas.width, h = this.canvas.height;
    var scale = Math.min(1, maxW / w);
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };
  SignaturePad.prototype.destroy = function () { window.removeEventListener('resize', this.resize); };
  window.SignaturePad = SignaturePad;
})();
