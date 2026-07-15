/*
 * SCORM runtime adapter
 * - Detects API_1484_11 (SCORM 2004) first, then API (SCORM 1.2)
 * - Falls back to localStorage for local / no-LMS preview
 * Exposes a single global: window.SCORM
 */
(function (global) {
  "use strict";

  var LS_KEY = "scorm_fallback_chengchufa";

  function findAPI(win, names, depth) {
    var tries = 0;
    while (win && tries < 12) {
      for (var i = 0; i < names.length; i++) {
        if (win[names[i]]) return { api: win[names[i]], name: names[i] };
      }
      if (win.parent && win.parent !== win) { win = win.parent; }
      else { break; }
      tries++;
    }
    return null;
  }

  function locate() {
    var found = findAPI(global, ["API_1484_11"]);
    if (found) return { api: found.api, version: "2004" };
    // opener chain (popup launch)
    if (global.opener) {
      found = findAPI(global.opener, ["API_1484_11"]);
      if (found) return { api: found.api, version: "2004" };
    }
    found = findAPI(global, ["API"]);
    if (found) return { api: found.api, version: "1.2" };
    if (global.opener) {
      found = findAPI(global.opener, ["API"]);
      if (found) return { api: found.api, version: "1.2" };
    }
    return null;
  }

  var located = locate();
  var api = located ? located.api : null;
  var version = located ? located.version : "local";
  var isLMS = !!api;
  var started = false;
  var finished = false;

  // key maps
  var K = version === "1.2"
    ? {
        lesson_location: "cmi.core.lesson_location",
        score_raw: "cmi.core.score.raw",
        score_min: "cmi.core.score.min",
        score_max: "cmi.core.score.max",
        completion: "cmi.core.lesson_status",   // 1.2 combines status
        success: "cmi.core.lesson_status",
        session_time: "cmi.core.session_time",
        suspend: "cmi.suspend_data"
      }
    : {
        lesson_location: "cmi.location",
        score_raw: "cmi.score.raw",
        score_min: "cmi.score.min",
        score_max: "cmi.score.max",
        score_scaled: "cmi.score.scaled",
        completion: "cmi.completion_status",
        success: "cmi.success_status",
        session_time: "cmi.session_time",
        suspend: "cmi.suspend_data",
        progress: "cmi.progress_measure"
      };

  function lsGet() {
    try { return JSON.parse(global.localStorage.getItem(LS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function lsSet(obj) {
    try { global.localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function callInit() {
    if (!api) return true;
    return version === "1.2" ? api.LMSInitialize("") : api.Initialize("");
  }
  function callGet(k) {
    if (!api) { return lsGet()[k] || ""; }
    return version === "1.2" ? api.LMSGetValue(k) : api.GetValue(k);
  }
  function callSet(k, v) {
    if (finished) return "false";
    if (!api) { var o = lsGet(); o[k] = v; lsSet(o); return "true"; }
    return version === "1.2" ? api.LMSSetValue(k, String(v)) : api.SetValue(k, String(v));
  }
  function callCommit() {
    if (finished) return "false";
    if (!api) return "true";
    return version === "1.2" ? api.LMSCommit("") : api.Commit("");
  }
  function callFinish() {
    if (finished) return "true";
    if (!api) { finished = true; return "true"; }
    var ok = version === "1.2" ? api.LMSFinish("") : api.Terminate("");
    finished = true;
    return ok;
  }

  // ISO8601 duration for 2004, HHHH:MM:SS for 1.2
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    if (version === "1.2") {
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      return pad(h) + ":" + pad(m) + ":" + pad(s);
    }
    var hh = Math.floor(sec / 3600);
    var mm = Math.floor((sec % 3600) / 60);
    var ss = sec % 60;
    return "PT" + (hh ? hh + "H" : "") + (mm ? mm + "M" : "") + ss + "S";
  }

  var SCORM = {
    version: version,
    isLMS: isLMS,
    _startedAt: Date.now(),

    isFinished: function () { return finished; },

    init: function () {
      if (started) return true;
      var ok = callInit();
      started = true;
      finished = false;
      this._startedAt = Date.now();
      callSet(K.score_min, 0);
      callSet(K.score_max, 100);
      if (version === "2004") callSet(K.completion, callGet(K.completion) || "incomplete");
      callCommit();
      return ok;
    },

    getLocation: function () { return callGet(K.lesson_location) || ""; },
    setLocation: function (loc) { callSet(K.lesson_location, loc); },

    getSuspend: function () {
      var raw = callGet(K.suspend);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
    setSuspend: function (obj) { callSet(K.suspend, JSON.stringify(obj)); },

    setScore: function (raw) {
      raw = Math.max(0, Math.min(100, Math.round(raw)));
      callSet(K.score_raw, raw);
      if (version === "2004") callSet(K.score_scaled, (raw / 100).toFixed(4));
    },

    setProgress: function (measure) {
      if (version === "2004") callSet(K.progress, Math.max(0, Math.min(1, measure)).toFixed(3));
    },

    setCompletion: function (done) {
      var status = done ? "completed" : "incomplete";
      callSet(K.completion, status);
    },

    setSuccess: function (passed) {
      if (version === "2004") { callSet(K.success, passed ? "passed" : "failed"); }
      else { callSet(K.completion, passed ? "passed" : "failed"); }
    },

    // record a single interaction (best-effort; ignored on fallback errors)
    recordInteraction: function (idx, id, type, learner, correct, result) {
      if (!isLMS || finished) return;
      try {
        if (version === "2004") {
          var b = "cmi.interactions." + idx + ".";
          callSet(b + "id", id);
          callSet(b + "type", type);
          callSet(b + "learner_response", learner);
          callSet(b + "result", correct ? "correct" : "incorrect");
        } else {
          var p = "cmi.interactions." + idx + ".";
          callSet(p + "id", id);
          callSet(p + "type", type);
          callSet(p + "student_response", learner);
          callSet(p + "result", correct ? "correct" : "wrong");
        }
      } catch (e) {}
    },

    commit: function () {
      if (finished) return "false";
      // push accumulated session time then commit
      var secs = (Date.now() - this._startedAt) / 1000;
      callSet(K.session_time, fmtTime(secs));
      return callCommit();
    },

    /** Finalize attempt: write session time, Commit, then Terminate/LMSFinish. */
    finish: function () {
      if (finished) return "true";
      var secs = (Date.now() - this._startedAt) / 1000;
      callSet(K.session_time, fmtTime(secs));
      if (version === "2004") {
        try { callSet("cmi.exit", "normal"); } catch (e) {}
      }
      callCommit();
      return callFinish();
    },

    elapsedSeconds: function () { return (Date.now() - this._startedAt) / 1000; }
  };

  // best-effort finish on unload (no-op if already submitted via report)
  global.addEventListener("beforeunload", function () {
    try { if (!finished) SCORM.finish(); } catch (e) {}
  });

  global.SCORM = SCORM;
})(window);
