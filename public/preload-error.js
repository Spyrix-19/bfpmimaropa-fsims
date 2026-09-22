// If a lazily-loaded screen fails to download (e.g. an unvisited route while
// offline), hand over to the precached offline page instead of a blank screen.
// Kept as an external file so the Content-Security-Policy can forbid inline
// scripts entirely.
window.addEventListener("vite:preloadError", function (e) {
  if (!navigator.onLine) {
    e.preventDefault();
    location.replace("/offline.html?from=" + encodeURIComponent(location.pathname));
  }
});
