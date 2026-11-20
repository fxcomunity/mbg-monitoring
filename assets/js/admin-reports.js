(function () {
  const rows = document.getElementById('aduanReportRows');
  if (!rows) return;

  const appRoot = new URL('../../', location.href);
  const isLocalPhp = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  const endpoint = new URL(isLocalPhp ? 'api/tiket.php' : 'api/tiket', appRoot);
  const count = document.getElementById('aduanReportCount');
  const message = document.getElementById('aduanLoadMessage');
  const refresh = document.getElementById('aduanRefreshButton');
  const statuses = ['masuk', 'verifikasi', 'proses', 'selesai', 'ditolak'];
  const statusLabels = {
    masuk: 'Masuk',
    verifikasi: 'Verifikasi',
    proses: 'Proses',
    selesai: 'Selesai',
    ditolak: 'Ditolak'
  };
  const roleLabels = { wali: 'Wali murid', guru: 'Guru', komite: 'Komite', siswa: 'Siswa', masyarakat: 'Masyarakat' };
  const categoryLabels = {
    waktu: 'Waktu distribusi',
    menu: 'Menu',
    suhu: 'Suhu makanan',
    higienitas: 'Higienitas',
    alergen: 'Alergen',
    lainnya: 'Lainnya'
  };
  let loading = false;

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function showMessage(text, isError) {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle('text-red-600', Boolean(isError));
    message.classList.toggle('text-slate-500', !isError);
  }

  function makePhotoUrl(ticketCode) {
    const url = new URL(endpoint.href);
    url.searchParams.set('photo', ticketCode);
    return url.href;
  }

  function renderReports(reports) {
    if (count) count.textContent = reports.length === 100 ? '100 terbaru' : reports.length + ' laporan';
    if (!reports.length) {
      rows.innerHTML = '<tr><td colspan="6" class="py-10 px-4 text-center text-slate-500">Belum ada pengaduan tersimpan di server.</td></tr>';
      showMessage('Data pengaduan berhasil dimuat dari server.', false);
      return;
    }

    rows.innerHTML = reports.map(function (report) {
      const ticket = escapeHtml(report.ticket_code);
      const status = statuses.includes(report.status) ? report.status : 'masuk';
      const photo = report.photo_path
        ? '<a class="text-blue-700 underline" href="' + escapeHtml(makePhotoUrl(report.ticket_code)) + '" target="_blank" rel="noopener noreferrer">Lihat lampiran</a>'
        : '';
      const options = statuses.map(function (option) {
        return '<option value="' + option + '"' + (option === status ? ' selected' : '') + '>' + statusLabels[option] + '</option>';
      }).join('');
      const notes = typeof report.satgas_notes === 'string' ? report.satgas_notes : '';
      return '<tr class="hover:bg-slate-50/70 transition-colors">' +
        '<td class="py-3.5 px-4 whitespace-nowrap"><span class="font-mono font-bold text-primary block">' + ticket + '</span>' +
          '<span class="text-[10px] text-slate-400">' + escapeHtml(report.incident_date || '') + '</span></td>' +
        '<td class="py-3.5 px-4"><strong class="text-slate-800 block">' + escapeHtml(report.reporter_name) + '</strong>' +
          '<span class="text-[10px] text-slate-400">' + escapeHtml(roleLabels[report.reporter_role] || report.reporter_role || '—') + '</span></td>' +
        '<td class="py-3.5 px-4"><span class="font-medium text-slate-700 block">' + escapeHtml(report.school_target) + '</span>' +
          '<span class="text-[10px] text-slate-400">Kategori: ' + escapeHtml(categoryLabels[report.issue_category] || report.issue_category || '—') + '</span></td>' +
        '<td class="py-3.5 px-4 max-w-xs"><p class="text-slate-600 whitespace-pre-wrap break-words">' + escapeHtml(report.description) + '</p>' +
          (notes ? '<div class="mt-1 p-1.5 rounded bg-amber-50 text-amber-800 text-[10px]"><strong>Catatan Satgas:</strong> ' + escapeHtml(notes) + '</div>' : '') +
          (photo ? '<div class="mt-1 text-[10px]">' + photo + '</div>' : '') + '</td>' +
        '<td class="py-3.5 px-4 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-800">' +
          escapeHtml(statusLabels[status]) + '</span><span class="text-[10px] text-slate-400 block mt-0.5 uppercase font-bold">Prioritas: ' +
          escapeHtml(report.priority || '—') + '</span></td>' +
        '<td class="py-3.5 px-4 whitespace-nowrap"><form class="aduan-update-form flex flex-col gap-1.5">' +
          '<input type="hidden" name="action" value="admin_update"><input type="hidden" name="ticket_code" value="' + ticket + '">' +
          '<select name="status" aria-label="Status aduan" class="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold">' + options + '</select>' +
          '<textarea name="satgas_notes" maxlength="2000" rows="2" placeholder="Catatan Satgas (opsional)" class="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px]">' +
            escapeHtml(notes) + '</textarea>' +
          '<button type="submit" class="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-container text-white text-[10px] font-bold">Simpan perubahan</button>' +
          '</form></td></tr>';
    }).join('');
    showMessage('Menampilkan ' + reports.length + (reports.length === 100 ? ' aduan terbaru (maksimal 100).' : ' aduan dari server.'), false);
  }

  async function loadReports() {
    if (loading) return;
    loading = true;
    if (refresh) refresh.disabled = true;
    showMessage('Memuat data pengaduan dari server...', false);
    const url = new URL(endpoint.href);
    url.searchParams.set('action', 'admin_list');
    try {
      const response = await fetchWithTimeout(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success' || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Data pengaduan tidak dapat dimuat.');
      }
      renderReports(result.data);
    } catch (error) {
      showMessage(error.name === 'AbortError'
        ? 'Server terlalu lama merespons. Coba muat ulang.'
        : error.message || 'Data pengaduan tidak dapat dimuat dari server.', true);
      if (count) count.textContent = '—';
      rows.innerHTML = '<tr><td colspan="6" class="py-10 px-4 text-center text-red-600">Gagal memuat data pengaduan. Coba muat ulang.</td></tr>';
    } finally {
      loading = false;
      if (refresh) refresh.disabled = false;
    }
  }

  rows.addEventListener('submit', async function (event) {
    const form = event.target.closest('.aduan-update-form');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage('Menyimpan perubahan aduan...', false);
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Perubahan aduan gagal disimpan.');
      }
      showMessage(result.message || 'Aduan berhasil diperbarui.', false);
      await loadReports();
    } catch (error) {
      showMessage(error.name === 'AbortError'
        ? 'Server terlalu lama merespons. Periksa status aduan sebelum mengirim ulang.'
        : error.message || 'Perubahan aduan gagal disimpan.', true);
    } finally {
      button.disabled = false;
    }
  });

  if (refresh) refresh.addEventListener('click', loadReports);
  loadReports();
})();
