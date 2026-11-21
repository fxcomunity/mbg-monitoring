(function () {
  const siteRoot = new URL(document.querySelector('meta[name="site-root"]').content, location.href);
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const apiUrl = new URL(isLocal ? 'api/internal_chat.php' : 'api/internal_chat', siteRoot);
  const authUrl = new URL(isLocal ? 'api/auth_user.php' : 'api/auth_user', siteRoot);
  const params = new URLSearchParams(location.search);
  const $ = (selector) => document.querySelector(selector);
  const state = {
    userId: 0,
    callId: Number(params.get('call_id')) || 0,
    conversationId: Number(params.get('conversation_id')) || 0,
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
    ringbackTimer: null
  };

  function showError(message) {
    $('#callError').textContent = message;
    $('#callError').hidden = false;
    $('#callStatus').textContent = 'Panggilan belum tersambung.';
  }

  function setStatus(message) {
    $('#callStatus').textContent = message;
    $('#callError').hidden = true;
  }

  function showControls(visible) {
    $('#muteButton').hidden = !visible;
    $('#speakerButton').hidden = !visible;
    $('#endCallButton').hidden = !visible;
  }

  function setAction(label, icon, disabled) {
    const button = $('#callAction');
    button.disabled = Boolean(disabled);
    button.querySelector('.material-symbols-outlined').textContent = icon;
    button.lastElementChild.textContent = label;
    button.hidden = false;
  }

  async function playRingback() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!state.audioContext) state.audioContext = new AudioContext();
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
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  async function createPeerConnection() {
    const config = await request(new URL('?action=call_config', apiUrl));
    const connection = new RTCPeerConnection({ iceServers: config.ice_servers || [] });
    state.connection = connection;
    state.localStream.getTracks().forEach((track) => connection.addTrack(track, state.localStream));
    connection.ontrack = (event) => {
      $('#remoteAudio').srcObject = event.streams[0] || new MediaStream([event.track]);
      $('#remoteAudio').play().catch(() => setStatus('Terhubung. Tekan Speaker untuk mengaktifkan audio lawan bicara.'));
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
      }
      if (connection.connectionState === 'failed') showError('Koneksi audio gagal. Jaringan ini mungkin memerlukan konfigurasi server TURN.');
      if (connection.connectionState === 'disconnected') setStatus('Koneksi terputus, mencoba menyambungkan kembali...');
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
      const terminal = ['declined', 'ended', 'missed'].includes(state.call.status);
      if (terminal) {
        stopRingback();
        state.ending = true;
        setStatus(state.call.status === 'declined' ? 'Panggilan ditolak.' : state.call.status === 'missed' ? 'Panggilan tidak dijawab.' : 'Panggilan berakhir.');
        cleanup();
        setAction('Kembali ke chat', 'arrow_back', false);
        $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/', siteRoot).href;
        return;
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

  // Jalankan mic + peer connection PARALEL dengan call_start untuk memangkas waktu tunggu
  async function startOutgoingCall() {
    startRingback();
    setAction('Menghubungi...', 'call', true);
    try {
      // Paralel: minta mic & call_start bersamaan
      const [result] = await Promise.all([
        post('call_start', { conversation_id: state.conversationId }),
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
      if (state.callId) await post('call_end', { call_id: state.callId }).catch(() => {});
      cleanup();
      showError(error.name === 'NotAllowedError' ? 'Izin mikrofon ditolak. Aktifkan akses mikrofon di browser lalu coba lagi.' : error.message);
      setAction('Coba panggil lagi', 'call', false);
    }
  }

  // Jawab: mic + call_answer paralel
  async function answerIncomingCall() {
    stopRingback();
    setAction('Menjawab...', 'call', true);
    try {
      await acquireMicrophone();
      // Paralel: buat peer connection & konfirmasi jawaban ke server
      await Promise.all([
        createPeerConnection(),
        post('call_answer', { call_id: state.callId })
      ]);
      showControls(true);
      setStatus('Menghubungkan audio...');
      setAction('Panggilan aktif', 'call', true);
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
    setAction('Mengakhiri...', 'call_end', true);
    try {
      await post('call_end', { call_id: state.callId });
    } catch (error) {
      console.warn('Status panggilan tidak dapat diperbarui:', error.message);
    }
    cleanup();
    setStatus('Panggilan berakhir.');
    setAction('Kembali ke chat', 'arrow_back', false);
    $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/', siteRoot).href;
  }

  function cleanup() {
    stopRingback();
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.localStream?.getTracks().forEach((track) => track.stop());
    state.localStream = null;
    state.connection?.close();
    state.connection = null;
    $('#remoteAudio').srcObject = null;
    showControls(false);
  }

  async function initialize() {
    // Paralel: auth + call_state (jika ada call_id)
    const authFetch = fetch(authUrl, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });

    let callFetch = null;
    if (state.callId) {
      const query = new URLSearchParams({ action: 'call_state', call_id: String(state.callId), after_signal_id: '0' });
      callFetch = request(`${apiUrl.href}?${query}`);
    }

    const auth = await authFetch;
    if (!auth.ok) {
      location.replace(new URL('auth/login.html', siteRoot));
      return;
    }
    const authResult = await auth.json();
    const role = authResult?.user?.role;
    if (!authResult?.logged_in || !['admin', 'sppg'].includes(role)) {
      location.replace(new URL(role === 'user' ? 'dashboard/user/' : 'auth/login.html', siteRoot));
      return;
    }

    if (state.callId) {
      // Ambil call_state + identity paralel
      const [result, identity] = await Promise.all([
        callFetch,
        request(new URL('?action=me', apiUrl))
      ]);
      state.call = result.data;
      state.peer = result.data.peer_name;
      state.userId = Number(identity.user_id);
      $('#callName').textContent = state.peer;
      $('#callAvatar').textContent = state.peer.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
      $('#callAvatar').className = `avatar call-avatar ${result.data.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
      const isCallee = Number(result.data.callee_id) === state.userId;
      if (isCallee && result.data.status === 'ringing') {
        setStatus('Panggilan masuk · izinkan mikrofon untuk menjawab.');
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
        await acquireMicrophone();
        await createPeerConnection();
        startPolling();
      } else {
        setStatus('Panggilan sudah berakhir.');
        setAction('Kembali ke chat', 'arrow_back', false);
        $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/', siteRoot).href;
      }
    } else if (state.conversationId) {
      const result = await request(new URL('?action=conversations', apiUrl));
      const conversation = (result.data || []).find((item) => Number(item.id) === state.conversationId);
      if (!conversation || conversation.kind !== 'direct') throw new Error('Panggilan hanya dapat dimulai dari chat satu lawan satu.');
      state.peer = conversation.peer_name;
      $('#callName').textContent = state.peer;
      $('#callAvatar').textContent = state.peer.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
      $('#callAvatar').className = `avatar call-avatar ${conversation.peer_role === 'admin' ? 'avatar-admin' : 'avatar-sppg'}`;
      setStatus('Siap memulai panggilan suara.');
      setAction('Panggil', 'call', false);
      $('#callAction').addEventListener('click', startOutgoingCall);
    } else {
      throw new Error('Pilih percakapan satu lawan satu terlebih dahulu.');
    }
  }

  $('#endCallButton').addEventListener('click', finishCall);
  $('#muteButton').addEventListener('click', () => {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const button = $('#muteButton');
    button.setAttribute('aria-pressed', String(!track.enabled));
    button.querySelector('.material-symbols-outlined').textContent = track.enabled ? 'mic' : 'mic_off';
    button.lastElementChild.textContent = track.enabled ? 'Bisukan' : 'Bunyikan';
  });
  $('#speakerButton').addEventListener('click', () => {
    const audio = $('#remoteAudio');
    audio.muted = !audio.muted;
    $('#speakerButton').setAttribute('aria-pressed', String(!audio.muted));
    $('#speakerButton').querySelector('.material-symbols-outlined').textContent = audio.muted ? 'volume_off' : 'volume_up';
    $('#speakerButton').lastElementChild.textContent = audio.muted ? 'Nyalakan suara' : 'Speaker';
  });
  window.addEventListener('pagehide', () => {
    if (!state.ending && state.callId) post('call_end', { call_id: state.callId }).catch(() => {});
    cleanup();
  });

  initialize().catch((error) => {
    console.error('Panggilan suara gagal dimulai:', error);
    showError(error.message);
    setAction('Kembali ke chat', 'arrow_back', false);
    $('#callAction').onclick = () => location.href = new URL('dashboard/komunikasi/chat/', siteRoot).href;
  });
})();
