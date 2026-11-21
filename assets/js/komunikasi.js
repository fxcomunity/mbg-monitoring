(function () {
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const siteRoot = new URL(document.querySelector('meta[name="site-root"]').content, location.href);
  const communicationRoot = new URL('dashboard/komunikasi/', siteRoot);
  const chatEndpoint = new URL(isLocal ? 'api/internal_chat.php' : 'api/internal_chat', siteRoot);
  const authEndpoint = new URL(isLocal ? 'api/auth_user.php' : 'api/auth_user', siteRoot);
  const $ = (selector) => document.querySelector(selector);
  const workspace = $('.workspace');
  const incomingCallDialog = $('#incomingCallDialog');
  const groupCreateDialog = $('#groupCreateDialog');
  const communityCreateDialog = $('#communityCreateDialog');
  const state = {
    userId: 0,
    role: '',
    directory: [],
    conversations: [],
    activeId: 0,
    activeConversation: null,
    lastMessageId: 0,
    search: '',
    roleFilter: 'all',
    unreadOnly: false,
    listView: 'chats',
    section: 'chats',
    archivedConversations: [],
    statuses: [],
    communities: [],
    calls: [],
    incomingCallId: 0,
    selectedGroupIds: new Set(),
    audioContext: null,
    ringtoneTimer: null,
    notificationsEnabled: false,
    notifiedCalls: new Set()
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

  function isOnline(value) {
    return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
  }

  function groupUrl(id) {
    return new URL(`grup/chat/${Number(id)}`, communicationRoot);
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
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
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
      const name = displayName(person);
      const matchesSearch = `${name} ${person.role} ${person.sppg_name || ''}`.toLowerCase().includes(state.search);
      return matchesSearch && (state.roleFilter === 'all' || person.role === state.roleFilter);
    });
    $('#contactCount').textContent = filtered.length;
    if (!filtered.length) {
      showError(list, state.search ? 'Kontak tidak ditemukan.' : 'Belum ada akun Admin/SPPG lain yang aktif.');
      return;
    }
    list.innerHTML = filtered.map((person) => {
      const name = displayName(person);
      const online = isOnline(person.is_online);
      return `
        <button class="contact-item" type="button" data-user-id="${Number(person.id)}">
          <span class="avatar ${person.role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(name))}</span>
          <span class="contact-copy">
            <span class="contact-topline"><span class="contact-name">${escapeHtml(name)}</span>
              <span class="presence-label ${online ? 'is-online' : ''}"><i></i>${online ? 'Online' : 'Offline'}</span>
            </span>
            <span class="contact-preview">${person.role === 'admin' ? 'Admin' : 'SPPG'} · Mulai percakapan</span>
          </span>
        </button>`;
    }).join('');
  }

  function renderGroupMembers() {
    const list = $('#groupMembers');
    const search = $('#groupMemberSearch').value.trim().toLowerCase();
    const people = state.directory.filter((person) =>
      `${displayName(person)} ${person.role} ${person.sppg_name || ''}`.toLowerCase().includes(search)
    );
    if (!people.length) {
      list.innerHTML = '<p class="group-no-members">Tidak ada akun yang cocok.</p>';
      return;
    }
    list.innerHTML = people.map((person) => {
      const id = Number(person.id);
      const name = displayName(person);
      return `<label class="group-member">
        <input type="checkbox" value="${id}" ${state.selectedGroupIds.has(id) ? 'checked' : ''}>
        <span class="avatar ${person.role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(name))}</span>
        <span><strong>${escapeHtml(name)}</strong><small>${person.role === 'admin' ? 'Admin' : 'SPPG'}</small></span>
      </label>`;
    }).join('');
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
      const matchesSearch = `${name} ${conversation.last_message || ''}`.toLowerCase().includes(state.search);
      return matchesSearch && (archived || !state.unreadOnly || Number(conversation.unread_count) > 0);
    });
    if (!archived) $('#conversationCount').textContent = filtered.length;
    if (!filtered.length) {
      showError(list, archived ? 'Belum ada chat yang diarsipkan.' : state.unreadOnly ? 'Tidak ada pesan yang belum dibaca.' : 'Belum ada percakapan. Pilih tab Kontak untuk memulai.');
      return;
    }
    list.innerHTML = filtered.map((conversation) => {
      const name = conversationName(conversation);
      const unread = Number(conversation.unread_count) || 0;
      const type = conversation.kind === 'group' ? `Grup · ${conversation.member_count} anggota` : (conversation.peer_role === 'admin' ? 'Admin' : 'SPPG');
      const peerOnline = isOnline(conversation.peer_online);
      return `
        <div class="conversation-row">
          <button class="contact-item ${Number(conversation.id) === state.activeId ? 'is-selected' : ''}" type="button"
            aria-current="${Number(conversation.id) === state.activeId ? 'true' : 'false'}" data-conversation-id="${Number(conversation.id)}">
          <span class="avatar ${conversation.kind === 'group' ? 'avatar-coord' : conversation.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">
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
  }

  function renderStatuses() {
    const list = $('#statusList');
    if (!state.statuses.length) {
      showError(list, 'Belum ada status. Bagikan kabar ke kontak atau grup.');
      return;
    }
    list.innerHTML = state.statuses.map((status) => `
      <article class="feature-card status-card">
        <span class="avatar ${status.author_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}" aria-hidden="true">${escapeHtml(initials(status.author_name || 'MB'))}</span>
        <div class="feature-card-copy">
          <div class="feature-card-title"><strong>${escapeHtml(status.author_name || 'Anggota')}</strong><time>${escapeHtml(formatTime(status.created_at))}</time></div>
          <p>${escapeHtml(status.conversation_id ? `Status grup · ${status.group_name || 'Grup'}` : 'Status kontak')}</p>
          <div class="status-message">${escapeHtml(status.message)}</div>
        </div>
      </article>`).join('');
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

  function setSection(section) {
    state.section = section;
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
      const target = ({ updates: '#statusList', communities: '#communityList', calls: '#callList', archives: '#archivedList' })[section];
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
      stopRingtone();
      if (incomingCallDialog.open) incomingCallDialog.close();
      return;
    }
    const callId = Number(incoming.id);
    if (callId === state.incomingCallId) return;
    state.incomingCallId = callId;
    $('#incomingCaller').textContent = incoming.caller_name || 'Admin/SPPG';
    $('#incomingCallStatus').textContent = `${incoming.caller_role === 'admin' ? 'Admin' : 'SPPG'} menelepon Anda`;
    startRingtone('incoming');
    if (state.notificationsEnabled && document.hidden && 'Notification' in window && Notification.permission === 'granted' && !state.notifiedCalls.has(callId)) {
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
    $('#activeAvatar').textContent = conversation.kind === 'group' ? 'GR' : initials(name);
    $('#activeName').textContent = name;
    $('#activeStatus').textContent = conversation.kind === 'group'
      ? `Grup · ${conversation.member_count} anggota`
      : `${conversation.peer_role === 'admin' ? 'Admin' : 'SPPG'} · ${isOnline(conversation.peer_online) ? 'Online' : 'Offline'}`;
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

  function setListView(view) {
    state.listView = view;
    state.unreadOnly = false;
    $('#conversationPane').hidden = view !== 'chats';
    $('#contactPane').hidden = view !== 'contacts';
    document.querySelectorAll('[data-view]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.view === view));
    document.querySelectorAll('[data-filter="unread"]').forEach((tab) => tab.classList.remove('is-active'));
    renderConversations();
    renderDirectory();
  }

  function initInteractions() {
    $('#conversationList').addEventListener('click', (event) => {
      const archiveButton = event.target.closest('[data-archive-id]');
      if (archiveButton) {
        event.preventDefault();
        event.stopPropagation();
        archiveConversation(Number(archiveButton.dataset.archiveId), false);
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
      state.search = event.target.value.trim().toLowerCase();
      renderConversations();
      renderDirectory();
    });
    document.querySelectorAll('[data-view]').forEach((tab) => tab.addEventListener('click', () => setListView(tab.dataset.view)));
    document.querySelectorAll('[data-section]').forEach((tab) => tab.addEventListener('click', () => setSection(tab.dataset.section)));
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
          setSection('chats');
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
      state.unreadOnly = !state.unreadOnly;
      state.listView = 'chats';
      $('#conversationPane').hidden = false;
      $('#contactPane').hidden = true;
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === 'chats'));
      tab.classList.toggle('is-active', state.unreadOnly);
      renderConversations();
    }));
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
    $('#statusCreateForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = $('#statusError');
      error.hidden = true;
      try {
        await request(chatEndpoint, {
          method: 'POST',
          body: JSON.stringify({
            action: 'status_create',
            message: $('#statusMessage').value.trim(),
            conversation_id: $('#statusGroup').value || null
          })
        });
        $('#statusMessage').value = '';
        await loadFeatureData('updates');
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      }
    });
    $('#refreshStatuses').addEventListener('click', () => loadFeatureData('updates').catch((error) => showError($('#statusList'), error.message)));
    $('#notificationSoundToggle').addEventListener('click', async () => {
      state.notificationsEnabled = !state.notificationsEnabled;
      const button = $('#notificationSoundToggle');
      button.setAttribute('aria-pressed', String(state.notificationsEnabled));
      button.querySelector('.material-symbols-outlined').textContent = state.notificationsEnabled ? 'notifications_active' : 'notifications_off';
      button.querySelector('.sound-label').textContent = state.notificationsEnabled ? 'Suara aktif' : 'Suara mati';
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
      const [identity, directory, conversations] = await Promise.all([
        request(`${chatEndpoint}?action=me`),
        request(`${chatEndpoint}?action=directory`),
        request(`${chatEndpoint}?action=conversations`)
      ]);
      state.userId = Number(identity.user_id) || state.userId;
      state.directory = directory.data || [];
      state.conversations = conversations.data || [];
      renderDirectory();
      renderGroupMembers();
      renderConversations();
      renderStatusGroups();
      renderCommunityChoices();
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
        await refreshConversations();
        if (state.activeId) await loadMessages(state.activeId, false);
        await refreshIncomingCall();
        if (state.section === 'calls') await loadFeatureData('calls');
        if (state.section === 'updates') await loadFeatureData('updates');
        if (state.section === 'archives') await loadFeatureData('archives');
      } catch (error) {
        console.warn('Pembaruan percakapan gagal:', error.message);
      }
    }, 2500);
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
