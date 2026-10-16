/**
 * Split import_sppg_mbgwatch.sql menjadi file-file kecil ~500KB
 * yang bisa dijalankan satu per satu di Neon SQL Editor
 * Jalankan: node database/scripts/split_import.js
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data_sppg/sppg_mbgwatch.json'), 'utf8'));

const esc = s => s ? String(s).replace(/'/g, "''").trim() : '';

// Split data ke 6 file, tiap file ~5000 records
const FILES = 6;
const perFile = Math.ceil(data.length / FILES);
const outDir = path.join(__dirname, '../sppg_chunks');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// File pertama: hapus data lama + schema check
for (let f = 0; f < FILES; f++) {
  const start = f * perFile;
  const end = Math.min(start + perFile, data.length);
  const chunk = data.slice(start, end);

  let sql = '-- SPPG Import Bagian ' + (f + 1) + '/' + FILES + '\n';
  sql += '-- Records ' + (start + 1) + '-' + end + ' dari ' + data.length + '\n';
  if (f === 0) {
    sql += '-- JALANKAN FILE INI PERTAMA KALI\n';
    sql += "DELETE FROM sppg WHERE source = 'MBGWatch';\n\n";
  }

  // Chunk per 500 rows
  const BATCH = 500;
  for (let i = 0; i < chunk.length; i += BATCH) {
    const batch = chunk.slice(i, i + BATCH);
    const rows = batch.map(r => {
      const key = 'mbgwatch-' + String(r.id).padStart(5, '0');
      return "('" + key + "', " + r.id + ", '" + esc(r.name) + "', '" + esc(r.province) + "', '" + esc(r.district) + "', '" + esc(r.subDistrict) + "', '" + esc(r.village) + "', '" + esc(r.address) + "', 'MBGWatch')";
    });
    sql += 'INSERT INTO sppg (source_key, source_row_number, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa, alamat, source) VALUES\n';
    sql += rows.join(',\n') + '\nON CONFLICT (source_key) DO NOTHING;\n\n';
  }

  const outFile = path.join(outDir, 'import_sppg_part' + (f + 1) + '.sql');
  fs.writeFileSync(outFile, sql, 'utf8');
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log('Part ' + (f + 1) + ': ' + chunk.length + ' records, ' + kb + ' KB → ' + outFile);
}

console.log('\nDone! 6 files di database/sppg_chunks/');
console.log('Jalankan di Neon SQL Editor satu per satu: part1 → part2 → ... → part6');
