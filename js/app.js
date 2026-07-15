/* 乘除法应用题初步 — interactive courseware engine (data-driven) */
(function () {
  "use strict";

  var lesson = null, questions = null;
  var flow = [];
  var state = {
    current: 0,
    viewed: {},        // pageId -> true
    answers: {},       // qid -> { correct, tries, response, done }
    completed: {}      // qid -> true (只要答对过，该题完成状态一直保留)
  };
  var interactionIds = [];
  var interactionSeq = 0; // for SCORM interaction index

  var el = {
    sidebar: document.getElementById("sidebar"),
    backdrop: document.getElementById("backdrop"),
    toc: document.getElementById("toc"),
    stageWrap: document.getElementById("stageWrap"),
    topTitle: document.getElementById("topTitle"),
    topPage: document.getElementById("topPage"),
    progFill: document.getElementById("progFill"),
    progText: document.getElementById("progText"),
    hamburger: document.getElementById("hamburger"),
    soundBtn: document.getElementById("soundBtn")
  };

  var TYPE_LABEL = {
    "fill-blank": "填空题", "choice": "单选题", "multi": "多选题",
    "judge": "判断题", "matching": "连线题", "drag": "拖拽题",
    "sequence": "排序题", "hotspot": "图片热点题"
  };

  function fetchJson(path) {
    return fetch(path + "?_=" + Date.now()).then(function (r) {
      if (!r.ok) throw new Error("无法加载 " + path + "（HTTP " + r.status + "），请确认已在项目根目录启动服务");
      return r.json();
    });
  }

  function normalizeLesson(data) {
    if (!data || typeof data !== "object") {
      throw new Error("lesson.json 内容无效");
    }
    if (Array.isArray(data.flow)) return data;
    // 兼容旧版 pages 结构
    if (Array.isArray(data.pages)) {
      data.flow = data.pages.map(function (p, i) {
        var id = typeof p.id === "number" ? "p" + String(p.id).padStart(2, "0") : (p.id || ("p" + String(i + 1).padStart(2, "0")));
        return {
          id: id,
          index: i + 1,
          title: p.title || ("第 " + (i + 1) + " 页"),
          image: p.image,
          kind: p.kind || "content"
        };
      });
      if (!Array.isArray(data.sections)) {
        data.sections = [{ id: "all", title: data.title || "课程目录", pages: data.flow.map(function (p) { return p.id; }) }];
      }
      return data;
    }
    throw new Error("lesson.json 缺少 flow 字段。请在项目根目录执行：cd 乘除法应用题 && python3 -m http.server 8899");
  }

  /* ---------------- boot ---------------- */
  function boot() {
    Promise.all([
      fetchJson("data/lesson.json"),
      fetchJson("data/questions.json")
    ]).then(function (res) {
      lesson = normalizeLesson(res[0]);
      questions = res[1] || {};
      flow = lesson.flow;
      if (!Array.isArray(flow)) {
        throw new Error("课程 flow 数据异常，请强制刷新页面（Cmd+Shift+R）后重试");
      }
      interactionIds = flow.filter(function (p) { return p.kind === "interaction"; })
                           .map(function (p) { return p.questionRef; });
      document.getElementById("courseTitle").textContent = lesson.title;
      document.getElementById("courseMeta").textContent =
        flow.length + " 页 · " + interactionIds.length + " 题";
      initScorm();
      buildTOC();
      bindShell();
      goto(state.current, true);
    }).catch(function (e) {
      var msg = (e && e.message) ? e.message : String(e);
      var wrap = document.getElementById("stageWrap");
      if (wrap) {
        wrap.innerHTML =
          '<div class="stage"><div class="panel">' +
          '<b>加载失败</b><br>' + msg +
          '<br><br>请确认：<br>1. 使用 HTTP 预览，不要用 file:// 打开<br>' +
          '2. 在项目根目录启动服务：<br><code>cd "/Users/eeo/肖xiao/cursor/课件/乘除法应用题"<br>python3 -m http.server 8899</code><br>' +
          '3. 访问 <code>http://localhost:8899/index.html</code> 并强制刷新（Cmd+Shift+R）' +
          '</div></div>';
      }
    });
  }

  function initScorm() {
    if (!window.SCORM) return;
    window.SCORM.init();
    var suspend = window.SCORM.getSuspend();
    if (suspend && suspend.answers) {
      state.answers = suspend.answers || {};
      state.viewed = suspend.viewed || {};
      state.completed = suspend.completed || {};
      var loc = parseInt(window.SCORM.getLocation(), 10);
      if (!isNaN(loc) && loc >= 0 && loc < flow.length) state.current = loc;
    }
  }

  function persist() {
    if (!window.SCORM || window.SCORM.isFinished()) return;
    window.SCORM.setSuspend({ answers: state.answers, viewed: state.viewed, completed: state.completed });
    window.SCORM.setLocation(String(state.current));
    updateScoreAndCompletion(false);
    window.SCORM.commit();
  }

  function updateScoreAndCompletion(finalize) {
    var total = interactionIds.length;
    var correct = 0, done = 0;
    interactionIds.forEach(function (qid) {
      var a = state.answers[qid];
      var isDone = state.completed[qid];
      if (isDone) {
        done++;
        correct++;
      } else if (a && a.done) {
        done++;
        if (a.correct) correct++;
      }
    });
    var score = total ? Math.round(correct / total * 100) : 0;
    var viewedCount = Object.keys(state.viewed).length;
    var progress = viewedCount / flow.length;
    var passScore = (lesson.scoring && lesson.scoring.passScore) || 60;
    var passed = score >= passScore;
    if (window.SCORM && !window.SCORM.isFinished()) {
      window.SCORM.setScore(score);
      if (finalize) {
        window.SCORM.setProgress(1);
        window.SCORM.setCompletion(true);
        window.SCORM.setSuccess(passed);
      } else {
        window.SCORM.setProgress(progress);
        var allDone = done === total && viewedCount === flow.length;
        window.SCORM.setCompletion(allDone);
        if (allDone) window.SCORM.setSuccess(passed);
      }
    }
    return {
      score: score, correct: correct, done: done, total: total,
      viewedCount: viewedCount, passed: passed
    };
  }

  /** 查看报告 = 向 LMS 提交最终成绩并结束本次 attempt */
  function submitResultsToLms() {
    if (!window.SCORM || window.SCORM.isFinished()) {
      return updateScoreAndCompletion(true);
    }
    window.SCORM.setSuspend({
      answers: state.answers,
      viewed: state.viewed,
      submitted: true
    });
    window.SCORM.setLocation("report");
    var s = updateScoreAndCompletion(true);
    window.SCORM.finish();
    return s;
  }

  /* ---------------- TOC ---------------- */
  function buildTOC() {
    el.toc.innerHTML = "";
    var sections = lesson.sections || [{ id: "all", title: lesson.title || "课程", pages: flow.map(function (p) { return p.id; }) }];
    sections.forEach(function (sec) {
      var g = document.createElement("div");
      g.className = "toc__group";
      var t = document.createElement("div");
      t.className = "toc__group-title";
      t.textContent = sec.title;
      g.appendChild(t);
      sec.pages.forEach(function (pid) {
        var page = flow.find(function (p) { return p.id === pid; });
        if (!page) return;
        var item = document.createElement("div");
        item.className = "toc__item";
        item.dataset.pid = pid;
        item.title = page.title;
        item.innerHTML =
          '<span class="toc__idx">' + String(page.index).padStart(2, "0") + '</span>' +
          '<span class="toc__label">' + page.title + '</span>' +
          '<span class="toc__status"></span>';
        item.addEventListener("click", function () {
          var idx = flow.findIndex(function (p) { return p.id === pid; });
          goto(idx);
          closeDrawer();
        });
        g.appendChild(item);
      });
      el.toc.appendChild(g);
    });
    refreshTOC();
  }

  function refreshTOC() {
    var cur = flow[state.current];
    var items = el.toc.querySelectorAll(".toc__item");
    items.forEach(function (it) {
      var pid = it.dataset.pid;
      it.classList.toggle("is-active", pid === cur.id);
      var st = it.querySelector(".toc__status");
      var page = flow.find(function (p) { return p.id === pid; });
      if (page.kind === "interaction") {
        var a = state.answers[page.questionRef];
        var isDone = state.completed[page.questionRef];
        if (isDone) st.innerHTML = '<span class="dot-done">\u2714</span>';
        else if (a && a.done && a.correct) st.innerHTML = '<span class="dot-done">\u2714</span>';
        else if (a && a.done) st.innerHTML = '<span style="color:var(--accent)">\u25CB</span>';
        else if (state.viewed[pid]) st.innerHTML = '<span style="color:var(--muted)">\u00B7</span>';
        else st.innerHTML = "";
      } else {
        st.innerHTML = state.viewed[pid] ? '<span class="dot-done">\u2714</span>' : "";
      }
    });
    var s = updateScoreAndCompletion();
    el.progFill.style.width = (s.viewedCount / flow.length * 100) + "%";
    el.progText.innerHTML = "<span>已学 " + s.viewedCount + "/" + flow.length + " 页</span><span>得分 " + s.score + "</span>";
  }

  /* ---------------- navigation ---------------- */
  function goto(idx, initial) {
    if (idx < 0) idx = 0;
    if (idx > flow.length) idx = flow.length;
    state.current = idx;
    if (idx < flow.length) {
      var page = flow[idx];
      state.viewed[page.id] = true;
      render(page);
      refreshTOC();
      if (!initial) persist();
    } else {
      // 最后一页「查看报告」：提交结果给 LMS，再展示报告
      renderReport();
      refreshTOC();
    }
    el.stageWrap.scrollTop = 0;
  }

  function shakeEl(node) {
    if (!node) return;
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    setTimeout(function () { node.classList.remove("shake"); }, 450);
  }

  function render(page) {
    el.topTitle.textContent = page.title;
    el.topPage.textContent = "第 " + page.index + " / " + flow.length + " 页";

    var stage = document.createElement("div");
    var isInteraction = page.kind === "interaction";
    stage.className = "stage " + (isInteraction ? "stage--split" : "stage--solo");

    var slide = document.createElement("div");
    slide.className = "slide anim-in";
    var img = document.createElement("img");
    img.className = "slide__img";
    img.src = page.image;
    img.alt = page.title;
    slide.appendChild(img);
    stage.appendChild(slide);

    if (page.kind === "cover" || page.kind === "divider") {
      renderStatic(page, slide, stage);
    } else if (isInteraction) {
      renderInteraction(page, slide, stage);
    }

    el.stageWrap.innerHTML = "";
    el.stageWrap.appendChild(stage);
    el.stageWrap.appendChild(buildNavRow());
  }

  function buildNavRow() {
    var row = document.createElement("div");
    row.className = "nav-row";
    var prev = document.createElement("button");
    prev.className = "btn btn--nav";
    prev.textContent = "\u2039 上一页";
    prev.disabled = state.current === 0;
    prev.onclick = function () { FX.click(); goto(state.current - 1); };
    var next = document.createElement("button");
    next.className = "btn btn--primary";
    next.textContent = state.current >= flow.length - 1 ? "查看报告（提交LMS） \u203A" : "下一页 \u203A";
    next.onclick = function () { FX.click(); goto(state.current + 1); };
    row.appendChild(prev);
    row.appendChild(next);
    return row;
  }

  /* ---------------- static pages (cover/divider) ---------------- */
  function renderStatic(page, slide, stage) {
    if (page.reveal) {
      var badge = document.createElement("div");
      badge.className = "reveal-badge";
      badge.textContent = "\uD83D\uDC46 点击画面，开始学习";
      slide.appendChild(badge);
      slide.style.cursor = "pointer";
      slide.addEventListener("click", function once() {
        FX.click(); FX.stars(window.innerWidth / 2, window.innerHeight / 3);
        badge.remove();
        slide.removeEventListener("click", once);
      });
    }
  }

  function renderPanelHead(q) {
    var html = '<span class="panel__tag">' + (TYPE_LABEL[q.type] || "互动题") + '</span>';
    if (q.material && q.material.length) {
      html += '<div class="panel__material">';
      q.material.forEach(function (line, i) {
        var cls = "panel__material-line";
        if (/^[A-C][：:]/.test(line)) cls += " panel__material-line--opt";
        if (/^\(\d+\)/.test(line) || /^[①②]/.test(line)) cls += " panel__material-line--sub";
        html += '<div class="' + cls + '">' + line + '</div>';
      });
      html += '</div>';
    } else if (q.prompt) {
      html += '<div class="panel__prompt">' + q.prompt + '</div>';
    }
    if (q.hint) html += '<div class="panel__hint">\uD83D\uDCA1 ' + q.hint + '</div>';
    return html;
  }

  /* ---------------- interaction dispatcher ---------------- */
  function renderInteraction(page, slide, stage) {
    var q = questions[page.questionRef];
    if (!q) return;
    var panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = renderPanelHead(q);
    var body = document.createElement("div");
    body.className = "panel__body";
    panel.appendChild(body);

    var ctrl = { getResponse: function () { return ""; }, check: function () { return false; }, reset: function () {}, lock: function () {} };

    switch (q.type) {
      case "fill-blank": ctrl = renderFill(q, body); break;
      case "choice": ctrl = renderChoice(q, body); break;
      case "multi": ctrl = renderMulti(q, body); break;
      case "judge": ctrl = renderJudge(q, body); break;
      case "matching": ctrl = renderMatching(q, body); break;
      case "drag": ctrl = renderDrag(q, body); break;
      case "sequence": ctrl = renderSequence(q, body); break;
      case "hotspot": ctrl = renderHotspot(q, body, slide); break;
    }

    // actions + feedback
    var actions = document.createElement("div");
    actions.className = "actions";
    var submit = document.createElement("button");
    submit.className = "btn btn--primary btn--submit";
    submit.textContent = "提交";
    var retry = document.createElement("button");
    retry.className = "btn btn--retry";
    retry.textContent = "重来";
    var showAns = document.createElement("button");
    showAns.className = "btn btn--ghost";
    showAns.textContent = "看解析";
    showAns.style.display = "none";
    actions.appendChild(submit);
    actions.appendChild(retry);
    actions.appendChild(showAns);

    var fb = document.createElement("div");
    fb.className = "feedback";

    panel.appendChild(actions);
    panel.appendChild(fb);
    stage.appendChild(panel);

    var tries = (state.answers[q.stepId] && state.answers[q.stepId].tries) || 0;
    var maxRetries = (q.retryPolicy && q.retryPolicy.maxRetries) || 3;
    var autoNextTimer = null;

    function clearAutoNext() {
      if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
    }

    function restartQuestion() {
      clearAutoNext();
      FX.click();
      tries = 0;
      delete state.answers[q.stepId];
      persist();
      refreshTOC();
      ctrl.lock(false);
      ctrl.reset();
      fb.className = "feedback";
      fb.innerHTML = "";
      submit.style.display = "";
      showAns.style.display = "none";
    }

    submit.onclick = function () {
      var ok = ctrl.check();
      tries++;
      var response = ctrl.getResponse();
      recordAnswer(q, ok, response, tries);
      if (ok) {
        FX.correct(); FX.confetti();
        var rect = submit.getBoundingClientRect();
        FX.stars(rect.left + rect.width / 2, rect.top);
        setTimeout(function () { FX.applause(); }, 150);
        fb.className = "feedback ok show";
        fb.innerHTML = "\uD83C\uDF89 " + q.feedback.correct +
          (q.explanation ? '<div class="feedback__exp">解析：' + q.explanation + '</div>' : "");
        submit.style.display = "none";
        showAns.style.display = "none";
        ctrl.lock(true);
        highlightTOCDone();
        clearAutoNext();
        autoNextTimer = setTimeout(function () {
          autoNextTimer = null;
          goto(state.current + 1);
        }, 1200);
      } else {
        FX.wrong();
        shakeEl(panel);
        fb.className = "feedback no show";
        var left = maxRetries - tries;
        fb.innerHTML = "\u274C " + q.feedback.incorrect +
          (left > 0 ? '<div class="feedback__exp">还可以再试 ' + left + ' 次</div>' : "");
        if (left > 0) {
          setTimeout(function () {
            ctrl.reset();
            fb.className = "feedback";
            fb.innerHTML = "";
          }, 700);
        } else {
          submit.style.display = "none";
          showAns.style.display = "";
          ctrl.lock(true);
        }
      }
    };

    retry.onclick = restartQuestion;

    showAns.onclick = function () {
      FX.click();
      fb.className = "feedback no show";
      fb.innerHTML = "\uD83D\uDCD6 正确答案与解析：<div class=\"feedback__exp\">" + q.explanation + "</div>";
      ctrl.lock(true);
      showAns.style.display = "none";
    };

    if (page.id === "p13") {
      initP13(slide, panel, q);
    }
    if (page.id === "p14") {
      initP14(slide, panel, q);
    }
    if (window.VizPractice && window.VizPractice.has(page.id)) {
      window.VizPractice.mount(page.id, slide, panel, q);
    }

    // 移除进入页面时直接锁定作答的 restore 逻辑，允许下次进入页面时自动回到可重做状态
  }

  function recordAnswer(q, ok, response, tries) {
    state.answers[q.stepId] = { correct: ok, tries: tries, response: response, done: true };
    if (ok) {
      state.completed[q.stepId] = true;
    }
    if (window.SCORM) {
      var typeMap = { "fill-blank": "fill-in", "choice": "choice", "multi": "choice",
        "judge": "true-false", "matching": "matching", "sequence": "sequencing",
        "drag": "matching", "hotspot": "performance" };
      window.SCORM.recordInteraction(interactionSeq++, q.stepId, typeMap[q.type] || "other",
        typeof response === "string" ? response : JSON.stringify(response), ok);
    }
    persist();
    refreshTOC();
  }

  function highlightTOCDone() {
    var active = el.toc.querySelector(".toc__item.is-active .toc__status");
    if (active) active.innerHTML = '<span class="dot-done">\u2714</span>';
  }

  /* ---------------- renderers ---------------- */

  // FILL-BLANK
  function renderFill(q, body) {
    var wrap = document.createElement("div");
    wrap.className = "blanks";
    var inputs = [];
    q.blanks.forEach(function (b) {
      var row = document.createElement("div");
      row.className = "blank-row";
      if (b.prefix) row.appendChild(txt(b.prefix + " "));
      var inp = document.createElement("input");
      inp.type = "text"; inp.inputMode = "numeric"; inp.dataset.id = b.id;
      inp.setAttribute("aria-label", b.id);
      inputs.push({ inp: inp, answers: b.answers });
      row.appendChild(inp);
      if (b.suffix) row.appendChild(txt(" " + b.suffix));
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
    return {
      getResponse: function () { return inputs.map(function (x) { return x.inp.value.trim(); }).join(","); },
      check: function () {
        var all = true;
        inputs.forEach(function (x) {
          var v = x.inp.value.trim();
          var ok = x.answers.map(String).indexOf(v) !== -1;
          x.inp.classList.toggle("correct", ok);
          x.inp.classList.toggle("wrong", !ok);
          if (!ok) all = false;
        });
        return all;
      },
      reset: function () { inputs.forEach(function (x) { x.inp.value = ""; x.inp.className = ""; }); },
      lock: function (on) {
        inputs.forEach(function (x) { x.inp.disabled = !!on; });
      }
    };
  }

  // CHOICE (single)
  function renderChoice(q, body) {
    var wrap = document.createElement("div"); wrap.className = "opts";
    var sel = null;
    q.options.forEach(function (o, i) {
      var d = optNode(o.id, String.fromCharCode(65 + i), o.text);
      d.onclick = function () {
        FX.click();
        wrap.querySelectorAll(".opt").forEach(function (n) { n.classList.remove("sel"); });
        d.classList.add("sel"); sel = o.id;
      };
      wrap.appendChild(d);
    });
    body.appendChild(wrap);
    return {
      getResponse: function () { return sel || ""; },
      check: function () {
        var ok = sel === q.correct;
        wrap.querySelectorAll(".opt").forEach(function (n) {
          if (n.dataset.oid === q.correct) n.classList.add("correct");
          if (n.dataset.oid === sel && !ok) n.classList.add("wrong");
        });
        return ok;
      },
      reset: function () { sel = null; wrap.querySelectorAll(".opt").forEach(function (n) { n.className = "opt"; }); },
      lock: function (on) {
        wrap.querySelectorAll(".opt").forEach(function (n) {
          n.style.pointerEvents = on ? "none" : "";
        });
      }
    };
  }

  // MULTI
  function renderMulti(q, body) {
    var wrap = document.createElement("div"); wrap.className = "opts";
    var sel = {};
    q.options.forEach(function (o, i) {
      var d = optNode(o.id, String.fromCharCode(65 + i), o.text);
      d.onclick = function () {
        FX.click(); sel[o.id] = !sel[o.id];
        d.classList.toggle("sel", sel[o.id]);
      };
      wrap.appendChild(d);
    });
    body.appendChild(wrap);
    return {
      getResponse: function () { return Object.keys(sel).filter(function (k) { return sel[k]; }).join(","); },
      check: function () {
        var chosen = Object.keys(sel).filter(function (k) { return sel[k]; }).sort();
        var want = q.correct.slice().sort();
        var ok = chosen.join(",") === want.join(",");
        wrap.querySelectorAll(".opt").forEach(function (n) {
          var id = n.dataset.oid;
          if (q.correct.indexOf(id) !== -1) n.classList.add("correct");
          else if (sel[id]) n.classList.add("wrong");
        });
        return ok;
      },
      reset: function () { sel = {}; wrap.querySelectorAll(".opt").forEach(function (n) { n.className = "opt"; }); },
      lock: function (on) {
        wrap.querySelectorAll(".opt").forEach(function (n) {
          n.style.pointerEvents = on ? "none" : "";
        });
      }
    };
  }

  // JUDGE (true/false)
  function renderJudge(q, body) {
    var wrap = document.createElement("div"); wrap.className = "opts judge-row";
    var sel = null;
    [["true", "\u2714 对"], ["false", "\u2718 错"]].forEach(function (pair) {
      var d = document.createElement("div");
      d.className = "opt"; d.dataset.oid = pair[0];
      d.innerHTML = '<span class="opt__mark"></span><span>' + pair[1] + '</span>';
      d.onclick = function () {
        FX.click();
        wrap.querySelectorAll(".opt").forEach(function (n) { n.classList.remove("sel"); });
        d.classList.add("sel"); sel = (pair[0] === "true");
      };
      wrap.appendChild(d);
    });
    body.appendChild(wrap);
    return {
      getResponse: function () { return sel === null ? "" : String(sel); },
      check: function () {
        var ok = sel === q.correct;
        wrap.querySelectorAll(".opt").forEach(function (n) {
          if ((n.dataset.oid === "true") === q.correct) n.classList.add("correct");
          if ((n.dataset.oid === "true") === sel && !ok) n.classList.add("wrong");
        });
        return ok;
      },
      reset: function () { sel = null; wrap.querySelectorAll(".opt").forEach(function (n) { n.className = "opt"; }); },
      lock: function (on) {
        wrap.querySelectorAll(".opt").forEach(function (n) {
          n.style.pointerEvents = on ? "none" : "";
        });
      }
    };
  }

  // MATCHING (click left then right to pair; instant correct/wrong feedback)
  function renderMatching(q, body) {
    var wrapper = document.createElement("div");
    wrapper.className = "match-wrap";
    var grid = document.createElement("div"); grid.className = "match";
    var leftCol = document.createElement("div"); leftCol.className = "match__col";
    var mid = document.createElement("div"); mid.className = "match__mid"; mid.textContent = "连线";
    var rightCol = document.createElement("div"); rightCol.className = "match__col";

    var pairs = {}; // leftId -> rightId (only correct pairs)
    var activeLeft = null;
    var busy = false;

    function clearSel() {
      grid.querySelectorAll(".match__node.sel").forEach(function (n) {
        n.classList.remove("sel");
      });
    }

    function isRightUsed(rid) {
      return Object.keys(pairs).some(function (k) { return pairs[k] === rid; });
    }

    function nodeBySide(side, id) {
      return (side === "left" ? leftCol : rightCol).querySelector('[data-id="' + id + '"]');
    }

    q.left.forEach(function (l) {
      var n = document.createElement("div");
      n.className = "match__node left"; n.dataset.id = l.id; n.textContent = l.text;
      n.onclick = function () {
        if (busy) return;
        if (pairs[l.id]) return;
        FX.click();
        clearSel();
        n.classList.add("sel");
        activeLeft = l.id;
      };
      leftCol.appendChild(n);
    });
    q.right.forEach(function (r) {
      var n = document.createElement("div");
      n.className = "match__node right"; n.dataset.id = r.id; n.textContent = r.text;
      n.onclick = function () {
        if (busy) return;
        if (isRightUsed(r.id)) return;
        if (!activeLeft) { FX.toast("请先点左边的小题"); return; }
        FX.click();
        clearSel();
        var lnode = nodeBySide("left", activeLeft);
        if (lnode) lnode.classList.add("sel");
        n.classList.add("sel");

        var expected = q.correct[activeLeft];
        if (expected === r.id) {
          pairs[activeLeft] = r.id;
          if (lnode) {
            lnode.classList.remove("sel");
            lnode.classList.add("paired", "correct");
          }
          n.classList.remove("sel");
          n.classList.add("paired", "correct");
          activeLeft = null;
          FX.correct();
          drawWires();
        } else {
          busy = true;
          if (lnode) lnode.classList.add("wrong");
          n.classList.add("wrong");
          shakeEl(wrapper.closest(".panel") || wrapper);
          FX.wrong();
          setTimeout(function () {
            if (lnode) lnode.classList.remove("sel", "wrong");
            n.classList.remove("sel", "wrong");
            activeLeft = null;
            busy = false;
          }, 450);
        }
      };
      rightCol.appendChild(n);
    });

    grid.appendChild(leftCol); grid.appendChild(mid); grid.appendChild(rightCol);
    var status = document.createElement("div");
    status.className = "panel__hint"; status.style.marginTop = "8px";
    wrapper.appendChild(grid); wrapper.appendChild(status);
    body.appendChild(wrapper);

    function drawWires() {
      var parts = Object.keys(pairs).map(function (lid) {
        var lt = q.left.find(function (x) { return x.id === lid; });
        return (lt ? lt.text.slice(0, 3) : lid) + " \u2192 " + pairs[lid];
      });
      status.textContent = parts.length ? "已连：" + parts.join("；") : "";
    }

    return {
      getResponse: function () { return JSON.stringify(pairs); },
      check: function () {
        var ok = true;
        Object.keys(q.correct).forEach(function (lid) {
          var picked = pairs[lid];
          var right = q.correct[lid];
          var lnode = nodeBySide("left", lid);
          var rnode = picked ? nodeBySide("right", picked) : null;
          if (picked === right) {
            if (lnode) lnode.classList.add("correct", "paired");
            if (rnode) rnode.classList.add("correct", "paired");
          } else {
            if (lnode) lnode.classList.add("wrong");
            ok = false;
          }
        });
        return ok;
      },
      reset: function () {
        pairs = {}; activeLeft = null; busy = false;
        wrapper.classList.remove("shake");
        grid.querySelectorAll(".match__node").forEach(function (n) {
          n.className = n.classList.contains("left") ? "match__node left" : "match__node right";
        });
        drawWires();
      },
      lock: function (on) {
        grid.querySelectorAll(".match__node").forEach(function (n) {
          n.style.pointerEvents = on ? "none" : "";
        });
      }
    };
  }

  // DRAG (drag-formula: pointer drag tiles into slots)
  function renderDrag(q, body) {
    var formula = document.createElement("div");
    formula.className = "drag-formula";
    var slotEls = {};
    var tokens = q.template.split(/(\{[abc]\})/);
    tokens.forEach(function (tk) {
      var m = tk.match(/^\{([abc])\}$/);
      if (m) {
        var s = document.createElement("div");
        s.className = "dropslot"; s.dataset.slot = m[1];
        slotEls[m[1]] = s; formula.appendChild(s);
      } else if (tk.trim()) {
        formula.appendChild(txt(tk));
      }
    });
    var tray = document.createElement("div"); tray.className = "tile-tray";
    q.tiles.forEach(function (val) {
      var t = document.createElement("div");
      t.className = "tile"; t.textContent = val; t.dataset.val = val;
      makeDraggableTile(t, slotEls, tray);
      tray.appendChild(t);
    });
    body.appendChild(formula);
    var hint = document.createElement("div"); hint.className = "panel__hint";
    hint.textContent = "把下面的数字卡拖到横线框里（也可以点卡片再点框）：";
    body.appendChild(hint);
    body.appendChild(tray);

    // click-to-place fallback
    var picked = null;
    tray.addEventListener("click", function (e) {
      var t = e.target.closest(".tile"); if (!t) return;
      FX.click();
      tray.querySelectorAll(".tile").forEach(function (x) { x.classList.remove("sel"); });
      t.classList.add("sel"); picked = t;
    });
    Object.keys(slotEls).forEach(function (k) {
      slotEls[k].addEventListener("click", function () {
        if (!picked) return;
        placeTile(picked, slotEls[k], tray);
        picked = null;
      });
    });

    function getVals() {
      return { a: slotVal("a"), b: slotVal("b"), c: slotVal("c") };
    }
    function slotVal(k) { var c = slotEls[k].querySelector(".tile"); return c ? c.dataset.val : ""; }

    return {
      getResponse: function () { var v = getVals(); return v.a + "x" + v.b + "=" + v.c; },
      check: function () {
        var v = getVals();
        var a = parseInt(v.a, 10), b = parseInt(v.b, 10), c = parseInt(v.c, 10);
        var ok = !isNaN(a) && !isNaN(b) && (a * b === q.correct.product) && (v.c === q.correct.c);
        Object.keys(slotEls).forEach(function (k) {
          slotEls[k].style.borderColor = ok ? "var(--ok)" : "var(--err)";
        });
        return ok;
      },
      reset: function () {
        Object.keys(slotEls).forEach(function (k) {
          var c = slotEls[k].querySelector(".tile");
          if (c) { tray.appendChild(c); c.classList.remove("placed"); }
          slotEls[k].style.borderColor = "";
        });
      },
      lock: function (on) {
        formula.style.pointerEvents = on ? "none" : "";
        tray.style.pointerEvents = on ? "none" : "";
      }
    };
  }

  function placeTile(tile, slot, tray) {
    var existing = slot.querySelector(".tile");
    if (existing) tray.appendChild(existing);
    slot.appendChild(tile);
    tile.classList.add("placed"); tile.classList.remove("sel");
    FX.click();
  }

  function makeDraggableTile(tile, slotEls, tray) {
    tile.addEventListener("pointerdown", function (e) {
      if (tile.parentElement && tile.parentElement.style.pointerEvents === "none") return;
      e.preventDefault();
      var clone = tile.cloneNode(true);
      clone.style.position = "fixed"; clone.style.zIndex = 1000; clone.style.pointerEvents = "none";
      clone.style.width = tile.offsetWidth + "px";
      document.body.appendChild(clone);
      tile.classList.add("dragging");
      var move = function (ev) {
        clone.style.left = (ev.clientX - tile.offsetWidth / 2) + "px";
        clone.style.top = (ev.clientY - tile.offsetHeight / 2) + "px";
        Object.keys(slotEls).forEach(function (k) {
          slotEls[k].classList.toggle("over", hit(slotEls[k], ev.clientX, ev.clientY));
        });
      };
      var up = function (ev) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        clone.remove(); tile.classList.remove("dragging");
        var dropped = false;
        Object.keys(slotEls).forEach(function (k) {
          slotEls[k].classList.remove("over");
          if (!dropped && hit(slotEls[k], ev.clientX, ev.clientY)) {
            placeTile(tile, slotEls[k], tray); dropped = true;
          }
        });
      };
      move(e);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  }

  function hit(node, x, y) {
    var r = node.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  // SEQUENCE (pointer drag to reorder + up/down buttons)
  function renderSequence(q, body) {
    var list = document.createElement("div"); list.className = "seq";
    var order = shuffle(q.items.slice());
    var tryCount = 0;
    while (tryCount < 8 && order.map(function (o) { return o.id; }).join(",") === q.correct.join(",")) {
      order = shuffle(q.items.slice()); tryCount++;
    }
    function paint() {
      list.innerHTML = "";
      order.forEach(function (item, i) {
        var row = document.createElement("div");
        row.className = "seq__item"; row.dataset.id = item.id;
        row.innerHTML = '<span class="seq__num">' + (i + 1) + '</span><span style="flex:1">' + item.text + '</span>' +
          '<span style="display:flex;gap:4px">' +
          '<button class="btn btn--ghost sequp" style="padding:4px 9px" aria-label="上移">\u25B2</button>' +
          '<button class="btn btn--ghost seqdn" style="padding:4px 9px" aria-label="下移">\u25BC</button></span>';
        row.querySelector(".sequp").onclick = function (e) { e.stopPropagation(); FX.click(); if (i > 0) { swap(i, i - 1); } };
        row.querySelector(".seqdn").onclick = function (e) { e.stopPropagation(); FX.click(); if (i < order.length - 1) { swap(i, i + 1); } };
        makeSeqDraggable(row, i);
        list.appendChild(row);
      });
    }
    function swap(i, j) { var t = order[i]; order[i] = order[j]; order[j] = t; paint(); }
    function makeSeqDraggable(row, index) {
      row.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        if (list.style.pointerEvents === "none") return;
        e.preventDefault();
        row.classList.add("dragging");
        var move = function (ev) {
          var rows = Array.prototype.slice.call(list.children);
          rows.forEach(function (r, k) {
            if (k === index) return;
            var rect = r.getBoundingClientRect();
            if (ev.clientY > rect.top && ev.clientY < rect.bottom) {
              var from = index, to = k;
              var moved = order.splice(from, 1)[0];
              order.splice(to, 0, moved);
              index = to; paint();
              // re-grab dragging on new node
              var nn = list.children[to]; if (nn) nn.classList.add("dragging");
            }
          });
        };
        var up = function () {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          Array.prototype.forEach.call(list.children, function (r) { r.classList.remove("dragging"); });
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
    }
    paint();
    body.appendChild(list);
    return {
      getResponse: function () { return order.map(function (o) { return o.id; }).join(","); },
      check: function () {
        var cur = order.map(function (o) { return o.id; });
        var ok = cur.join(",") === q.correct.join(",");
        Array.prototype.forEach.call(list.children, function (r, i) {
          r.classList.toggle("correct", r.dataset.id === q.correct[i]);
        });
        return ok;
      },
      reset: function () { order = shuffle(q.items.slice()); paint(); },
      lock: function (on) { list.style.pointerEvents = on ? "none" : ""; }
    };
  }

  // HOTSPOT (+ magnifier, + follow-up fill)
  function renderHotspot(q, body, slide) {
    var layer = document.createElement("div"); layer.className = "hotspot-layer";
    var picked = {};
    var mag = null;
    q.hotspots.forEach(function (h) {
      var b = document.createElement("div");
      b.className = "hot";
      b.style.left = h.x + "%"; b.style.top = h.y + "%";
      b.style.width = h.w + "%"; b.style.height = h.h + "%";
      b.innerHTML = '<span class="hot__tip">' + h.label + '</span>';
      b.onclick = function () {
        FX.click();
        if (h.correct) {
          picked[h.id] = true; b.classList.add("picked");
          FX.stars(b.getBoundingClientRect().left, b.getBoundingClientRect().top);
        } else {
          b.classList.add("wrongpick");
          FX.wrong();
          shakeEl(body.closest(".panel"));
          setTimeout(function () { b.classList.remove("wrongpick"); }, 500);
        }
        updateStatus();
      };
      layer.appendChild(b);
    });
    slide.appendChild(layer);

    // magnifier
    if (q.magnifier) {
      mag = document.createElement("div"); mag.className = "magnifier";
      slide.appendChild(mag);
      var imgEl = slide.querySelector(".slide__img");
      slide.addEventListener("pointermove", function (e) {
        var r = slide.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (x < 0 || y < 0 || x > r.width || y > r.height) { mag.style.display = "none"; return; }
        mag.style.display = "block";
        mag.style.left = (x - 75) + "px"; mag.style.top = (y - 75) + "px";
        mag.style.backgroundImage = "url(" + imgEl.src + ")";
        mag.style.backgroundSize = (r.width * 2) + "px " + (r.height * 2) + "px";
        mag.style.backgroundPosition = (-(x * 2 - 75)) + "px " + (-(y * 2 - 75)) + "px";
      });
      slide.addEventListener("pointerleave", function () { mag.style.display = "none"; });
    }

    var status = document.createElement("div");
    status.className = "panel__hint"; status.style.marginTop = "6px";

    // follow-up input
    var followInputs = [];
    var followWrap = document.createElement("div");
    if (q.followUp) {
      followWrap.className = "blanks"; followWrap.style.marginTop = "12px";
      var fp = document.createElement("div"); fp.className = "panel__prompt";
      fp.style.fontSize = "15px"; fp.textContent = q.followUp.prompt;
      followWrap.appendChild(fp);
      q.followUp.blanks.forEach(function (b) {
        var row = document.createElement("div"); row.className = "blank-row";
        var inp = document.createElement("input"); inp.type = "text"; inp.inputMode = "numeric";
        followInputs.push({ inp: inp, answers: b.answers });
        row.appendChild(inp);
        if (b.suffix) row.appendChild(txt(" " + b.suffix));
        followWrap.appendChild(row);
      });
    }
    body.appendChild(status);
    body.appendChild(followWrap);

    var requiredHotspots = q.requiredHotspots || [];
    function updateStatus() {
      var need = requiredHotspots.length;
      var got = requiredHotspots.filter(function (id) { return picked[id]; }).length;
      status.textContent = "已找到价格：" + got + " / " + need;
    }
    updateStatus();

    return {
      getResponse: function () {
        return Object.keys(picked).join(",") + "|" + followInputs.map(function (x) { return x.inp.value.trim(); }).join(",");
      },
      check: function () {
        var allSpots = requiredHotspots.every(function (id) { return picked[id]; });
        if (!allSpots) { FX.toast("先点出所有正确的价格哦"); return false; }
        var all = true;
        followInputs.forEach(function (x) {
          var ok = x.answers.map(String).indexOf(x.inp.value.trim()) !== -1;
          x.inp.classList.toggle("correct", ok);
          x.inp.classList.toggle("wrong", !ok);
          if (!ok) all = false;
        });
        return all;
      },
      reset: function () {
        picked = {};
        layer.querySelectorAll(".hot").forEach(function (n) { n.className = "hot"; });
        followInputs.forEach(function (x) { x.inp.value = ""; x.inp.className = ""; });
        updateStatus();
      },
      lock: function (on) {
        layer.style.pointerEvents = on ? "none" : "";
        followInputs.forEach(function (x) { x.inp.disabled = !!on; });
        if (mag && on) mag.style.display = "none";
      }
    };
  }

  /* ---------------- report ---------------- */
  function renderReport() {
    el.topTitle.textContent = "学习报告";
    el.topPage.textContent = "";
    var s = submitResultsToLms();
    var pass = !!s.passed;
    var lmsHint = window.SCORM && window.SCORM.isLMS
      ? "结果已提交至 LMS：得分 / 完成状态 / 通过状态 / 学习时长 / 作答记录"
      : "本地预览模式：成绩已固化（未连接 LMS）";
    var stage = document.createElement("div"); stage.className = "stage stage--solo";
    var rep = document.createElement("div"); rep.className = "report";
    rep.innerHTML =
      '<h2>' + (pass ? "\uD83C\uDF89 恭喜完成！" : "继续加油！") + '</h2>' +
      '<div class="report__score">' + s.score + '<span style="font-size:20px">分</span></div>' +
      '<div class="report__grid">' +
        cell(s.correct + "/" + s.total, "答对题数") +
        cell(s.viewedCount + "/" + flow.length, "浏览页数") +
        cell((pass ? "已通过" : "未通过"), "完成状态") +
        cell(fmtDuration(window.SCORM ? window.SCORM.elapsedSeconds() : 0), "学习时长") +
      '</div>' +
      '<div style="color:var(--muted);font-size:13px">' + lmsHint + '</div>';
    var acts = document.createElement("div"); acts.className = "actions"; acts.style.justifyContent = "center"; acts.style.marginTop = "18px";
    var back = document.createElement("button"); back.className = "btn btn--ghost"; back.textContent = "\u2039 返回复习";
    back.onclick = function () { FX.click(); goto(flow.length - 1); };
    var restart = document.createElement("button"); restart.className = "btn btn--primary"; restart.textContent = "重新学习";
    restart.onclick = function () { FX.click(); state.answers = {}; state.viewed = {}; state.completed = {}; goto(0); };
    acts.appendChild(back); acts.appendChild(restart);
    rep.appendChild(acts);
    stage.appendChild(rep);
    el.stageWrap.innerHTML = ""; el.stageWrap.appendChild(stage);
    if (pass) { FX.confetti(); FX.applause(); }
  }

  function cell(v, label) {
    return '<div class="report__cell"><b>' + v + '</b><span>' + label + '</span></div>';
  }

  /* ---------------- shell / helpers ---------------- */
  function bindShell() {
    el.hamburger.onclick = function () {
      el.sidebar.classList.toggle("open");
      el.backdrop.classList.toggle("show", el.sidebar.classList.contains("open"));
    };
    el.backdrop.onclick = closeDrawer;
    el.soundBtn.onclick = function () {
      var on = !FX.isEnabled(); FX.setEnabled(on);
      el.soundBtn.textContent = on ? "\uD83D\uDD0A" : "\uD83D\uDD07";
      if (on) FX.click();
    };
    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") goto(state.current + 1);
      if (e.key === "ArrowLeft") goto(state.current - 1);
    });
    // commit on visibility change
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && window.SCORM) window.SCORM.commit();
    });
  }

  function closeDrawer() {
    el.sidebar.classList.remove("open");
    el.backdrop.classList.remove("show");
  }

  function optNode(id, letter, text) {
    var d = document.createElement("div");
    d.className = "opt"; d.dataset.oid = id;
    d.innerHTML = '<span class="opt__mark">' + letter + '</span><span>' + text + '</span>';
    return d;
  }
  function txt(s) { var span = document.createElement("span"); span.textContent = s; return span; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    // guard: avoid already-correct order for sequences
    return a;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    // guard: avoid already-correct order for sequences
    return a;
  }

  /* ---------------- Custom Visualizer: p13 (小兔摘花) ---------------- */
  function initP13(slide, panel, q) {
    var imgEl = slide.querySelector(".slide__img");
    if (imgEl) imgEl.style.display = "none";

    var canvas = document.createElement("div");
    canvas.className = "p13-canvas";
    
    var header = document.createElement("div");
    header.className = "p13-header";
    header.innerHTML = 
      '<div class="p13-rabbit">🐰</div>' +
      '<div class="p13-bubble">小兔：我摘了 24 朵花，你能帮我平均分到 3 个篮子里吗？每只篮子装几朵？</div>';
    canvas.appendChild(header);

    var basketsContainer = document.createElement("div");
    basketsContainer.className = "p13-baskets";
    
    var baskets = [];
    for (var i = 0; i < 3; i++) {
      var basketWrap = document.createElement("div");
      basketWrap.className = "p13-basket-wrap";
      
      var basket = document.createElement("div");
      basket.className = "p13-basket";
      basket.dataset.index = i;
      
      var label = document.createElement("div");
      label.className = "p13-basket-label";
      label.innerHTML = '篮子 ' + (i + 1) + '<span class="p13-basket-count" id="p13-count-' + i + '">0 朵</span>';
      
      basketWrap.appendChild(basket);
      basketWrap.appendChild(label);
      basketsContainer.appendChild(basketWrap);
      
      baskets.push({
        el: basket,
        countEl: label.querySelector(".p13-basket-count"),
        flowers: []
      });
    }
    canvas.appendChild(basketsContainer);

  
    var pool = document.createElement("div");
    pool.className = "p13-pool";
    canvas.appendChild(pool);

    var actions = document.createElement("div");
    actions.className = "p13-actions";
    
    var btnAuto = document.createElement("button");
    btnAuto.className = "p13-btn p13-btn-auto";
    btnAuto.innerHTML = "✨ 一键平均分";
    
    var btnStep = document.createElement("button");
    btnStep.className = "p13-btn p13-btn-step";
    btnStep.innerHTML = "👉 逐朵分发";
    
    var btnReset = document.createElement("button");
    btnReset.className = "p13-btn p13-btn-reset";
    btnReset.innerHTML = "🔄 重置重来";
    
    actions.appendChild(btnAuto);
    actions.appendChild(btnStep);
    actions.appendChild(btnReset);
    canvas.appendChild(actions);

    slide.appendChild(canvas);

    var flowerEmojis = ["🌸", "💮", "🏵️", "🌹", "🌺", "🌻", "🌼", "🌷"];
    var flowerElements = [];
    var animationSessionId = 0;

    function initFlowers() {
      animationSessionId++;
      pool.innerHTML = "";
      flowerElements = [];
      baskets.forEach(function (b) {
        b.el.innerHTML = "";
        b.flowers = [];
        b.countEl.textContent = "0 朵";
      });
      
      for (var j = 0; j < 24; j++) {
        var fl = document.createElement("div");
        fl.className = "p13-flower";
        fl.textContent = flowerEmojis[j % flowerEmojis.length];
        fl.dataset.id = j;
        pool.appendChild(fl);
        flowerElements.push(fl);
        makeFlowerDraggable(fl);
      }
      
      btnAuto.disabled = false;
      btnStep.disabled = false;
      
      var inp = panel.querySelector("input");
      if (inp) {
        inp.value = "";
        inp.className = "";
      }
      var submitBtn = panel.querySelector(".btn--submit");
      if (submitBtn) {
        submitBtn.classList.remove("pulse");
      }
    }

    function makeFlowerDraggable(flower) {
      flower.addEventListener("pointerdown", function (e) {
        if (flower.classList.contains("in-basket") || btnAuto.disabled === true) return;
        e.preventDefault();
        
        var rect = flower.getBoundingClientRect();
        var clone = flower.cloneNode(true);
        clone.style.position = "fixed";
        clone.style.zIndex = "1000";
        clone.style.pointerEvents = "none";
        clone.style.width = rect.width + "px";
        clone.style.height = rect.height + "px";
        clone.style.left = rect.left + "px";
        clone.style.top = rect.top + "px";
        document.body.appendChild(clone);
        
        flower.classList.add("dragging");
        
        var move = function (ev) {
          clone.style.left = (ev.clientX - rect.width / 2) + "px";
          clone.style.top = (ev.clientY - rect.height / 2) + "px";
          
          baskets.forEach(function (b) {
            var isOver = hitTest(b.el, ev.clientX, ev.clientY);
            b.el.classList.toggle("over", isOver);
          });
        };
        
        var up = function (ev) {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          clone.remove();
          flower.classList.remove("dragging");
          
          var placed = false;
          for (var i = 0; i < baskets.length; i++) {
            var b = baskets[i];
            b.el.classList.remove("over");
            if (!placed && hitTest(b.el, ev.clientX, ev.clientY)) {
              placeFlowerInBasket(flower, i);
              placed = true;
              break;
            }
          }
        };
        
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
    }

    function hitTest(node, x, y) {
      var r = node.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function placeFlowerInBasket(flower, basketIndex) {
      var b = baskets[basketIndex];
      flower.classList.add("in-basket");
      flower.style.pointerEvents = "none";
      b.el.appendChild(flower);
      b.flowers.push(flower);
      b.countEl.textContent = b.flowers.length + " 朵";
      FX.click();
      
      checkCompletion();
    }

    function animateFlowerFly(flower, basketIndex, callback) {
      var currentSession = animationSessionId;
      var startRect = flower.getBoundingClientRect();
      var b = baskets[basketIndex];
      var endRect = b.el.getBoundingClientRect();
      
      var clone = flower.cloneNode(true);
      clone.style.position = "fixed";
      clone.style.zIndex = "1000";
      clone.style.pointerEvents = "none";
      clone.style.width = startRect.width + "px";
      clone.style.height = startRect.height + "px";
      clone.style.left = startRect.left + "px";
      clone.style.top = startRect.top + "px";
      clone.style.transition = "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      document.body.appendChild(clone);
      
      flower.style.visibility = "hidden";
      flower.classList.add("in-basket");
      
      requestAnimationFrame(function () {
        if (currentSession !== animationSessionId) {
          clone.remove();
          return;
        }
        var offsetX = (Math.random() * 0.4 + 0.3) * endRect.width;
        var offsetY = (Math.random() * 0.3 + 0.2) * endRect.height;
        clone.style.left = (endRect.left + offsetX - startRect.width / 2) + "px";
        clone.style.top = (endRect.top + offsetY - startRect.height / 2) + "px";
        clone.style.transform = "scale(0.8)";
      });
      
      setTimeout(function () {
        if (currentSession !== animationSessionId) {
          clone.remove();
          return;
        }
        clone.remove();
        flower.style.visibility = "visible";
        flower.style.pointerEvents = "none";
        b.el.appendChild(flower);
        b.flowers.push(flower);
        b.countEl.textContent = b.flowers.length + " 朵";
        FX.click();
        if (callback) callback();
      }, 400);
    }

    function checkCompletion() {
      var remaining = pool.querySelectorAll(".p13-flower:not(.in-basket)").length;
      if (remaining === 0) {
        btnAuto.disabled = true;
        btnStep.disabled = true;
        
        var isPerfect = baskets.every(function (b) { return b.flowers.length === 8; });
        if (isPerfect) {
          FX.stars(window.innerWidth / 2, window.innerHeight / 3);
          FX.toast("太棒了！24朵花平均装进3个篮子，每个篮子正好装 8 朵！");
        } else {
          FX.toast("分完了，但每个篮子里的花不一样多哦！点【重置】再试一次吧～");
        }
      }
    }

    btnAuto.onclick = function () {
      FX.click();
      btnAuto.disabled = true;
      btnStep.disabled = true;
      
      var remainingFlowers = Array.prototype.slice.call(pool.querySelectorAll(".p13-flower:not(.in-basket)"));
      if (remainingFlowers.length === 0) return;
      
      animationSessionId++;
      var currentSession = animationSessionId;
      
      var index = 0;
      function next() {
        if (currentSession !== animationSessionId) return;
        
        if (index < remainingFlowers.length) {
          var f = remainingFlowers[index];
          var basketIndex = index % 3;
          animateFlowerFly(f, basketIndex, function () {
            if (currentSession !== animationSessionId) return;
            index++;
            setTimeout(next, 80);
          });
        } else {
          checkCompletion();
        }
      }
      next();
    };

    btnStep.onclick = function () {
      FX.click();
      var remainingFlowers = Array.prototype.slice.call(pool.querySelectorAll(".p13-flower:not(.in-basket)"));
      if (remainingFlowers.length < 3) {
        remainingFlowers.forEach(function (f, idx) {
          animateFlowerFly(f, idx % 3);
        });
        setTimeout(checkCompletion, 500);
        return;
      }
      
      btnAuto.disabled = true;
      btnStep.disabled = true;
      
      animationSessionId++;
      var currentSession = animationSessionId;
      
      var f1 = remainingFlowers[0];
      var f2 = remainingFlowers[1];
      var f3 = remainingFlowers[2];
      
      var completedCount = 0;
      function onDone() {
        if (currentSession !== animationSessionId) return;
        completedCount++;
        if (completedCount === 3) {
          btnStep.disabled = false;
          btnAuto.disabled = false;
          checkCompletion();
        }
      }
      
      animateFlowerFly(f1, 0, onDone);
      setTimeout(function() { animateFlowerFly(f2, 1, onDone); }, 100);
      setTimeout(function() { animateFlowerFly(f3, 2, onDone); }, 200);
    };

    btnReset.onclick = function () {
      FX.click();
      initFlowers();
    };

    initFlowers();
  }

  /* ---------------- Custom Visualizer: p14 (篮球和足球) ---------------- */
  function initP14(slide, panel, q) {
    var imgEl = slide.querySelector(".slide__img");
    if (imgEl) imgEl.style.display = "none";

    var TOTAL_BASKETBALL = 45;
    var TOTAL_FOOTBALL = 27;
    var GROUP_COUNT = 9;
    var PER_GROUP = 3;

    var canvas = document.createElement("div");
    canvas.className = "p14-canvas";

    var scene = document.createElement("div");
    scene.className = "p14-scene";

    /* --- 左侧器材架 --- */
    var shelf = document.createElement("div");
    shelf.className = "p14-shelf";

    var bbLayer = document.createElement("div");
    bbLayer.className = "p14-shelf-layer p14-basketball-layer";
    bbLayer.innerHTML =
      '<div class="p14-layer-badge p14-layer-badge--bb">' +
        '<span class="p14-layer-icon">🏀</span>' +
        '<span class="p14-layer-count">' + TOTAL_BASKETBALL + '</span>' +
        '<span class="p14-layer-tag p14-layer-tag--warn">?</span>' +
      '</div>' +
      '<div class="p14-ball-grid p14-ball-grid--bb"></div>' +
      '<div class="p14-shutter"></div>' +
      '<div class="p14-lock-mark">🔒</div>';
    var bbGrid = bbLayer.querySelector(".p14-ball-grid");

    var fbLayer = document.createElement("div");
    fbLayer.className = "p14-shelf-layer p14-football-layer";
    fbLayer.innerHTML =
      '<div class="p14-layer-badge p14-layer-badge--fb">' +
        '<span class="p14-layer-icon">⚽</span>' +
        '<span class="p14-layer-count">' + TOTAL_FOOTBALL + '</span>' +
        '<span class="p14-layer-tag p14-layer-tag--ok">分</span>' +
      '</div>' +
      '<div class="p14-ball-grid p14-ball-grid--fb"></div>';
    var fbGrid = fbLayer.querySelector(".p14-ball-grid");
    var fbPool = fbGrid;

    shelf.appendChild(bbLayer);
    shelf.appendChild(fbLayer);

    /* --- 右侧 9 个小组 --- */
    var groupsWrap = document.createElement("div");
    groupsWrap.className = "p14-groups";
    var groups = [];
    for (var g = 0; g < GROUP_COUNT; g++) {
      var gWrap = document.createElement("div");
      gWrap.className = "p14-group";
      gWrap.innerHTML =
        '<div class="p14-group-pitch" data-gi="' + g + '">' +
          '<span class="p14-group-no">' + (g + 1) + '</span>' +
          '<div class="p14-group-balls"></div>' +
        '</div>' +
        '<div class="p14-group-count">0</div>';
      groupsWrap.appendChild(gWrap);
      groups.push({
        pitch: gWrap.querySelector(".p14-group-pitch"),
        ballsEl: gWrap.querySelector(".p14-group-balls"),
        countEl: gWrap.querySelector(".p14-group-count"),
        balls: []
      });
    }

    scene.appendChild(shelf);
    scene.appendChild(groupsWrap);
    canvas.appendChild(scene);

    /* --- 算理条（数字为主，少文字） --- */
    var bridge = document.createElement("div");
    bridge.className = "p14-bridge";
    bridge.innerHTML =
      '<div class="p14-formula">' +
        '<span class="p14-chip p14-chip--fb">⚽<b id="p14-f-total">' + TOTAL_FOOTBALL + '</b></span>' +
        '<span class="p14-op">÷</span>' +
        '<span class="p14-chip p14-chip--grp">👥<b>' + GROUP_COUNT + '</b></span>' +
        '<span class="p14-op">=</span>' +
        '<span class="p14-chip p14-chip--ans" id="p14-ans">?</span>' +
      '</div>' +
      '<div class="p14-remain">' +
        '<span class="p14-remain-icon">⚽</span>' +
        '<span class="p14-remain-bar"><span class="p14-remain-fill" id="p14-remain-fill"></span></span>' +
        '<span class="p14-remain-num" id="p14-remain-num">' + TOTAL_FOOTBALL + '</span>' +
      '</div>';
    canvas.appendChild(bridge);

    var remainFill = bridge.querySelector("#p14-remain-fill");
    var remainNum = bridge.querySelector("#p14-remain-num");
    var ansChip = bridge.querySelector("#p14-ans");

    /* --- 操作按钮 --- */
    var actions = document.createElement("div");
    actions.className = "p14-actions";

    var btnLock = document.createElement("button");
    btnLock.className = "p14-btn p14-btn-lock";
    btnLock.innerHTML = '<span class="p14-btn-icon">🔒</span><span>去掉篮球</span>';

    var btnStep = document.createElement("button");
    btnStep.className = "p14-btn p14-btn-step";
    btnStep.innerHTML = '<span class="p14-btn-icon">▶</span><span>每组 +1</span>';
    btnStep.disabled = true;

    var btnAuto = document.createElement("button");
    btnAuto.className = "p14-btn p14-btn-auto";
    btnAuto.innerHTML = '<span class="p14-btn-icon">⚡</span><span>全部分完</span>';
    btnAuto.disabled = true;

    var btnReset = document.createElement("button");
    btnReset.className = "p14-btn p14-btn-reset";
    btnReset.textContent = "↺";

    actions.appendChild(btnLock);
    actions.appendChild(btnStep);
    actions.appendChild(btnAuto);
    actions.appendChild(btnReset);
    canvas.appendChild(actions);

    slide.appendChild(canvas);

    var animationSessionId = 0;
    var isLocked = false;
    var isAnimating = false;
    var distributedRound = 0;

    function hitTest(node, x, y) {
      var r = node.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function makeBall(type, index) {
      var ball = document.createElement("div");
      ball.className = "p14-ball p14-ball--" + type;
      ball.dataset.index = index;
      ball.textContent = type === "bb" ? "🏀" : "⚽";
      return ball;
    }

    function updateRemain(count) {
      remainNum.textContent = count;
      var pct = (count / TOTAL_FOOTBALL) * 100;
      remainFill.style.width = pct + "%";
    }

    function updateFormulaPerGroup(n) {
      if (n === 0) {
        ansChip.textContent = "?";
        ansChip.className = "p14-chip p14-chip--ans";
      } else {
        ansChip.textContent = String(n);
        ansChip.className = "p14-chip p14-chip--ans p14-chip--lit";
      }
    }

    function resetPanelInput() {
      var inp = panel.querySelector("input");
      if (inp) {
        inp.value = "";
        inp.className = "";
      }
      var submitBtn = panel.querySelector(".btn--submit");
      if (submitBtn) submitBtn.classList.remove("pulse");
    }

    function initScene() {
      animationSessionId++;
      isLocked = false;
      isAnimating = false;
      distributedRound = 0;

      bbGrid.innerHTML = "";
      fbGrid.innerHTML = "";
      for (var i = 0; i < TOTAL_BASKETBALL; i++) {
        bbGrid.appendChild(makeBall("bb", i));
      }
      for (var j = 0; j < TOTAL_FOOTBALL; j++) {
        var fb = makeBall("fb", j);
        fbGrid.appendChild(fb);
        makeFootballDraggable(fb);
      }

      groups.forEach(function (gr) {
        gr.ballsEl.innerHTML = "";
        gr.balls = [];
        gr.countEl.textContent = "0";
        gr.pitch.classList.remove("over", "p14-group-pitch--full");
      });

      bbLayer.classList.remove("locked");
      btnLock.disabled = false;
      btnStep.disabled = true;
      btnAuto.disabled = true;

      updateRemain(TOTAL_FOOTBALL);
      updateFormulaPerGroup(0);
      resetPanelInput();
    }

    function lockBasketballs() {
      if (isLocked) return;
      isLocked = true;
      FX.click();
      bbLayer.classList.add("locked");
      btnLock.disabled = true;
      btnStep.disabled = false;
      btnAuto.disabled = false;
      bbLayer.querySelector(".p14-layer-tag--warn").textContent = "×";
      bbLayer.querySelector(".p14-layer-tag--warn").className = "p14-layer-tag p14-layer-tag--off";
    }

    function placeFootballInGroup(ball, groupIndex) {
      var gr = groups[groupIndex];
      ball.classList.add("in-group");
      ball.style.pointerEvents = "none";
      gr.ballsEl.appendChild(ball);
      gr.balls.push(ball);
      var n = gr.balls.length;
      gr.countEl.textContent = String(n);
      gr.pitch.classList.toggle("p14-group-pitch--full", n >= PER_GROUP);
      FX.click();
      syncStateAfterMove();
    }

    function syncStateAfterMove() {
      var remaining = fbPool.querySelectorAll(".p14-ball:not(.in-group)").length;
      updateRemain(remaining);
      if (remaining === 0) {
        btnStep.disabled = true;
        btnAuto.disabled = true;
        var allEqual = groups.every(function (gr) { return gr.balls.length === PER_GROUP; });
        if (allEqual) {
          updateFormulaPerGroup(PER_GROUP);
          FX.stars(window.innerWidth / 2, window.innerHeight / 3);
        }
      } else {
        var minCount = Math.min.apply(null, groups.map(function (gr) { return gr.balls.length; }));
        updateFormulaPerGroup(minCount);
      }
    }

    function animateBallFly(ball, groupIndex, callback) {
      var session = animationSessionId;
      var startRect = ball.getBoundingClientRect();
      var gr = groups[groupIndex];
      var endRect = gr.pitch.getBoundingClientRect();

      var clone = ball.cloneNode(true);
      clone.style.position = "fixed";
      clone.style.zIndex = "1000";
      clone.style.pointerEvents = "none";
      clone.style.width = startRect.width + "px";
      clone.style.height = startRect.height + "px";
      clone.style.left = startRect.left + "px";
      clone.style.top = startRect.top + "px";
      clone.style.transition = "all 0.45s cubic-bezier(0.34, 1.2, 0.64, 1)";
      document.body.appendChild(clone);

      ball.style.visibility = "hidden";
      ball.classList.add("in-group");

      requestAnimationFrame(function () {
        if (session !== animationSessionId) { clone.remove(); return; }
        var tx = endRect.left + endRect.width / 2 - startRect.width / 2;
        var ty = endRect.top + endRect.height / 2 - startRect.height / 2;
        clone.style.left = tx + "px";
        clone.style.top = ty + "px";
        clone.style.transform = "scale(0.75)";
      });

      setTimeout(function () {
        if (session !== animationSessionId) { clone.remove(); return; }
        clone.remove();
        ball.style.visibility = "visible";
        placeFootballInGroup(ball, groupIndex);
        if (callback) callback();
      }, 450);
    }

    function makeFootballDraggable(ball) {
      ball.addEventListener("pointerdown", function (e) {
        if (!isLocked || isAnimating || ball.classList.contains("in-group")) return;
        e.preventDefault();

        var rect = ball.getBoundingClientRect();
        var clone = ball.cloneNode(true);
        clone.style.position = "fixed";
        clone.style.zIndex = "1000";
        clone.style.pointerEvents = "none";
        clone.style.width = rect.width + "px";
        clone.style.height = rect.height + "px";
        clone.style.left = rect.left + "px";
        clone.style.top = rect.top + "px";
        document.body.appendChild(clone);
        ball.classList.add("dragging");

        var move = function (ev) {
          clone.style.left = (ev.clientX - rect.width / 2) + "px";
          clone.style.top = (ev.clientY - rect.height / 2) + "px";
          groups.forEach(function (gr) {
            gr.pitch.classList.toggle("over", hitTest(gr.pitch, ev.clientX, ev.clientY));
          });
        };

        var up = function (ev) {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          clone.remove();
          ball.classList.remove("dragging");
          var placed = false;
          for (var gi = 0; gi < groups.length; gi++) {
            groups[gi].pitch.classList.remove("over");
            if (!placed && hitTest(groups[gi].pitch, ev.clientX, ev.clientY)) {
              if (groups[gi].balls.length < PER_GROUP) {
                placeFootballInGroup(ball, gi);
              }
              placed = true;
            }
          }
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
    }

    function distributeOneRound(callback) {
      var remaining = Array.prototype.slice.call(fbPool.querySelectorAll(".p14-ball:not(.in-group)"));
      if (remaining.length === 0) {
        if (callback) callback();
        return;
      }

      var session = animationSessionId;
      var count = Math.min(GROUP_COUNT, remaining.length);
      var done = 0;

      for (var r = 0; r < count; r++) {
        (function (roundIdx) {
          var ball = remaining[roundIdx];
          var gi = roundIdx;
          setTimeout(function () {
            if (session !== animationSessionId) return;
            animateBallFly(ball, gi, function () {
              done++;
              if (done === count && callback) callback();
            });
          }, roundIdx * 65);
        })(r);
      }
    }

    btnLock.onclick = lockBasketballs;

    btnStep.onclick = function () {
      if (!isLocked || isAnimating) return;
      FX.click();
      isAnimating = true;
      btnStep.disabled = true;
      btnAuto.disabled = true;
      animationSessionId++;

      distributeOneRound(function () {
        isAnimating = false;
        distributedRound++;
        var remaining = fbPool.querySelectorAll(".p14-ball:not(.in-group)").length;
        if (remaining > 0) {
          btnStep.disabled = false;
          btnAuto.disabled = false;
        } else {
          syncStateAfterMove();
        }
      });
    };

    btnAuto.onclick = function () {
      if (!isLocked || isAnimating) return;
      FX.click();
      isAnimating = true;
      btnStep.disabled = true;
      btnAuto.disabled = true;
      animationSessionId++;
      var session = animationSessionId;

      function nextRound() {
        if (session !== animationSessionId) return;
        var remaining = fbPool.querySelectorAll(".p14-ball:not(.in-group)").length;
        if (remaining === 0) {
          isAnimating = false;
          syncStateAfterMove();
          return;
        }
        distributeOneRound(function () {
          setTimeout(nextRound, 150);
        });
      }
      nextRound();
    };

    btnReset.onclick = function () {
      FX.click();
      initScene();
    };

    initScene();
  }

  function fmtDuration(sec) {
    sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60;
    return m + "分" + (s < 10 ? "0" : "") + s + "秒";
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
