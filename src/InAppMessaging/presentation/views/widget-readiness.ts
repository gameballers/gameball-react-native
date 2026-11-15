/**
 * Injected into a reward campaign's WebView. Reports when the campaign is actually drawn.
 *
 * **Mirrored in the Flutter, iOS and Android SDKs.** It is inlined in each rather than shared, so
 * the numbers below are repeated everywhere and must be changed everywhere. They were expensive to
 * find; these comments are here so nobody tidies them away.
 *
 * Three things this encodes, all measured against the live widget:
 *
 * 1. **The content lives in `about:srcdoc` iframes.** A check that reads only the top document
 *    sits at about 209 nodes with zero text indefinitely and never fires. srcdoc inherits the
 *    parent's origin, so the frames stay reachable.
 *
 * 2. **The load passes through three stable plateaus**, so "the DOM stopped changing" cannot mean
 *    "loaded": a skeleton at `7/209/1/0/0` holds still for a full second, a half-built state at
 *    `6/254/1/0/35` for another, and only then the finished campaign at `6/267/1/3/104`.
 *
 * 3. **`sizedCanvas` is 1 from the very first sample** — it is the skeleton's placeholder.
 *    Including it in the content test made the predicate true throughout loading, and an OR is
 *    only ever as strict as its weakest term. `imgDone` and `textLen` are both 0 across the whole
 *    skeleton, which is why the test is `imgDone > 0 || textLen > 40`.
 *
 * The stability count is a secondary check, not the safeguard — no value of it can tell loading
 * from loaded when the loading state holds still for a second.
 *
 * **The fallback, not the first word.** A widget that posts `gameReady` says itself when the game
 * is on screen, and whichever comes first settles the view. This guess is for widgets that predate
 * that event, and it can miss: a game drawn on a canvas with under 40 characters of text — an
 * Arabic scratch card with no Arabic title, measured at `6/323/2/0/36` — never passes it. The
 * script also installs the `WidgetEvent` shim that event arrives through.
 */
export const READINESS_SCRIPT = `
(function () {
  if (window.__gbIamWatching) return;
  window.__gbIamWatching = true;

  function post(text) {
    try { window.ReactNativeWebView.postMessage(text); } catch (e) {}
  }

  function frames() {
    var out = [window];
    var els = document.querySelectorAll('iframe');
    for (var i = 0; i < els.length; i++) {
      try {
        var w = els[i].contentWindow;
        if (w && w.document) out.push(w);
      } catch (e) { /* cross-origin; nothing to read */ }
    }
    return out;
  }

  function shim(w) {
    try {
      if (w.__gbIamShimmed) return;
      w.__gbIamShimmed = true;
      w.WidgetEvent = w.WidgetEvent || {};
      w.WidgetEvent.postEvent = function (raw) { post('gb:event:' + String(raw)); };
      w.GameballWidget = w.GameballWidget || {};
      w.GameballWidget.closeWidget = function () { post('gb:close'); };
    } catch (e) {}
  }

  function fingerprint() {
    var fs = frames();
    var nodes = 0, sizedCanvas = 0, imgDone = 0, textLen = 0;
    for (var f = 0; f < fs.length; f++) {
      var w = fs[f];
      shim(w);
      try {
        var d = w.document;
        nodes += d.querySelectorAll('*').length;
        var cv = d.querySelectorAll('canvas');
        for (var j = 0; j < cv.length; j++) {
          if (cv[j].clientWidth > 0 && cv[j].clientHeight > 0) sizedCanvas++;
        }
        var ims = d.querySelectorAll('img');
        for (var i = 0; i < ims.length; i++) {
          if (ims[i].complete && ims[i].naturalWidth > 0) imgDone++;
        }
        if (d.body) textLen += (d.body.innerText || '').trim().length;
      } catch (e) {}
    }
    return {
      key: fs.length + '/' + nodes + '/' + sizedCanvas + '/' + imgDone + '/' + textLen,
      drawn: imgDone > 0 || textLen > 40
    };
  }

  var last = null, stable = 0, started = Date.now();
  function tick() {
    var fp = fingerprint();
    if (fp.key === last) { stable++; } else { stable = 0; last = fp.key; }

    if (fp.drawn && stable >= 3) { post('gb:ready'); return; }
    if (Date.now() - started > 12000) { post('gb:timeout'); return; }
    setTimeout(tick, 250);
  }
  setTimeout(tick, 250);
})();
true;
`;
