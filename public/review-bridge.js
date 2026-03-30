/**
 * Cinq Portal — Review Bridge
 * Add this script to client sites to enable accurate annotation positioning.
 *
 * Usage: <script src="https://portal.studiocinq.com/review-bridge.js"></script>
 *
 * Only activates when the site is loaded inside the Cinq review iframe.
 * Does nothing when loaded directly — zero impact on the live site.
 *
 * Works with native scroll, Framer, Webflow, Squarespace, and any platform
 * that uses custom scroll containers.
 */
(function () {
  // Only run inside an iframe
  if (window === window.top) return;

  var scrollEl = null;
  var lastY = -1;

  function send() {
    var y = 0;
    var h = 0;

    if (scrollEl && scrollEl !== document && scrollEl !== document.documentElement && scrollEl !== document.body) {
      // Custom scroll container (Framer, etc.)
      y = Math.round(scrollEl.scrollTop);
      h = Math.round(scrollEl.scrollHeight);
    } else {
      // Native window scrolling
      y = Math.round(window.scrollY || window.pageYOffset || 0);
      h = Math.round(Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.scrollHeight
      ));
    }

    if (y !== lastY) {
      lastY = y;
      window.parent.postMessage({ type: "cinq-scroll", y: y, h: h }, "*");
    }
  }

  // Capture scroll events on ANY element — this catches custom scroll containers
  // without needing to know the DOM structure in advance
  document.addEventListener("scroll", function (e) {
    var target = e.target;

    // If we catch a scroll on a real element (not document), use it
    if (target && target !== document && target !== document.documentElement) {
      // Only adopt it if it's taller than the viewport (it's the main scroller)
      if (target.scrollHeight > window.innerHeight) {
        scrollEl = target;
      }
    }

    send();
  }, true); // true = capture phase, catches all scroll events

  // Also listen on window for native scroll
  window.addEventListener("scroll", function () {
    if (!scrollEl) scrollEl = document.documentElement;
    send();
  }, { passive: true });

  // Send initial position after a short delay to let frameworks initialize
  function init() {
    // Try to find a scroll container proactively
    var els = document.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.scrollHeight > window.innerHeight + 50 && el.clientHeight > 0) {
        var style = window.getComputedStyle(el);
        var ov = style.overflowY;
        if (ov === "auto" || ov === "scroll" || ov === "overlay") {
          scrollEl = el;
          break;
        }
      }
    }
    send();
  }

  // Wait for page to be fully ready, then wait a bit more for framework hydration
  if (document.readyState === "complete") {
    setTimeout(init, 500);
  } else {
    window.addEventListener("load", function () {
      setTimeout(init, 500);
    });
  }
})();
