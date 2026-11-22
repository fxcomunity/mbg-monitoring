/**
 * admin-auth.js — Guard sesi Admin Satgas MBG (dipakai semua halaman dashboard/admin/*)
 *
 * Tugas:
 *  1. Cek sesi ke api/auth_user(.php) — wajib role 'admin'.
 *     Role lain diarahkan ke dashboard masing-masing; belum login → auth/login.html.
 *  2. Cache profil singkat di localStorage/sessionStorage (key: mbg_session).
 *  3. Tandai <html class="dashboard-ready"> agar konten tampil (html disembunyikan via CSS).
 *  4. Intercept klik link logout & submit form demo (action="#") → toast peringatan.
 *
 * Include di <head> sebagai script sinkron agar guard berjalan sebelum render.
 */
(function () {
  var sessionKey = 'mbg_session';
  var localPhp = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  var authEndpoint = localPhp ? '../../api/auth_user.php' : '../../api/auth_user';

  function clearLocalSession() {
    try {
      sessionStorage.removeItem(sessionKey);
      localStorage.removeItem(sessionKey);
    } catch (error) {
      console.warn('Sesi lokal tidak dapat dibersihkan:', error);
    }
  }

  function readCachedSession() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey) || 'null');
      return cached && cached.role === 'admin' && cached.name && (!cached.exp || cached.exp > Date.now()) ? cached : null;
    } catch (error) {
      return null;
    }
  }

  var cachedSession = readCachedSession();
  if (cachedSession) document.documentElement.classList.add('dashboard-ready');

  fetch(authEndpoint, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  }).then(function (response) {
    if (!response.ok) throw new Error('Status autentikasi tidak tersedia.');
    return response.json();
  }).then(function (data) {
    var role = data && data.logged_in && data.user && data.user.role;
    if (['admin', 'sppg', 'user'].indexOf(role) < 0) {
      clearLocalSession();
      location.replace('../../auth/login.html');
      return;
    }
    if (role !== 'admin') {
      location.replace('../' + role + '/');
      return;
    }
    var profile = data.user;
    var sessionCache = {
      name: profile.full_name || profile.username,
      full_name: profile.full_name || profile.username,
      username: profile.username || '',
      role: profile.role,
      avatar_url: profile.avatar_url || '',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000
    };
    try {
      localStorage.setItem(sessionKey, JSON.stringify(sessionCache));
      sessionStorage.setItem(sessionKey, JSON.stringify(sessionCache));
    } catch (error) {
      console.warn('Sesi profil tidak dapat disimpan di browser.');
    }
    document.documentElement.classList.add('dashboard-ready');
  }).catch(function (error) {
    if (cachedSession) {
      console.warn('Dashboard tetap ditampilkan dari cache; sesi server belum dapat diverifikasi.', error);
      return;
    }
    location.replace('../../auth/login.html');
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href*="login.html"]');
    if (!link) return;
    clearLocalSession();
    fetch(authEndpoint + '?action=logout', {
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true
    }).catch(function (error) {
      console.error('Sesi tidak dapat diakhiri melalui server:', error);
    });
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    var handledForms = ['formSatgas', 'formSppg', 'formUploadUserAvatar', 'formUploadSppgLogo', 'sppgReplyForm', 'adminReplyForm'];
    if (!form || handledForms.indexOf(form.id) >= 0 || form.getAttribute('action') !== '#') return;
    event.preventDefault();
    var toast = document.getElementById('mbg-demo-toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'mbg-demo-toast';
    toast.className = 'fixed left-1/2 top-20 z-[99999] -translate-x-1/2 rounded-xl border border-amber-200 bg-white px-5 py-3 text-xs font-semibold text-slate-800 shadow-xl';
    toast.setAttribute('role', 'status');
    toast.textContent = 'Form ini belum terhubung ke penyimpanan server; perubahan tidak disimpan.';
    document.body.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 4000);
  }, true);
})();
