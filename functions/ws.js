/**
 * Cloudflare Pages Function + Durable Object
 * Route: GET /ws  (upgrade ke WebSocket)
 *
 * Flow:
 *  1. Client connect ke /ws
 *  2. Pages Function ambil singleton Durable Object "MBG_MAP_ROOM"
 *  3. Durable Object upgrade koneksi ke WebSocket
 *  4. Client kirim JSON { type:'location', id, lat, lng, name, role, accuracy }
 *  5. Durable Object broadcast ke SEMUA client yang sedang connect
 *  6. Client yang disconnect → broadcast { type:'leave', id }
 *
 * Deploy:
 *  wrangler deploy  (lihat wrangler.toml di /workers/ untuk referensi)
 *  Tambahkan di wrangler.toml:
 *    [durable_objects]
 *    bindings = [{ name = "MAP_ROOM", class_name = "MapRoom" }]
 *    [[migrations]]
 *    tag = "v1"
 *    new_classes = ["MapRoom"]
 */

// ─── Pages Function handler ────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const upgrade = request.headers.get('Upgrade');

  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return new Response('WebSocket upgrade required', { status: 426 });
  }

  // Semua client masuk ke satu room "global"
  const id = env.MAP_ROOM.idFromName('mbg-global-map');
  const stub = env.MAP_ROOM.get(id);
  return stub.fetch(request);
}

// ─── Durable Object ────────────────────────────────────────────────────────
export class MapRoom {
  constructor(state) {
    this.state = state;
    // Map clientId → { ws, info }
    this.clients = new Map();
  }

  async fetch(request) {
    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Durable Object WebSocket event hooks
  async webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    // Assign stable ID ke koneksi ini jika belum ada
    if (!this._getId(ws) && data.id) {
      this._setId(ws, data.id);
    }

    const clientId = this._getId(ws) || data.id || this._makeId();
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, { ws, info: {} });
    }

    if (data.type === 'location') {
      // Simpan info terbaru
      this.clients.get(clientId).info = {
        id: clientId,
        lat: data.lat,
        lng: data.lng,
        name: data.name || 'Pengguna',
        role: data.role || 'user',
        accuracy: data.accuracy || 0,
        ts: Date.now()
      };

      // Broadcast ke semua client (termasuk pengirim)
      const payload = JSON.stringify({
        type: 'location',
        ...this.clients.get(clientId).info
      });
      this._broadcast(payload);
    }

    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
    }

    if (data.type === 'get_all') {
      // Client baru minta snapshot semua posisi terkini
      const snapshot = [];
      for (const [, { info }] of this.clients) {
        if (info.lat) snapshot.push(info);
      }
      ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
    }
  }

  async webSocketClose(ws) {
    const clientId = this._getId(ws);
    if (clientId) {
      this.clients.delete(clientId);
      this._broadcast(JSON.stringify({ type: 'leave', id: clientId }));
    }
  }

  async webSocketError(ws) {
    const clientId = this._getId(ws);
    if (clientId) {
      this.clients.delete(clientId);
      this._broadcast(JSON.stringify({ type: 'leave', id: clientId }));
    }
  }

  _broadcast(payload) {
    const dead = [];
    for (const [id, { ws }] of this.clients) {
      try { ws.send(payload); }
      catch { dead.push(id); }
    }
    dead.forEach(id => this.clients.delete(id));
  }

  _getId(ws) { return ws.__mbgId; }
  _setId(ws, id) { ws.__mbgId = id; }
  _makeId() {
    return 'u-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}
