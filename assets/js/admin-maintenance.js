(function () {
  'use strict';

  var endpoint = '../../api/maintenance.php';
  var form = document.getElementById('maintenance-form');
  var messageInput = document.getElementById('maintenance-message');
  var etaInput = document.getElementById('maintenance-eta');
  var feedback = document.getElementById('maintenance-feedback');
  var statusText = document.getElementById('maintenance-status-text');
  var statusDot = document.getElementById('maintenance-status-dot');
  var refreshButton = document.getElementById('refresh-status');
  var enableButton = document.getElementById('enable-maintenance');
  var disableButton = document.getElementById('disable-maintenance');
  var busy = false;

  function decodeMessage(value) {
    var decoder = document.createElement('textarea');
    decoder.innerHTML = String(value || '');
    return decoder.value;
  }

  function setStatus(active, message) {
    statusText.textContent = message || (active ? 'Maintenance aktif' : 'Situs beroperasi');
    var color = message === 'Status tidak tersedia' ? 'bg-red-300' : (active ? 'bg-amber-300' : 'bg-emerald-300');
    statusDot.className = 'h-2.5 w-2.5 rounded-full ' + color;
  }

  function showFeedback(message, success) {
    feedback.textContent = message;
    feedback.className = 'mt-5 rounded-xl border px-4 py-3 text-sm ' + (success
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-800');
    feedback.classList.remove('hidden');
  }

  function setBusy(value) {
    busy = value;
    [refreshButton, enableButton, disableButton].forEach(function (button) {
      button.disabled = value;
    });
  }

  function formatLocalDateTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function request(url, options) {
    var response = await fetch(url, options);
    var result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Server memberikan respons yang tidak dapat dibaca.');
    }
    if (!response.ok) throw new Error(result.error || result.message || 'Permintaan gagal diproses.');
    return result;
  }

  async function loadStatus() {
    refreshButton.disabled = true;
    try {
      var state = await request(endpoint, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      setStatus(!!state.active);
      if (typeof state.message === 'string') messageInput.value = decodeMessage(state.message);
      if (state.eta) etaInput.value = formatLocalDateTime(state.eta);
      updateCounter();
    } catch (error) {
      setStatus(false, 'Status tidak tersedia');
      showFeedback(error.message || 'Status maintenance tidak dapat dimuat.', false);
    } finally {
      refreshButton.disabled = busy;
    }
  }

  function updateCounter() {
    document.getElementById('message-count').textContent = messageInput.value.length + '/500';
  }

  async function save(action) {
    if (busy) return;
    var isEnable = action === 'enable';
    if (isEnable) {
      if (!form.reportValidity()) return;
      if (!window.confirm('Aktifkan maintenance? Pengunjung akan melihat halaman maintenance.')) return;
    } else if (!window.confirm('Buka kembali situs untuk semua pengunjung?')) {
      return;
    }

    var payload = { action: action };
    if (isEnable) {
      payload.message = messageInput.value.trim();
      if (etaInput.value) {
        var date = new Date(etaInput.value);
        if (Number.isNaN(date.getTime())) {
          showFeedback('Perkiraan waktu selesai tidak valid.', false);
          etaInput.focus();
          return;
        }
        payload.eta = date.toISOString();
      } else {
        payload.eta = '';
      }
      if (!payload.message) {
        showFeedback('Pesan maintenance wajib diisi.', false);
        messageInput.focus();
        return;
      }
      if (payload.message.length > 500) {
        showFeedback('Pesan maintenance maksimal 500 karakter.', false);
        messageInput.focus();
        return;
      }
    }

    setBusy(true);
    feedback.classList.add('hidden');
    try {
      var result = await request(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.success) throw new Error(result.error || 'Perubahan maintenance gagal disimpan.');
      setStatus(!!(result.state && result.state.active));
      showFeedback(isEnable
        ? 'Mode maintenance aktif. Pengunjung akan melihat halaman informasi pemeliharaan.'
        : 'Maintenance dinonaktifkan. Situs kembali dapat diakses pengunjung.', true);
      await loadStatus();
    } catch (error) {
      showFeedback(error.message || 'Perubahan maintenance gagal disimpan.', false);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  messageInput.addEventListener('input', updateCounter);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    save('enable');
  });
  disableButton.addEventListener('click', function () { save('disable'); });
  refreshButton.addEventListener('click', loadStatus);

  updateCounter();
  loadStatus();
})();
