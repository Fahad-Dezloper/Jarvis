// Playback engine injected into the preview page. It is a self-contained
// script (no imports, no build step) delivered as a string.
//
// Constraints for editing the source below: it lives in String.raw, so do not
// use backticks or "${" inside it, and do not write "</script" anywhere.
//
// Time model: the runtime owns one master clock (ms from scene start). Every
// discovered animation is paused and positioned from that clock, so seek, step
// and playback all go through the same code path.
//
// Selector generation is original work (id -> tag.class -> ancestor chain ->
// :nth-of-type). CSS identifier escaping follows the algorithm published in the
// CSSOM specification. No third-party code is included.

export const RUNTIME_SOURCE: string = String.raw`
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  var win = window;
  var doc = win.document;

  // ---- pure helpers (copies of lib/runtime/pure.ts, checked by scripts/check-runtime.ts) ----

  function cssEscapeIdent(value) {
    var s = String(value);
    var first = s.charCodeAt(0);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var ch = s.charAt(i);
      if (c === 0) {
        out += '�';
      } else if ((c >= 1 && c <= 0x1f) || c === 0x7f || (i === 0 && c >= 0x30 && c <= 0x39) ||
                 (i === 1 && c >= 0x30 && c <= 0x39 && first === 0x2d)) {
        out += '\\' + c.toString(16) + ' ';
      } else if (i === 0 && s.length === 1 && c === 0x2d) {
        out += '\\' + ch;
      } else if (c >= 0x80 || c === 0x2d || c === 0x5f || (c >= 0x30 && c <= 0x39) ||
                 (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
        out += ch;
      } else {
        out += '\\' + ch;
      }
    }
    return out;
  }

  function isStableClass(name) {
    if (!name) return false;
    if (name.indexOf('mb-') === 0) return false;
    if (/^(css|sc|jsx|emotion|svelte|astro)-/i.test(name)) return false;
    if (name.charAt(0) === '_') return false;
    if (/(?:__|--)[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*$/.test(name)) return false;
    return true;
  }

  function isStableId(id) {
    if (!id) return false;
    if (id.charAt(0) === ':') return false;
    if (/^\d/.test(id)) return false;
    if (/\d{4,}/.test(id)) return false;
    if (/^(radix|headlessui|react-aria)/i.test(id)) return false;
    return true;
  }

  function segment(n, withNth) {
    if (n.id && isStableId(n.id)) return { text: '#' + cssEscapeIdent(n.id), abs: true };
    var text = n.tag;
    var stable = n.classes.filter(isStableClass).slice(0, 2);
    for (var i = 0; i < stable.length; i++) text += '.' + cssEscapeIdent(stable[i]);
    if (withNth && n.sameTag > 1) text += ':nth-of-type(' + n.nth + ')';
    return { text: text, abs: false };
  }

  function generateSelector(node, isUnique) {
    var levels = [];
    var n = node;
    while (n) {
      levels.push(n);
      if ((n.id && isStableId(n.id)) || n.tag === 'body' || n.tag === 'html') break;
      n = n.parent;
    }
    var last = '';
    for (var pass = 0; pass < 2; pass++) {
      var withNth = pass === 1;
      for (var k = 1; k <= levels.length; k++) {
        var parts = [];
        var abs = false;
        for (var i = k - 1; i >= 0; i--) {
          var s = segment(levels[i], withNth);
          parts.push(s.text);
          if (i === k - 1 && s.abs) abs = true;
        }
        last = parts.join(' > ');
        if (isUnique(last)) return last;
        if (abs) return last;
      }
    }
    return last;
  }

  function itemEndMs(item) {
    var dur = isFinite(item.durationMs) && item.durationMs > 0 ? item.durationMs : 0;
    var delay = isFinite(item.delayMs) ? item.delayMs : 0;
    var endDelay = item.endDelayMs && isFinite(item.endDelayMs) ? item.endDelayMs : 0;
    var start = item.startMs && isFinite(item.startMs) ? item.startMs : 0;
    var iters = item.iterations;
    var capped = !(typeof iters === 'number' && isFinite(iters));
    var count = capped ? 1 : Math.max(0, iters);
    return { endMs: start + delay + dur * count + endDelay, capped: capped };
  }

  function computeTotalMs(items) {
    var totalMs = 0;
    var cappedCount = 0;
    for (var i = 0; i < items.length; i++) {
      var r = itemEndMs(items[i]);
      if (r.capped) cappedCount++;
      if (r.endMs > totalMs) totalMs = r.endMs;
    }
    return { totalMs: totalMs, cappedCount: cappedCount };
  }

  function toKebab(name) {
    if (name === 'cssFloat') return 'float';
    if (name.indexOf('--') === 0) return name;
    return name.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  var KEYFRAME_META = ['offset', 'computedOffset', 'easing', 'composite'];

  function summarizeKeyframes(keyframes) {
    var seen = [];
    for (var i = 0; i < keyframes.length; i++) {
      var kf = keyframes[i];
      if (!kf) continue;
      for (var key in kf) {
        if (KEYFRAME_META.indexOf(key) !== -1) continue;
        var name = toKebab(key);
        if (seen.indexOf(name) === -1) seen.push(name);
      }
    }
    return seen;
  }

  var GSAP_RESERVED = [
    'duration', 'delay', 'ease', 'repeat', 'repeatDelay', 'yoyo', 'yoyoEase',
    'stagger', 'overwrite', 'paused', 'immediateRender', 'lazy', 'data', 'id',
    'keyframes', 'css', 'runBackwards', 'startAt', 'inherit', 'defaults',
    'reversed', 'repeatRefresh', 'scrollTrigger', 'motionPath', 'callbackScope',
    'parent', 'autoRevert', 'from', 'to', 'preserveAlpha'
  ];

  function gsapAnimatedProps(vars) {
    var out = [];
    if (!vars) return out;
    function add(k) { if (out.indexOf(k) === -1) out.push(k); }
    for (var key in vars) {
      if (GSAP_RESERVED.indexOf(key) !== -1) continue;
      if (/^on[A-Z]/.test(key)) continue;
      add(key);
    }
    var css = vars.css;
    if (css && typeof css === 'object') { for (var k2 in css) add(k2); }
    return out;
  }

  function parseClockValue(input) {
    if (input == null) return null;
    var s = String(input).trim();
    if (!s) return null;
    if (s === 'indefinite') return Infinity;
    var m = /^(-?\d+(?:\.\d+)?|-?\.\d+)(h|min|s|ms)?$/.exec(s);
    if (m) {
      var v = parseFloat(m[1]);
      var unit = m[2] || 's';
      if (unit === 'h') return v * 3600000;
      if (unit === 'min') return v * 60000;
      if (unit === 'ms') return v;
      return v * 1000;
    }
    m = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(s);
    if (m) {
      var h = m[1] ? parseInt(m[1], 10) : 0;
      return (h * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])) * 1000;
    }
    return null;
  }

  function parseSmilBegin(input) {
    if (!input) return 0;
    var first = String(input).split(';')[0];
    var v = parseClockValue(first);
    return v == null || !isFinite(v) ? 0 : v;
  }

  function buildLabel(props, target, infinite) {
    var what = props.length ? props.join(', ') : 'animation';
    var base = target ? what + ' on ' + target : what;
    return infinite ? base + ' (infinite, shown as 1 iteration)' : base;
  }

  if (win.__MB_PURE_ONLY__) {
    win.__mbPure = {
      cssEscapeIdent: cssEscapeIdent, isStableClass: isStableClass, isStableId: isStableId,
      generateSelector: generateSelector, itemEndMs: itemEndMs, computeTotalMs: computeTotalMs,
      toKebab: toKebab, summarizeKeyframes: summarizeKeyframes, gsapAnimatedProps: gsapAnimatedProps,
      parseClockValue: parseClockValue, parseSmilBegin: parseSmilBegin, buildLabel: buildLabel
    };
    return;
  }
  if (win.__motionBrief) return;
  win.__motionBrief = { version: 1 };

  // ---- messaging ----

  var errorsSeen = {};
  var errorCount = 0;

  function post(msg) {
    try {
      var p = win.parent;
      // The host page is unknown from inside a sandboxed frame, so the target
      // origin has to be '*'. Messages carry only animation metadata.
      if (p && p !== win) p.postMessage(msg, '*');
    } catch (e) { /* never throw into the page */ }
  }

  function fail(where, e) {
    try {
      var text = where + ': ' + (e && e.message ? e.message : String(e));
      if (errorsSeen[text] || errorCount >= 20) return;
      errorsSeen[text] = true;
      errorCount++;
      post({ type: 'mb:error', message: text });
    } catch (e2) { /* ignore */ }
  }

  // ---- state ----

  var entries = [];          // registered animations
  var byObject = [];         // [object, entry] pairs for de-duplication
  var counters = { css: 0, waapi: 0, gsap: 0, smil: 0 };
  var gsapTops = [];         // { obj, offsetSec }
  var svgRoots = [];
  var timeMs = 0;
  var totalMs = 0;
  var playing = false;
  var rate = 1;
  var lastFrame = null;
  var rafId = 0;
  var lastPostAt = 0;
  var lastSig = null;
  var scanTimer = 0;

  function lookup(obj) {
    for (var i = 0; i < byObject.length; i++) if (byObject[i][0] === obj) return byObject[i][1];
    return null;
  }

  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  // ---- selectors ----

  function toSelNode(el) {
    var parent = el.parentElement;
    var nth = 1;
    var same = 1;
    if (parent) {
      same = 0;
      var sibs = parent.children;
      for (var i = 0; i < sibs.length; i++) {
        if (sibs[i].localName === el.localName) {
          same++;
          if (sibs[i] === el) nth = same;
        }
      }
    }
    var tag = el.localName;
    var classes = [];
    try { classes = Array.prototype.slice.call(el.classList || []); } catch (e) { classes = []; }
    return {
      tag: tag,
      id: el.getAttribute ? (el.getAttribute('id') || null) : null,
      classes: classes,
      nth: nth,
      sameTag: same,
      parent: (!parent || tag === 'body' || tag === 'html') ? null : toSelNode(parent)
    };
  }

  function isUniqueSelector(sel) {
    try { return doc.querySelectorAll(sel).length === 1; } catch (e) { return false; }
  }

  function selectorFor(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      return generateSelector(toSelNode(el), isUniqueSelector);
    } catch (e) {
      fail('selector', e);
      return null;
    }
  }

  // ---- discovery ----

  function describeDoc(anim) {
    var eff = anim.effect;
    var timing = eff.getComputedTiming();
    var spec = eff.getTiming ? eff.getTiming() : {};
    var keyframes = [];
    try { keyframes = eff.getKeyframes ? eff.getKeyframes() : []; } catch (e) { keyframes = []; }
    var props = summarizeKeyframes(keyframes);
    var isCss = (typeof CSSAnimation !== 'undefined' && anim instanceof CSSAnimation) ||
                (typeof CSSTransition !== 'undefined' && anim instanceof CSSTransition);
    if (!props.length && typeof anim.transitionProperty === 'string') props = [anim.transitionProperty];
    var target = eff.target || null;
    var selector = selectorFor(target);
    if (selector && eff.pseudoElement) selector += eff.pseudoElement;
    var iterations = timing.iterations;
    var infinite = !isFinite(iterations);
    var info = {
      id: '',
      kind: isCss ? 'css' : 'waapi',
      label: buildLabel(props, selector, infinite),
      selector: selector,
      durationMs: num(timing.duration, 0),
      delayMs: num(timing.delay, 0),
      easing: String(spec.easing || timing.easing || 'linear'),
      iterations: iterations,
      properties: props
    };
    return { info: info, endDelayMs: num(timing.endDelay, 0) };
  }

  function docAnimAlive(anim) {
    return anim.playState !== 'idle' && !!anim.effect;
  }

  function isDocumentTimeline(anim) {
    if (typeof DocumentTimeline === 'undefined') return true;
    return !anim.timeline || anim.timeline instanceof DocumentTimeline;
  }

  function register(kind, obj, built) {
    counters[kind]++;
    built.info.id = kind + '-' + counters[kind];
    var entry = { kind: kind, obj: obj, info: built.info, endDelayMs: built.endDelayMs || 0, extra: built.extra || null, fresh: true };
    entries.push(entry);
    byObject.push([obj, entry]);
    return entry;
  }

  function scanDocument() {
    var list = [];
    try { list = doc.getAnimations ? doc.getAnimations() : []; } catch (e) { fail('getAnimations', e); }
    for (var i = 0; i < list.length; i++) {
      var anim = list[i];
      try {
        if (lookup(anim) || !anim.effect || !isDocumentTimeline(anim)) continue;
        var target = anim.effect.target;
        if (target && target.id === '__mb_overlay') continue;
        var built = describeDoc(anim);
        var entry = register(built.info.kind, anim, built);
        try { anim.pause(); } catch (e2) { fail('pause', e2); }
        entry.fresh = true;
      } catch (e) { fail('scan animation', e); }
    }
  }

  var GSAP_SKIP_EASE = 'custom';

  function easeName(ease) {
    if (typeof ease === 'string') return ease;
    if (typeof ease === 'function') return ease.custom ? GSAP_SKIP_EASE : (ease.name || GSAP_SKIP_EASE);
    return 'power1.out';
  }

  function scanGsap() {
    var g = win.gsap;
    if (!g || !g.globalTimeline) return;
    var tl = g.globalTimeline;
    var tweens = [];
    try { tweens = tl.getChildren(true, true, false); } catch (e) { fail('gsap getChildren', e); return; }

    var fresh = [];
    var i, tw, top, n;
    for (i = 0; i < tweens.length; i++) {
      tw = tweens[i];
      if (lookup(tw)) continue;
      top = tw;
      while (top.parent && top.parent !== tl) top = top.parent;
      if (top.parent !== tl) continue;
      fresh.push({ tw: tw, top: top });
    }
    if (!fresh.length) return;

    // Tweens found in the same pass share an origin, so a tween created later
    // in the page's life starts at 0 instead of at its wall-clock offset.
    var base = Infinity;
    for (i = 0; i < fresh.length; i++) {
      var st = fresh[i].top.startTime();
      if (st < base) base = st;
    }
    if (!isFinite(base)) base = 0;

    for (i = 0; i < fresh.length; i++) {
      try {
        tw = fresh[i].tw;
        top = fresh[i].top;
        var topRec = null;
        for (var t = 0; t < gsapTops.length; t++) if (gsapTops[t].obj === top) topRec = gsapTops[t];
        if (!topRec) {
          topRec = { obj: top, offsetSec: top.startTime() - base };
          gsapTops.push(topRec);
          try { top.pause(); } catch (e0) { fail('gsap pause', e0); }
        }
        var rel = 0;
        n = tw;
        while (n && n !== top) { rel += n.startTime(); n = n.parent; }
        var startSec = topRec.offsetSec + rel;
        var vars = tw.vars || {};
        var targets = [];
        try { targets = tw.targets ? tw.targets() : []; } catch (e1) { targets = []; }
        var first = targets.length && targets[0] && targets[0].nodeType === 1 ? targets[0] : null;
        var selector = selectorFor(first);
        if (selector && targets.length > 1) selector += ' (+' + (targets.length - 1) + ')';
        var props = gsapAnimatedProps(vars);
        var repeat = typeof tw.repeat === 'function' ? tw.repeat() : 0;
        var infinite = repeat === -1;
        var info = {
          id: '',
          kind: 'gsap',
          label: buildLabel(props, selector, infinite),
          selector: selector,
          durationMs: num(tw.duration(), 0) * 1000,
          delayMs: startSec * 1000,
          easing: easeName(vars.ease),
          iterations: infinite ? Infinity : repeat + 1,
          properties: props
        };
        register('gsap', tw, { info: info, extra: { top: topRec } });
      } catch (e) { fail('scan gsap', e); }
    }
  }

  function smilRoot(el) {
    var r = el;
    while (r.ownerSVGElement) r = r.ownerSVGElement;
    return r;
  }

  function scanSmil() {
    var nodes = [];
    try { nodes = doc.querySelectorAll('animate, animateTransform, animateMotion, animateColor, set'); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      try {
        if (lookup(el)) continue;
        var root = smilRoot(el);
        if (!root || typeof root.pauseAnimations !== 'function') continue;
        var target = el.targetElement || el.parentElement;
        var selector = selectorFor(target);
        var attr = el.getAttribute('attributeName');
        var name = el.localName;
        var props = attr ? [attr] : (name === 'animateMotion' ? ['motion-path'] : []);
        if (name === 'animateTransform') props = ['transform'];
        var dur = parseClockValue(el.getAttribute('dur'));
        var rc = el.getAttribute('repeatCount');
        var iterations = rc === 'indefinite' ? Infinity : num(rc, 1);
        var rd = parseClockValue(el.getAttribute('repeatDur'));
        if (rd === Infinity) iterations = Infinity;
        var durationMs = dur == null || !isFinite(dur) ? 0 : dur;
        if (name === 'set' && !durationMs) durationMs = 0;
        var info = {
          id: '',
          kind: 'smil',
          label: buildLabel(props, selector, !isFinite(iterations)),
          selector: selector,
          durationMs: durationMs,
          delayMs: parseSmilBegin(el.getAttribute('begin')),
          easing: el.getAttribute('calcMode') || (name === 'set' ? 'discrete' : 'linear'),
          iterations: iterations,
          properties: props
        };
        if (svgRoots.indexOf(root) === -1) svgRoots.push(root);
        register('smil', el, { info: info, extra: { root: root } });
      } catch (e2) { fail('scan smil', e2); }
    }
  }

  function alive(entry) {
    try {
      if (entry.kind === 'css' || entry.kind === 'waapi') return docAnimAlive(entry.obj);
      if (entry.kind === 'gsap') return !!entry.obj.parent && !!entry.extra.top.obj.parent;
      if (entry.kind === 'smil') return entry.obj.isConnected !== false;
    } catch (e) { return false; }
    return true;
  }

  function refreshInfo(entry) {
    // Cheap re-read of values that can change (GSAP durations, etc.).
    if (entry.kind === 'gsap') {
      try {
        var tw = entry.obj;
        var repeat = typeof tw.repeat === 'function' ? tw.repeat() : 0;
        entry.info.durationMs = num(tw.duration(), 0) * 1000;
        entry.info.iterations = repeat === -1 ? Infinity : repeat + 1;
      } catch (e) { /* keep previous */ }
    }
  }

  function computeTotals() {
    var items = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      refreshInfo(e);
      items.push({
        durationMs: e.info.durationMs,
        delayMs: e.info.delayMs,
        endDelayMs: e.endDelayMs,
        iterations: e.info.iterations
      });
    }
    return computeTotalMs(items);
  }

  function signature() {
    var parts = [];
    for (var i = 0; i < entries.length; i++) {
      var f = entries[i].info;
      parts.push([f.id, f.label, f.selector, f.durationMs, f.delayMs, f.easing, String(f.iterations), f.properties.join('|')].join('~'));
    }
    return parts.join('\n') + '\n#' + totalMs;
  }

  function postAnimations() {
    var list = [];
    for (var i = 0; i < entries.length; i++) {
      var f = entries[i].info;
      list.push({
        id: f.id, kind: f.kind, label: f.label, selector: f.selector,
        durationMs: f.durationMs, delayMs: f.delayMs, easing: f.easing,
        iterations: f.iterations, properties: f.properties.slice()
      });
    }
    post({ type: 'mb:animations', animations: list, totalMs: totalMs });
  }

  function scan(force) {
    try {
      var before = entries.length;
      scanDocument();
      scanGsap();
      scanSmil();
      var kept = [];
      for (var i = 0; i < entries.length; i++) {
        if (alive(entries[i])) kept.push(entries[i]);
      }
      var pruned = kept.length !== entries.length;
      if (pruned) {
        entries = kept;
        byObject = byObject.filter(function (p) { return kept.indexOf(p[1]) !== -1; });
      }
      totalMs = computeTotals().totalMs;
      if (timeMs > totalMs) timeMs = totalMs;
      if (entries.length !== before || pruned) applyTime(timeMs);
      var sig = signature();
      if (force || sig !== lastSig) {
        lastSig = sig;
        postAnimations();
      }
    } catch (e) { fail('scan', e); }
  }

  function scheduleScan() {
    if (scanTimer) win.clearTimeout(scanTimer);
    scanTimer = win.setTimeout(function () { scanTimer = 0; scan(false); }, 150);
  }

  // ---- applying time ----

  function applyTime(t) {
    var smilDone = [];
    var gsapDone = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      try {
        if (e.kind === 'css' || e.kind === 'waapi') {
          e.obj.currentTime = t;
        } else if (e.kind === 'gsap') {
          var top = e.extra.top;
          if (gsapDone.indexOf(top) === -1) {
            gsapDone.push(top);
            var local = t / 1000 - top.offsetSec;
            if (local < 0) local = 0;
            top.obj.totalTime(local, true);
          }
        } else if (e.kind === 'smil') {
          var root = e.extra.root;
          if (smilDone.indexOf(root) === -1) {
            smilDone.push(root);
            root.pauseAnimations();
            root.setCurrentTime(t / 1000);
          }
        }
        e.fresh = false;
      } catch (err) { fail('apply ' + e.kind, err); }
    }
  }

  function postTime(force) {
    var now = win.performance && win.performance.now ? win.performance.now() : Date.now();
    if (!force && now - lastPostAt < 33) return;
    lastPostAt = now;
    post({ type: 'mb:time', timeMs: timeMs, playing: playing });
  }

  function clampTime(t) {
    if (!isFinite(t)) return timeMs;
    return Math.max(0, Math.min(totalMs, t));
  }

  function tick(now) {
    rafId = 0;
    if (!playing) return;
    try {
      if (lastFrame == null) lastFrame = now;
      var dt = now - lastFrame;
      lastFrame = now;
      if (dt > 250) dt = 250;
      timeMs += dt * rate;
      var ended = false;
      if (timeMs >= totalMs) { timeMs = totalMs; ended = true; }
      applyTime(timeMs);
      if (ended) { playing = false; lastFrame = null; postTime(true); return; }
      postTime(false);
    } catch (e) { fail('tick', e); }
    if (playing) rafId = win.requestAnimationFrame(tick);
  }

  function startLoop() {
    lastFrame = null;
    if (!rafId) rafId = win.requestAnimationFrame(tick);
  }

  // ---- commands ----

  function cmdPlay() {
    if (totalMs <= 0) { playing = false; postTime(true); return; }
    if (timeMs >= totalMs) timeMs = 0;
    playing = true;
    applyTime(timeMs);
    startLoop();
    postTime(true);
  }

  function cmdPause() {
    playing = false;
    lastFrame = null;
    postTime(true);
  }

  function cmdSeek(t) {
    timeMs = clampTime(num(t, timeMs));
    applyTime(timeMs);
    lastFrame = null;
    postTime(true);
  }

  function cmdStep(d) {
    playing = false;
    lastFrame = null;
    cmdSeek(timeMs + num(d, 0));
  }

  function cmdRate(r) {
    var v = num(r, 1);
    rate = Math.max(0.05, Math.min(4, v));
    postTime(true);
  }

  function cmdRestart() {
    timeMs = 0;
    applyTime(0);
    if (totalMs > 0) { playing = true; startLoop(); }
    postTime(true);
  }

  // ---- element picking ----

  var pick = { on: false, box: null, label: null, hovered: null, raf: 0, prevCursor: '' };

  function labelFor(el) {
    var s = el.localName;
    if (el.id) s += '#' + el.id;
    var cls = el.classList && el.classList.length ? '.' + Array.prototype.slice.call(el.classList).slice(0, 2).join('.') : '';
    return s + cls;
  }

  function isOverlay(el) {
    return el && (el.id === '__mb_overlay' || (el.closest && el.closest('#__mb_overlay')));
  }

  function drawHover() {
    pick.raf = 0;
    var el = pick.hovered;
    if (!pick.on || !el || !pick.box) return;
    try {
      var r = el.getBoundingClientRect();
      var s = pick.box.style;
      s.display = 'block';
      s.left = r.left + 'px';
      s.top = r.top + 'px';
      s.width = r.width + 'px';
      s.height = r.height + 'px';
      pick.label.textContent = labelFor(el) + '  ' + Math.round(r.width) + ' x ' + Math.round(r.height);
      pick.label.style.top = r.top < 22 ? (r.height + 4) + 'px' : '-20px';
    } catch (e) { fail('hover', e); }
  }

  function onPickMove(ev) {
    var el = ev.target;
    if (!el || el.nodeType !== 1 || isOverlay(el)) return;
    pick.hovered = el;
    if (!pick.raf) pick.raf = win.requestAnimationFrame(drawHover);
  }

  function swallow(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  }

  function onPickClick(ev) {
    try {
      swallow(ev);
      var el = ev.target;
      if (!el || el.nodeType !== 1 || isOverlay(el)) return;
      var r = el.getBoundingClientRect();
      post({
        type: 'mb:element-picked',
        selector: selectorFor(el) || el.localName,
        tag: el.localName,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height }
      });
    } catch (e) { fail('pick', e); }
  }

  function setPick(enabled) {
    enabled = !!enabled;
    if (enabled === pick.on) return;
    pick.on = enabled;
    var root = doc.documentElement;
    if (enabled) {
      var box = doc.createElement('div');
      box.id = '__mb_overlay';
      box.setAttribute('style', 'position:fixed;display:none;z-index:2147483647;pointer-events:none;' +
        'box-sizing:border-box;border:2px solid #8b5cf6;background:rgba(139,92,246,0.15);border-radius:2px;');
      var label = doc.createElement('div');
      label.setAttribute('style', 'position:absolute;left:-2px;top:-20px;white-space:nowrap;font:11px/16px ui-monospace,monospace;' +
        'color:#fff;background:#7c3aed;padding:0 6px;border-radius:3px;pointer-events:none;');
      box.appendChild(label);
      root.appendChild(box);
      pick.box = box;
      pick.label = label;
      pick.prevCursor = root.style.cursor;
      root.style.cursor = 'crosshair';
      doc.addEventListener('mousemove', onPickMove, true);
      doc.addEventListener('click', onPickClick, true);
      doc.addEventListener('mousedown', swallow, true);
      doc.addEventListener('mouseup', swallow, true);
    } else {
      doc.removeEventListener('mousemove', onPickMove, true);
      doc.removeEventListener('click', onPickClick, true);
      doc.removeEventListener('mousedown', swallow, true);
      doc.removeEventListener('mouseup', swallow, true);
      if (pick.box && pick.box.parentNode) pick.box.parentNode.removeChild(pick.box);
      root.style.cursor = pick.prevCursor;
      pick.box = null;
      pick.label = null;
      pick.hovered = null;
    }
  }

  // ---- wiring ----

  win.addEventListener('message', function (ev) {
    try {
      if (ev.source !== win.parent) return;
      var d = ev.data;
      if (!d || typeof d.type !== 'string' || d.type.indexOf('mb:') !== 0) return;
      switch (d.type) {
        case 'mb:play': cmdPlay(); break;
        case 'mb:pause': cmdPause(); break;
        case 'mb:seek': cmdSeek(d.timeMs); break;
        case 'mb:step': cmdStep(d.deltaMs); break;
        case 'mb:rate': cmdRate(d.rate); break;
        case 'mb:restart': cmdRestart(); break;
        case 'mb:scan': scan(true); postTime(true); break;
        case 'mb:pick-mode': setPick(d.enabled); break;
        default: break;
      }
    } catch (e) { fail('command', e); }
  });

  try {
    ['animationstart', 'animationcancel', 'transitionrun', 'transitionstart'].forEach(function (name) {
      doc.addEventListener(name, scheduleScan, true);
    });
    if (win.MutationObserver) {
      new win.MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var t = records[i].target;
          if (isOverlay(t && t.nodeType === 1 ? t : null)) continue;
          scheduleScan();
          return;
        }
      }).observe(doc.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']
      });
    }
    if (doc.readyState !== 'complete') {
      win.addEventListener('load', function () { win.setTimeout(function () { scan(false); }, 100); });
    }
  } catch (e) { fail('observe', e); }

  post({ type: 'mb:ready' });
  scan(true);
  postTime(true);
})();
`;
