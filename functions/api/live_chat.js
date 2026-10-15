/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/live_chat
 * Menggantikan: api/live_chat.php
 * Live chat Satgas BGN via OpenRouter AI
 */

import { CORS, json, getSession } from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (request.method === 'POST') {
    let body = {};
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else {
      const fd = await request.formData().catch(() => null);
      if (fd) fd.forEach((v, k) => { body[k] = v; });
    }

    const message   = String(body.message || '').trim();
    const sessionId = String(body.session_id || '');

    if (!message) return json({ status: 'error', message: 'Pesan tidak boleh kosong.' }, 400);
    if (message.length > 500) return json({ status: 'error', message: 'Pesan terlalu panjang (maks 500 karakter).' }, 422);

    const apiKey  = env.OPENROUTER_API_KEY;
    const model   = env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
    const baseUrl = env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    if (!apiKey) {
      return json({
        status: 'success',
        reply: 'Layanan live chat sedang dalam pemeliharaan. Silakan hubungi Satgas BGN melalui email resmi.',
        session_id: sessionId
      });
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://mbg.jack-ai.my.id',
          'X-Title': 'Radar MBG Live Chat'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Anda adalah asisten resmi Satgas Badan Gizi Nasional (BGN) Republik Indonesia untuk program Makan Bergizi Gratis (MBG). Jawab pertanyaan dengan ramah, informatif, dan dalam Bahasa Indonesia. Fokus pada informasi MBG, SPPG, distribusi pangan, dan gizi.'
            },
            { role: 'user', content: message }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!res.ok) throw new Error(`AI API error: ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak dapat memproses permintaan ini saat ini.';

      return json({ status: 'success', reply, session_id: sessionId });
    } catch (err) {
      return json({
        status: 'success',
        reply: 'Maaf, layanan chat sedang sibuk. Silakan coba lagi dalam beberapa saat.',
        session_id: sessionId
      });
    }
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
