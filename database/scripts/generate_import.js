/**
 * Generate SQL import untuk 30.231 SPPG dari sppg_mbgwatch.json
 * Jalankan: node database/scripts/generate_import.js
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data_sppg/sppg_mbgwatch.json'), 'utf8'));
console.log('Total records:', data.length);

const esc = s => s ? String(s).replace(/'/g, "''").trim() : '';

let sql = '-- Import ' + data.length + ' SPPG dari sppg_mbgwatch.json (MBGWatch)\n';
sql += '-- Data tanpa koordinat GPS — jalankan geocode_sppg.py setelahnya\n';
sql += '-- Jalankan di: console.neon.tech → SQL Editor\n\n';

// Hapus data lama MBGWatch dulu agar bisa re-run
sql += '-- Hapus data lama MBGWatch (aman jika belum ada)\n';
sql += "DELETE FROM sppg WHERE source = 'MBGWatch';\n\n";

// Insert dalam chunks 500 baris (Neon SQL Editor batas ~1000 per query)
const CHUNK = 500;
let total = 0;

for (let i = 0; i < data.length; i += CHUNK) {
  const chunk = data.slice(i, i + CHUNK);
  const rows = chunk.map(r => {
    const key = 'mbgwatch-' + String(r.id).padStart(5, '0');
    return [
      "('" + key + "'",
      r.id,
      "'" + esc(r.name) + "'",
      "'" + esc(r.province) + "'",
      "'" + esc(r.district) + "'",
      "'" + esc(r.subDistrict) + "'",
      "'" + esc(r.village) + "'",
      "'" + esc(r.address) + "'",
      "'MBGWatch')"
    ].join(', ');
  });

  sql += 'INSERT INTO sppg (source_key, source_row_number, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa, alamat, source) VALUES\n';
  sql += rows.join(',\n');
  sql += '\nON CONFLICT (source_key) DO NOTHING;\n\n';

  total += chunk.length;
  if (total % 5000 === 0) console.log('Generated:', total, '/', data.length);
}

const outPath = path.join(__dirname, '../import_sppg_mbgwatch.sql');
fs.writeFileSync(outPath, sql, 'utf8');

const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log('Done! Output:', outPath);
console.log('File size:', sizeMB, 'MB');
console.log('Total inserted:', data.length, 'records in', Math.ceil(data.length / CHUNK), 'chunks');
