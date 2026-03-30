/**
 * Cinq Portal — Review Bridge
 * Add this script to client sites to enable accurate annotation positioning.
 *
 * Usage: <script src="https://portal.studiocinq.com/review-bridge.js"></script>
 *
 * Only activates when the site is loaded inside the Cinq review iframe.
 * Does nothing when loaded directly — zero impact on the live site.
 *
 * Supports native scroll, Framer, Webflow, and other platforms that use
 * custom scroll containers instead of native window scrolling.
 */
(function () {
  // Only run inside an iframe
  if (window === window.top) return;

  var scrollEl = null;
  var last = -1;

  // Find the actual scrolling element — handles Framer, Webflow, etc.
  function findScrollContainer() {
    // 1. Check if native window/document scrolling is in use
    if (document.scrollingElement && document.scrollingElement.scrollHeight > window.innerHeight + 10) {
      return document.scrollingElement;
    }

    // 2. Look for common framework scroll wrappers
    var candidates = document.querySelectorAll(
      '[data-framer-component-type], [data-scroll-container], [data-barba-container], .w-webflow-badge ~ *, main, #main, #__next > div, #app > div'
    );
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var style = window.getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
          el.scrollHeight > el.clientHeight + 10) {
        return el;
      }
    }

    // 3. Brute force: walk top-level elements for any scrollable container
    var all = document.querySelectorAll('body > *, body > * > *, body > * > * > *');
    for (var j = 0; j < all.length; j++) {
      var el2 = all[j];
      var s = window.getComputedStyle(el2);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowY === 'overlay') &&
          el2.scrollHeight > el2.clientHeight + 10) {
        return el2;
      }
    }

    // 4. Fallback to documentElement
    return document.documentElement;
  }

  function send() {
    if (!scrollEl) return;
    var y = Math.round(scrollEl === document.documentElement || scrollEl === document.body
      ? (window.scrollY || window.pageYOffset || 0)
      : scrollEl.scrollTop);
    var h = Math.round(scrollEl.scrollHeight);
    if (y !== last) {
      last = y;
      window.parent.postMessage({ type: "cinq-scroll", y: y, h: h }, "*");
    }
  }

  function init() {
    scrollEl = findScrollContainer();

    // Send initial position
    send();

    // Listen on both window scroll and the container scroll
    var ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          send();
          ticking = false;
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    if (scrollEl && scrollEl !== document.documentElement && scrollEl !== document.body) {
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
    }

    // Re-detect on resize (page height might change)
    window.addEventListener("resize", function () {
      scrollEl = findScrollContainer();
      last = -1;
      send();
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
