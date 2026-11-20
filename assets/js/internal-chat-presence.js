(function () {
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const siteRoot = new URL('../../', location.href);
  const endpoint = new URL(isLocal ? 'api/internal_chat.php' : 'api/internal_chat', siteRoot);
  let stopped = false;

  async function sendPresence() {
    if (stopped) return;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'presence' })
      });
      if (response.status === 401 || response.status === 403) {
        stopped = true;
        return;
      }
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || `Status online gagal diperbarui (HTTP ${response.status}).`);
      }
    } catch (error) {
      console.warn('Status online komunikasi belum diperbarui:', error.message);
    }
  }

  sendPresence();
  window.setInterval(sendPresence, 30000);
  document.addEventListener('visibilitychange', sendPresence);
})();
