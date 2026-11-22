(function () {
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const siteRoot = new URL(document.querySelector('meta[name="site-root"]').content, location.href);
  const communicationRoot = new URL('dashboard/komunikasi/', siteRoot);
  const chatEndpoint = new URL(isLocal ? 'api/internal_chat.php' : 'api/internal_chat', siteRoot);
  const authEndpoint = new URL(isLocal ? 'api/auth_user.php' : 'api/auth_user', siteRoot);
  const passwordEndpoint = new URL(isLocal ? 'api/change_password.php' : 'api/change_password', siteRoot);
  const $ = (selector) => document.querySelector(selector);
  const workspace = $('.workspace');
  const incomingCallDialog = $('#incomingCallDialog');
  const groupCreateDialog = $('#groupCreateDialog');
  const communityCreateDialog = $('#communityCreateDialog');
  const state = {
    userId: 0,
    role: '',
    profile: null,
    directory: [],
    conversations: [],
    activeId: 0,
    activeConversation: null,
    lastMessageId: 0,
    search: '',
    roleFilter: 'all',
    unreadOnly: false,
    listView: 'chats',
    searchReturnView: 'chats',
    section: 'chats',
    archivedConversations: [],
    statuses: [],
    communities: [],
    calls: [],
    incomingCallId: 0,
    incomingConversationId: 0,
    selectedGroupIds: new Set(),
    audioContext: null,
    ringtoneTimer: null,
    notificationsEnabled: false,
    notifiedCalls: new Set(),
    aiHistory: [],
    pinnedIds: new Set(),
    usersFilter: 'all',
    usersSearch: '',
    statusViewer: null,
    statusPhoto: null
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function displayName(person) {
    return person.sppg_name || person.full_name || person.name || 'Akun MBG';
  }

  function initials(name) {
    return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'MB';
  }

  function normalizedRole(person) {
    return String(person?.role || '').trim().toLowerCase();
  }

  function roleLabel(person) {
    return normalizedRole(person) === 'admin' ? 'Admin Satgas' : 'Mitra SPPG';
  }

  function matchesPersonSearch(person, search) {
    if (!search) return true;
    const role = normalizedRole(person);
    const terms = [displayName(person), person.full_name || '', person.sppg_name || '', person.username || '', person.email || '', role, role === 'admin' ? 'admin satgas administrator' : 'sppg mitra dapur'].join(' ');
    return normalizeSearch(search).split(/\s+/).every((word) => normalizeSearch(terms).includes(word));
  }

  function normalizeSearch(value) {
    return String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('id');
  }

  function findAiDirectoryMatches(query) {
    const text = normalizeSearch(query);
    const isAdminQuery = /\b(admin|satgas|administrator)\b/.test(text);
    const isSppgQuery = /\b(sppg|mitra|dapur)\b/.test(text);
    const onlineOnly = /\b(online|aktif)\b/.test(text);
    const offlineOnly = /\b(offline)\b/.test(text);
    const searchWords = text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1
      && !['siapa', 'saja', 'akun', 'kontak', 'cari', 'tolong', 'nama', 'yang', 'ada', 'semua', 'lihat', 'tampilkan', 'online', 'offline', 'aktif', 'anggota', 'untuk', 'dengan', 'dari', 'pada', 'di', 'ke', 'dan', 'atau'].includes(word)
      && !['admin', 'satgas', 'administrator', 'sppg', 'mitra', 'dapur'].includes(word));
    const directoryIntent = isAdminQuery || isSppgQuery || /\b(akun|kontak|online|offline|anggota)\b/.test(text);
    if (!directoryIntent) return null;
    return state.directory.filter((person) => {
      const role = normalizedRole(person);
      if (isAdminQuery && role !== 'admin') return false;
      if (isSppgQuery && role !== 'sppg') return false;
      if (onlineOnly && !isOnline(person.is_online)) return false;
      if (offlineOnly && isOnline(person.is_online)) return false;
      const personText = normalizeSearch(`${displayName(person)} ${person.full_name || ''} ${person.sppg_name || ''} ${person.about || ''} ${role}`);
      return searchWords.every((word) => personText.includes(word));
    });
  }

  function safeAvatarUrl(person) {
    const value = typeof person?.avatar_url === 'string' ? person.avatar_url.trim() : '';
    if (!value) return '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value)) return value;
    try {
      const url = new URL(value, siteRoot);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch (error) {
      console.warn('URL foto profil tidak valid.');
    }
    return '';
  }

  function renderAvatar(element, person, fallback) {
    const source = safeAvatarUrl(person);
    element.replaceChildren();
    if (!source) {
      element.textContent = fallback;
      return;
    }
    const image = document.createElement('img');
    image.className = 'avatar-image';
    image.alt = '';
    image.src = source;
    image.addEventListener('error', () => {
      image.remove();
      element.textContent = fallback;
    }, { once: true });
    element.append(image);
  }

  function isOnline(value) {
    return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
  }

  function groupUrl(id) {
    return new URL(`grup/chat/${Number(id)}`, communicationRoot);
  }

  function sectionUrl(section) {
    const routes = {
      chats: 'chat/',
      updates: 'pembaruan',
      communities: 'komunitas',
      calls: 'panggilan',
      archives: 'arsip',
      users: 'user',
      ai: 'ai'
    };
    return new URL(routes[section] || routes.chats, communicationRoot);
  }

  function sectionFromPath(pathname = location.pathname) {
    const path = pathname.toLowerCase().replace(/\/+$/, '');
    const routes = {
      '/pembaruan': 'updates',
      '/komunitas': 'communities',
      '/panggilan': 'calls',
      '/arsip': 'archives',
      '/user': 'users',
      '/ai': 'ai'
    };
    const route = Object.entries(routes).find(([suffix]) => path.endsWith(`/komunikasi${suffix}`));
    const querySection = new URLSearchParams(location.search).get('section');
    return route?.[1] || (Object.values(routes).includes(querySection) ? querySection : 'chats');
  }

  function requestedConversationId() {
    const newRouteMatch = location.pathname.match(/\/komunikasi\/grup\/chat\/(\d+)\/?$/);
    if (newRouteMatch) return Number(newRouteMatch[1]);
    const routeMatch = location.pathname.match(/\/chat\/grup\/[^/]+\/(\d+)\/?$/);
    if (routeMatch) return Number(routeMatch[1]);
    const queryId = new URLSearchParams(location.search).get('conversation_id') || '';
    const queryMatch = queryId.match(/(?:^|\/)(\d+)\/?$/);
    return queryMatch ? Number(queryMatch[1]) : 0;
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    return date.toDateString() === now.toDateString()
      ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date)
      : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
      },
      ...options
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.status !== 'success') {
      if (response.status === 401 || response.status === 403) {
        location.replace(new URL('auth/login.html', siteRoot));
      }
      throw new Error(result?.message || `Permintaan gagal (HTTP ${response.status}).`);
    }
    return result;
  }

  function showError(container, message) {
    container.innerHTML = `<p class="no-contacts" role="status">${escapeHtml(message)}</p>`;
  }

  function renderDirectory() {
    const list = $('#contactList');
    const filtered = state.directory.filter((person) => {
      return matchesPersonSearch(person, state.search)
        && (state.roleFilter === 'all' || normalizedRole(person) === state.roleFilter);
    });
    $('#contactCount').textContent = filtered.length;
    if (!filtered.length) {
      showError(list, state.search ? 'Kontak tidak ditemukan.' : 'Belum ada akun Admin/SPPG lain yang aktif.');
      return;
    }
    list.innerHTML = filtered.map((person) => {
      const isSelf = Boolean(person.is_self) || Number(person.id) === state.userId;
      const name = displayName(person) + (isSelf ? ' (Anda)' : '');
      const online = isSelf || isOnline(person.is_online);
      const isAdmin = normalizedRole(person) === 'admin';
      const roleText = isAdmin ? 'Admin Satgas' : 'Mitra SPPG';
      return `
        <button class="contact-item" type="button" data-user-id="${Number(person.id)}">
          <span class="avatar ${isAdmin ? 'avatar-admin' : 'avatar-sppg'}${statusRingClass(person.id, isSelf)}" aria-hidden="true">${escapeHtml(initials(displayName(person)))}</span>
          <span class="contact-copy">
            <span class="contact-topline"><span class="contact-name">${escapeHtml(name)}</span>
              <span class="presence-label ${online ? 'is-online' : ''}"><i></i>${online ? 'Online' : 'Offline'}</span>
            </span>
            <span class="contact-preview">${roleText} · ${escapeHtml(person.about || (isSelf ? 'Pesan untuk diri sendiri' : 'Mulai percakapan'))}</span>
          </span>
        </button>`;
    }).join('');
    filtered.forEach((person) => {
      const avatar = list.querySelector(`[data-user-id="${Number(person.id)}"] .avatar`);
      if (avatar) renderAvatar(avatar, person, initials(displayName(person)));
    });
  }

  function renderGroupMembers() {
    const list = $('#groupMembers');
    const search = $('#groupMemberSearch').value.trim().toLowerCase();
    const people = state.directory.filter((person) => matchesPersonSearch(person, search));
    if (!people.length) {
      list.innerHTML = '<p class="group-no-members">Tidak ada akun yang cocok.</p>';
      return;
    }
    list.innerHTML = people.map((person) => {
      const id = Number(person.id);
      const name = displayName(person);
      const isAdmin = normalizedRole(person) === 'admin';
      return `<label class="group-member">
        <input type="checkbox" value="${id}" ${state.selectedGroupIds.has(id) ? 'checked' : ''}>
        <span class="avatar ${isAdmin ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(name))}</span>
        <span><strong>${escapeHtml(name)}</strong><small>${isAdmin ? 'Admin Satgas' : 'SPPG'}</small></span>
      </label>`;
    }).join('');
    people.forEach((person) => {
      const avatar = list.querySelector(`input[value="${Number(person.id)}"]`)?.parentElement.querySelector('.avatar');
      if (avatar) renderAvatar(avatar, person, initials(displayName(person)));
    });
  }

  function updateGroupSelectionCount() {
    const remaining = Math.max(0, 2 - state.selectedGroupIds.size);
    $('#groupSelectionCount').textContent = remaining
      ? `Pilih ${remaining} anggota lagi.`
      : `${state.selectedGroupIds.size} anggota dipilih.`;
  }

  function conversationName(conversation) {
    return conversation.kind === 'group'
      ? (conversation.name || 'Grup komunikasi')
      : (conversation.peer_name || displayName(state.directory.find((person) => Number(person.id) === Number(conversation.peer_id)) || {}));
  }

  function renderConversations() {
    renderConversationList($('#conversationList'), state.conversations, false);
  }

  function renderConversationList(list, conversations, archived) {
    const filtered = conversations.filter((conversation) => {
      const name = conversationName(conversation);
      const matchesSearch = `${name} ${conversation.last_message || ''} ${conversation.peer_role || ''} ${conversation.description || ''}`.toLocaleLowerCase('id').includes(state.search);
      return matchesSearch && (archived || !state.unreadOnly || Number(conversation.unread_count) > 0);
    }).sort((left, right) => Number(state.pinnedIds.has(Number(right.id))) - Number(state.pinnedIds.has(Number(left.id))));
    const showAiContact = !archived && !state.unreadOnly
      && normalizeSearch('AI MBG Asisten kecerdasan buatan').includes(normalizeSearch(state.search));

    const matchingContacts = (state.search && !archived)
      ? state.directory.filter((person) => matchesPersonSearch(person, state.search))
      : [];

    if (!archived) $('#conversationCount').textContent = filtered.length;
    if (!filtered.length && !showAiContact && !matchingContacts.length) {
      showError(list, archived ? 'Belum ada chat yang diarsipkan.' : state.unreadOnly ? 'Tidak ada pesan yang belum dibaca.' : (state.search ? 'Tidak ada percakapan atau kontak yang cocok.' : 'Belum ada percakapan. Pilih tab Kontak untuk memulai.'));
      return;
    }
    const aiContact = showAiContact ? `
      <button class="contact-item ai-contact-item" type="button" data-ai-contact>
        <img class="avatar ai-contact-avatar" src="assets/images/communication-ai.png" alt="">
        <span class="contact-copy">
          <span class="contact-topline"><span class="contact-name">AI MBG</span><span class="contact-time">Asisten</span></span>
          <span class="contact-preview">Tanya sesuatu kepada AI</span>
        </span>
      </button>` : '';

    const conversationsHtml = filtered.map((conversation) => {
      const name = conversationName(conversation);
      const unread = Number(conversation.unread_count) || 0;
      const type = conversation.kind === 'group' ? `Grup · ${conversation.member_count} anggota` : (conversation.peer_role === 'admin' ? 'Admin Satgas' : 'Mitra SPPG');
      const peerOnline = isOnline(conversation.peer_online);
      return `
        <div class="conversation-row">
          <button class="contact-item ${Number(conversation.id) === state.activeId ? 'is-selected' : ''}" type="button"
            aria-current="${Number(conversation.id) === state.activeId ? 'true' : 'false'}" data-conversation-id="${Number(conversation.id)}">
          <span class="avatar ${conversation.kind === 'group' ? 'avatar-coord' : conversation.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}${conversation.kind === 'direct' ? statusRingClass(conversation.peer_id, false) : ''}" aria-hidden="true">
            ${escapeHtml(conversation.kind === 'group' ? 'GR' : initials(name))}
          </span>
          <span class="contact-copy">
            <span class="contact-topline"><span class="contact-name">${escapeHtml(name)}</span><span class="contact-time">${escapeHtml(formatTime(conversation.updated_at))}</span></span>
            <span class="contact-preview-line">
              <span class="contact-preview">${escapeHtml(conversation.last_message || `${type}${conversation.kind === 'direct' ? (peerOnline ? ' · Online' : ' · Offline') : ''}`)}</span>
              ${unread ? `<span class="unread-count" aria-label="${unread} pesan belum dibaca">${unread}</span>` : ''}
            </span>
          </span>
          </button>
          <button class="archive-button" type="button" data-archive-id="${Number(conversation.id)}" data-archived="${archived}"
            aria-label="${archived ? 'Keluarkan dari arsip' : 'Arsipkan percakapan'}" title="${archived ? 'Keluarkan dari arsip' : 'Arsipkan'}">
            <span class="material-symbols-outlined" aria-hidden="true">${archived ? 'unarchive' : 'archive'}</span>
          </button>
        </div>`;
    }).join('');

    let contactsHtml = '';
    if (matchingContacts.length > 0) {
      contactsHtml = `
        <div class="contact-list-heading" style="margin-top:0.75rem;">Kontak Admin &amp; SPPG (${matchingContacts.length})</div>
        ` + matchingContacts.map((person) => {
          const isSelf = Boolean(person.is_self) || Number(person.id) === state.userId;
          const name = displayName(person) + (isSelf ? ' (Anda)' : '');
          const online = isSelf || isOnline(person.is_online);
          const isAdmin = normalizedRole(person) === 'admin';
          const roleText = isAdmin ? 'Admin Satgas' : 'Mitra SPPG';
          return `
            <button class="contact-item" type="button" data-user-id="${Number(person.id)}">
              <span class="avatar ${isAdmin ? 'avatar-admin' : 'avatar-sppg'}${statusRingClass(person.id, isSelf)}" aria-hidden="true">${escapeHtml(initials(displayName(person)))}</span>
              <span class="contact-copy">
                <span class="contact-topline"><span class="contact-name">${escapeHtml(name)}</span>
                  <span class="presence-label ${online ? 'is-online' : ''}"><i></i>${online ? 'Online' : 'Offline'}</span>
                </span>
                <span class="contact-preview">${roleText} · ${escapeHtml(person.about || (isSelf ? 'Pesan untuk diri sendiri' : 'Mulai percakapan'))}</span>
              </span>
            </button>`;
        }).join('');
    }

    list.innerHTML = aiContact + conversationsHtml + contactsHtml;

    filtered.forEach((conversation) => {
      if (conversation.kind !== 'direct') return;
      const item = Array.from(list.querySelectorAll('[data-conversation-id]'))
        .find((button) => Number(button.dataset.conversationId) === Number(conversation.id));
      const avatar = item?.querySelector('.avatar');
      const person = state.directory.find((entry) => Number(entry.id) === Number(conversation.peer_id))
        || { avatar_url: conversation.peer_avatar_url, full_name: conversationName(conversation), role: conversation.peer_role };
      if (avatar) renderAvatar(avatar, person, initials(conversationName(conversation)));
    });

    matchingContacts.forEach((person) => {
      const items = Array.from(list.querySelectorAll(`[data-user-id="${Number(person.id)}"]`));
      items.forEach((btn) => {
        const avatar = btn.querySelector('.avatar');
        if (avatar) renderAvatar(avatar, person, initials(displayName(person)));
      });
    });
  }

  /* ── Status ala WhatsApp ─────────────────────────────────
     Status dikelompokkan per rail: "a:{author_id}" untuk status
     pribadi dan "g:{conversation_id}" untuk status grup.
     Ring hijau = ada status belum dilihat, abu = sudah dilihat. */
  function statusRailKey(status) {
    return status.conversation_id ? `g:${Number(status.conversation_id)}` : `a:${Number(status.author_id)}`;
  }

  function statusRailGroups() {
    const groups = new Map();
    (state.statuses || []).forEach((status) => {
      const key = statusRailKey(status);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(status);
    });
    groups.forEach((items) => items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    return groups;
  }

  function statusIsViewed(status) {
    return status.viewed_by_me === true || status.viewed_by_me === 't' || status.viewed_by_me === 1;
  }

  function statusUnviewedAuthors() {
    const set = new Set();
    (state.statuses || []).forEach((status) => {
      if (!status.conversation_id && !statusIsViewed(status)) set.add(Number(status.author_id));
    });
    return set;
  }

  function statusRingClass(personId, isSelf) {
    if (isSelf) return '';
    return statusUnviewedAuthors().has(Number(personId)) ? ' wa-ring' : '';
  }

  function statusPerson(status) {
    return {
      avatar_url: status.author_avatar || '',
      full_name: status.author_name || 'Anggota',
      sppg_name: status.author_name || '',
      role: status.author_role || 'user'
    };
  }

  function renderStatusRail() {
    const rail = $('#statusRail');
    if (!rail) return;
    const groups = statusRailGroups();
    const tiles = [];

    const mine = groups.get(`a:${state.userId}`) || [];
    tiles.push(`<button class="status-tile" type="button" data-status-key="a:${state.userId}">
      <span class="status-ring ${mine.length ? 'has-status' : ''}">
        <span class="avatar avatar-small ${normalizedRole(state.profile) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" id="statusMyAvatar">${escapeHtml(initials(displayName(state.profile)))}</span>
      </span>
      <span class="status-tile-plus"><span class="material-symbols-outlined" aria-hidden="true">add</span></span>
      <span class="status-tile-name">Status saya</span>
      <span class="status-tile-time">${mine.length ? escapeHtml(formatTime(mine[mine.length - 1].created_at)) : 'Ketuk untuk membuat'}</span>
    </button>`);

    groups.forEach((items, key) => {
      if (key === `a:${state.userId}`) return;
      const latest = items[items.length - 1];
      const unviewed = items.some((item) => !statusIsViewed(item));
      if (key.startsWith('g:')) {
        const conversation = state.conversations.find((item) => Number(item.id) === Number(key.slice(2)));
        const name = conversation?.name || latest.group_name || 'Grup';
        tiles.push(`<button class="status-tile" type="button" data-status-key="${escapeHtml(key)}">
          <span class="status-ring ${unviewed ? 'has-status' : 'viewed'}">
            <span class="avatar avatar-small avatar-coord" aria-hidden="true">GR</span>
          </span>
          <span class="status-tile-name">${escapeHtml(name)}</span>
          <span class="status-tile-time">${escapeHtml(formatTime(latest.created_at))}</span>
        </button>`);
        return;
      }
      const person = statusPerson(latest);
      const name = displayName(person);
      tiles.push(`<button class="status-tile" type="button" data-status-key="${escapeHtml(key)}">
        <span class="status-ring ${unviewed ? 'has-status' : 'viewed'}">
          <span class="avatar avatar-small ${normalizedRole(person) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(name))}</span>
        </span>
        <span class="status-tile-name">${escapeHtml(name)}</span>
        <span class="status-tile-time">${escapeHtml(formatTime(latest.created_at))}</span>
      </button>`);
    });

    $('#statusRail').innerHTML = tiles.join('');

    const myAvatar = $('#statusMyAvatar');
    if (myAvatar) renderAvatar(myAvatar, state.profile, initials(displayName(state.profile)));
    document.querySelectorAll('#statusRail .status-tile:not([data-status-key="a:' + state.userId + '"])').forEach((tile) => {
      const avatar = tile.querySelector('.avatar');
      if (!avatar || tile.dataset.statusKey.startsWith('g:')) return;
      const authorId = Number(tile.dataset.statusKey.slice(2));
      const person = state.directory.find((entry) => Number(entry.id) === authorId)
        || statusPerson((groups.get(tile.dataset.statusKey) || [{}]).slice(-1)[0]);
      renderAvatar(avatar, person, initials(displayName(person)));
    });
  }

  function renderStatuses() {
    const wrap = $('#statusList');
    if (!wrap) return;
    if (!$('#statusRail')) wrap.innerHTML = '<div id="statusRail" class="status-rail"></div>';
    renderStatusRail();
    let hint = wrap.querySelector('.status-empty-hint');
    if (!state.statuses.length) {
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'no-contacts status-empty-hint';
        hint.textContent = 'Belum ada status. Bagikan kabar ke kontak atau grup.';
        wrap.prepend(hint);
      }
    } else if (hint) {
      hint.remove();
    }
  }

  /* ── Status viewer (layar penuh ala WA) ── */
  function statusViewerItems() {
    const viewer = state.statusViewer;
    if (!viewer) return [];
    return statusRailGroups().get(viewer.key) || [];
  }

  function closeStatusViewer() {
    const viewer = state.statusViewer;
    if (viewer?.timer) window.clearTimeout(viewer.timer);
    state.statusViewer = null;
    $('#statusViewer').hidden = true;
    document.body.style.overflow = '';
  }

  function markStatusesViewed(items) {
    const pending = items.filter((item) => !statusIsViewed(item));
    if (!pending.length) return;
    pending.forEach((item) => { item.viewed_by_me = true; });
    pending.forEach((item) => {
      request(chatEndpoint, { method: 'POST', body: JSON.stringify({ action: 'status_view', status_id: Number(item.id) }) })
        .catch((error) => console.warn('Status belum ditandai dibaca:', error.message));
    });
    renderStatusRail();
    renderConversations();
    renderDirectory();
  }

  function scheduleStatusAdvance() {
    const viewer = state.statusViewer;
    if (!viewer) return;
    if (viewer.timer) window.clearTimeout(viewer.timer);
    viewer.timer = window.setTimeout(() => {
      if (!state.statusViewer) return;
      if (state.statusViewer.index < statusViewerItems().length - 1) showStatusItem(state.statusViewer.index + 1);
      else closeStatusViewer();
    }, 5000);
  }

  function showStatusItem(index) {
    const viewer = state.statusViewer;
    if (!viewer) return;
    const items = statusViewerItems();
    if (index < 0 || index >= items.length) { closeStatusViewer(); return; }
    viewer.index = index;
    const status = items[index];

    document.querySelectorAll('#statusViewerProgress .status-progress-seg').forEach((seg, i) => {
      const fill = seg.querySelector('i');
      fill.style.transition = 'none';
      fill.style.width = i < index ? '100%' : '0%';
      void fill.offsetWidth;
      fill.style.transition = i === index ? 'width 5s linear' : 'none';
      if (i === index) fill.style.width = '100%';
    });

    const isMine = Number(status.author_id) === state.userId;
    $('#statusViewerName').textContent = isMine ? 'Status saya' : (status.author_name || 'Status');
    $('#statusViewerTime').textContent = `${isMine ? '' : (status.conversation_id ? `Grup · ${status.group_name || 'Grup'} · ` : '')}${formatTime(status.created_at)}`;
    $('#statusViewerCount').textContent = `${index + 1}/${items.length}`;
    $('#statusViewerDelete').hidden = !isMine;
    $('#statusReplyForm').hidden = isMine;

    const avatar = $('#statusViewerAvatar');
    const person = statusPerson(status);
    avatar.className = `avatar avatar-small ${normalizedRole(person) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
    renderAvatar(avatar, person, initials(status.author_name || 'MB'));

    const stage = $('#statusViewerStage');
    const caption = $('#statusViewerCaption');
    stage.innerHTML = '';
    if (status.media_type === 'image' && status.media_url) {
      const img = document.createElement('img');
      img.className = 'status-viewer-media';
      img.src = status.media_url;
      img.alt = 'Foto status';
      stage.append(img);
    } else {
      const text = document.createElement('div');
      text.className = 'status-viewer-text';
      const p = document.createElement('p');
      p.textContent = status.message || '';
      text.append(p);
      stage.append(text);
    }
    if (status.message && status.media_type === 'image') {
      caption.textContent = status.message;
      caption.hidden = false;
    } else {
      caption.hidden = true;
    }

    markStatusesViewed([status]);
    scheduleStatusAdvance();
  }

  function openStatusViewer(key) {
    const items = (statusRailGroups().get(key) || []).slice();
    if (!items.length) return;
    state.statusViewer = { key, index: 0, timer: null };
    const viewer = $('#statusViewer');
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';

    $('#statusViewerProgress').innerHTML = items.map(() =>
      '<span class="status-progress-seg"><i></i></span>').join('');
    showStatusItem(0);
  }

  function initStatusViewer() {
    const viewer = $('#statusViewer');
    if (!viewer) return;
    $('#statusViewerClose').addEventListener('click', closeStatusViewer);
    viewer.addEventListener('click', (event) => {
      if (event.target === viewer) closeStatusViewer();
    });
    $('#statusViewerStage').addEventListener('click', (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;
      const items = statusViewerItems();
      if (ratio < 0.35) {
        if (state.statusViewer.index > 0) showStatusItem(state.statusViewer.index - 1);
      } else if (state.statusViewer.index < items.length - 1) {
        showStatusItem(state.statusViewer.index + 1);
      } else {
        closeStatusViewer();
      }
    });
    $('#statusViewerDelete').addEventListener('click', async () => {
      const current = statusViewerItems()[state.statusViewer?.index];
      if (!current) return;
      try {
        await request(chatEndpoint, { method: 'POST', body: JSON.stringify({ action: 'status_delete', status_id: Number(current.id) }) });
        state.statuses = state.statuses.filter((item) => Number(item.id) !== Number(current.id));
        const items = statusViewerItems();
        if (!items.length) { closeStatusViewer(); renderStatusRail(); return; }
        const progress = $('#statusViewerProgress');
        progress.innerHTML = items.map(() => '<span class="status-progress-seg"><i></i></span>').join('');
        showStatusItem(Math.min(state.statusViewer.index, items.length - 1));
        renderStatusRail();
      } catch (error) {
        alert(error.message);
      }
    });
    $('#statusReplyForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = $('#statusReplyInput');
      const text = input.value.trim();
      if (!text || !state.statusViewer) return;
      const current = statusViewerItems()[state.statusViewer.index];
      if (!current) return;
      const send = event.submitter || event.target.querySelector('.send-button');
      try {
        let conversationId = current.conversation_id ? Number(current.conversation_id) : 0;
        if (!conversationId) {
          const direct = await request(chatEndpoint, {
            method: 'POST',
            body: JSON.stringify({ action: 'direct', user_id: Number(current.author_id) })
          });
          conversationId = Number(direct.conversation_id);
        }
        await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'send', conversation_id: conversationId, message: text })
        });
        input.value = '';
        await refreshConversations();
        if (state.section === 'chats') setSection('chats');
      } catch (error) {
        alert(error.message);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (!state.statusViewer || event.key !== 'Escape') return;
      closeStatusViewer();
    });
  }

  function renderCommunities() {
    const list = $('#communityList');
    if (!state.communities.length) {
      showError(list, 'Belum ada komunitas. Buat komunitas untuk mengumpulkan anggota dan grup koordinasi.');
      return;
    }
    list.innerHTML = state.communities.map((community) => {
      let groups = community.groups;
      if (typeof groups === 'string') {
        try { groups = JSON.parse(groups); } catch { groups = []; }
      }
      return `<article class="feature-card community-card">
        <span class="avatar avatar-coord" aria-hidden="true"><span class="material-symbols-outlined">diversity_3</span></span>
        <div class="feature-card-copy">
          <div class="feature-card-title"><strong>${escapeHtml(community.name)}</strong><span>${Number(community.member_count) || 0} anggota</span></div>
          <p>${escapeHtml(community.description || 'Komunitas koordinasi MBG')}</p>
          <div class="community-groups">${Array.isArray(groups) && groups.length ? groups.map((group) =>
            `<button class="community-group-link" type="button" data-community-group="${Number(group.id)}">${escapeHtml(group.name)}</button>`
          ).join('') : '<span>Belum ada grup koordinasi.</span>'}</div>
        </div>
      </article>`;
    }).join('');
  }

  
  async function callUser(userId) {
    try {
      const result = await request(chatEndpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'direct', user_id: Number(userId) })
      });
      const url = new URL('chat/telephone/', communicationRoot);
      url.searchParams.set('conversation_id', String(result.conversation_id));
      location.href = url.href;
    } catch (error) {
      alert(error.message);
    }
  }

  function renderUsersSection() {
    const list = $('#usersSectionList');
    if (!list) return;
    const search = state.usersSearch || '';
    const filtered = state.directory.filter((person) => {
      const matchRole = state.usersFilter === 'all' || normalizedRole(person) === state.usersFilter;
      return matchRole && matchesPersonSearch(person, search);
    });
    if (!filtered.length) {
      showError(list, search ? 'Tidak ada user yang cocok dengan pencarian.' : 'Belum ada akun Admin/SPPG yang terdaftar.');
      return;
    }
    list.innerHTML = filtered.map((person) => {
      const isSelf = Boolean(person.is_self) || Number(person.id) === state.userId;
      const name = displayName(person) + (isSelf ? ' (Anda)' : '');
      const online = isSelf || isOnline(person.is_online);
      const isAdmin = normalizedRole(person) === 'admin';
      const roleText = isAdmin ? 'Admin Satgas' : 'Mitra SPPG';
      return `
        <article class="feature-card user-directory-card" style="display:flex; align-items:center; gap:0.75rem; padding:0.85rem; border-radius:14px; margin-bottom:0.5rem;">
          <span class="avatar ${isAdmin ? 'avatar-admin' : 'avatar-sppg'}${statusRingClass(person.id, isSelf)}" aria-hidden="true">${escapeHtml(initials(displayName(person)))}</span>
          <div class="feature-card-copy" style="flex:1; min-width:0;">
            <div class="feature-card-title" style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:0.82rem;">${escapeHtml(name)}</strong>
              <span class="presence-label ${online ? 'is-online' : ''}"><i></i>${online ? 'Online' : 'Offline'}</span>
            </div>
            <p style="margin:0.25rem 0 0; font-size:0.65rem;">${roleText} · ${escapeHtml(person.about || (isSelf ? 'Akun Anda saat ini' : 'Akun komunikasi aktif'))}</p>
          </div>
          <button class="icon-button" type="button" data-user-direct="${Number(person.id)}" aria-label="Mulai chat dengan ${escapeHtml(displayName(person))}" title="Mulai chat">
            <span class="material-symbols-outlined">chat</span>
          </button>
          ${!isSelf ? `
          <button class="icon-button" type="button" data-user-call="${Number(person.id)}" aria-label="Telepon ${escapeHtml(displayName(person))}" title="Panggilan suara">
            <span class="material-symbols-outlined">call</span>
          </button>` : ''}
        </article>`;
    }).join('');

    filtered.forEach((person) => {
      const card = list.querySelector(`[data-user-direct="${Number(person.id)}"]`)?.closest('.user-directory-card');
      const avatar = card?.querySelector('.avatar');
      if (avatar) renderAvatar(avatar, person, initials(displayName(person)));
    });
  }

  function renderCallHistory() {
    const list = $('#callList');
    if (!state.calls.length) {
      showError(list, 'Belum ada riwayat panggilan.');
      return;
    }
    list.innerHTML = state.calls.map((call) => {
      const stateLabel = ({ ringing: 'Memanggil', active: 'Terhubung', declined: 'Ditolak', missed: 'Tidak terjawab', ended: 'Selesai' })[call.status] || 'Panggilan';
      return `<article class="feature-card call-history-card">
        <span class="avatar ${call.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(call.peer_name || 'MB'))}</span>
        <div class="feature-card-copy"><div class="feature-card-title"><strong>${escapeHtml(call.peer_name || 'Admin/SPPG')}</strong><time>${escapeHtml(formatTime(call.created_at))}</time></div><p>${escapeHtml(stateLabel)} · Suara</p></div>
        <button class="icon-button" type="button" data-call-conversation="${Number(call.conversation_id)}" aria-label="Panggil ${escapeHtml(call.peer_name || 'kontak')}"><span class="material-symbols-outlined">call</span></button>
      </article>`;
    }).join('');
  }

  function renderCommunityChoices() {
    $('#communityMembers').innerHTML = state.directory.map((person) => `
      <label class="group-member"><input type="checkbox" value="${Number(person.id)}">
        <span class="avatar ${person.role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(displayName(person)))}</span>
        <span><strong>${escapeHtml(displayName(person))}</strong><small>${person.role === 'admin' ? 'Admin' : 'SPPG'}</small></span>
      </label>`).join('') || '<p class="group-no-members">Belum ada anggota lain.</p>';
    const groups = state.conversations.filter((conversation) => conversation.kind === 'group');
    $('#communityGroups').innerHTML = groups.map((conversation) => `
      <label class="group-member"><input type="checkbox" value="${Number(conversation.id)}">
        <span class="avatar avatar-coord" aria-hidden="true">GR</span>
        <span><strong>${escapeHtml(conversation.name || 'Grup')}</strong><small>${Number(conversation.member_count) || 0} anggota</small></span>
      </label>`).join('') || '<p class="group-no-members">Buat grup chat terlebih dahulu agar dapat ditambahkan.</p>';
  }

  function renderStatusGroups() {
    const select = $('#statusGroup');
    const selected = select.value;
    select.innerHTML = '<option value="">Status saya · semua kontak internal</option>' +
      state.conversations.filter((conversation) => conversation.kind === 'group').map((conversation) =>
        `<option value="${Number(conversation.id)}">Status grup · ${escapeHtml(conversation.name || 'Grup')}</option>`
      ).join('');
    if (selected && [...select.options].some((option) => option.value === selected)) select.value = selected;
  }

  async function loadFeatureData(section) {
    if (section === 'updates') {
      const result = await request(`${chatEndpoint}?action=statuses`);
      state.statuses = result.data || [];
      renderStatuses();
    } else if (section === 'communities') {
      const result = await request(`${chatEndpoint}?action=communities`);
      state.communities = result.data || [];
      renderCommunities();
    } else if (section === 'calls') {
      const result = await request(`${chatEndpoint}?action=call_history`);
      state.calls = result.data || [];
      renderCallHistory();
    } else if (section === 'archives') {
      const result = await request(`${chatEndpoint}?action=conversations&archived=1`);
      state.archivedConversations = result.data || [];
      renderConversationList($('#archivedList'), state.archivedConversations, true);
    }
  }

  function appendAiMessage(role, text, pending = false) {
    const container = document.getElementById('aiMessages');
    const message = document.createElement('article');
    message.className = `ai-message ${role}${pending ? ' is-pending' : ''}`;
    if (role === 'assistant') {
      const avatar = document.createElement('img');
      avatar.src = 'assets/images/communication-ai.png';
      avatar.alt = '';
      avatar.width = 28; avatar.height = 28;
      message.append(avatar);
    }
    if (pending) {
      const dots = document.createElement('p');
      dots.innerHTML = '<span class="ai-typing-dots"><span></span><span></span><span></span></span>';
      message.append(dots);
    } else {
      const content = document.createElement('p');
      content.textContent = text;
      message.append(content);
    }
    container.append(message);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    return message;
  }

  function appendAiDirectoryResults(matches, query) {
    const rendered = matches.slice(0, 30);
    const summary = document.createElement('p');
    summary.className = 'ai-result-summary';
    summary.textContent = matches.length
      ? `${matches.length} kontak cocok dengan “${query}”. Ketuk kontak untuk membuka percakapan.${matches.length > rendered.length ? ` Menampilkan ${rendered.length} pertama.` : ''}`
      : `Tidak ada akun yang cocok dengan “${query}”. Coba nama, Admin, atau SPPG.`;
    const group = document.createElement('div');
    group.className = 'ai-account-results';
    rendered.forEach((person) => {
      const button = document.createElement('button');
      button.className = 'ai-account-card';
      button.type = 'button';
      button.dataset.userId = String(Number(person.id));
      const avatar = document.createElement('span');
      avatar.className = `avatar ${normalizedRole(person) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
      renderAvatar(avatar, person, initials(displayName(person)));
      const details = document.createElement('span');
      details.className = 'ai-account-details';
      const name = document.createElement('strong');
      name.textContent = displayName(person);
      const subtitle = document.createElement('small');
      subtitle.textContent = `${roleLabel(person)} · ${isOnline(person.is_online) ? 'Online' : 'Offline'}`;
      details.append(name, subtitle);
      button.append(avatar, details);
      group.append(button);
    });
    $('#aiMessages').append(summary, group);
    $('#aiMessages').scrollTop = $('#aiMessages').scrollHeight;
  }

  async function submitAiMessage(message) {
    const input = $('#aiMessageInput');
    const send = $('#aiSendButton');
    const notice = $('#aiNotice');
    const prompt = message.trim();
    if (!prompt) return;
    appendAiMessage('user', prompt);
    input.value = '';
    const directoryMatches = findAiDirectoryMatches(prompt);
    if (directoryMatches) {
      appendAiDirectoryResults(directoryMatches, prompt);
      notice.textContent = 'Pencarian akun berjalan privat di perangkat ini; data kontak tidak dikirim ke OpenRouter.';
      return;
    }
    send.disabled = true;
    notice.textContent = 'AI sedang mencari di direktori Admin/SPPG...';
    const pending = appendAiMessage('assistant', 'Sedang memeriksa direktori...', true);
    try {
      const result = await request(chatEndpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'ai_chat', message: prompt, history: state.aiHistory })
      });
      pending.remove();
      appendAiMessage('assistant', result.reply);
      state.aiHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: result.reply });
      state.aiHistory = state.aiHistory.slice(-8);
      notice.textContent = 'Asisten AI menjawab pertanyaan umum. Pencarian kontak tetap dilakukan secara privat di perangkat.';
    } catch (error) {
      pending.remove();
      appendAiMessage('assistant', error.message);
      notice.textContent = 'AI tidak dapat menjawab saat ini.';
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  function setSection(section, updateHistory = false) {
    state.section = section;
    if (updateHistory) history.pushState({ section }, '', sectionUrl(section));
    document.querySelectorAll('[data-section]').forEach((item) => item.classList.toggle('is-active', item.dataset.section === section));
    const featureSection = section !== 'chats';
    workspace.classList.toggle('has-feature', featureSection);
    $('#featurePanel').hidden = !featureSection;
    $('#chatPanel').hidden = featureSection;
    document.querySelectorAll('.feature-view').forEach((view) => { view.hidden = view.id !== `${section}View`; });
    $('#conversationSidebar').hidden = featureSection;
    if (!featureSection) {
      $('#conversationSidebar').hidden = false;
      return;
    }
    loadFeatureData(section).catch((error) => {
      if (section === 'ai') {
        $('#aiNotice').textContent = error.message;
        return;
      }
      const target = ({ updates: '#statusList', communities: '#communityList', calls: '#callList', archives: '#archivedList', users: '#usersSectionList' })[section];
      if (target) showError($(target), error.message);
    });
  }

  function stopRingtone() {
    if (state.ringtoneTimer) window.clearInterval(state.ringtoneTimer);
    state.ringtoneTimer = null;
  }

  async function playTone(pattern = 'incoming') {
    if (!state.notificationsEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!state.audioContext) state.audioContext = new AudioContext();
      if (state.audioContext.state === 'suspended') await state.audioContext.resume();
      const now = state.audioContext.currentTime;
      const frequencies = pattern === 'outgoing' ? [440, 480] : [660, 880];
      frequencies.forEach((frequency, index) => {
        const oscillator = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.18);
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.18 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.16);
        oscillator.connect(gain);
        gain.connect(state.audioContext.destination);
        oscillator.start(now + index * 0.18);
        oscillator.stop(now + index * 0.18 + 0.18);
      });
    } catch (error) {
      console.warn('Audio notifikasi tidak dapat diputar:', error.message);
    }
  }

  function startRingtone(pattern) {
    if (!state.notificationsEnabled || state.ringtoneTimer) return;
    playTone(pattern);
    state.ringtoneTimer = window.setInterval(() => playTone(pattern), 1800);
  }

  async function archiveConversation(conversationId, unarchive) {
    try {
      await request(chatEndpoint, {
        method: 'POST',
        body: JSON.stringify({ action: unarchive ? 'unarchive' : 'archive', conversation_id: conversationId })
      });
      await refreshConversations();
      if (state.section === 'archives') await loadFeatureData('archives');
      if (!unarchive && state.activeId === conversationId) {
        state.activeId = 0;
        state.activeConversation = null;
        $('#activeChat').hidden = true;
        $('#emptyChat').hidden = false;
        workspace.classList.remove('has-active-chat');
      }
      return true;
    } catch (error) {
      showError(state.section === 'archives' ? $('#archivedList') : $('#conversationList'), error.message);
      return false;
    }
  }

  function renderMessages(messages, append) {
    const list = $('#messageList');
    const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (!append) list.innerHTML = '';
    if (!messages.length && !append) {
      list.innerHTML = '<p class="message-empty">Belum ada pesan. Mulai percakapan sekarang.</p>';
      return;
    }
    const html = messages.map((message) => {
      const mine = Number(message.sender_id) === state.userId;
      return `<article class="message-bubble ${mine ? 'outgoing' : 'incoming'}">
        ${state.activeConversation?.kind === 'group' && !mine ? `<strong class="message-sender">${escapeHtml(message.sender_name || 'Anggota')}</strong>` : ''}
        <p>${escapeHtml(message.message)}</p>
        <span class="message-meta">${escapeHtml(formatTime(message.created_at))}${mine ? '<span class="material-symbols-outlined" aria-label="Terkirim">done_all</span>' : ''}</span>
      </article>`;
    }).join('');
    if (append) list.insertAdjacentHTML('beforeend', html);
    else list.innerHTML = html;
    if (!append || wasAtBottom) list.scrollTop = list.scrollHeight;
  }

  async function loadMessages(conversationId, initial = false) {
    const query = new URLSearchParams({
      action: 'messages',
      conversation_id: String(conversationId),
      after_id: initial ? '0' : String(state.lastMessageId)
    });
    const result = await request(`${chatEndpoint}?${query}`);
    const messages = result.data || [];
    if (initial) {
      state.lastMessageId = Number(messages[messages.length - 1]?.id) || 0;
      renderMessages(messages, false);
    } else if (messages.length) {
      state.lastMessageId = Number(messages[messages.length - 1].id) || state.lastMessageId;
      renderMessages(messages, true);
    }
  }

  async function refreshConversations() {
    const result = await request(`${chatEndpoint}?action=conversations`);
    state.conversations = result.data || [];
    renderConversations();
    renderStatusGroups();
    if (state.activeId) {
      const latest = state.conversations.find((conversation) => Number(conversation.id) === state.activeId);
      if (latest) {
        state.activeConversation = latest;
        $('#activeStatus').textContent = latest.kind === 'group'
          ? `Grup · ${latest.member_count} anggota`
          : `${latest.peer_role === 'admin' ? 'Admin' : 'SPPG'} · ${isOnline(latest.peer_online) ? 'Online' : 'Terakhir terlihat ' + formatTime(latest.peer_last_seen_at)}`;
      }

    }
  }

  async function refreshIncomingCall() {
    const result = await request(new URL('?action=call_pending', chatEndpoint));
    const incoming = result.data?.[0];
    if (!incoming) {
      state.incomingCallId = 0;
      state.incomingConversationId = 0;
      stopRingtone();
      if (incomingCallDialog.open) incomingCallDialog.close();
      return;
    }
    const callId = Number(incoming.id);
    if (callId === state.incomingCallId) return;
    state.incomingCallId = callId;
    state.incomingConversationId = Number(incoming.conversation_id) || 0;

    const callerName = incoming.caller_name || 'Admin/SPPG';
    const callerRole = incoming.caller_role === 'admin' ? 'Admin' : 'SPPG';
    $('#incomingCaller').textContent = callerName;
    $('#incomingCallStatus').textContent = `${callerRole} menelepon Anda (Panggilan Suara WebRTC)`;

    const phoneEl = $('#incomingCallPhone');
    if (phoneEl) {
      phoneEl.textContent = `Kontak: ${incoming.caller_phone || '0895404147521'}`;
      phoneEl.hidden = false;
    }

    const avatarEl = $('#incomingAvatar');
    if (avatarEl) {
      avatarEl.className = `avatar ${incoming.caller_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'} incoming-avatar-pulse`;
      if (incoming.caller_avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(incoming.caller_avatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        avatarEl.textContent = initials(callerName) || '☎';
      }
    }
    const muted = localStorage.getItem(`mbg-muted-conversation-${Number(incoming.conversation_id)}`) === 'true';
    if (state.notificationsEnabled && !muted) startRingtone('incoming');
    if (state.notificationsEnabled && !muted && document.hidden && 'Notification' in window && Notification.permission === 'granted' && !state.notifiedCalls.has(callId)) {
      state.notifiedCalls.add(callId);
      new Notification('Panggilan masuk · MBG Connect', { body: `${incoming.caller_name || 'Admin/SPPG'} menelepon Anda.` });
    }
    if (!incomingCallDialog.open) incomingCallDialog.showModal();
  }

  async function selectConversation(conversationId) {
    const conversation = state.conversations.find((item) => Number(item.id) === Number(conversationId));
    if (!conversation) return;
    state.activeId = Number(conversation.id);
    state.activeConversation = conversation;
    state.lastMessageId = 0;
    const name = conversationName(conversation);
    $('#activeAvatar').className = `avatar avatar-large ${conversation.kind === 'group' ? 'avatar-coord' : conversation.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
    const activePerson = conversation.kind === 'direct'
      ? state.directory.find((person) => Number(person.id) === Number(conversation.peer_id))
      : null;
    renderAvatar($('#activeAvatar'), activePerson, conversation.kind === 'group' ? 'GR' : initials(name));
    $('#activeName').textContent = name;
    $('#activeStatus').textContent = conversation.kind === 'group'
      ? `Grup · ${conversation.member_count} anggota`
      : `${conversation.peer_role === 'admin' ? 'Admin' : 'SPPG'} · ${isOnline(conversation.peer_online) ? 'Online' : 'Offline'}`;
    $('#activeAvatarButton').setAttribute('aria-label', `Lihat profil ${name}`);
    updateConversationMenu();
    $('#emptyChat').hidden = true;
    $('#activeChat').hidden = false;
    workspace.classList.add('has-active-chat');
    renderConversations();
    $('#messageList').innerHTML = '<p class="message-empty">Memuat pesan...</p>';
    try {
      await loadMessages(state.activeId, true);
      await refreshConversations();
    } catch (error) {
      showError($('#messageList'), error.message);
    }
  }

  async function startDirectChat(userId) {
    try {
      const result = await request(chatEndpoint, {
        method: 'POST',
        body: JSON.stringify({ action: 'direct', user_id: Number(userId) })
      });
      await refreshConversations();
      $('#conversationPane').hidden = false;
      $('#contactPane').hidden = true;
      state.listView = 'chats';
      document.querySelectorAll('[data-view]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === 'chats'));
      await selectConversation(Number(result.conversation_id));
    } catch (error) {
      showError($('#contactList'), error.message);
    }
  }

  function setListView(view, updateHistory = true) {
    state.listView = view;
    state.unreadOnly = false;
    $('#conversationPane').hidden = view !== 'chats';
    $('#contactPane').hidden = view !== 'contacts';
    document.querySelectorAll('[data-view]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === view));
    document.querySelectorAll('[data-filter="unread"]').forEach((tab) => tab.classList.remove('is-active'));
    renderConversations();
    renderDirectory();
    if (updateHistory) {
      const destination = new URL(view === 'contacts' ? 'Kontak' : 'chat/', communicationRoot);
      history.pushState({ listView: view }, '', destination);
    }
  }

  function showProfile(person, editable) {
    if (!person) return;
    const name = displayName(person);
    const isAdmin = normalizedRole(person) === 'admin';
    $('#profileName').textContent = name;
    $('#profileRole').textContent = roleLabel(person);
    $('#profileAvatar').className = `avatar profile-avatar ${isAdmin ? 'avatar-admin' : 'avatar-sppg'}`;
    renderAvatar($('#profileAvatar'), person, initials(name));
    $('#profileAbout').value = editable ? (person.about || '') : '';
    $('#profileAbout').hidden = !editable;
    $('#profileAboutLabel').hidden = !editable;
    $('#profileAboutReadOnly').textContent = person.about || (editable ? '' : 'Belum ada deskripsi.');
    $('#profileAboutReadOnly').hidden = editable;
    $('#profileActions').hidden = !editable;
    $('#profileError').hidden = true;
    $('#profileDialog').showModal();
  }

  function applyCommunicationTheme(theme) {
    const themes = ['default', 'ocean', 'violet', 'rose', 'amber'];
    const selected = themes.includes(theme) ? theme : 'default';
    document.documentElement.dataset.communicationTheme = selected;
    $('#communicationThemeSelect').value = selected;
    try {
      localStorage.setItem('mbg-communication-theme', selected);
    } catch (error) {
      console.warn('Tema komunikasi tidak dapat disimpan di perangkat ini:', error.message);
    }
  }

  function openSettings(view = 'profile') {
    const profile = state.profile || {};
    const name = displayName(profile);
    $('#settingsProfileName').textContent = name;
    $('#settingsProfileEmail').textContent = profile.email || 'Email tidak tersedia';
    $('#settingsProfileRole').textContent = roleLabel(profile);
    $('#settingsAbout').value = profile.about || '';
    $('#settingsProfileError').hidden = true;
    $('#settingsProfileAvatar').className = `avatar profile-avatar ${normalizedRole(profile) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
    renderAvatar($('#settingsProfileAvatar'), profile, initials(name));
    setSettingsTab(view);
    if (!$('#settingsDialog').open) $('#settingsDialog').showModal();
  }

  function setSettingsTab(tab) {
    document.querySelectorAll('[data-settings-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.settingsTab === tab);
    });
    document.querySelectorAll('[data-settings-view]').forEach((panel) => {
      panel.hidden = panel.dataset.settingsView !== tab;
    });
  }

  function activePeerProfile() {
    if (!state.activeConversation || state.activeConversation.kind !== 'direct') return null;
    return state.directory.find((person) => Number(person.id) === Number(state.activeConversation.peer_id))
      || {
        full_name: state.activeConversation.peer_name,
        role: state.activeConversation.peer_role
      };
  }

  function updateConversationMenu() {
    const hasConversation = Boolean(state.activeConversation);
    const muted = localStorage.getItem(`mbg-muted-conversation-${state.activeId}`) === 'true';
    const pinned = state.pinnedIds.has(state.activeId);
    $('#conversationMuteAction').setAttribute('aria-pressed', String(muted));
    $('#conversationMuteAction').querySelector('span:last-child').textContent = muted ? 'Aktifkan nada chat' : 'Bisukan nada chat';
    $('#conversationMuteAction').hidden = !hasConversation;
    $('#conversationPinAction').hidden = !hasConversation;
    $('#conversationPinAction').setAttribute('aria-pressed', String(pinned));
    $('#conversationPinAction').querySelector('span:last-child').textContent = pinned ? 'Lepas sematan chat' : 'Sematkan chat';
    $('#conversationSoundAction').setAttribute('aria-pressed', String(state.notificationsEnabled));
    $('#conversationMenuTitle').textContent = !hasConversation
      ? 'Opsi komunikasi'
      : state.activeConversation.kind === 'group' ? 'Opsi grup' : 'Opsi percakapan';
    $('#conversationProfileAction').hidden = !hasConversation || state.activeConversation.kind !== 'direct';
    $('#conversationMenuNotice').textContent = !hasConversation
      ? 'Cari kontak Admin/SPPG, buka asisten AI, atau atur suara notifikasi.'
      : state.activeConversation.kind === 'group'
      ? 'Ketuk foto grup untuk melihat profil dan deskripsi.'
      : 'Pengaturan suara berlaku untuk panggilan dan notifikasi chat ini.';
  }

  function routeToUnread(updateHistory = true) {
    state.unreadOnly = true;
    state.listView = 'chats';
    $('#conversationPane').hidden = false;
    $('#contactPane').hidden = true;
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === 'chats'));
    document.querySelectorAll('[data-filter="unread"]').forEach((item) => item.classList.add('is-active'));
    renderConversations();
    if (updateHistory) history.pushState({ unreadOnly: true }, '', new URL('sebelum-baca', communicationRoot));
  }

  function initInteractions() {
    $('#conversationList').addEventListener('click', (event) => {
      if (event.target.closest('[data-ai-contact]')) {
        setSection('ai', true);
        return;
      }
      const archiveButton = event.target.closest('[data-archive-id]');
      if (archiveButton) {
        event.preventDefault();
        event.stopPropagation();
        archiveConversation(Number(archiveButton.dataset.archiveId), false);
        return;
      }
      const userButton = event.target.closest('[data-user-id]');
      if (userButton) {
        startDirectChat(Number(userButton.dataset.userId));
        return;
      }
      const button = event.target.closest('[data-conversation-id]');
      if (!button) return;
      const conversationId = Number(button.dataset.conversationId);
      const conversation = state.conversations.find((item) => Number(item.id) === conversationId);
      if (conversation?.kind === 'group') {
        location.href = groupUrl(conversationId).href;
        return;
      }
      selectConversation(conversationId);
    });
    $('#contactList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-id]');
      if (button) startDirectChat(Number(button.dataset.userId));
    });
    $('#contactSearch').addEventListener('input', (event) => {
      state.search = event.target.value.trim().toLocaleLowerCase('id');
      state.roleFilter = 'all';
      document.querySelectorAll('#contactPane [data-filter]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.filter === 'all'));
      if (state.section !== 'chats') setSection('chats');
      renderConversations();
      renderDirectory();
    });
    document.querySelectorAll('[data-view]').forEach((tab) => tab.addEventListener('click', () => setListView(tab.dataset.view)));
    document.querySelectorAll('[data-section]').forEach((tab) => tab.addEventListener('click', () => setSection(tab.dataset.section, true)));
    $('#archivedList').addEventListener('click', (event) => {
      const archiveButton = event.target.closest('[data-archive-id]');
      if (archiveButton) {
        archiveConversation(Number(archiveButton.dataset.archiveId), true);
        return;
      }
      const button = event.target.closest('[data-conversation-id]');
      if (!button) return;
      const conversationId = Number(button.dataset.conversationId);
      archiveConversation(conversationId, true).then((unarchived) => {
        if (!unarchived) return;
        const conversation = state.conversations.find((item) => Number(item.id) === conversationId)
          || state.archivedConversations.find((item) => Number(item.id) === conversationId);
        if (conversation?.kind === 'group') location.href = groupUrl(conversationId).href;
        else {
          setSection('chats', true);
          selectConversation(conversationId);
        }
      });
    });
    $('#communityList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-community-group]');
      if (button) {
        const conversation = state.conversations.find((item) => Number(item.id) === Number(button.dataset.communityGroup));
        if (conversation) location.href = groupUrl(conversation.id).href;
      }
    });
    
    const usersSearchInput = $('#usersSectionSearch');
    if (usersSearchInput) {
      usersSearchInput.addEventListener('input', (event) => {
        state.usersSearch = event.target.value.trim().toLocaleLowerCase('id');
        renderUsersSection();
      });
    }
    document.querySelectorAll('[data-user-filter]').forEach((tab) => {
      tab.addEventListener('click', () => {
        state.usersFilter = tab.dataset.userFilter;
        document.querySelectorAll('[data-user-filter]').forEach((t) => t.classList.toggle('is-active', t.dataset.userFilter === state.usersFilter));
        renderUsersSection();
      });
    });
    const usersList = $('#usersSectionList');
    if (usersList) {
      usersList.addEventListener('click', (event) => {
        const directBtn = event.target.closest('[data-user-direct]');
        if (directBtn) {
          startDirectChat(Number(directBtn.dataset.userDirect));
          return;
        }
        const callBtn = event.target.closest('[data-user-call]');
        if (callBtn) {
          callUser(Number(callBtn.dataset.userCall));
          return;
        }
      });
    }

    $('#callList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-call-conversation]');
      if (!button) return;
      const url = new URL('chat/telephone/', communicationRoot);
      url.searchParams.set('conversation_id', button.dataset.callConversation);
      location.href = url.href;
    });
    document.querySelectorAll('#contactPane [data-filter]').forEach((tab) => tab.addEventListener('click', () => {
      state.roleFilter = tab.dataset.filter;
      document.querySelectorAll('#contactPane [data-filter]').forEach((item) => item.classList.toggle('is-active', item === tab));
      renderDirectory();
    }));
    document.querySelectorAll('[data-filter="unread"]').forEach((tab) => tab.addEventListener('click', () => {
      if (state.unreadOnly) setListView('chats');
      else routeToUnread();
    }));
    $('#sidebarProfileButton').addEventListener('click', () => openSettings());
    $('#closeSettingsDialog').addEventListener('click', () => $('#settingsDialog').close());

    async function triggerHelpCall() {
      const btn = $('#startHelpCallButton');
      const notice = $('#helpCallNotice');
      if (btn) {
        btn.disabled = true;
        const label = btn.querySelector('span:last-child');
        if (label) label.textContent = 'Menghubungkan...';
      }
      if (notice) {
        notice.textContent = 'Menghubungkan ke Admin Pusat Bantuan via WebRTC...';
        notice.classList.remove('is-error');
      }

      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'help_call_start' })
        });
        const url = new URL('chat/telephone/', communicationRoot);
        url.searchParams.set('call_id', String(result.call_id));
        url.searchParams.set('is_help', '1');
        location.href = url.href;
      } catch (err) {
        if (notice) {
          notice.textContent = err.message || 'Gagal memulai panggilan bantuan.';
          notice.classList.add('is-error');
        } else {
          alert(err.message || 'Gagal memulai panggilan bantuan.');
        }
        if (btn) {
          btn.disabled = false;
          const label = btn.querySelector('span:last-child');
          if (label) label.textContent = 'Panggil';
        }
      }
    }

    $('#startHelpCallButton')?.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHelpCall();
    });
    $('#helpCallCard')?.addEventListener('click', () => {
      triggerHelpCall();
    });
    document.querySelectorAll('[data-settings-tab]').forEach((button) => {
      button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab));
    });
    document.querySelectorAll('[data-open-settings-tab]').forEach((button) => {
      button.addEventListener('click', () => setSettingsTab(button.dataset.openSettingsTab));
    });
    $('#settingsProfileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const save = $('#saveSettingsProfile');
      const error = $('#settingsProfileError');
      error.hidden = true;
      save.disabled = true;
      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'profile_save', about: $('#settingsAbout').value.trim() })
        });
        state.profile.about = result.data.about;
        save.textContent = 'Tersimpan';
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        save.disabled = false;
        window.setTimeout(() => { save.textContent = 'Simpan About'; }, 1400);
      }
    });
    $('#settingsPasswordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = $('#settingsPasswordStatus');
      const submit = $('#saveSettingsPassword');
      status.hidden = true;
      if ($('#settingsNewPassword').value !== $('#settingsConfirmPassword').value) {
        status.textContent = 'Konfirmasi kata sandi baru belum cocok.';
        status.className = 'settings-status is-error';
        status.hidden = false;
        $('#settingsConfirmPassword').focus();
        return;
      }
      submit.disabled = true;
      try {
        const result = await request(passwordEndpoint, { method: 'POST', body: new FormData(form) });
        status.textContent = result.message || 'Kata sandi berhasil diperbarui. Silakan masuk kembali.';
        status.className = 'settings-status is-success';
        status.hidden = false;
        form.reset();
        window.setTimeout(() => location.replace(new URL('auth/login.html', siteRoot)), 1400);
      } catch (error) {
        status.textContent = error.message;
        status.className = 'settings-status is-error';
        status.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    $('#communicationThemeSelect').addEventListener('change', (event) => applyCommunicationTheme(event.target.value));
    $('#notificationSoundToggle').addEventListener('click', async () => {
      state.notificationsEnabled = !state.notificationsEnabled;
      const button = $('#notificationSoundToggle');
      button.setAttribute('aria-pressed', String(state.notificationsEnabled));
      button.querySelector('.material-symbols-outlined').textContent = state.notificationsEnabled ? 'notifications_active' : 'notifications_off';
      button.querySelector('.sound-label').textContent = state.notificationsEnabled ? 'Suara aktif' : 'Suara mati';
      updateConversationMenu();
      if (state.notificationsEnabled) {
        try {
          if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
          await playTone('incoming');
          if (state.incomingCallId) startRingtone('incoming');
        } catch (error) {
          console.warn('Izin audio notifikasi tidak tersedia:', error.message);
        }
      } else {
        stopRingtone();
      }
    });
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement
        && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (typing && event.key !== 'Escape') return;
      const key = event.key.toLowerCase();
      const ctrlAlt = event.ctrlKey && event.altKey;
      if (ctrlAlt && event.shiftKey && key === 'u') {
        event.preventDefault();
        setSection('chats', true);
        routeToUnread();
      } else if (ctrlAlt && event.shiftKey && key === 'm') {
        event.preventDefault();
        if (state.activeId) $('#conversationMuteAction').click();
      } else if (ctrlAlt && event.shiftKey && key === 'e') {
        event.preventDefault();
        if (state.activeId) archiveConversation(state.activeId, false);
      } else if ((ctrlAlt && key === '/') || (event.ctrlKey && event.shiftKey && key === 'f')) {
        event.preventDefault();
        setSection('chats', true);
        setListView('chats');
        $('#contactSearch').focus();
      } else if (ctrlAlt && event.shiftKey && key === 'n') {
        event.preventDefault();
        $('#newChatButton').click();
      } else if (ctrlAlt && !event.shiftKey && key === 'n') {
        event.preventDefault();
        setSection('chats', true);
        setListView('contacts');
        $('#contactSearch').focus();
      } else if (ctrlAlt && event.shiftKey && key === 'p') {
        event.preventDefault();
        if (state.activeId) $('#conversationPinAction').click();
      } else if (ctrlAlt && event.shiftKey && (event.code === 'BracketRight' || event.code === 'BracketLeft')) {
        event.preventDefault();
        const chats = state.conversations;
        if (!chats.length) return;
        const current = chats.findIndex((conversation) => Number(conversation.id) === state.activeId);
        const offset = event.code === 'BracketRight' ? 1 : -1;
        const next = chats[(current + offset + chats.length) % chats.length];
        selectConversation(Number(next.id));
      } else if (ctrlAlt && event.shiftKey && key === 'l') {
        event.preventDefault();
        setSection('chats', true);
        setListView('chats');
        $('#contactSearch').value = '';
        state.search = '';
        renderConversations();
        renderDirectory();
      } else if (ctrlAlt && key === 'p') {
        event.preventDefault();
        openSettings('profile');
      } else if (key === 'escape' && $('#settingsDialog').open) {
        $('#settingsDialog').close();
      } else if (key === 'escape' && workspace.classList.contains('has-active-chat')) {
        workspace.classList.remove('has-active-chat');
      }
    });
    $('#headerMoreButton').addEventListener('click', () => {
      updateConversationMenu();
      $('#conversationMenuDialog').showModal();
    });
    $('#activeAvatarButton').addEventListener('click', () => {
      if (state.activeConversation?.kind === 'group') {
        const group = state.activeConversation;
        showProfile({ full_name: group.name || 'Grup komunikasi', role: 'group', about: group.description || '' }, false);
        $('#profileRole').textContent = `Grup · ${Number(group.member_count) || 0} anggota`;
      } else {
        showProfile(activePeerProfile(), false);
      }
    });
    $('#closeProfileDialog').addEventListener('click', () => $('#profileDialog').close());
    $('#cancelProfile').addEventListener('click', () => $('#profileDialog').close());
    $('#profileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const save = $('#saveProfile');
      const error = $('#profileError');
      error.hidden = true;
      save.disabled = true;
      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'profile_save', about: $('#profileAbout').value.trim() })
        });
        state.profile.about = result.data.about;
        $('#profileAboutReadOnly').textContent = result.data.about;
        $('#profileDialog').close();
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        save.disabled = false;
      }
    });
    $('#conversationMenuButton').addEventListener('click', () => {
      updateConversationMenu();
      $('#conversationMenuDialog').showModal();
    });
    $('#closeConversationMenu').addEventListener('click', () => $('#conversationMenuDialog').close());
    $('#conversationProfileAction').addEventListener('click', () => {
      $('#conversationMenuDialog').close();
      showProfile(activePeerProfile(), false);
    });
    $('#conversationMuteAction').addEventListener('click', () => {
      if (!state.activeId) return;
      const key = `mbg-muted-conversation-${state.activeId}`;
      const muted = localStorage.getItem(key) !== 'true';
      localStorage.setItem(key, String(muted));
      if (state.incomingConversationId === state.activeId) {
        if (muted) stopRingtone();
        else if (state.notificationsEnabled) startRingtone('incoming');
      }
      updateConversationMenu();
    });
    $('#conversationPinAction').addEventListener('click', () => {
      if (!state.activeId) return;
      if (state.pinnedIds.has(state.activeId)) state.pinnedIds.delete(state.activeId);
      else state.pinnedIds.add(state.activeId);
      try {
        localStorage.setItem(`mbg-pinned-conversations-${state.userId}`, JSON.stringify([...state.pinnedIds]));
      } catch (error) {
        console.warn('Sematan chat tidak dapat disimpan di perangkat ini:', error.message);
      }
      renderConversations();
      updateConversationMenu();
    });
    $('#conversationSoundAction').addEventListener('click', () => $('#notificationSoundToggle').click());
    $('#aiContactsButton').addEventListener('click', () => {
      setSection('chats');
      setListView('contacts');
      $('#contactSearch').focus();
    });
    $('#aiMessages').addEventListener('click', (event) => {
      const account = event.target.closest('[data-user-id]');
      if (!account) return;
      setSection('chats', true);
      startDirectChat(Number(account.dataset.userId));
    });
    $('#aiChatForm').addEventListener('submit', (event) => {
      event.preventDefault();
      submitAiMessage($('#aiMessageInput').value);
    });
    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(location.search);
      const path = location.pathname.toLowerCase().replace(/\/+$/, '');
      if (params.get('view') === 'unread' || path.endsWith('/sebelum-baca')) {
        setSection('chats');
        routeToUnread(false);
      }
      else if (params.get('view') === 'contacts' || path.endsWith('/kontak')) {
        setSection('chats');
        setListView('contacts', false);
      } else {
        const section = sectionFromPath();
        if (section !== 'chats') setSection(section);
        else {
          setSection('chats');
          setListView('chats', false);
        }
      }
    });
    $('#newChatButton').addEventListener('click', () => {
      state.selectedGroupIds.clear();
      $('#groupName').value = '';
      $('#groupMemberSearch').value = '';
      $('#groupError').hidden = true;
      renderGroupMembers();
      updateGroupSelectionCount();
      groupCreateDialog.showModal();
      $('#groupName').focus();
    });
    $('#closeGroupDialog').addEventListener('click', () => groupCreateDialog.close());
    $('#cancelGroupCreate').addEventListener('click', () => groupCreateDialog.close());
    $('#groupMemberSearch').addEventListener('input', renderGroupMembers);
    $('#groupMembers').addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      const id = Number(checkbox.value);
      if (checkbox.checked) state.selectedGroupIds.add(id);
      else state.selectedGroupIds.delete(id);
      updateGroupSelectionCount();
    });
    $('#groupCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = $('#groupName').value.trim();
      const error = $('#groupError');
      error.hidden = true;
      if (!name || state.selectedGroupIds.size < 2) {
        error.textContent = !name ? 'Nama grup wajib diisi.' : 'Pilih minimal dua anggota Admin/SPPG.';
        error.hidden = false;
        return;
      }
      const button = $('#createGroupButton');
      button.disabled = true;
      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'group',
            name,
            member_ids: Array.from(state.selectedGroupIds)
          })
        });
        location.href = groupUrl(result.conversation_id).href;
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
    $('#newCommunityButton').addEventListener('click', () => {
      $('#communityName').value = '';
      $('#communityDescription').value = '';
      $('#communityError').hidden = true;
      renderCommunityChoices();
      communityCreateDialog.showModal();
      $('#communityName').focus();
    });
    $('#closeCommunityDialog').addEventListener('click', () => communityCreateDialog.close());
    $('#cancelCommunityCreate').addEventListener('click', () => communityCreateDialog.close());
    $('#communityCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = $('#createCommunityButton');
      const error = $('#communityError');
      error.hidden = true;
      button.disabled = true;
      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'community_create',
            name: $('#communityName').value.trim(),
            description: $('#communityDescription').value.trim(),
            member_ids: Array.from($('#communityMembers').querySelectorAll('input:checked'), (input) => Number(input.value)),
            conversation_ids: Array.from($('#communityGroups').querySelectorAll('input:checked'), (input) => Number(input.value))
          })
        });
        communityCreateDialog.close();
        await loadFeatureData('communities');
        $('#communityError').textContent = `Komunitas dibuat (ID ${result.community_id}).`;
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
    $('#statusList').addEventListener('click', (event) => {
      const tile = event.target.closest('[data-status-key]');
      if (!tile) return;
      const key = tile.dataset.statusKey;
      if (!(statusRailGroups().get(key) || []).length) {
        $('#statusMessage').focus();
        return;
      }
      openStatusViewer(key);
    });
    $('#statusPhotoButton').addEventListener('click', () => $('#statusPhotoInput').click());
    $('#statusPhotoInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        $('#statusError').textContent = 'Format foto harus JPG, PNG, atau WebP.';
        $('#statusError').hidden = false;
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        $('#statusError').textContent = 'Ukuran foto maksimal 3MB.';
        $('#statusError').hidden = false;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.statusPhoto = { dataUrl: String(reader.result) };
        $('#statusPhotoPreviewImg').src = state.statusPhoto.dataUrl;
        $('#statusPhotoPreview').hidden = false;
        $('#statusError').hidden = true;
      };
      reader.readAsDataURL(file);
    });
    $('#statusPhotoRemove').addEventListener('click', () => {
      state.statusPhoto = null;
      $('#statusPhotoPreview').hidden = true;
      $('#statusPhotoPreviewImg').removeAttribute('src');
    });
    $('#statusCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = $('#statusError');
      error.hidden = true;
      const message = $('#statusMessage').value.trim();
      if (!message && !state.statusPhoto) {
        error.textContent = 'Tulis status atau pilih foto terlebih dahulu.';
        error.hidden = false;
        return;
      }
      try {
        await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'status_create',
            message,
            media: state.statusPhoto?.dataUrl || '',
            conversation_id: $('#statusGroup').value || null
          })
        });
        $('#statusMessage').value = '';
        state.statusPhoto = null;
        $('#statusPhotoPreview').hidden = true;
        $('#statusPhotoPreviewImg').removeAttribute('src');
        await loadFeatureData('updates');
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      }
    });
    initStatusViewer();
    $('#refreshStatuses').addEventListener('click', () => loadFeatureData('updates').catch((error) => showError($('#statusList'), error.message)));
    $('#backToContacts').addEventListener('click', () => workspace.classList.remove('has-active-chat'));
    $('#startCallButton').addEventListener('click', () => {
      if (!state.activeId || state.activeConversation?.kind !== 'direct') return;
      const url = new URL('chat/telephone/', communicationRoot);
      url.searchParams.set('conversation_id', String(state.activeId));
      location.href = url.href;
    });
    $('#answerIncomingCall').addEventListener('click', () => {
      if (!state.incomingCallId) return;
      stopRingtone();
      const url = new URL('chat/telephone/', communicationRoot);
      url.searchParams.set('call_id', String(state.incomingCallId));
      url.searchParams.set('is_help', '1');
      location.href = url.href;
    });
    $('#declineIncomingCall').addEventListener('click', async () => {
      const callId = state.incomingCallId;
      if (!callId) return;
      try {
        await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'call_decline', call_id: callId })
        });
        state.incomingCallId = 0;
        state.incomingConversationId = 0;
        stopRingtone();
        incomingCallDialog.close();
      } catch (error) {
        $('#incomingCallStatus').textContent = error.message;
      }
    });
    $('#messageForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = $('#messageInput');
      const message = input.value.trim();
      if (!message || !state.activeId) return;
      const send = $('#sendButton');
      send.disabled = true;
      try {
        const result = await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({ action: 'send', conversation_id: state.activeId, message })
        });
        input.value = '';
        $('#chatNotice').textContent = 'Percakapan internal · pesan tersimpan di server';
        $('#chatNotice').classList.remove('is-error');
        state.lastMessageId = Number(result.data.id) || state.lastMessageId;
        renderMessages([result.data], true);
        await refreshConversations();
        input.focus();
      } catch (error) {
        const notice = $('#chatNotice');
        notice.textContent = `Pesan tidak terkirim: ${error.message}`;
        notice.classList.add('is-error');
      } finally {
        send.disabled = false;
      }
    });
  }

  async function initialize(role, user) {
    state.role = role;
    state.userId = Number(user.id) || 0;
    const roleLabel = role === 'admin' ? 'Admin Satgas' : 'Mitra SPPG';
    const dashboardPath = new URL(`dashboard/${role}/`, siteRoot).href;
    $('#roleBadge').textContent = roleLabel;
    $('#dashboardLink').href = dashboardPath;
    $('#dashboardLinkDesktop').href = dashboardPath;
    $('#dashboardLinkDesktop').setAttribute('aria-label', `Kembali ke dashboard ${roleLabel}`);
    $('#startCallButton').hidden = role !== 'admin' && role !== 'sppg';
    document.title = `Komunikasi ${roleLabel} — Radar MBG`;
    initInteractions();
    $('#conversationList').innerHTML = '<p class="no-contacts">Memuat percakapan...</p>';
    $('#contactList').innerHTML = '<p class="no-contacts">Memuat akun Admin/SPPG...</p>';
    try {
      const [identity, directory, conversations, statuses] = await Promise.all([
        request(`${chatEndpoint}?action=me`),
        request(`${chatEndpoint}?action=directory`),
        request(`${chatEndpoint}?action=conversations`),
        request(`${chatEndpoint}?action=statuses`).catch(() => ({ data: [] }))
      ]);
      state.userId = Number(identity.user_id) || state.userId;
      state.profile = identity.data || { ...user, role };
      try {
        const pinnedIds = JSON.parse(localStorage.getItem(`mbg-pinned-conversations-${state.userId}`) || '[]');
        state.pinnedIds = new Set(Array.isArray(pinnedIds) ? pinnedIds.map(Number).filter(Number.isSafeInteger) : []);
      } catch (error) {
        console.warn('Daftar chat tersemat tidak dapat dibaca:', error.message);
        state.pinnedIds.clear();
      }
      $('#sidebarProfileName').textContent = displayName(state.profile);
      $('#sidebarProfileAvatar').className = `avatar ${normalizedRole(state.profile) === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
      renderAvatar($('#sidebarProfileAvatar'), state.profile, initials(displayName(state.profile)));
      let savedTheme = 'default';
      try {
        savedTheme = localStorage.getItem('mbg-communication-theme') || 'default';
      } catch (error) {
        console.warn('Tema komunikasi tersimpan tidak dapat dibaca:', error.message);
      }
      applyCommunicationTheme(savedTheme);
      state.directory = directory.data || [];
      state.conversations = conversations.data || [];
      state.statuses = statuses.data || [];
      renderStatusRail();
      renderDirectory();
      renderGroupMembers();
      renderConversations();
      renderStatusGroups();
      renderCommunityChoices();
      const urlParams = new URLSearchParams(location.search);
      if (urlParams.get('settings') === 'help' || urlParams.get('tab') === 'help') {
        openSettings('help');
      }
      const requestedView = urlParams.get('view');
      const path = location.pathname.toLowerCase().replace(/\/+$/, '');
      if (requestedView === 'unread' || path.endsWith('/sebelum-baca')) routeToUnread(false);
      else if (requestedView === 'contacts' || path.endsWith('/kontak')) setListView('contacts', false);
      else setSection(sectionFromPath());
      const requestedConversation = requestedConversationId();
      if (requestedConversation > 0) await selectConversation(requestedConversation);
    } catch (error) {
      showError($('#conversationList'), error.message);
      showError($('#contactList'), error.message);
      $('#groupMembers').innerHTML = `<p class="group-no-members">${escapeHtml(error.message)}</p>`;
    }
    window.setInterval(() => {
      request(chatEndpoint, { method: 'POST', body: JSON.stringify({ action: 'presence' }) }).catch((error) => console.warn('Status kehadiran belum diperbarui:', error.message));
    }, 30000);
    window.setInterval(async () => {
      try {
        const tasks = [refreshConversations(), refreshIncomingCall()];
        if (state.activeId) tasks.push(loadMessages(state.activeId, false));
        if (state.section === 'calls') tasks.push(loadFeatureData('calls'));
        if (state.section === 'updates') tasks.push(loadFeatureData('updates'));
        if (state.section === 'archives') tasks.push(loadFeatureData('archives'));
        if (state.section === 'users') tasks.push(loadFeatureData('users'));
        await Promise.allSettled(tasks);
      } catch (error) {
        console.warn('Pembaruan percakapan gagal:', error.message);
      }
    }, 1500);
  }

  fetch(authEndpoint, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`Autentikasi gagal (HTTP ${response.status}).`);
      return response.json();
    })
    .then((data) => {
      const user = data?.user;
      const role = data?.logged_in && user?.role;
      if (role !== 'admin' && role !== 'sppg') {
        location.replace(role === 'user' ? new URL('dashboard/user/', siteRoot).href : new URL('auth/login.html', siteRoot).href);
        return;
      }
      initialize(role, user);
    })
    .catch((error) => {
      console.error('Gagal memverifikasi akses halaman komunikasi:', error);
      location.replace(new URL('auth/login.html', siteRoot).href);
    });
})();
