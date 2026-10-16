// Contoh konsumsi API Worker dari web frontend.
// Ganti API_BASE dengan URL Worker milik project Anda.
const API_BASE = "https://GANTI-DENGAN-WORKER-ANDA.workers.dev";

export async function fetchSppgPage({ limit = 100, offset = 0, provinsi = "" } = {}) {
  const url = new URL("/api/sppg", API_BASE);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (provinsi) url.searchParams.set("provinsi", provinsi);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API SPPG gagal: HTTP ${response.status}`);
  return response.json();
}

export async function fetchAllSppg({ pageSize = 200, provinsi = "" } = {}) {
  const all = [];
  let offset = 0;
  while (true) {
    const page = await fetchSppgPage({ limit: pageSize, offset, provinsi });
    all.push(...page.data);
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.total) break;
  }
  return all;
}

// Marker peta: hanya rekaman dengan pasangan koordinat valid.
export function getMappableSppg(records) {
  return records.filter(r =>
    Number.isFinite(r.latitude) && Number.isFinite(r.longitude) &&
    r.latitude >= -90 && r.latitude <= 90 &&
    r.longitude >= -180 && r.longitude <= 180
  );
}
