(function () {
  const siteRoot = new URL(document.querySelector('meta[name="site-root"]').content, location.href);
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const apiUrl = new URL(isLocal ? 'api/internal_chat.php' : 'api/internal_chat', siteRoot);
  const authUrl = new URL(isLocal ? 'api/auth_user.php' : 'api/auth_user', siteRoot);
  const params = new URLSearchParams(location.search);
  const isHelpCall = params.get('is_help') === '1' || params.get('help') === '1';
  const $ = (selector) => document.querySelector(selector);

  const state = {
    userId: 0,
    callId: Number(params.get('call_id')) || 0,
    conversationId: Number(params.get('conversation_id')) || 0,
    isHelp: isHelpCall,
    call: null,
    peer: null,
    connection: null,
    localStream: null,
    signalCursor: 0,
    pendingCandidates: [],
    busy: false,
    ending: false,
    pollTimer: null,
    audioContext: null,
    ringbackTimer: null,
    callTimerInterval: null,
    callStartTime: null
  };

  function showError(message) {
    const errorEl = $('#callError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    const statusEl = $('#callStatus');
    if (statusEl) statusEl.textContent = 'Panggilan belum tersambung.';
    stopCallTimer();
  }

  function setStatus(message) {
    const statusEl = $('#callStatus');
    if (statusEl) statusEl.textContent = message;
    const errorEl = $('#callError');
    if (errorEl) errorEl.hidden = true;
  }

  function showControls(visible) {
    $('#muteButton').hidden = !visible;
    $('#speakerButton').hidden = !visible;
    $('#endCallButton').hidden = !visible;
  }

  function setAction(label, icon, disabled) {
    const button = $('#callAction');
    if (!button) return;
    button.disabled = Boolean(disabled);
    button.querySelector('.material-symbols-outlined').textContent = icon;
    button.lastElementChild.textContent = label;
    button.hidden = false;
  }

  function startCallTimer() {
    if (state.callTimerInterval) return;
    state.callStartTime = Date.now();
    const durationEl = $('#callDuration');
    const timerEl = $('#callTimer');
    if (durationEl) durationEl.hidden = false;
    if (timerEl) timerEl.textContent = '00:00';
    state.callTimerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopCallTimer() {
    if (state.callTimerInterval) {
      window.clearInterval(state.callTimerInterval);
      state.callTimerInterval = null;
    }
  }

  function updatePeerDisplay(name, role, phone, avatarUrl) {
    const nameEl = $('#callName');
    if (nameEl) nameEl.textContent = name || 'Admin Pusat Bantuan';
    const phoneEl = $('#callPhone');
    if (phoneEl) phoneEl.textContent = `Kontak: ${phone || '0895404147521'}`;

    const avatarContainer = $('#callAvatar');
    const avatarImg = $('#callAvatarImg');
    const avatarText = $('#callAvatarText');

    if (avatarContainer) {
      avatarContainer.className = `avatar call-avatar ${role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
    }

    if (avatarUrl && avatarImg) {
      avatarImg.src = avatarUrl;
      avatarImg.style.display = 'block';
      if (avatarText) avatarText.style.display = 'none';
    } else if (avatarText) {
      if (avatarImg) avatarImg.style.display = 'none';
      avatarText.style.display = 'block';
      const parts = (name || 'MB').trim().split(/\s+/).slice(0, 2);
      avatarText.textContent = parts.map((p) => p[0] || '').join('').toUpperCase() || 'BGN';
    }
  }

  async function playRingback() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!state.audioContext) state.audioContext = new AudioCtx();
      if (state.audioContext.state === 'suspended') await state.audioContext.resume();
      const now = state.audioContext.currentTime;
      [440, 480].forEach((frequency, index) => {
        const oscillator = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.18);
        gain.gain.linearRampToValueAtTime(0.1, now + index * 0.18 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.16);
        oscillator.connect(gain);
        gain.connect(state.audioContext.destination);
        oscillator.start(now + index * 0.18);
        oscillator.stop(now + index * 0.18 + 0.18);
      });
    } catch (error) {
      console.warn('Nada panggilan tidak dapat diputar:', error.message);
    }
  }

  function startRingback() {
    if (state.ringbackTimer) return;
    playRingback();
    state.ringbackTimer = window.setInterval(playRingback, 2200);
  }

  function stopRingback() {
    if (state.ringbackTimer) window.clearInterval(state.ringbackTimer);
    state.ringbackTimer = null;
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
      if (response.status === 401 || response.status === 403) location.replace(new URL('auth/login.html', siteRoot));
      throw new Error(result?.message || `Permintaan gagal (HTTP ${response.status}).`);
    }
    return result;
  }

  async function post(action, data = {}) {
    return request(apiUrl, { method: 'POST', body: JSON.stringify({ action, ...data }) });
  }

  async function acquireMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser atau koneksi ini tidak mendukung akses mikrofon. Gunakan HTTPS atau localhost.');
    }
    setStatus('Menghubungkan ke mikrofon...');
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  async function createPeerConnection() {
    const config = await request(new URL('?action=call_config', apiUrl));
    const connection = new RTCPeerConnection({ iceServers: config.ice_servers || [{ urls: 'stun:stun.l.google.com:19302' }] });
    state.connection = connection;

    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => connection.addTrack(track, state.localStream));
    }

    connection.ontrack = (event) => {
      const audio = $('#remoteAudio');
      if (audio) {
        audio.srcObject = event.streams[0] || new MediaStream([event.track]);
        audio.play().catch(() => setStatus('Terhubung. Tekan Speaker untuk mengaktifkan audio lawan bicara.'));
      }
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate || !state.callId || state.ending) return;
      post('call_signal', {
        call_id: state.callId,
        signal_type: 'candidate',
        payload: event.candidate.toJSON()
      }).catch((error) => console.warn('Kandidat jaringan tidak terkirim:', error.message));
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        stopRingback();
        setStatus('Terhubung · panggilan suara aktif');
        startCallTimer();
      } else if (connection.connectionState === 'failed') {
        stopCallTimer();
        showError('Koneksi audio gagal. Jaringan ini mungkin memerlukan konfigurasi server TURN.');
      } else if (connection.connectionState === 'disconnected') {
        setStatus('Koneksi terputus, mencoba menyambungkan kembali...');
      }
    };
  }

  async function addCandidate(payload) {
    if (!state.connection?.remoteDescription) {
      state.pendingCandidates.push(payload);
      return;
    }
    await state.connection.addIceCandidate(new RTCIceCandidate(payload));
  }

  async function flushCandidates() {
    const candidates = state.pendingCandidates.splice(0);
    for (const candidate of candidates) await addCandidate(candidate);
  }

  async function handleSignal(signal) {
    let payload = signal.payload;
    if (typeof payload === 'string') payload = JSON.parse(payload);
    if (signal.signal_type === 'offer') {
      await state.connection.setRemoteDescription(new RTCSessionDescription(payload));
      await flushCandidates();
      const answer = await state.connection.createAnswer();
      await state.connection.setLocalDescription(answer);
      await post('call_signal', { call_id: state.callId, signal_type: 'answer', payload: answer });
      setStatus('Menjawab panggilan...');
    } else if (signal.signal_type === 'answer') {
      await state.connection.setRemoteDescription(new RTCSessionDescription(payload));
      await flushCandidates();
      setStatus('Menghubungkan audio...');
    } else if (signal.signal_type === 'candidate') {
      await addCandidate(payload);
    }
  }

  async function pollCall() {
    if (!state.callId || state.ending || state.busy) return;
    state.busy = true;
    try {
      const query = new URLSearchParams({
        action: 'call_state',
        call_id: String(state.callId),
        after_signal_id: String(state.signalCursor)
      });
      const result = await request(`${apiUrl.href}?${query}`);
      state.call = result.data;

      // Update peer details if available
      if (result.data) {
        updatePeerDisplay(
          result.data.peer_name,
          result.data.peer_role,
          result.data.peer_phone || (state.isHelp ? '0895404147521' : ''),
          result.data.peer_avatar
        );
      }

      const terminal = ['declined', 'ended', 'missed'].includes(state.call.status);
      if (terminal) {
        stopRingback();
        stopCallTimer();
        state.ending = true;
        setStatus(state.call.status === 'declined' ? 'Panggilan ditolak oleh penerima.' : state.call.status === 'missed' ? 'Panggilan tidak dijawab.' : 'Panggilan berakhir.');
        cleanup();
        setAction('Kembali ke chat', 'arrow_back', false);
        $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/?settings=help', siteRoot).href;
        return;
      }

      if (state.call.status === 'active' && !state.callTimerInterval) {
        stopRingback();
        setStatus('Terhubung · panggilan suara aktif');
        startCallTimer();
      }

      for (const signal of result.signals || []) {
        state.signalCursor = Math.max(state.signalCursor, Number(signal.id) || 0);
        await handleSignal(signal);
      }
    } catch (error) {
      console.warn('Status panggilan belum diperbarui:', error.message);
    } finally {
      state.busy = false;
    }
  }

  function startPolling() {
    if (state.pollTimer) return;
    state.pollTimer = window.setInterval(pollCall, 500);
    pollCall();
  }

  async function startOutgoingCall() {
    startRingback();
    setAction('Menghubungi...', 'call', true);
    setStatus('Menghubungkan ke Pusat Bantuan...');
    try {
      const [result] = await Promise.all([
        state.callId ? Promise.resolve({ call_id: state.callId }) : post('call_start', { conversation_id: state.conversationId }),
        acquireMicrophone()
      ]);
      state.callId = Number(result.call_id);
      const currentUrl = new URL(location.href);
      currentUrl.searchParams.set('call_id', String(state.callId));
      history.replaceState(null, '', currentUrl);

      await createPeerConnection();
      const offer = await state.connection.createOffer();
      await state.connection.setLocalDescription(offer);
      await post('call_signal', { call_id: state.callId, signal_type: 'offer', payload: offer });

      showControls(true);
      setStatus('Memanggil... Menunggu jawaban.');
      setAction('Sedang memanggil', 'call', true);
      startPolling();
    } catch (error) {
      stopRingback();
      stopCallTimer();
      if (state.callId) await post('call_end', { call_id: state.callId }).catch(() => {});
      cleanup();
      showError(error.name === 'NotAllowedError' ? 'Izin mikrofon ditolak. Izinkan akses mikrofon di browser lalu coba lagi.' : error.message);
      setAction('Coba panggil lagi', 'call', false);
      $('#callAction').onclick = () => startOutgoingCall();
    }
  }

  async function answerIncomingCall() {
    stopRingback();
    setAction('Menjawab...', 'call', true);
    setStatus('Menjawab panggilan...');
    try {
      await acquireMicrophone();
      await Promise.all([
        createPeerConnection(),
        post('call_answer', { call_id: state.callId })
      ]);
      showControls(true);
      setStatus('Terhubung · panggilan suara aktif');
      setAction('Panggilan aktif', 'call', true);
      startCallTimer();
      startPolling();
    } catch (error) {
      cleanup();
      showError(error.name === 'NotAllowedError' ? 'Izin mikrofon ditolak. Panggilan tidak dapat dijawab.' : error.message);
      setAction('Coba jawab lagi', 'call', false);
    }
  }

  async function finishCall() {
    if (!state.callId || state.ending) return;
    state.ending = true;
    stopRingback();
    stopCallTimer();
    setAction('Mengakhiri...', 'call_end', true);
    try {
      await post('call_end', { call_id: state.callId });
    } catch (error) {
      console.warn('Status panggilan tidak dapat diperbarui:', error.message);
    }
    cleanup();
    setStatus('Panggilan berakhir.');
    setAction('Kembali ke Bantuan', 'arrow_back', false);
    $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/?settings=help', siteRoot).href;
  }

  function cleanup() {
    stopRingback();
    stopCallTimer();
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.localStream?.getTracks().forEach((track) => track.stop());
    state.localStream = null;
    state.connection?.close();
    state.connection = null;
    const audio = $('#remoteAudio');
    if (audio) audio.srcObject = null;
    showControls(false);
  }

  async function initialize() {
    const authFetch = fetch(authUrl, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const auth = await authFetch;
    if (!auth.ok) {
      location.replace(new URL('auth/login.html', siteRoot));
      return;
    }
    const authResult = await auth.json();
    const role = authResult?.user?.role;
    if (!authResult?.logged_in || !['admin', 'sppg', 'user'].includes(role)) {
      location.replace(new URL('auth/login.html', siteRoot));
      return;
    }
    state.userId = Number(authResult.user.id);

    // KASUS 1: Inisiasi Panggilan Bantuan (Help Center WebRTC Call) tanpa call_id sebelumnya
    if (!state.callId && state.isHelp) {
      $('#callEyebrow').textContent = 'PUSAT BANTUAN MBG CONNECT';
      setStatus('Menghubungkan ke Admin Pusat Bantuan...');
      setAction('Menghubungi...', 'call', true);

      try {
        const helpResult = await post('help_call_start');
        state.callId = Number(helpResult.call_id);
        state.conversationId = Number(helpResult.conversation_id);
        state.peer = helpResult.peer.name;

        updatePeerDisplay(
          helpResult.peer.name,
          helpResult.peer.role,
          helpResult.peer.phone || '0895404147521',
          helpResult.peer.avatar
        );

        const currentUrl = new URL(location.href);
        currentUrl.searchParams.set('call_id', String(state.callId));
        history.replaceState(null, '', currentUrl);

        await startOutgoingCall();
      } catch (err) {
        showError(err.message || 'Admin Pusat Bantuan sedang tidak tersedia.');
        setAction('Coba lagi', 'refresh', false);
        $('#callAction').onclick = () => location.reload();
      }
      return;
    }

    // KASUS 2: Panggilan yang sudah memiliki call_id (Caller atau Callee yang menjawab)
    if (state.callId) {
      const query = new URLSearchParams({ action: 'call_state', call_id: String(state.callId), after_signal_id: '0' });
      const [result, identity] = await Promise.all([
        request(`${apiUrl.href}?${query}`),
        request(new URL('?action=me', apiUrl))
      ]);
      state.call = result.data;
      state.peer = result.data.peer_name;
      state.userId = Number(identity.user_id);

      updatePeerDisplay(
        result.data.peer_name,
        result.data.peer_role,
        result.data.peer_phone || (state.isHelp ? '0895404147521' : ''),
        result.data.peer_avatar
      );

      const isCallee = Number(result.data.callee_id) === state.userId;
      if (isCallee && result.data.status === 'ringing') {
        $('#callEyebrow').textContent = 'PANGGILAN MASUK';
        setStatus('Panggilan masuk · Izinkan mikrofon untuk menjawab.');
        setAction('Jawab', 'call', false);
        $('#callAction').addEventListener('click', answerIncomingCall);
      } else if (!isCallee && ['ringing', 'active'].includes(result.data.status)) {
        await acquireMicrophone();
        await createPeerConnection();
        const offer = await state.connection.createOffer();
        await state.connection.setLocalDescription(offer);
        await post('call_signal', { call_id: state.callId, signal_type: 'offer', payload: offer });
        setStatus('Memanggil... Menunggu jawaban.');
        setAction('Sedang memanggil', 'call', true);
        showControls(true);
        startPolling();
      } else if (result.data.status === 'active') {
        setStatus('Panggilan sedang berlangsung.');
        setAction('Panggilan aktif', 'call', true);
        showControls(true);
        startCallTimer();
        await acquireMicrophone();
        await createPeerConnection();
        startPolling();
      } else {
        setStatus('Panggilan sudah berakhir.');
        setAction('Kembali ke chat', 'arrow_back', false);
        $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/?settings=help', siteRoot).href;
      }
      return;
    }

    // KASUS 3: Memulai panggilan dari direct conversation yang dipilih
    if (state.conversationId) {
      const result = await request(new URL('?action=conversations', apiUrl));
      const conversation = (result.data || []).find((item) => Number(item.id) === state.conversationId);
      if (!conversation || conversation.kind !== 'direct') throw new Error('Panggilan hanya dapat dimulai dari chat satu lawan satu.');
      state.peer = conversation.peer_name;
      updatePeerDisplay(conversation.peer_name, conversation.peer_role, '0895404147521', '');
      setStatus('Siap memulai panggilan suara.');
      setAction('Panggil', 'call', false);
      $('#callAction').addEventListener('click', startOutgoingCall);
    } else {
      throw new Error('Panggilan tidak valid. Silakan buka menu Bantuan untuk menghubungi Admin.');
    }
  }

  $('#endCallButton')?.addEventListener('click', finishCall);
  $('#muteButton')?.addEventListener('click', () => {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const button = $('#muteButton');
    button.setAttribute('aria-pressed', String(!track.enabled));
    button.querySelector('.material-symbols-outlined').textContent = track.enabled ? 'mic' : 'mic_off';
    button.lastElementChild.textContent = track.enabled ? 'Bisukan' : 'Bunyikan';
  });

  $('#speakerButton')?.addEventListener('click', () => {
    const audio = $('#remoteAudio');
    if (!audio) return;
    audio.muted = !audio.muted;
    const button = $('#speakerButton');
    button.setAttribute('aria-pressed', String(!audio.muted));
    button.querySelector('.material-symbols-outlined').textContent = audio.muted ? 'volume_off' : 'volume_up';
    button.lastElementChild.textContent = audio.muted ? 'Nyalakan suara' : 'Speaker';
  });

  window.addEventListener('pagehide', () => {
    if (!state.ending && state.callId) post('call_end', { call_id: state.callId }).catch(() => {});
    cleanup();
  });

  initialize().catch((error) => {
    console.error('Panggilan suara gagal dimulai:', error);
    showError(error.message);
    setAction('Kembali', 'arrow_back', false);
    $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/?settings=help', siteRoot).href;
  });
})();
