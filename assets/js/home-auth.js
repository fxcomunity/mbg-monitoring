(function () {
  const profileKey = 'mbg_profile_cache';
  const roles = {
    admin: { label: 'Admin Satgas BGN', dashboard: 'dashboard/admin/' },
    sppg: { label: 'Mitra Dapur SPPG', dashboard: 'dashboard/sppg/' },
    user: { label: 'Wali Murid / Publik', dashboard: 'dashboard/user/' }
  };
  const scriptUrl = document.currentScript.src;
  const appRoot = new URL('../../', scriptUrl);
  const apiUrl = new URL(location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'api/auth_user.php'
    : 'api/auth_user', appRoot);
  const fallbackAvatar = new URL('assets/images/ic_launcher.png', appRoot).href;

  function getCache() {
    try {
      const profile = JSON.parse(localStorage.getItem(profileKey) || 'null');
      return profile && roles[profile.role] && typeof profile.full_name === 'string' ? profile : null;
    } catch (error) {
      console.warn('Cache profil tidak dapat dibaca.');
      return null;
    }
  }

  function avatarUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return fallbackAvatar;
    try {
      const localPath = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const normalized = localPath ? value.replace(/^\/+/, '') : value;
      const url = new URL(normalized, appRoot);
      if (url.protocol === 'https:' || url.origin === location.origin) return url.href;
    } catch (_) {}
    return fallbackAvatar;
  }

  function render(profile) {
    const login = document.getElementById('navBtnLogin');
    const accountButton = document.getElementById('navUserBtn');
    const dropdown = document.getElementById('navUserDropdown');
    const mobileAccount = document.getElementById('mobileNavLogin');
    const name = profile.full_name || profile.username || 'Pengguna';
    const role = roles[profile.role];
    if (!login || !accountButton || !role) return;

    document.documentElement.classList.add('mbg-has-profile-cache');
    login.classList.add('hidden');
    accountButton.classList.remove('hidden');
    accountButton.classList.add('flex');
    accountButton.setAttribute('aria-label', 'Akun ' + name);

    [
      document.getElementById('navUserAvatar'),
      document.getElementById('dropAvatarLg'),
      mobileAccount && mobileAccount.querySelector('img')
    ]
      .filter(Boolean)
      .forEach((image) => {
        image.src = avatarUrl(profile.avatar_url || profile.avatar);
        image.alt = 'Foto profil ' + name;
        image.onerror = function () {
          this.onerror = null;
          this.src = fallbackAvatar;
        };
      });

    const navName = document.getElementById('navUserName');
    const navRole = document.getElementById('navUserRole');
    const dropName = document.getElementById('dropUserName');
    const dropRole = document.getElementById('dropUserRole');
    const dashboard = document.getElementById('dropDashboardLink');
    if (navName) navName.textContent = name;
    if (navRole) navRole.textContent = role.label;
    if (dropName) dropName.textContent = name;
    if (dropRole) dropRole.textContent = role.label;
    if (dashboard) dashboard.href = new URL(role.dashboard, appRoot).href;

    const adminSection = document.getElementById('dropAdminSection');
    if (adminSection) adminSection.classList.toggle('hidden', profile.role !== 'admin');
    if (mobileAccount) {
      mobileAccount.href = new URL(role.dashboard, appRoot).href;
      mobileAccount.setAttribute('aria-label', 'Dashboard ' + role.label);
      const mobileAvatar = mobileAccount.querySelector('img');
      if (mobileAvatar) mobileAvatar.alt = 'Foto profil ' + name;
      const label = mobileAccount.querySelector('span');
      if (label) label.textContent = name + ' · ' + role.label;
    }

    if (!accountButton.dataset.dropdownReady) {
      accountButton.dataset.dropdownReady = 'true';
      accountButton.addEventListener('click', function (event) {
        event.stopPropagation();
        const isOpen = !dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden', isOpen);
        accountButton.setAttribute('aria-expanded', String(!isOpen));
      });
      document.addEventListener('click', function () {
        dropdown.classList.add('hidden');
        accountButton.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function clearProfile() {
    try {
      localStorage.removeItem(profileKey);
      localStorage.removeItem('mbg_session');
      sessionStorage.removeItem('mbg_session');
    } catch (error) {
      console.warn('Cache profil tidak dapat dihapus.');
    }
    document.documentElement.classList.remove('mbg-has-profile-cache');
    const login = document.getElementById('navBtnLogin');
    const accountButton = document.getElementById('navUserBtn');
    const mobileAccount = document.getElementById('mobileNavLogin');
    if (login) login.classList.remove('hidden');
    if (accountButton) {
      accountButton.classList.add('hidden');
      accountButton.classList.remove('flex');
    }
    if (mobileAccount) {
      mobileAccount.href = new URL('auth/login.html', appRoot).href;
      const mobileAvatar = mobileAccount.querySelector('img');
      if (mobileAvatar) {
        mobileAvatar.src = fallbackAvatar;
        mobileAvatar.alt = '';
      }
      const label = mobileAccount.querySelector('span');
      if (label) label.textContent = 'Portal Masuk (User, SPPG & Admin)';
    }
  }

  function saveProfile(profile) {
    const safeProfile = {
      username: typeof profile.username === 'string' ? profile.username : '',
      full_name: typeof profile.full_name === 'string' ? profile.full_name : '',
      role: profile.role,
      role_label: typeof profile.role_label === 'string' ? profile.role_label : '',
      avatar_url: typeof profile.avatar_url === 'string' ? profile.avatar_url : '',
      avatar: typeof profile.avatar === 'string' ? profile.avatar : ''
    };
    try {
      localStorage.setItem(profileKey, JSON.stringify(safeProfile));
      const sessionCache = {
        name: safeProfile.full_name || safeProfile.username,
        full_name: safeProfile.full_name || safeProfile.username,
        username: safeProfile.username,
        role: safeProfile.role,
        avatar_url: safeProfile.avatar_url || safeProfile.avatar,
        avatar: safeProfile.avatar || safeProfile.avatar_url,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      localStorage.setItem('mbg_session', JSON.stringify(sessionCache));
      sessionStorage.setItem('mbg_session', JSON.stringify(sessionCache));
    } catch (error) {
      console.warn('Profil tidak dapat disimpan di browser.');
    }
    render(safeProfile);
  }

  const cached = getCache();
  if (cached) render(cached);

  const logout = document.getElementById('dropLogoutBtn');
  if (logout) {
    logout.addEventListener('click', function (event) {
      event.preventDefault();
      clearProfile();
      const logoutUrl = new URL(apiUrl.href);
      logoutUrl.searchParams.set('action', 'logout');
      fetch(logoutUrl, {
        credentials: 'same-origin',
        keepalive: true
      }).catch(function (error) {
        console.error('Sesi server tidak dapat diakhiri.', error);
      }).finally(function () {
        location.href = new URL('auth/login.html', appRoot).href;
      });
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 5000);
  fetch(apiUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    .then(function (response) {
      if (!response.ok) throw new Error('Status sesi server tidak tersedia.');
      return response.json();
    })
    .then(function (result) {
      if (result.logged_in && result.user && roles[result.user.role]) {
        saveProfile(result.user);
      } else if (result.logged_in === false) {
        clearProfile();
      }
    })
    .catch(function (error) {
      if (error.name !== 'AbortError') console.warn('Profil cache dipertahankan karena sesi server belum dapat diverifikasi.');
    })
    .finally(function () {
      clearTimeout(timeout);
    });
})();
