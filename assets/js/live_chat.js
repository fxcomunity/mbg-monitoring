/**
 * live_chat.js — Floating Live Chat Widget Radar MBG Nasional (Dual Canvas & 2-Way Reply)
 * Dilengkapi 2 Canvas Terpisah:
 *   1. Canvas Satgas BGN (Pengawasan, AKG, Pelaporan Resmi Satgas Pusat)
 *   2. Canvas Mitra SPPG (Operasional Dapur, Menu Hari Ini, Alergen, Pengiriman)
 * Didukung OpenRouter AI + Balasan Nyata Admin Satgas & Mitra SPPG secara Realtime.
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', initLiveChatWidget);

  function initLiveChatWidget() {
    if (document.getElementById('mbgLiveChatRoot')) return;

    // Tentukan base path ke api/live_chat.php
    const isSubfolder = window.location.pathname.includes('/features/') || 
                        window.location.pathname.includes('/pages/') ||
                        window.location.pathname.includes('/dashboard/');
    const apiBase = isSubfolder ? '../../api/live_chat.php' : 'api/live_chat.php';

    // Buat wadah utama floating widget
    const root = document.createElement('div');
    root.id = 'mbgLiveChatRoot';
    root.className = 'fixed bottom-5 right-5 z-50 flex flex-col items-end select-none font-sans text-slate-800';

    root.innerHTML = `
      <!-- CHAT WINDOW (POPUP) -->
      <div id="mbgChatBox" class="hidden flex flex-col w-[360px] sm:w-[410px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden mb-4 transition-all duration-200 origin-bottom-right scale-95 opacity-0">
        
        <!-- TOP CHANNEL BAR (TAB SELECTOR) -->
        <div class="bg-[#001026] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div class="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl">
            <button id="btnTabSatgas" type="button" class="py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white text-[#001026] shadow-sm">
              <span>🏛️ Satgas BGN</span>
            </button>
            <button id="btnTabSppg" type="button" class="py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-300 hover:text-white">
              <span>🍲 Mitra SPPG</span>
            </button>
          </div>

          <div class="flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Live</span>
            <button id="btnMinimizeChat" class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1" title="Tutup Chat">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- CANVAS 1: SATGAS BGN PUSAT (Pengawasan & Jaminan Mutu)  -->
        <!-- ======================================================== -->
        <div id="canvasSatgasBgn" class="flex flex-col flex-1 h-full overflow-hidden">
          
          <!-- Satgas Header Banner -->
          <div class="bg-gradient-to-r from-[#001026] via-[#0b2545] to-[#134074] text-white p-3.5 shrink-0 flex items-center justify-between border-b border-blue-900/40">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-[#6ffbbe]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
              </div>
              <div>
                <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Satgas BGN Pusat</span>
                  <span class="px-1.5 py-0.2 rounded-full bg-[#6ffbbe]/20 text-[#6ffbbe] text-[9px] font-extrabold uppercase">Pengawas</span>
                </h3>
                <p class="text-[10px] text-slate-300">Badan Gizi Nasional • Standar AKG & Kebijakan MBG</p>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded-full font-medium">Layanan Resmi</span>
          </div>

          <!-- Messages Stream Satgas -->
          <div id="messagesSatgas" class="flex-grow p-3.5 overflow-y-auto space-y-3 bg-slate-50/70 text-xs">
            <div class="flex items-start gap-2">
              <div class="w-7 h-7 rounded-full bg-[#001026] text-[#6ffbbe] flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm">BGN</div>
              <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm max-w-[85%]">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="font-bold text-slate-900 text-[11px]">Satgas BGN Pusat</span>
                  <span class="px-1 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">Verifikator</span>
                </div>
                <p class="text-slate-600 leading-relaxed text-[11px]">Selamat datang di Kanal Pengawasan Satgas BGN. Anda dapat menanyakan standar gizi nasional, sertifikasi higiene SLHS, atau melaporkan kendala distribusi porsi.</p>
                <span class="text-[9px] text-slate-400 mt-1 block text-right">Siaga Realtime</span>
              </div>
            </div>
          </div>

          <!-- Quick Templates Chips Satgas -->
          <div class="p-2 bg-white border-t border-slate-100 flex flex-col gap-1 shrink-0">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">Pertanyaan Cepat Satgas:</span>
            <div class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 text-[10px] font-medium transition-all" data-target="admin" data-msg="Bagaimana standar gizi AKG MBG nasional hari ini?">
                📊 Standar AKG Nasional
              </button>
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 text-[10px] font-medium transition-all" data-target="admin" data-msg="Bagaimana prosedur lapor jika makanan tiba dalam keadaan dingin?">
                🚨 Prosedur Makanan Dingin
              </button>
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 text-[10px] font-medium transition-all" data-target="admin" data-msg="Apakah seluruh dapur SPPG sudah memiliki sertifikat higiene SLHS?">
                🛡️ Sertifikat Higiene SLHS
              </button>
            </div>
          </div>

          <!-- Input Form Satgas -->
          <form id="formSatgas" class="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input type="text" id="inputSatgas" placeholder="Ketik pertanyaan ke Satgas BGN..." required autocomplete="off"
                   class="flex-grow px-3.5 py-2.5 bg-slate-100 text-slate-900 placeholder:text-slate-400 rounded-2xl text-xs border border-transparent focus:bg-white focus:border-[#134074] focus:outline-none transition-all">
            <button type="submit" class="w-10 h-10 rounded-2xl bg-[#001026] hover:bg-[#134074] text-white flex items-center justify-center transition-all shrink-0 shadow-sm active:scale-95">
              <svg class="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>

        </div>

        <!-- ======================================================== -->
        <!-- CANVAS 2: MITRA DAPUR SPPG (Operasional, Menu, Alergen) -->
        <!-- ======================================================== -->
        <div id="canvasMitraSppg" class="hidden flex flex-col flex-1 h-full overflow-hidden">
          
          <!-- SPPG Header Banner -->
          <div class="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] text-white p-3.5 shrink-0 flex flex-col gap-2 border-b border-emerald-900/40">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-[#6ffbbe]">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Mitra Dapur SPPG</span>
                    <span class="px-1.5 py-0.2 rounded-full bg-emerald-300/20 text-emerald-300 text-[9px] font-extrabold uppercase">Dapur</span>
                  </h3>
                  <p class="text-[10px] text-emerald-100">Layanan Pangan, Menu Makanan & Pengantaran</p>
                </div>
              </div>
              <span class="text-[10px] text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full font-medium">Mitra BGN</span>
            </div>

            <!-- SPPG Kitchen Selector -->
            <div>
              <select id="chatSppgSelector" class="w-full px-2.5 py-1.5 bg-black/20 text-white border border-white/20 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6ffbbe]">
                <option value="SPPG BANGLI BANGLI LANDIH" class="text-slate-900">SPPG BANGLI BANGLI LANDIH (Bali)</option>
                <option value="SPPG Menteng Senayan Jakarta Pusat" class="text-slate-900">SPPG Menteng Senayan (Jakarta Pusat)</option>
                <option value="SPPG Sukajadi Kota Bandung" class="text-slate-900">SPPG Sukajadi (Kota Bandung)</option>
                <option value="SPPG Gubeng Surabaya" class="text-slate-900">SPPG Gubeng (Surabaya)</option>
              </select>
            </div>
          </div>

          <!-- Messages Stream SPPG -->
          <div id="messagesSppg" class="flex-grow p-3.5 overflow-y-auto space-y-3 bg-slate-50/70 text-xs">
            <div class="flex items-start gap-2">
              <div class="w-7 h-7 rounded-full bg-emerald-800 text-[#6ffbbe] flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm">SPPG</div>
              <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm max-w-[85%]">
                <div class="flex items-center gap-1.5 mb-1">
                  <span id="sppgWelcomeName" class="font-bold text-slate-900 text-[11px]">SPPG BANGLI BANGLI LANDIH</span>
                  <span class="px-1 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">Dapur Aktif</span>
                </div>
                <p class="text-slate-600 leading-relaxed text-[11px]">Halo! Kami siap membantu informasi seputar masakan hari ini, pengecekan alergen anak, dan jadwal drop porsi ke sekolah Anda.</p>
                <span class="text-[9px] text-slate-400 mt-1 block text-right">Dapur Siaga</span>
              </div>
            </div>
          </div>

          <!-- Quick Templates Chips SPPG -->
          <div class="p-2 bg-white border-t border-slate-100 flex flex-col gap-1 shrink-0">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-1">Pertanyaan Cepat Dapur SPPG:</span>
            <div class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-medium transition-all" data-target="sppg" data-msg="Menu makanan hari ini apa ya min?">
                🍛 Menu Hari Ini Apa?
              </button>
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-medium transition-all" data-target="sppg" data-msg="Apakah sajian hari ini bebas dari alergen kacang atau seafood?">
                ⚠️ Bebas Alergen Kacang?
              </button>
              <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-medium transition-all" data-target="sppg" data-msg="Pukul berapa estimasi pengantaran tiba di sekolah kami?">
                ⏱️ Jam Berapa Tiba?
              </button>
            </div>
          </div>

          <!-- Input Form SPPG -->
          <form id="formSppg" class="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input type="text" id="inputSppg" placeholder="Tanya menu / porsi ke dapur SPPG..." required autocomplete="off"
                   class="flex-grow px-3.5 py-2.5 bg-slate-100 text-slate-900 placeholder:text-slate-400 rounded-2xl text-xs border border-transparent focus:bg-white focus:border-emerald-600 focus:outline-none transition-all">
            <button type="submit" class="w-10 h-10 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition-all shrink-0 shadow-sm active:scale-95">
              <svg class="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>

        </div>

      </div>

      <!-- FLOATING TOGGLE BUTTON -->
      <button id="btnToggleChat" type="button" aria-label="Buka Live Chat MBG" class="relative group flex items-center gap-2 px-4 py-3 rounded-full bg-[#001026] hover:bg-[#134074] text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white/20">
        <div class="relative flex items-center justify-center">
          <svg class="w-6 h-6 text-[#6ffbbe]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#059669] border-2 border-[#001026] animate-ping"></span>
        </div>
        <span class="font-bold text-xs tracking-tight">Live Chat MBG</span>
        <span id="chatUnreadBadge" class="hidden px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">1</span>
      </button>
    `;

    document.body.appendChild(root);

    // State Variables
    let currentCanvas = 'satgas'; // 'satgas' atau 'sppg'
    let isChatOpen = false;
    let pollInterval = null;

    // Session IDs dipisah per canvas
    let sessionSatgas = localStorage.getItem('mbg_chat_session_satgas');
    if (!sessionSatgas) {
      sessionSatgas = 'cs_satgas_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('mbg_chat_session_satgas', sessionSatgas);
    }

    let sessionSppg = localStorage.getItem('mbg_chat_session_sppg');
    if (!sessionSppg) {
      sessionSppg = 'cs_sppg_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('mbg_chat_session_sppg', sessionSppg);
    }

    let lastIdSatgas = 0;
    let lastIdSppg = 0;

    // Element References
    const chatBox = document.getElementById('mbgChatBox');
    const btnToggle = document.getElementById('btnToggleChat');
    const btnClose = document.getElementById('btnMinimizeChat');
    const btnTabSatgas = document.getElementById('btnTabSatgas');
    const btnTabSppg = document.getElementById('btnTabSppg');
    const canvasSatgas = document.getElementById('canvasSatgasBgn');
    const canvasSppg = document.getElementById('canvasMitraSppg');
    const messagesSatgas = document.getElementById('messagesSatgas');
    const messagesSppg = document.getElementById('messagesSppg');
    const formSatgas = document.getElementById('formSatgas');
    const formSppg = document.getElementById('formSppg');
    const inputSatgas = document.getElementById('inputSatgas');
    const inputSppg = document.getElementById('inputSppg');
    const sppgSelector = document.getElementById('chatSppgSelector');
    const sppgWelcomeName = document.getElementById('sppgWelcomeName');

    // Switch Canvas Tab
    function switchCanvas(canvas) {
      currentCanvas = canvas;
      if (canvas === 'satgas') {
        canvasSatgas.classList.remove('hidden');
        canvasSppg.classList.add('hidden');
        btnTabSatgas.className = 'py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white text-[#001026] shadow-sm';
        btnTabSppg.className = 'py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-300 hover:text-white';
        inputSatgas.focus();
        loadHistory('admin', sessionSatgas, messagesSatgas);
      } else {
        canvasSppg.classList.remove('hidden');
        canvasSatgas.classList.add('hidden');
        btnTabSppg.className = 'py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white text-emerald-900 shadow-sm';
        btnTabSatgas.className = 'py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-300 hover:text-white';
        inputSppg.focus();
        loadHistory('sppg', sessionSppg, messagesSppg);
      }
    }

    btnTabSatgas.addEventListener('click', () => switchCanvas('satgas'));
    btnTabSppg.addEventListener('click', () => switchCanvas('sppg'));

    // Toggle Chat Window
    function toggleChat(open) {
      if (typeof open === 'boolean') {
        isChatOpen = open;
      } else {
        isChatOpen = !isChatOpen;
      }

      if (isChatOpen) {
        chatBox.classList.remove('hidden');
        setTimeout(() => {
          chatBox.classList.remove('scale-95', 'opacity-0');
          chatBox.classList.add('scale-100', 'opacity-100');
          if (currentCanvas === 'satgas') inputSatgas.focus();
          else inputSppg.focus();
        }, 10);

        // Load history & mulai polling
        loadHistory('admin', sessionSatgas, messagesSatgas);
        loadHistory('sppg', sessionSppg, messagesSppg);
        loadSppgDropdown();
        startPolling();
      } else {
        chatBox.classList.remove('scale-100', 'opacity-100');
        chatBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          chatBox.classList.add('hidden');
        }, 200);
        stopPolling();
      }
    }

    btnToggle.addEventListener('click', toggleChat);
    btnClose.addEventListener('click', () => toggleChat(false));

    // Update Welcome Name on SPPG change
    if (sppgSelector) {
      sppgSelector.addEventListener('change', () => {
        if (sppgWelcomeName) sppgWelcomeName.textContent = sppgSelector.value;
      });
    }

    // Load History from Server
    async function loadHistory(targetType, sessionId, container) {
      try {
        const res = await fetch(`${apiBase}?action=history&session_id=${encodeURIComponent(sessionId)}&target_type=${targetType}`);
        const json = await res.json();
        if (json.status === 'success' && json.messages) {
          // Kosongkan pesan kecuali initial greeting
          const initial = container.firstElementChild ? container.firstElementChild.outerHTML : '';
          container.innerHTML = initial;

          json.messages.forEach(msg => {
            appendMessage(container, msg);
            if (targetType === 'admin' && msg.id > lastIdSatgas) lastIdSatgas = msg.id;
            if (targetType === 'sppg' && msg.id > lastIdSppg) lastIdSppg = msg.id;
          });
          scrollToBottom(container);
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat live chat:', err);
      }
    }

    // Load SPPG List from API
    async function loadSppgDropdown() {
      try {
        const res = await fetch(`${apiBase}?action=sppg_list`);
        const json = await res.json();
        if (json.status === 'success' && json.data && json.data.length > 0) {
          sppgSelector.innerHTML = '';
          json.data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sppg_name;
            opt.textContent = `${s.sppg_name} ${s.alamat ? '(' + s.alamat + ')' : ''}`;
            opt.className = 'text-slate-900';
            sppgSelector.appendChild(opt);
          });
          if (sppgWelcomeName) sppgWelcomeName.textContent = sppgSelector.value;
        }
      } catch (e) {}
    }

    // Append Message to UI
    function appendMessage(container, msg) {
      const isUser = msg.sender_type === 'user';
      const isOfficialHuman = (msg.sender_type === 'admin' || msg.sender_type === 'sppg') && !msg.is_template;

      const div = document.createElement('div');
      div.className = isUser ? 'flex items-start justify-end gap-2' : 'flex items-start gap-2';

      let badgeHtml = '';
      if (msg.sender_type === 'admin') {
        badgeHtml = `<span class="px-1 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">🏛️ Satgas BGN</span>`;
      } else if (msg.sender_type === 'sppg') {
        badgeHtml = `<span class="px-1 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">🍲 Mitra SPPG</span>`;
      }

      const content = `
        ${!isUser ? `
          <div class="w-7 h-7 rounded-full ${msg.sender_type === 'sppg' ? 'bg-emerald-700' : 'bg-[#001026]'} text-[#6ffbbe] flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm">
            ${msg.sender_type === 'sppg' ? 'SPPG' : 'BGN'}
          </div>
        ` : ''}
        <div class="${isUser ? 'bg-[#001026] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80'} p-3 rounded-2xl shadow-sm max-w-[85%]">
          <div class="flex items-center gap-1.5 mb-1 ${isUser ? 'justify-end' : ''}">
            <span class="font-bold text-[11px] ${isUser ? 'text-[#6ffbbe]' : 'text-slate-900'}">${escapeHtml(msg.sender_name || (isUser ? 'Anda' : 'Petugas'))}</span>
            ${badgeHtml}
          </div>
          <p class="leading-relaxed text-[11px] whitespace-pre-wrap">${escapeHtml(msg.message)}</p>
          <span class="text-[9px] ${isUser ? 'text-slate-300' : 'text-slate-400'} mt-1 block text-right">${formatTime(msg.created_at)}</span>
        </div>
      `;

      div.innerHTML = content;
      container.appendChild(div);
      scrollToBottom(container);
    }

    // Scroll Helper
    function scrollToBottom(container) {
      container.scrollTop = container.scrollHeight;
    }

    // Send Message Handler
    async function sendMessage(targetType, sessionId, inputEl, container) {
      const text = inputEl.value.trim();
      if (!text) return;

      inputEl.value = '';
      inputEl.disabled = true;

      const targetSppg = (targetType === 'sppg' && sppgSelector) ? sppgSelector.value : '';

      // Tampilkan pesan user di UI
      appendMessage(container, {
        sender_type: 'user',
        sender_name: 'Anda',
        message: text,
        created_at: new Date().toISOString()
      });

      // Tampilkan indikator mengetik
      const typingDiv = document.createElement('div');
      typingDiv.id = 'typingIndicator_' + targetType;
      typingDiv.className = 'flex items-center gap-1.5 p-2 bg-slate-100 rounded-xl text-slate-500 text-[10px] w-fit';
      typingDiv.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
        <span class="ml-1">${targetType === 'sppg' ? 'Dapur SPPG sedang merespons...' : 'Satgas BGN sedang meninjau...'}</span>
      `;
      container.appendChild(typingDiv);
      scrollToBottom(container);

      try {
        const fd = new FormData();
        fd.append('action', 'send');
        fd.append('target_type', targetType);
        fd.append('session_id', sessionId);
        fd.append('target_sppg_name', targetSppg);
        fd.append('message', text);

        const res = await fetch(apiBase, { method: 'POST', body: fd });
        const json = await res.json();

        // Hapus typing
        typingDiv.remove();

        if (json.status === 'success') {
          if (json.auto_reply) {
            appendMessage(container, json.auto_reply);
            if (targetType === 'admin') lastIdSatgas = json.auto_reply.id || lastIdSatgas;
            if (targetType === 'sppg') lastIdSppg = json.auto_reply.id || lastIdSppg;
          }
        }
      } catch (err) {
        typingDiv.remove();
        appendMessage(container, {
          sender_type: targetType,
          sender_name: 'Sistem',
          message: 'Pesan Anda telah dicatat. Petugas akan segera membalas.',
          created_at: new Date().toISOString()
        });
      } finally {
        inputEl.disabled = false;
        inputEl.focus();
      }
    }

    formSatgas.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage('admin', sessionSatgas, inputSatgas, messagesSatgas);
    });

    formSppg.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage('sppg', sessionSppg, inputSppg, messagesSppg);
    });

    // Quick Templates Handler
    document.querySelectorAll('.quick-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target || 'admin';
        const msg = btn.dataset.msg;
        if (!msg) return;

        if (target === 'admin') {
          inputSatgas.value = msg;
          sendMessage('admin', sessionSatgas, inputSatgas, messagesSatgas);
        } else {
          inputSppg.value = msg;
          sendMessage('sppg', sessionSppg, inputSppg, messagesSppg);
        }
      });
    });

    // Real-Time Polling for Replies from Admin & SPPG Dashboard
    function startPolling() {
      stopPolling();
      pollInterval = setInterval(async () => {
        if (!isChatOpen) return;

        // Poll Satgas Canvas
        if (currentCanvas === 'satgas') {
          try {
            const res = await fetch(`${apiBase}?action=poll&session_id=${encodeURIComponent(sessionSatgas)}&after_id=${lastIdSatgas}`);
            const json = await res.json();
            if (json.status === 'success' && json.messages && json.messages.length > 0) {
              json.messages.forEach(m => {
                // Tampilkan hanya jika bukan pesan yang dikirim user sendiri
                if (m.sender_type !== 'user') {
                  appendMessage(messagesSatgas, m);
                }
                if (m.id > lastIdSatgas) lastIdSatgas = m.id;
              });
            }
          } catch (e) {}
        } else {
          // Poll SPPG Canvas
          try {
            const res = await fetch(`${apiBase}?action=poll&session_id=${encodeURIComponent(sessionSppg)}&after_id=${lastIdSppg}`);
            const json = await res.json();
            if (json.status === 'success' && json.messages && json.messages.length > 0) {
              json.messages.forEach(m => {
                if (m.sender_type !== 'user') {
                  appendMessage(messagesSppg, m);
                }
                if (m.id > lastIdSppg) lastIdSppg = m.id;
              });
            }
          } catch (e) {}
        }
      }, 3500);
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    // Utilities
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatTime(isoStr) {
      if (!isoStr) return 'Baru saja';
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return 'Baru saja';
      }
    }
  }
})();
