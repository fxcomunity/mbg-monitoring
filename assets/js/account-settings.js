(function () {
  'use strict';

  var appRoot = '../../';
  var localPhp = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  var apiBase = appRoot + 'api/';
  var authUrl = apiBase + (localPhp ? 'auth_user.php' : 'auth_user');
  var dashboardLink = document.getElementById('dashboardLink');
  var main = document.getElementById('account-main');
  var loading = document.getElementById('account-loading');
  var roleLabels = {
    admin: 'Admin Satgas BGN',
    sppg: 'Mitra Dapur SPPG',
    user: 'Wali Murid / Publik'
  };
  var fallbackAvatar = appRoot + 'assets/images/ic_launcher.png';

  function safeAvatar(value) {
    if (typeof value !== 'string' || !value.trim()) return fallbackAvatar;
    var image = value.trim();
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(image)) return image;
    if (/^uploads\/avatars\/[a-z0-9_.-]+$/i.test(image)) return appRoot + image;
    try {
      var url = new URL(image, document.baseURI);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch (error) {
      console.warn('URL foto profil tidak valid.');
    }
    return fallbackAvatar;
  }

  function showStatus(element, message, success) {
    element.textContent = message;
    element.className = 'rounded-xl px-4 py-3 text-sm ' + (success
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border border-red-200 bg-red-50 text-red-800');
  }

  function authRedirect() {
    location.replace(appRoot + 'auth/login.html');
  }

  async function loadAccount() {
    var response = await fetch(authUrl, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Status akun tidak dapat diverifikasi.');
    var result = await response.json();
    if (!result.logged_in || !result.user || !roleLabels[result.user.role]) {
      authRedirect();
      return;
    }

    var user = result.user;
    var role = user.role;
    if (dashboardLink) dashboardLink.href = '../' + role + '/index.html';
    document.getElementById('profile-name')?.replaceChildren(document.createTextNode(user.full_name || user.username || 'Pengguna'));
    document.getElementById('profile-detail-name')?.replaceChildren(document.createTextNode(user.full_name || '—'));
    document.getElementById('profile-username')?.replaceChildren(document.createTextNode(user.username || '—'));
    document.getElementById('profile-email')?.replaceChildren(document.createTextNode(user.email || 'Tidak tersedia'));
    document.getElementById('profile-role')?.replaceChildren(document.createTextNode(roleLabels[role]));
    document.getElementById('profile-role-detail')?.replaceChildren(document.createTextNode(roleLabels[role]));
    var avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.src = safeAvatar(user.avatar_url || user.avatar);
    if (role === 'sppg' && user.sppg_name) {
      document.getElementById('sppg-name-row')?.classList.remove('hidden');
      document.getElementById('profile-sppg')?.replaceChildren(document.createTextNode(user.sppg_name));
    }
    document.getElementById('password-user-label')?.replaceChildren(
      document.createTextNode((user.full_name || user.username || 'Akun') + ' · ' + roleLabels[role])
    );
    main?.classList.remove('hidden');
    loading?.setAttribute('hidden', '');
    if (role === 'sppg') {
      var help = document.getElementById('avatar-help');
      if (help) help.textContent = 'Perubahan foto profil SPPG akan menunggu persetujuan Admin Satgas. JPG, PNG, atau WebP, maksimal 5 MB.';
    }
  }

  var avatarForm = document.getElementById('avatar-form');
  if (avatarForm) {
    var fileInput = document.getElementById('avatar-file');
    var avatarImage = document.getElementById('profile-avatar');
    var status = document.getElementById('avatar-status');
    var submit = document.getElementById('avatar-submit');
    var priorAvatar = '';

    fileInput?.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        fileInput.value = '';
        showStatus(status, file.size > 5 * 1024 * 1024
          ? 'Ukuran foto maksimal 5 MB.'
          : 'Pilih file JPG, PNG, atau WebP yang valid.', false);
        return;
      }
      if (priorAvatar) URL.revokeObjectURL(priorAvatar);
      priorAvatar = URL.createObjectURL(file);
      avatarImage.src = priorAvatar;
      status.classList.add('hidden');
    });

    avatarForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!avatarForm.reportValidity()) return;
      submit.disabled = true;
      submit.lastElementChild.textContent = 'Menyimpan...';
      status.classList.remove('hidden');
      status.className = 'rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800';
      status.textContent = 'Mengunggah foto profil...';
      try {
        var response = await fetch(apiBase + (localPhp ? 'upload_avatar.php' : 'upload_avatar'), {
          method: 'POST',
          body: new FormData(avatarForm),
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });
        var result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Foto profil gagal disimpan.');
        }
        if (result.avatar_url) avatarImage.src = safeAvatar(result.avatar_url);
        var successMessage = result.message || 'Foto profil berhasil diperbarui.';
        showStatus(status, successMessage, true);
        avatarForm.reset();
      } catch (error) {
        showStatus(status, error.message || 'Foto profil gagal disimpan. Coba lagi.', false);
      } finally {
        submit.disabled = false;
        submit.lastElementChild.textContent = 'Simpan foto profil';
      }
    });
  }

  var passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    var status = document.getElementById('password-status');
    var submit = document.getElementById('password-submit');
    passwordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!passwordForm.reportValidity()) return;
      var formData = new FormData(passwordForm);
      if (formData.get('new_password') !== formData.get('confirm_password')) {
        showStatus(status, 'Konfirmasi kata sandi baru belum cocok.', false);
        document.getElementById('confirm-password')?.focus();
        return;
      }
      submit.disabled = true;
      submit.lastElementChild.textContent = 'Memperbarui...';
      status.classList.remove('hidden');
      status.className = 'rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800';
      status.textContent = 'Memverifikasi kata sandi saat ini...';
      try {
        var response = await fetch(apiBase + (localPhp ? 'change_password.php' : 'change_password'), {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });
        var result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Kata sandi gagal diperbarui.');
        }
        passwordForm.reset();
        showStatus(status, 'Kata sandi berhasil diperbarui. Silakan masuk kembali menggunakan kata sandi baru.', true);
        window.setTimeout(function () {
          location.replace(appRoot + 'auth/login.html');
        }, 1400);
      } catch (error) {
        showStatus(status, error.message || 'Kata sandi gagal diperbarui. Coba lagi.', false);
      } finally {
        submit.disabled = false;
        submit.lastElementChild.textContent = 'Simpan kata sandi baru';
      }
    });
  }

  loadAccount().catch(function (error) {
    console.error('Gagal memuat pengaturan akun:', error);
    if (loading) {
      loading.innerHTML = '<div class="max-w-sm rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl"><span class="material-symbols-outlined text-3xl text-red-600">error</span><p class="mt-3 text-sm font-bold text-slate-900">Pengaturan akun tidak dapat dimuat</p><p class="mt-2 text-xs leading-5 text-slate-600">Periksa koneksi lalu muat ulang halaman.</p><button type="button" class="mt-5 rounded-xl bg-[#001026] px-5 py-3 text-xs font-bold text-white" onclick="location.reload()">Coba lagi</button></div>';
    }
  });
})();
