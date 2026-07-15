/* Effects: WebAudio SFX + confetti + reward stars + toast. No binary assets required. */
(function (global) {
  "use strict";

  var AC = global.AudioContext || global.webkitAudioContext;
  var ctx = null;
  var enabled = true;

  function ac() {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gain) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + dur + 0.02);
  }

  function noiseBurst(start, dur, gain) {
    var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain(); g.gain.value = gain || 0.15;
    var f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1000;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(c.currentTime + start);
  }

  var FX = {
    setEnabled: function (v) { enabled = v; },
    isEnabled: function () { return enabled; },

    click: function () {
      if (!enabled) return;
      tone(660, 0, 0.08, "triangle", 0.12);
    },
    correct: function () {
      if (!enabled) return;
      tone(523.25, 0, 0.14, "sine", 0.22);   // C5
      tone(659.25, 0.10, 0.14, "sine", 0.22); // E5
      tone(783.99, 0.20, 0.22, "sine", 0.24); // G5
      tone(1046.5, 0.32, 0.28, "sine", 0.22); // C6
    },
    wrong: function () {
      if (!enabled) return;
      tone(311.13, 0, 0.18, "sawtooth", 0.16);
      tone(233.08, 0.14, 0.28, "sawtooth", 0.16);
    },
    applause: function () {
      if (!enabled) return;
      for (var i = 0; i < 14; i++) noiseBurst(i * 0.045 + Math.random() * 0.02, 0.05, 0.10);
      tone(880, 0.05, 0.2, "sine", 0.12);
    },

    toast: function (msg) {
      var t = document.createElement("div");
      t.className = "toast"; t.textContent = msg;
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.classList.add("show"); });
      setTimeout(function () {
        t.classList.remove("show");
        setTimeout(function () { t.remove(); }, 400);
      }, 1800);
    },

    stars: function (x, y) {
      var chars = ["\u2B50", "\uD83C\uDF1F", "\u2728", "\uD83C\uDF89"];
      for (var i = 0; i < 6; i++) {
        (function (i) {
          var s = document.createElement("div");
          s.className = "reward-star";
          s.textContent = chars[i % chars.length];
          s.style.left = (x + (Math.random() * 120 - 60)) + "px";
          s.style.top = (y + (Math.random() * 60 - 30)) + "px";
          s.style.animationDelay = (i * 0.05) + "s";
          document.body.appendChild(s);
          setTimeout(function () { s.remove(); }, 1000);
        })(i);
      }
    },

    confetti: function () {
      var canvas = document.createElement("canvas");
      canvas.className = "confetti-canvas";
      canvas.width = global.innerWidth; canvas.height = global.innerHeight;
      document.body.appendChild(canvas);
      var g = canvas.getContext("2d");
      var colors = ["#1a9be0", "#ffb300", "#22b573", "#ff5a5a", "#8a5cff", "#ff8fc7"];
      var parts = [];
      for (var i = 0; i < 140; i++) {
        parts.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * canvas.height * 0.3,
          w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
          c: colors[Math.floor(Math.random() * colors.length)],
          vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3,
          rot: Math.random() * Math.PI, vr: -0.2 + Math.random() * 0.4
        });
      }
      var start = performance.now();
      function frame(now) {
        g.clearRect(0, 0, canvas.width, canvas.height);
        parts.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.03;
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
          g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          g.restore();
        });
        if (now - start < 2600) requestAnimationFrame(frame);
        else canvas.remove();
      }
      requestAnimationFrame(frame);
    }
  };

  global.FX = FX;
})(window);
