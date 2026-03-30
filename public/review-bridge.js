/**
 * Cinq Portal — Review Bridge
 * Add this script to client sites to enable accurate annotation positioning.
 *
 * Usage: <script src="https://portal.studiocinq.com/review-bridge.js"></script>
 *
 * Only activates when the site is loaded inside the Cinq review iframe.
 * Does nothing when loaded directly — zero impact on the live site.
 */
(function () {
  // Only run inside an iframe
  if (window === window.top) return;

  var last = -1;
  function send() {
    var y = Math.round(window.scrollY || window.pageYOffset || 0);
    var h = Math.round(
      Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      )
    );
    if (y !== last) {
      last = y;
      window.parent.postMessage({ type: "cinq-scroll", y: y, h: h }, "*");
    }
  }

  // Send initial position once DOM is ready
  if (document.readyState === "complete") {
    send();
  } else {
    window.addEventListener("load", send);
  }

  // Send on scroll (throttled)
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        send();
        ticking = false;
      });
    }
  }, { passive: true });

  // Send on resize (page height might change)
  window.addEventListener("resize", function () {
    last = -1;
    send();
  });
})();
