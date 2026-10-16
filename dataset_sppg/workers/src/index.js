import pg from "pg";
const { Client } = pg;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}
function normalize(s) { return (s || "").trim(); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (url.pathname === "/api/health") return json({ ok: true, service: "sppg-mbg-api" });

    const client = new Client({ connectionString: env.DB.connectionString });
    try {
      await client.connect();
      if (url.pathname === "/api/sppg") {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
        const provinsi = normalize(url.searchParams.get("provinsi"));
        const kabupaten = normalize(url.searchParams.get("kabupaten_kota"));
        const conditions = [];
        const values = [];
        if (provinsi) { values.push(provinsi); conditions.push(`provinsi ILIKE $${values.length}`); values[values.length - 1] = provinsi; }
        if (kabupaten) { values.push(kabupaten); conditions.push(`kabupaten_kota ILIKE $${values.length}`); }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        values.push(limit, offset);
        const query = `
          SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
                 alamat, latitude, longitude, status, source, retrieved_at
          FROM sppg ${where}
          ORDER BY provinsi, kabupaten_kota, nama
          LIMIT $${values.length - 1} OFFSET $${values.length}`;
        const result = await client.query(query, values);
        const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM sppg ${where}`, values.slice(0, conditions.length));
        return json({
          source: "BGN",
          total: countResult.rows[0].total,
          limit, offset,
          data: result.rows
        });
      }
      const match = url.pathname.match(/^\/api\/sppg\/(\d+)$/);
      if (match) {
        const result = await client.query(
          `SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
                  alamat, latitude, longitude, status, source, retrieved_at
           FROM sppg WHERE id = $1`, [Number(match[1])]
        );
        return result.rowCount ? json(result.rows[0]) : json({ error: "SPPG tidak ditemukan" }, 404);
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("API database error", err?.message || err);
      return json({ error: "Internal server error" }, 500);
    } finally {
      try { await client.end(); } catch {}
    }
  }
};
