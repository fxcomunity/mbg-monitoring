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
    incomingCallId: 0,
    selectedGroupIds: new Set()
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

  function groupSlug(name) {
    return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grup';
  }

  function groupUrl(name, id) {
    return new URL(`chat/grup/${groupSlug(name)}/${Number(id)}`, communicationRoot);
  }

  function requestedConversationId() {
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
    const list = $('#conversationList');
    const filtered = state.conversations.filter((conversation) => {
      const name = conversationName(conversation);
      const matchesSearch = `${name} ${conversation.last_message || ''}`.toLowerCase().includes(state.search);
      return matchesSearch && (!state.unreadOnly || Number(conversation.unread_count) > 0);
    });
    $('#conversationCount').textContent = filtered.length;
    if (!filtered.length) {
      showError(list, state.unreadOnly ? 'Tidak ada pesan yang belum dibaca.' : 'Belum ada percakapan. Pilih tab Kontak untuk memulai.');
      return;
    }
    list.innerHTML = filtered.map((conversation) => {
      const name = conversationName(conversation);
      const unread = Number(conversation.unread_count) || 0;
      const type = conversation.kind === 'group' ? `Grup · ${conversation.member_count} anggota` : (conversation.peer_role === 'admin' ? 'Admin' : 'SPPG');
      const peerOnline = isOnline(conversation.peer_online);
      return `
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
        </button>`;
    }).join('');
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
      if (incomingCallDialog.open) incomingCallDialog.close();
      return;
    }
    const callId = Number(incoming.id);
    if (callId === state.incomingCallId) return;
    state.incomingCallId = callId;
    $('#incomingCaller').textContent = incoming.caller_name || 'Admin/SPPG';
    $('#incomingCallStatus').textContent = `${incoming.caller_role === 'admin' ? 'Admin' : 'SPPG'} menelepon Anda`;
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
      const button = event.target.closest('[data-conversation-id]');
      if (!button) return;
      const conversationId = Number(button.dataset.conversationId);
      const conversation = state.conversations.find((item) => Number(item.id) === conversationId);
      if (conversation?.kind === 'group') {
        location.href = groupUrl(conversation.name, conversationId).href;
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
        location.href = groupUrl(name, result.conversation_id).href;
      } catch (requestError) {
        error.textContent = requestError.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
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
