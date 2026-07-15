/* 大展身手 / 厚积薄发 · 练习可视化 P16、P18–P27 */
(function (global) {
  "use strict";

  var V = {
    hideImg: function (slide) {
      var img = slide.querySelector(".slide__img");
      if (img) img.style.display = "none";
    },
    canvas: function (cls) {
      var el = document.createElement("div");
      el.className = "viz-canvas" + (cls ? " " + cls : "");
      return el;
    },
    hit: function (node, x, y) {
      var r = node.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
    grid: function (parent, count, emoji, itemCls) {
      var items = [];
      for (var i = 0; i < count; i++) {
        var d = document.createElement("div");
        d.className = "viz-item" + (itemCls ? " " + itemCls : "");
        d.textContent = emoji;
        d.dataset.i = i;
        parent.appendChild(d);
        items.push(d);
      }
      return items;
    },
    bridge: function (html) {
      var b = document.createElement("div");
      b.className = "viz-bridge";
      b.innerHTML = html;
      return b;
    },
    actions: function (specs) {
      var row = document.createElement("div");
      row.className = "viz-actions";
      specs.forEach(function (s) {
        var btn = document.createElement("button");
        btn.className = "viz-btn " + (s.cls || "viz-btn--pri");
        btn.innerHTML = s.html || s.text;
        if (s.disabled) btn.disabled = true;
        btn.onclick = s.on;
        row.appendChild(btn);
        s.el = btn;
      });
      return row;
    },
    resetInputs: function (panel) {
      panel.querySelectorAll("input").forEach(function (inp) {
        inp.value = "";
        inp.className = "";
      });
      var sub = panel.querySelector(".btn--submit");
      if (sub) sub.classList.remove("pulse");
    },
    fly: function (fromEl, toEl, emoji, cb) {
      var a = fromEl.getBoundingClientRect();
      var b = toEl.getBoundingClientRect();
      var clone = document.createElement("div");
      clone.className = "viz-item";
      clone.textContent = emoji;
      clone.style.position = "fixed";
      clone.style.left = a.left + "px";
      clone.style.top = a.top + "px";
      clone.style.zIndex = "1000";
      clone.style.pointerEvents = "none";
      clone.style.transition = "all 0.42s cubic-bezier(0.34,1.2,0.64,1)";
      document.body.appendChild(clone);
      requestAnimationFrame(function () {
        clone.style.left = (b.left + b.width / 2 - 18) + "px";
        clone.style.top = (b.top + b.height / 2 - 18) + "px";
        clone.style.transform = "scale(0.8)";
      });
      setTimeout(function () {
        clone.remove();
        if (cb) cb();
      }, 420);
    },
    setBridge: function (bridgeEl, html) {
      bridgeEl.innerHTML = html;
    }
  };

  /* ---------- 通用：分步均分 ---------- */
  function makeDistributeViz(slide, panel, cfg) {
    V.hideImg(slide);
    var session = 0;
    var locked = !cfg.needLock;
    var canvas = V.canvas();
    var scene = document.createElement("div");
    scene.className = "viz-scene";

    var srcCol = document.createElement("div");
    srcCol.className = "viz-col";
    var srcZone = document.createElement("div");
    srcZone.className = "viz-zone" + (cfg.distractor ? "" : "");
    srcZone.innerHTML = '<div class="viz-badge">' + cfg.srcIcon + ' <b>' + cfg.srcCount + '</b></div>';
    var srcGrid = document.createElement("div");
    srcGrid.className = "viz-grid";
    srcZone.appendChild(srcGrid);

    var distZoneEl = null;
    if (cfg.distractor) {
      distZoneEl = document.createElement("div");
      distZoneEl.className = "viz-zone viz-zone--off";
      distZoneEl.innerHTML = '<div class="viz-badge">' + cfg.distractor.icon + ' <b>' + cfg.distractor.count + '</b><span style="margin-left:auto;font-size:11px">?</span></div>';
      var dg = document.createElement("div");
      dg.className = "viz-grid";
      V.grid(dg, cfg.distractor.count, cfg.distractor.emoji, "viz-item--sm");
      distZoneEl.appendChild(dg);
      srcCol.appendChild(distZoneEl);
    }
    srcCol.appendChild(srcZone);

    var dstCol = document.createElement("div");
    dstCol.className = "viz-col";
    var dstGrid = document.createElement("div");
    dstGrid.className = "viz-grid";
    dstGrid.style.display = "grid";
    dstGrid.style.gridTemplateColumns = "repeat(" + (cfg.groupCols || 3) + ",1fr)";
    dstGrid.style.gap = "6px";
    var groups = [];
    for (var g = 0; g < cfg.groups; g++) {
      var gw = document.createElement("div");
      gw.className = "viz-zone";
      gw.style.minHeight = "52px";
      gw.style.padding = "4px";
      gw.innerHTML = '<div style="font-size:9px;font-weight:800;text-align:center">' + (g + 1) + '</div>';
      var gb = document.createElement("div");
      gb.className = "viz-grid";
      gb.style.minHeight = "36px";
      gw.appendChild(gb);
      dstGrid.appendChild(gw);
      groups.push({ el: gw, balls: gb, count: 0 });
    }
    dstCol.appendChild(dstGrid);

    scene.appendChild(srcCol);
    scene.appendChild(dstCol);

    var bridge = V.bridge(cfg.formulaHtml || "");
    var remainFillEl = null;

    var btns = V.actions([
      cfg.needLock ? { cls: "viz-btn--warn", html: "🔒", on: function () { lockDist(); } } : null,
      { cls: "viz-btn--step", html: "▶ +1", on: function () { stepRound(); }, disabled: cfg.needLock },
      { cls: "viz-btn--pri", html: "⚡", on: function () { autoAll(); }, disabled: cfg.needLock },
      { cls: "viz-btn--reset", text: "↺", on: function () { reset(); } }
    ].filter(Boolean));

    canvas.appendChild(scene);
    canvas.appendChild(bridge);
    if (cfg.showRemain) {
      var rb = document.createElement("div");
      rb.className = "viz-bar";
      remainFillEl = document.createElement("div");
      remainFillEl.className = "viz-bar-fill";
      remainFillEl.style.width = "100%";
      rb.appendChild(remainFillEl);
      canvas.appendChild(rb);
    }
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var balls = [];

    function reset() {
      session++;
      locked = !cfg.needLock;
      srcGrid.innerHTML = "";
      balls = V.grid(srcGrid, cfg.srcCount, cfg.srcEmoji, "viz-item--lg viz-item--grab");
      groups.forEach(function (gr) {
        gr.balls.innerHTML = "";
        gr.count = 0;
      });
      if (distZoneEl) {
        distZoneEl.className = "viz-zone viz-zone--off";
      }
      btns.querySelectorAll(".viz-btn").forEach(function (b, i) {
        if (cfg.needLock && i > 0 && i < 3) b.disabled = true;
        if (cfg.needLock && i === 0) b.disabled = false;
      });
      updateRemain(cfg.srcCount);
      V.resetInputs(panel);
    }

    function lockDist() {
      if (locked) return;
      locked = true;
      FX.click();
      if (distZoneEl) distZoneEl.className = "viz-zone viz-zone--off";
      btns.querySelectorAll(".viz-btn")[0].disabled = true;
      btns.querySelectorAll(".viz-btn")[1].disabled = false;
      btns.querySelectorAll(".viz-btn")[2].disabled = false;
    }

    function updateRemain(n) {
      if (remainFillEl) remainFillEl.style.width = ((n / cfg.srcCount) * 100) + "%";
      if (cfg.onRemain) cfg.onRemain(bridge, n);
    }

    function placeBall(ball, gi) {
      ball.remove();
      var em = document.createElement("div");
      em.className = "viz-item placed";
      em.textContent = cfg.srcEmoji;
      groups[gi].balls.appendChild(em);
      groups[gi].count++;
      FX.click();
    }

    function stepRound() {
      if (cfg.needLock && !locked) return;
      var left = srcGrid.querySelectorAll(".viz-item").length;
      if (!left) return;
      session++;
      var s = session;
      var n = Math.min(cfg.groups, left);
      var batch = Array.prototype.slice.call(srcGrid.querySelectorAll(".viz-item"), 0, n);
      var done = 0;
      batch.forEach(function (b, i) {
        setTimeout(function () {
          if (s !== session) return;
          V.fly(b, groups[i].el, cfg.srcEmoji, function () {
            placeBall(b, i);
            done++;
            if (done === n) {
              var rem = srcGrid.querySelectorAll(".viz-item").length;
              updateRemain(rem);
              checkDone();
            }
          });
        }, i * 70);
      });
    }

    function autoAll() {
      if (cfg.needLock && !locked) return;
      btns.querySelectorAll(".viz-btn")[1].disabled = true;
      btns.querySelectorAll(".viz-btn")[2].disabled = true;
      function next() {
        if (srcGrid.querySelectorAll(".viz-item").length === 0) {
          checkDone();
          return;
        }
        stepRound();
        setTimeout(next, 550);
      }
      next();
    }

    function checkDone() {
      if (srcGrid.querySelectorAll(".viz-item").length > 0) return;
      var per = groups[0].count;
      var ok = groups.every(function (gr) { return gr.count === per; });
      if (ok && per === cfg.perGroup) {
        FX.stars(window.innerWidth / 2, window.innerHeight / 3);
        if (cfg.doneFormula) V.setBridge(bridge, cfg.doneFormula);
      }
    }

    reset();
  }

  function initP16(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var kitchen = document.createElement("div");
    kitchen.className = "viz-p16-kitchen";
    var spots = [
      { label: "大毛", n: 5 }, { label: "二毛", n: 3 }, { label: "锅", n: 8 },
      { label: "盘", n: 7 }, { label: "袋×6", n: 36, bag: true }, { label: "合计", n: 0, sum: true }
    ];
    var sumEl = null;
    spots.forEach(function (s) {
      var spot = document.createElement("div");
      spot.className = "viz-p16-spot";
      spot.innerHTML = '<div class="viz-p16-spot-label">' + s.label + '</div>';
      var g = document.createElement("div");
      g.className = "viz-grid";
      if (s.sum) {
        sumEl = document.createElement("div");
        sumEl.className = "viz-badge";
        sumEl.innerHTML = "<b>0</b>";
        spot.appendChild(sumEl);
      } else if (s.bag) {
        spot.dataset.bag = "1";
        spot.dataset.hidden = "36";
        g.innerHTML = '<div class="viz-item viz-item--lg">📦×6</div>';
      } else {
        spot.dataset.n = s.n;
        V.grid(g, s.n, "🥟", "viz-item--sm");
      }
      if (!s.sum) spot.appendChild(g);
      kitchen.appendChild(spot);
    });

    var bridge = V.bridge(
      '<div class="viz-formula" id="p16-f"><span class="viz-chip">6×6=<b>?</b></span><span class="viz-op">+</span><span class="viz-chip">5+3+8+7=<b>?</b></span></div>'
    );

    var btns = V.actions([
      { cls: "viz-btn--step", html: "📦 拆包", on: function () { unpack(); } },
      { cls: "viz-btn--pri", html: "🥣 汇总", on: function () { gather(); } },
      { cls: "viz-btn--reset", text: "↺", on: function () { reset(); } }
    ]);

    canvas.appendChild(kitchen);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    function reset() {
      sumEl.innerHTML = "<b>0</b>";
      kitchen.querySelector("[data-bag]").querySelector(".viz-grid").innerHTML = '<div class="viz-item viz-item--lg">📦×6</div>';
      V.setBridge(bridge, '<div class="viz-formula"><span class="viz-chip">6×6=<b>?</b></span><span class="viz-op">+</span><span class="viz-chip">5+3+8+7=<b>?</b></span></div>');
      V.resetInputs(panel);
    }

    function unpack() {
      FX.click();
      var bag = kitchen.querySelector("[data-bag] .viz-grid");
      bag.innerHTML = "";
      V.grid(bag, 36, "🥟", "viz-item--sm");
      V.setBridge(bridge, '<div class="viz-formula"><span class="viz-chip viz-chip--lit">6×6=<b>36</b></span><span class="viz-op">+</span><span class="viz-chip">5+3+8+7=<b>23</b></span></div>');
    }

    function gather() {
      FX.click();
      var total = 5 + 3 + 8 + 7 + 36;
      sumEl.innerHTML = "<b>" + total + "</b>";
      V.setBridge(bridge, '<div class="viz-formula"><span class="viz-chip viz-chip--lit">36+23=<b>59</b>🥟</span></div>');
      FX.stars(window.innerWidth / 2, window.innerHeight / 3);
    }

    reset();
  }

  function initP18(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var scene = document.createElement("div");
    scene.className = "viz-scene";
    var shelf = document.createElement("div");
    shelf.className = "viz-zone viz-col";
    shelf.innerHTML = '<div class="viz-badge">🦴 <b>9</b>元/袋</div>';
    var grid = document.createElement("div");
    grid.className = "viz-grid";
    shelf.appendChild(grid);
    var cart = document.createElement("div");
    cart.className = "viz-zone viz-col";
    cart.innerHTML = '<div class="viz-badge">🛒</div><div class="viz-grid" id="p18-cart"></div><div class="viz-badge" id="p18-money">💰 <b>0</b></div>';
    scene.appendChild(shelf);
    scene.appendChild(cart);
    var bridge = V.bridge('<div class="viz-formula" id="p18-f"><b>9</b>×<b id="p18-n">0</b>=<b id="p18-t">0</b></div>');
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶ +1袋", on: step },
      { cls: "viz-btn--pri", html: "⚡ 4袋", on: auto },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(scene);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var cartGrid = canvas.querySelector("#p18-cart");
    var moneyEl = canvas.querySelector("#p18-money");
    var nEl = canvas.querySelector("#p18-n");
    var tEl = canvas.querySelector("#p18-t");
    var bags = [];
    var money = 0;

    function reset() {
      grid.innerHTML = "";
      bags = V.grid(grid, 4, "🦴", "viz-item--lg");
      cartGrid.innerHTML = "";
      money = 0;
      moneyEl.innerHTML = "💰 <b>0</b>";
      nEl.textContent = "0";
      tEl.textContent = "0";
      V.resetInputs(panel);
    }

    function addOne() {
      if (!bags.length) return;
      var b = bags.shift();
      V.fly(b, cartGrid, "🦴", function () {
        b.remove();
        var item = document.createElement("div");
        item.className = "viz-item viz-item--lg";
        item.textContent = "🦴";
        cartGrid.appendChild(item);
        money += 9;
        moneyEl.innerHTML = "💰 <b>" + money + "</b>";
        var n = 4 - bags.length;
        nEl.textContent = n;
        tEl.textContent = money;
        if (money === 36) {
          FX.stars(window.innerWidth / 2, window.innerHeight / 3);
          V.setBridge(bridge, '<div class="viz-formula viz-chip viz-chip--lit"><b>9×4=36</b>💰</div>');
        }
      });
    }

    function step() { FX.click(); addOne(); }
    function auto() { FX.click(); while (bags.length) addOne(); }

    reset();
  }

  function initP19(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var scene = document.createElement("div");
    scene.className = "viz-scene";

    var cal = document.createElement("div");
    cal.className = "viz-col";
    var calGrid = document.createElement("div");
    calGrid.className = "viz-p19-cal";
    calGrid.id = "p19-cal";
    var days = [];
    for (var d = 0; d < 7; d++) {
      var day = document.createElement("div");
      day.className = "viz-p19-day";
      day.innerHTML = (d + 1) + "<div style='opacity:.3;font-size:14px'>🍎</div>";
      calGrid.appendChild(day);
      days.push(day);
    }
    cal.innerHTML = '<div class="viz-badge">📅 7天</div>';
    cal.appendChild(calGrid);

    var basket = document.createElement("div");
    basket.className = "viz-col viz-zone";
    basket.innerHTML = '<div class="viz-badge">🧺 <b>20</b></div><div class="viz-grid" id="p19-basket"></div>';
    scene.appendChild(cal);
    scene.appendChild(basket);

    var bridge = V.bridge('<div class="viz-formula"><b>5</b>×<b>7</b>=<b id="p19-need">?</b><span class="viz-op">−</span><b>20</b>=<b id="p19-more">?</b></div>');
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶ 分苹果", on: step1 },
      { cls: "viz-btn--pri", html: "🛒 补货", on: step2 },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(scene);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var basketGrid = canvas.querySelector("#p19-basket");
    var needEl = canvas.querySelector("#p19-need");
    var moreEl = canvas.querySelector("#p19-more");
    var apples = [];

    function reset() {
      basketGrid.innerHTML = "";
      apples = V.grid(basketGrid, 20, "🍎", "viz-item--sm");
      days.forEach(function (day, i) {
        day.className = "viz-p19-day";
        day.innerHTML = (i + 1) + "<div style='opacity:.3;font-size:14px'>🍎</div>";
      });
      needEl.textContent = "?";
      moreEl.textContent = "?";
      V.resetInputs(panel);
    }

    function step1() {
      FX.click();
      var di = 0;
      function feedDay() {
        if (di >= 7 || !apples.length) {
          for (var k = di; k < 7; k++) days[k].className = "viz-p19-day need";
          needEl.textContent = "35";
          return;
        }
        for (var j = 0; j < 5 && apples.length; j++) {
          apples.shift().remove();
        }
        days[di].className = "viz-p19-day filled";
        days[di].innerHTML = (di + 1) + "<div>🍎×5</div>";
        di++;
        setTimeout(feedDay, 280);
      }
      feedDay();
    }

    function step2() {
      FX.click();
      for (var k = 0; k < 3; k++) {
        days[4 + k].className = "viz-p19-day filled";
        days[4 + k].innerHTML = (5 + k) + "<div>🍎×5</div>";
      }
      moreEl.textContent = "15";
      V.setBridge(bridge, '<div class="viz-formula viz-chip viz-chip--lit"><b>35−20=15</b>🍎</div>');
      FX.stars(window.innerWidth / 2, window.innerHeight / 3);
    }

    reset();
  }

  function initP20(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var zone = document.createElement("div");
    zone.className = "viz-zone";
    zone.style.flex = "1";
    zone.innerHTML = '<div class="viz-badge">🥟 <b>40</b>  ·  每天 <b>5</b></div><div class="viz-grid" id="p20-grid"></div>';
    var bridge = V.bridge('<div class="viz-formula"><b id="p20-left">40</b><span class="viz-op">÷</span><b>5</b>=<b id="p20-d">?</b>天</div>');
    var day = 0;
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶ 吃一天", on: function () {
        FX.click();
        for (var i = 0; i < 5 && gridEl.children.length; i++) gridEl.lastChild.remove();
        day++;
        leftEl.textContent = gridEl.children.length;
        dEl.textContent = day;
        if (gridEl.children.length === 0) {
          V.setBridge(bridge, '<div class="viz-formula viz-chip viz-chip--lit"><b>40÷5=8</b>天</div>');
          FX.stars(window.innerWidth / 2, window.innerHeight / 3);
        }
      }},
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(zone);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var gridEl = canvas.querySelector("#p20-grid");
    var leftEl = canvas.querySelector("#p20-left");
    var dEl = canvas.querySelector("#p20-d");

    function reset() {
      day = 0;
      gridEl.innerHTML = "";
      V.grid(gridEl, 40, "🥟", "viz-item--sm");
      leftEl.textContent = "40";
      dEl.textContent = "?";
      V.resetInputs(panel);
    }
    reset();
  }

  function initP21(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var grid = document.createElement("div");
    grid.className = "viz-grid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3,1fr)";
    grid.style.flex = "1";
    var boxes = [];
    for (var i = 0; i < 9; i++) {
      var box = document.createElement("div");
      box.className = "viz-zone";
      box.style.padding = "4px";
      box.innerHTML = '<div style="font-size:9px;font-weight:800">📦8</div><div class="viz-grid"></div>';
      grid.appendChild(box);
      boxes.push(box);
    }
    var bridge = V.bridge('<div class="viz-formula"><b id="p21-c">0</b><span class="viz-op">支</span>  <b>9×8=?</b></div>');
    var total = 0;
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶ 开一盒", on: openOne },
      { cls: "viz-btn--pri", html: "⚡ 全开", on: openAll },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(grid);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);
    var idx = 0;
    var countEl = canvas.querySelector("#p21-c");

    function openBox(box) {
      var g = box.querySelector(".viz-grid");
      if (g.children.length) return;
      V.grid(g, 8, "🖍️", "viz-item--sm");
      total += 8;
      countEl.textContent = total;
      if (total === 72) {
        V.setBridge(bridge, '<div class="viz-formula viz-chip viz-chip--lit"><b>9×8=72</b>🖍️</div>');
        FX.stars(window.innerWidth / 2, window.innerHeight / 3);
      }
    }

    function openOne() { FX.click(); if (idx < 9) openBox(boxes[idx++]); }
    function openAll() { FX.click(); for (; idx < 9; idx++) openBox(boxes[idx]); }
    function reset() {
      idx = 0; total = 0;
      boxes.forEach(function (b) { b.querySelector(".viz-grid").innerHTML = ""; });
      countEl.textContent = "0";
      V.resetInputs(panel);
    }
    reset();
  }

  function initP22(slide, panel) {
    makeDistributeViz(slide, panel, {
      needLock: true,
      distractor: { icon: "⚽", count: 20, emoji: "⚽" },
      srcIcon: "🏀", srcCount: 18, srcEmoji: "🏀",
      groups: 6, groupCols: 3, perGroup: 3,
      answers: { a: "3" },
      formulaHtml: '<div class="viz-formula"><span class="viz-chip">🏀<b>18</b></span><span class="viz-op">÷</span><span class="viz-chip">👥<b>6</b></span><span class="viz-op">=</span><span class="viz-chip"><b>?</b></span></div>',
      doneFormula: '<div class="viz-formula viz-chip viz-chip--lit"><b>18÷6=3</b>🏀</div>',
      showRemain: true
    });
  }

  function initP23(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    canvas.innerHTML =
      '<div class="viz-scene">' +
        '<div class="viz-zone viz-col"><div class="viz-badge">💴 <b>50</b></div><div class="viz-item viz-item--lg" id="p23-pay">50</div><div class="viz-badge">找回 <b>2</b> → <b id="p23-spend">?</b></div></div>' +
        '<div class="viz-zone viz-col"><div class="viz-badge">🍎 <b>6</b>kg</div><div class="viz-grid" id="p23-apples"></div></div>' +
      '</div>' +
      '<div class="viz-bridge" id="p23-br"><b>50−2=?</b>  <b>?÷6</b></div>';
    slide.appendChild(canvas);
    var applesEl = canvas.querySelector("#p23-apples");
    var spendEl = canvas.querySelector("#p23-spend");
    var brEl = canvas.querySelector("#p23-br");
    V.grid(applesEl, 6, "🍎", "viz-item--lg");
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶ 找零", on: function () {
        FX.click();
        spendEl.textContent = "48";
        V.setBridge(brEl, '<div class="viz-formula"><b>50−2=48</b></div>');
      }},
      { cls: "viz-btn--pri", html: "⚡ 分价", on: function () {
        FX.click();
        V.setBridge(brEl, '<div class="viz-formula viz-chip viz-chip--lit"><b>48÷6=8</b>💰</div>');
        FX.stars(window.innerWidth / 2, window.innerHeight / 3);
      }},
      { cls: "viz-btn--reset", text: "↺", on: function () {
        spendEl.textContent = "?";
        V.setBridge(brEl, '<b>50−2=?</b>  <b>?÷6</b>');
        V.resetInputs(panel);
      }}
    ]);
    canvas.appendChild(btns);
  }

  function initP24(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var boys = 14, girls = 6, boats = 0;
    var scene = document.createElement("div");
    scene.className = "viz-scene";
    scene.innerHTML =
      '<div class="viz-col viz-zone"><div class="viz-badge">👦<b>14</b> 👧<b>6</b></div><div class="viz-grid" id="p24-people"></div></div>' +
      '<div class="viz-col" id="p24-boats" style="display:grid;gap:4px"></div>';
    var bridge = V.bridge('<div class="viz-formula" id="p24-f">?</div>');
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶", on: step },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(scene);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var peopleEl = canvas.querySelector("#p24-people");
    var boatsEl = canvas.querySelector("#p24-boats");

    function reset() {
      boats = 0;
      peopleEl.innerHTML = "";
      V.grid(peopleEl, boys, "👦", "viz-item--sm");
      V.grid(peopleEl, girls, "👧", "viz-item--sm");
      boatsEl.innerHTML = "";
      V.setBridge(bridge, "?");
      V.resetInputs(panel);
    }

    function addBoat() {
      var pool = peopleEl;
      if (pool.children.length < 4) return;
      for (var i = 0; i < 4; i++) pool.children[0].remove();
      var boat = document.createElement("div");
      boat.className = "viz-p24-boat";
      for (var j = 0; j < 4; j++) {
        var s = document.createElement("div");
        s.className = "viz-p24-seat";
        s.textContent = "👤";
        boat.appendChild(s);
      }
      boatsEl.appendChild(boat);
      boats++;
      V.setBridge(bridge, "<b>20÷4=" + boats + "</b>🚤");
    }

    function step() {
      FX.click();
      if (peopleEl.children.length >= 4) addBoat();
      if (peopleEl.children.length === 0 && boats === 5) {
        V.setBridge(bridge, "<b>5×8=40</b>💰");
        FX.stars(window.innerWidth / 2, window.innerHeight / 3);
      }
    }
    reset();
  }

  function initP25(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var truck = document.createElement("div");
    truck.className = "viz-zone";
    truck.innerHTML = '<div class="viz-badge">🐰 🚚 <b>48</b></div><div class="viz-grid" id="p25-truck"></div>';
    var pots = document.createElement("div");
    pots.className = "viz-grid";
    pots.style.display = "grid";
    pots.style.gridTemplateColumns = "repeat(4,1fr)";
    pots.style.gap = "4px";
    pots.style.flex = "1";
    var potEls = [];
    for (var i = 0; i < 8; i++) {
      var p = document.createElement("div");
      p.className = "viz-p25-pot";
      pots.appendChild(p);
      potEls.push(p);
    }
    var bridge = V.bridge('<div class="viz-formula"><b>48÷8=?</b></div>');
    var distributeBtn = null;
    var btns = V.actions([
      { cls: "viz-btn--pri", html: "⚡ 装盆", on: distribute },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    distributeBtn = btns.querySelector(".viz-btn--pri");
    canvas.appendChild(truck);
    canvas.appendChild(pots);
    canvas.appendChild(bridge);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var truckGrid = truck.querySelector(".viz-grid");
    var distributed = false;

    function reset() {
      distributed = false;
      if (distributeBtn) distributeBtn.disabled = false;
      truckGrid.innerHTML = "";
      V.grid(truckGrid, 48, "🥕", "viz-item--sm");
      potEls.forEach(function (p) { p.innerHTML = ""; });
      V.setBridge(bridge, "<b>48÷8=?</b>");
      V.resetInputs(panel);
    }

    function distribute() {
      if (distributed) return;
      distributed = true;
      if (distributeBtn) distributeBtn.disabled = true;
      FX.click();
      var truckB = Array.prototype.slice.call(truckGrid.children);
      var bi = 0;
      potEls.forEach(function (pot) {
        for (var j = 0; j < 6; j++) {
          if (truckB[bi]) {
            var b = truckB[bi++];
            V.fly(b, pot, "🥕", function () {
              b.remove();
              var em = document.createElement("div");
              em.className = "viz-item viz-item--sm";
              em.textContent = "🥕";
              pot.appendChild(em);
            });
          }
        }
      });
      setTimeout(function () {
        V.setBridge(bridge, '<div class="viz-formula viz-chip viz-chip--lit"><b>48÷8=6</b>🥕 ✔</div>');
        FX.stars(window.innerWidth / 2, window.innerHeight / 3);
      }, 800);
    }
    reset();
  }

  function initP26(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    canvas.innerHTML =
      '<div class="viz-scene">' +
        '<div class="viz-col" id="p26-plates" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px"></div>' +
        '<div class="viz-col viz-zone"><div class="viz-badge">📅 7天×2🍐</div><div class="viz-p19-cal" id="p26-cal"></div></div>' +
      '</div><div class="viz-bridge" id="p26-br">?</div>';
    slide.appendChild(canvas);
    var calEl = canvas.querySelector("#p26-cal");
    var brEl = canvas.querySelector("#p26-br");
    for (var p = 0; p < 3; p++) {
      var pl = document.createElement("div");
      pl.className = "viz-zone";
      pl.innerHTML = "<div style='font-size:9px;font-weight:800'>盘" + (p+1) + "</div><div class='viz-grid'></div>";
      canvas.querySelector("#p26-plates").appendChild(pl);
    }
    for (var d = 0; d < 7; d++) {
      var day = document.createElement("div");
      day.className = "viz-p19-day";
      day.textContent = (d + 1);
      calEl.appendChild(day);
    }
    var step = 0;
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶", on: function () {
        FX.click();
        if (step === 0) {
          canvas.querySelectorAll("#p26-plates .viz-grid").forEach(function (g) {
            V.grid(g, 11, "❓", "viz-item--sm");
          });
          V.setBridge(brEl, "<b>11×3=33</b>");
          step = 1;
        } else if (step === 1) {
          calEl.querySelectorAll(".viz-p19-day").forEach(function (day) {
            day.className = "viz-p19-day filled";
            day.innerHTML = day.textContent + "<div>🍐🍐</div>";
          });
          V.setBridge(brEl, "<b>2×7=14</b>🍐");
          step = 2;
        } else {
          V.setBridge(brEl, '<div class="viz-chip viz-chip--lit">🍑<b>19</b> 🍐<b>14</b></div>');
          FX.stars(window.innerWidth / 2, window.innerHeight / 3);
        }
      }},
      { cls: "viz-btn--reset", text: "↺", on: function () {
        step = 0;
        canvas.querySelectorAll(".viz-grid").forEach(function (g) { g.innerHTML = ""; });
        calEl.querySelectorAll(".viz-p19-day").forEach(function (day, i) {
          day.className = "viz-p19-day";
          day.textContent = (i + 1);
        });
        V.setBridge(brEl, "?");
        V.resetInputs(panel);
      }}
    ]);
    canvas.appendChild(btns);
  }

  function initP27(slide, panel) {
    V.hideImg(slide);
    var canvas = V.canvas();
    var pile = document.createElement("div");
    pile.className = "viz-col viz-zone";
    pile.innerHTML = '<div class="viz-badge">🍐<b>21</b> 🍑<b>6</b></div><div class="viz-grid" id="p27-pile"></div>';
    var basketsWrap = document.createElement("div");
    basketsWrap.className = "viz-col";
    basketsWrap.id = "p27-baskets";
    basketsWrap.style.display = "grid";
    basketsWrap.style.gridTemplateColumns = "repeat(3,1fr)";
    basketsWrap.style.gap = "4px";
    var scene = document.createElement("div");
    scene.className = "viz-scene";
    scene.appendChild(pile);
    scene.appendChild(basketsWrap);
    var bridge = V.bridge('<div class="viz-formula" id="p27-br">?</div>');
    canvas.appendChild(scene);
    canvas.appendChild(bridge);

    var step = 0;
    var btns = V.actions([
      { cls: "viz-btn--step", html: "▶", on: onStep },
      { cls: "viz-btn--reset", text: "↺", on: reset }
    ]);
    canvas.appendChild(btns);
    slide.appendChild(canvas);

    var pileEl = pile.querySelector("#p27-pile");

    function buildPile() {
      pileEl.innerHTML = "";
      pileEl.style.display = "flex";
      pileEl.style.gap = "8px";
      var left = document.createElement("div");
      left.className = "viz-grid";
      left.id = "p27-pears";
      V.grid(left, 21, "🍐", "viz-item--sm");
      var right = document.createElement("div");
      right.className = "viz-grid";
      right.id = "p27-peaches";
      V.grid(right, 6, "🍑", "viz-item--sm");
      pileEl.appendChild(left);
      pileEl.appendChild(right);
    }

    function buildBaskets() {
      basketsWrap.innerHTML = "";
      for (var b = 0; b < 3; b++) {
        var bk = document.createElement("div");
        bk.className = "viz-zone";
        bk.innerHTML = "<div style='font-size:9px;font-weight:800'>" + (b + 1) + "</div><div class='viz-grid'></div>";
        basketsWrap.appendChild(bk);
      }
    }

    function reset() {
      step = 0;
      buildPile();
      buildBaskets();
      V.setBridge(bridge, "?");
      V.resetInputs(panel);
    }

    function onStep() {
      if (step > 0) return;
      FX.click();
      step = 1;
      var pearsEl = pile.querySelector("#p27-pears");
      var peachesEl = pile.querySelector("#p27-peaches");
      if (pearsEl) pearsEl.innerHTML = "";
      if (peachesEl) peachesEl.innerHTML = "";
      var baskets = basketsWrap.querySelectorAll(".viz-grid");
      for (var j = 0; j < 3; j++) {
        for (var pr = 0; pr < 7; pr++) {
          var e1 = document.createElement("div");
          e1.className = "viz-item viz-item--sm";
          e1.textContent = "🍐";
          baskets[j].appendChild(e1);
        }
        for (var pq = 0; pq < 2; pq++) {
          var e2 = document.createElement("div");
          e2.className = "viz-item viz-item--sm";
          e2.textContent = "🍑";
          baskets[j].appendChild(e2);
        }
      }
      V.setBridge(bridge, '<div class="viz-chip viz-chip--lit">🍑<b>2</b> 🍐<b>7</b>/篮</div>');
      FX.stars(window.innerWidth / 2, window.innerHeight / 3);
    }

    reset();
  }

  var REGISTRY = {
    p16: initP16,
    p18: initP18,
    p19: initP19,
    p20: initP20,
    p21: initP21,
    p22: initP22,
    p23: initP23,
    p24: initP24,
    p25: initP25,
    p26: initP26,
    p27: initP27
  };

  global.VizPractice = {
    has: function (id) { return !!REGISTRY[id]; },
    mount: function (id, slide, panel, q) {
      var fn = REGISTRY[id];
      if (fn) fn(slide, panel, q);
    }
  };
})(window);
