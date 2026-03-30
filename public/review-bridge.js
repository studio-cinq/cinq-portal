/**
 * Cinq Portal — Review Bridge
 * Add this script to client sites to enable accurate annotation positioning.
 *
 * Usage: <script src="https://portal.studiocinq.com/review-bridge.js"></script>
 *
 * Only activates when the site is loaded inside the Cinq review iframe.
 * Does nothing when loaded directly — zero impact on the live site.
 *
 * Works with any platform (Framer, Webflow, Squarespace, custom, etc.)
 * by using elementFromPoint to calculate absolute page positions.
 */
(function () {
  // Only run inside an iframe
  if (window === window.top) return;

  // Get the absolute Y position of a point on the page,
  // regardless of how scrolling is implemented
  function getAbsoluteY(vpX, vpY) {
    var el = document.elementFromPoint(vpX, vpY);
    if (!el) return { absY: vpY, pageHeight: window.innerHeight };

    // Walk up to get the element's absolute position on the page
    // getBoundingClientRect gives viewport-relative position
    var rect = el.getBoundingClientRect();

    // Find the scroll container by walking up parents
    var scrollTop = 0;
    var pageHeight = 0;
    var node = el;

    while (node && node !== document.body && node !== document.documentElement) {
      var parent = node.parentElement;
      if (parent) {
        var style = window.getComputedStyle(parent);
        var ov = style.overflowY;
        if ((ov === "auto" || ov === "scroll" || ov === "overlay" || ov === "hidden") &&
            parent.scrollHeight > parent.clientHeight + 10) {
          scrollTop += parent.scrollTop;
          if (parent.scrollHeight > pageHeight) {
            pageHeight = parent.scrollHeight;
          }
        }
      }
      node = parent;
    }

    // Also check window scroll
    var winScroll = window.scrollY || window.pageYOffset || 0;
    scrollTop += winScroll;

    // If we didn't find a big scroll container, use document height
    if (pageHeight === 0) {
      pageHeight = Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.scrollHeight,
        window.innerHeight
      );
    }

    // Absolute Y = viewport Y position + total scroll offset
    var absY = vpY + scrollTop;

    return { absY: Math.round(absY), pageHeight: Math.round(pageHeight), scrollTop: Math.round(scrollTop) };
  }

  // Listen for position queries from the parent review page
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "cinq-query-position") {
      var vpX = e.data.vpX;
      var vpY = e.data.vpY;
      var result = getAbsoluteY(vpX, vpY);
      window.parent.postMessage({
        type: "cinq-position-result",
        id: e.data.id,
        absY: result.absY,
        pageHeight: result.pageHeight,
        scrollTop: result.scrollTop
      }, "*");
    }
  });

  // Also continuously report scroll position (best effort)
  var lastY = -1;
  function sendScroll() {
    // Use the query mechanism on center of viewport to get current scroll
    var result = getAbsoluteY(window.innerWidth / 2, 0);
    var y = result.scrollTop;
    var h = result.pageHeight;
    if (y !== lastY) {
      lastY = y;
      window.parent.postMessage({ type: "cinq-scroll", y: y, h: h }, "*");
    }
  }

  // Capture all scroll events
  document.addEventListener("scroll", function () {
    requestAnimationFrame(sendScroll);
  }, true);

  window.addEventListener("scroll", function () {
    requestAnimationFrame(sendScroll);
  }, { passive: true });

  // Send initial after frameworks hydrate
  if (document.readyState === "complete") {
    setTimeout(sendScroll, 500);
  } else {
    window.addEventListener("load", function () { setTimeout(sendScroll, 500); });
  }
})();
