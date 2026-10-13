/**
 * live_chat.js — Floating Live Chat Widget Radar MBG Nasional
 * Mendukung komunikasi publik langsung ke Admin Satgas BGN maupun Dapur SPPG.
 * Dilengkapi Template Pertanyaan Cepat (Quick Replies) & Auto-Responder Realtime.
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', initLiveChatWidget);

  function initLiveChatWidget() {
    // Jangan inisialisasi ganda
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
      <div id="mbgChatBox" class="hidden flex flex-col w-[360px] sm:w-[390px] h-[540px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden mb-4 transition-all duration-200 origin-bottom-right scale-95 opacity-0">
        
        <!-- HEADER -->
        <div class="bg-gradient-to-r from-[#001026] via-[#0b2545] to-[#134074] text-white p-4 shrink-0 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="relative w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <svg class="w-5 h-5 text-[#6ffbbe]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#059669] border-2 border-[#001026]"></span>
              </div>
              <div>
                <h3 class="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>Live Chat MBG</span>
                  <span class="px-1.5 py-0.5 rounded-full bg-[#6ffbbe]/20 text-[#6ffbbe] text-[9px] font-black uppercase">Siaga</span>
                </h3>
                <p class="text-[11px] text-slate-300">Badan Gizi Nasional RI</p>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button id="btnMinimizeChat" class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors" title="Tutup Chat">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          <!-- TARGET SELECTION TABS (ADMIN vs SPPG) -->
          <div class="grid grid-cols-2 gap-1.5 p-1 bg-black/20 rounded-xl text-xs font-semibold">
            <button id="tabTargetAdmin" type="button" class="py-1.5 px-3 rounded-lg text-center transition-all bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5">
              <span>🏛️ Satgas BGN</span>
            </button>
            <button id="tabTargetSppg" type="button" class="py-1.5 px-3 rounded-lg text-center transition-all text-slate-300 hover:text-white flex items-center justify-center gap-1.5">
              <span>🍲 Mitra SPPG</span>
            </button>
          </div>

          <!-- SPPG SELECTOR (Shown only when SPPG tab active) -->
          <div id="sppgSelectWrapper" class="hidden">
            <label class="block text-[10px] text-slate-300 mb-1 font-medium">Pilih Dapur SPPG Terdekat:</label>
            <select id="chatSppgSelector" class="w-full px-2.5 py-1.5 bg-white/10 text-white border border-white/20 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6ffbbe]">
              <option value="SPPG Menteng Senayan Jakarta Pusat" class="text-slate-900">SPPG Menteng Senayan (Jakarta Pusat)</option>
              <option value="SPPG Sukajadi Kota Bandung" class="text-slate-900">SPPG Sukajadi (Kota Bandung)</option>
              <option value="SPPG Gubeng Surabaya" class="text-slate-900">SPPG Gubeng (Surabaya)</option>
              <option value="SPPG Medan Kota" class="text-slate-900">SPPG Medan Kota (Sumatera Utara)</option>
            </select>
          </div>
        </div>

        <!-- CHAT MESSAGES BODY -->
        <div id="mbgChatMessages" class="flex-grow p-4 overflow-y-auto space-y-3 bg-slate-50/70 text-xs">
          <!-- Initial Welcome Bubble -->
          <div class="flex items-start gap-2">
            <div class="w-7 h-7 rounded-full bg-[#001026] text-[#6ffbbe] flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm">BGN</div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm max-w-[85%]">
              <p class="font-bold text-slate-900 text-[11px] mb-1">Satgas BGN Pusat</p>
              <p class="text-slate-600 leading-relaxed">Halo! Selamat datang di Layanan Bantuan & Komunikasi MBG. Anda dapat menanyakan menu makanan, jadwal pengantaran, atau lapor aduan kepada Admin Satgas maupun Dapur SPPG.</p>
              <span class="text-[9px] text-slate-400 mt-1 block text-right">Baru saja</span>
            </div>
          </div>
        </div>

        <!-- QUICK REPLY TEMPLATES CAROUSEL / CHIPS -->
        <div class="p-2.5 bg-white border-t border-slate-100 flex flex-col gap-1.5 shrink-0">
          <div class="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">
            <span>Template Pertanyaan Cepat:</span>
            <span class="text-[#059669]">Klik untuk kirim</span>
          </div>
          <div id="chatQuickTemplates" class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80 text-[11px] font-medium transition-colors" data-msg="Min, makanan sekarang apa ya menunya?">
              🍛 Min makanan sekarang apa?
            </button>
            <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80 text-[11px] font-medium transition-colors" data-msg="Apakah menu hari ini ada alergen kacang, telur, atau ikan?">
              ⚠️ Ada alergen apa saja?
            </button>
            <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80 text-[11px] font-medium transition-colors" data-msg="Kira-kira jam berapa distribusi makanan sampai di sekolah kami?">
              ⏱️ Jam berapa makanan sampai?
            </button>
            <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80 text-[11px] font-medium transition-colors" data-msg="Bagaimana cara melapor jika ada porsi yang kurang atau tidak sesuai?">
              📝 Cara lapor porsi kurang
            </button>
            <button type="button" class="quick-chip whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80 text-[11px] font-medium transition-colors" data-msg="Berapa standar suhu hangat minimal makanan saat disajikan?">
              🌡️ Standar suhu hangat makanan
            </button>
          </div>
        </div>

        <!-- INPUT FOOTER -->
        <form id="mbgChatForm" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input type="text" id="mbgChatInput" placeholder="Ketik pertanyaan ke Satgas/SPPG..." required autocomplete="off" class="flex-grow px-3.5 py-2.5 bg-slate-100 text-slate-800 placeholder:text-slate-400 rounded-2xl text-xs border border-transparent focus:bg-white focus:border-[#134074] focus:outline-none transition-all">
          <button type="submit" id="btnChatSend" class="w-10 h-10 rounded-2xl bg-[#001026] hover:bg-[#134074] text-white flex items-center justify-center transition-all shrink-0 shadow-sm active:scale-95">
            <svg class="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </form>

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

    // Variabel State
    let currentTarget = 'admin'; // 'admin' atau 'sppg'
    let chatSessionId = localStorage.getItem('mbg_chat_session') || '';
    let isChatOpen = false;

    const chatBox = document.getElementById('mbgChatBox');
    const btnToggle = document.getElementById('btnToggleChat');
    const btnClose = document.getElementById('btnMinimizeChat');
    const tabAdmin = document.getElementById('tabTargetAdmin');
    const tabSppg = document.getElementById('tabTargetSppg');
    const sppgSelectWrapper = document.getElementById('sppgSelectWrapper');
    const sppgSelector = document.getElementById('chatSppgSelector');
    const chatMessages = document.getElementById('mbgChatMessages');
    const chatForm = document.getElementById('mbgChatForm');
    const chatInput = document.getElementById('mbgChatInput');
    const quickTemplateChips = document.querySelectorAll('.quick-chip');

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
          chatInput.focus();
        }, 10);
        loadChatHistory();
      } else {
        chatBox.classList.remove('scale-100', 'opacity-100');
        chatBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          chatBox.classList.add('hidden');
        }, 200);
      }
    }

    btnToggle.addEventListener('click', toggleChat);
    btnClose.addEventListener('click', () => toggleChat(false));

    // Tab Switcher (Admin vs SPPG)
    tabAdmin.addEventListener('click', () => {
      currentTarget = 'admin';
      tabAdmin.className = 'py-1.5 px-3 rounded-lg text-center transition-all bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5';
      tabSppg.className = 'py-1.5 px-3 rounded-lg text-center transition-all text-slate-300 hover:text-white flex items-center justify-center gap-1.5';
      sppgSelectWrapper.classList.add('hidden');
      chatInput.placeholder = 'Ketik pertanyaan ke Satgas BGN Pusat...';
    });

    tabSppg.addEventListener('click', () => {
      currentTarget = 'sppg';
      tabSppg.className = 'py-1.5 px-3 rounded-lg text-center transition-all bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5';
      tabAdmin.className = 'py-1.5 px-3 rounded-lg text-center transition-all text-slate-300 hover:text-white flex items-center justify-center gap-1.5';
      sppgSelectWrapper.classList.remove('hidden');
      chatInput.placeholder = 'Tanyakan ke ' + sppgSelector.value + '...';
    });

    sppgSelector.addEventListener('change', () => {
      chatInput.placeholder = 'Tanyakan ke ' + sppgSelector.value + '...';
    });

    // Quick Reply Template Clicks
    quickTemplateChips.forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.getAttribute('data-msg');
        if (msg) {
          sendMessage(msg, true);
        }
      });
    });

    // Submit Form
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = chatInput.value.trim();
      if (!txt) return;
      sendMessage(txt, false);
      chatInput.value = '';
    });

    // Send Message Function
    async function sendMessage(msgText, isTpl = false) {
      appendMessageBubble('user', 'Anda', msgText, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Typing Indicator
      const typingId = showTypingIndicator();

      try {
        const fd = new FormData();
        fd.append('action', 'send');
        fd.append('session_id', chatSessionId);
        fd.append('target_type', currentTarget);
        if (currentTarget === 'sppg') {
          fd.append('target_sppg_name', sppgSelector.value);
        }
        fd.append('message', msgText);
        if (isTpl) fd.append('is_template', '1');

        const res = await fetch(apiBase, {
          method: 'POST',
          body: fd,
          credentials: 'include'
        });
        const data = await res.json();

        removeTypingIndicator(typingId);

        if (data.status === 'success') {
          if (data.session_id) {
            chatSessionId = data.session_id;
            localStorage.setItem('mbg_chat_session', chatSessionId);
          }
          if (data.auto_reply) {
            setTimeout(() => {
              appendMessageBubble(
                data.auto_reply.sender_type,
                data.auto_reply.sender_name,
                data.auto_reply.message,
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              );
            }, 300);
          }
        }
      } catch (err) {
        removeTypingIndicator(typingId);
        appendMessageBubble('system', 'Sistem', 'Pesan gagal terkirim. Periksa koneksi internet Anda.', '');
      }
    }

    // Render Bubbles
    function appendMessageBubble(senderType, senderName, text, time) {
      const isUser = senderType === 'user';
      const bubble = document.createElement('div');
      bubble.className = isUser ? 'flex items-start justify-end gap-2' : 'flex items-start gap-2';

      if (isUser) {
        bubble.innerHTML = `
          <div class="bg-[#001026] text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%]">
            <p class="leading-relaxed break-words">${escapeHTML(text)}</p>
            <span class="text-[9px] text-slate-300 mt-1 block text-right">${time || ''}</span>
          </div>
          <div class="w-7 h-7 rounded-full bg-[#134074] text-white flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm">Anda</div>
        `;
      } else {
        const isSppg = senderType === 'sppg';
        const badgeColor = isSppg ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
        const avatarInitial = isSppg ? 'SPPG' : 'BGN';
        const avatarBg = isSppg ? 'bg-[#0b2545] text-amber-400' : 'bg-[#001026] text-[#6ffbbe]';

        bubble.innerHTML = `
          <div class="w-7 h-7 rounded-full ${avatarBg} flex items-center justify-center shrink-0 font-bold text-[9px] shadow-sm">${avatarInitial}</div>
          <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-sm max-w-[85%]">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="font-bold text-slate-900 text-[11px]">${escapeHTML(senderName)}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase ${badgeColor}">${isSppg ? 'Mitra SPPG' : 'Satgas BGN'}</span>
            </div>
            <p class="text-slate-600 leading-relaxed break-words">${escapeHTML(text)}</p>
            <span class="text-[9px] text-slate-400 mt-1 block text-right">${time || ''}</span>
          </div>
        `;
      }

      chatMessages.appendChild(bubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Typing Indicator
    function showTypingIndicator() {
      const id = 'typing_' + Date.now();
      const div = document.createElement('div');
      div.id = id;
      div.className = 'flex items-center gap-2';
      div.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 text-[10px]">•••</div>
        <div class="bg-white px-3 py-2 rounded-2xl rounded-tl-none border border-slate-200 text-slate-400 italic text-[11px] flex items-center gap-1">
          <span>Mengetik balasan</span>
          <span class="animate-bounce">.</span><span class="animate-bounce delay-100">.</span><span class="animate-bounce delay-200">.</span>
        </div>
      `;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return id;
    }

    function removeTypingIndicator(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    // Load Chat History
    async function loadChatHistory() {
      if (!chatSessionId) return;
      try {
        const res = await fetch(`${apiBase}?action=history&session_id=${encodeURIComponent(chatSessionId)}`);
        const data = await res.json();
        if (data.status === 'success' && data.messages && data.messages.length > 0) {
          // Kosongkan dan render ulang riwayat
          chatMessages.innerHTML = '';
          data.messages.forEach(m => {
            const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            appendMessageBubble(m.sender_type, m.sender_name, m.message, time);
          });
        }
      } catch (e) {
        // Abaikan jika offline
      }
    }

    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }
})();
