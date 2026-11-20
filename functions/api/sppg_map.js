import { CORS, json, dbQuery } from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);

  const url = new URL(request.url);
  const provinsi = (url.searchParams.get('provinsi') || '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5000, 1), 50000);
  const bboxText = (url.searchParams.get('bbox') || '').trim();
  const bboxParts = bboxText ? bboxText.split(',').map(value => Number(value.trim())) : [];
  const bbox = bboxParts.length === 4 && bboxParts.every(Number.isFinite) &&
    bboxParts[0] <= bboxParts[2] && bboxParts[1] <= bboxParts[3] ? bboxParts : null;

  try {
    const params = [];
    let where = 'TRUE';
    if (provinsi) {
      where = 'provinsi ILIKE $1';
      params.push(provinsi);
    }

    const gpsResult = await dbQuery(env.DATABASE_URL,
      `SELECT id, nama, provinsi, kabupaten_kota, alamat, nama_yayasan,
              status, data_bulan, latitude, longitude
       FROM sppg
       WHERE ${where} AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY id LIMIT ${limit}`,
      params
    );
    const approximateResult = await dbQuery(env.DATABASE_URL,
      `SELECT provinsi, kabupaten_kota, COUNT(*)::int AS sppg_count
       FROM sppg
       WHERE ${where} AND (latitude IS NULL OR longitude IS NULL)
       GROUP BY provinsi, kabupaten_kota
       ORDER BY provinsi, kabupaten_kota LIMIT ${limit}`,
      params
    );

    let centroidData = { provinces: [], cities: [] };
    const assetUrl = new URL('/database/data/indonesia-city-centroids.json', request.url);
    const assetResponse = env.ASSETS
      ? await env.ASSETS.fetch(new Request(assetUrl))
      : await fetch(assetUrl);
    if (assetResponse.ok) centroidData = await assetResponse.json();

    const normalize = value => String(value || '').toUpperCase().trim()
      .replace(/^(KABUPATEN|KAB\.|KOTA ADMINISTRASI|KOTA)\s+/u, '')
      .replace(/\s+/gu, ' ').trim();
    const provinceAliases = { 'DAERAH ISTIMEWA YOGYAKARTA': 'DI YOGYAKARTA' };
    const provinces = {};
    const provinceCities = {};
    const cities = {};

    for (const item of centroidData.provinces || []) {
      const key = normalize(item.province);
      if (key) provinces[key] = item;
    }
    for (const item of centroidData.cities || []) {
      const provinceKey = normalize(item.province);
      const cityKey = normalize(item.city);
      if (!provinceKey || !cityKey) continue;
      provinceCities[`${provinceKey}|${cityKey}`] = item;
      (cities[cityKey] ||= []).push(item);
    }

    const features = [];
    const indexes = {};
    let mappedCount = 0;
    let approximateCount = 0;
    let gpsCount = 0;
    let unmapped = 0;

    for (const row of gpsResult.rows || []) {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        unmapped++;
        continue;
      }
      if (bbox && (latitude < bbox[0] || latitude > bbox[2] || longitude < bbox[1] || longitude > bbox[3])) continue;

      mappedCount++;
      gpsCount++;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: {
          id: Number(row.id),
          nama: row.nama,
          provinsi: row.provinsi,
          kabupaten_kota: row.kabupaten_kota,
          alamat: row.alamat,
          nama_yayasan: row.nama_yayasan,
          status: row.status,
          data_bulan: row.data_bulan,
          location_accuracy: 'gps',
          location_label: 'Koordinat GPS terdaftar',
          sppg_count: 1
        }
      });
    }

    for (const row of approximateResult.rows || []) {
      const groupCount = Number(row.sppg_count) || 0;
      let cityKey = normalize(row.kabupaten_kota);
      let provinceKey = normalize(row.provinsi);
      provinceKey = provinceAliases[provinceKey] || provinceKey;
      let centroid = provinceCities[`${provinceKey}|${cityKey}`] || null;
      if (!centroid && cities[cityKey]?.length === 1) centroid = cities[cityKey][0];

      let locationLabel = 'Perkiraan pusat kabupaten/kota';
      if (!centroid) {
        centroid = provinces[provinceKey] || null;
        locationLabel = 'Perkiraan pusat provinsi';
      }
      if (!centroid) {
        unmapped += groupCount;
        continue;
      }

      const latitude = Number(centroid.latitude);
      const longitude = Number(centroid.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        unmapped += groupCount;
        continue;
      }
      if (bbox && (latitude < bbox[0] || latitude > bbox[2] || longitude < bbox[1] || longitude > bbox[3])) continue;

      mappedCount += groupCount;
      approximateCount += groupCount;
      const key = `${provinceKey}|${cityKey}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
      if (!(key in indexes)) {
        indexes[key] = features.length;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: {
            id: null,
            nama: row.kabupaten_kota || `Wilayah ${row.provinsi || 'SPPG'}`,
            provinsi: row.provinsi,
            kabupaten_kota: row.kabupaten_kota,
            alamat: null,
            nama_yayasan: null,
            status: null,
            data_bulan: null,
            location_accuracy: 'approximate',
            location_label: locationLabel,
            sppg_count: 0,
            sample_names: []
          }
        });
      }
      features[indexes[key]].properties.sppg_count += groupCount;
    }

    return json({
      type: 'FeatureCollection',
      count: mappedCount,
      approximate_count: approximateCount,
      gps_count: gpsCount,
      unmapped,
      features
    });
  } catch (_) {
    return json({ status: 'error', message: 'Gagal mengambil data peta SPPG' }, 500);
  }
}
