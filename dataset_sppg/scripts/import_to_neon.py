#!/usr/bin/env python3
import json, os, sys, hashlib
from pathlib import Path
import psycopg
from psycopg.rows import dict_row

def source_key(r):
    raw = "|".join(str(r.get(k) or "").strip().casefold() for k in
        ["nama","provinsi","kabupaten_kota","kecamatan","kelurahan_desa","alamat"])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def main(path):
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Set environment variable DATABASE_URL terlebih dahulu.")
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    records = data.get("records", [])
    sql = """
    INSERT INTO sppg
      (source_key, source_row_number, nama, provinsi, kabupaten_kota, kecamatan,
       kelurahan_desa, alamat, latitude, longitude, status, source, source_url, retrieved_at, updated_at)
    VALUES
      (%(source_key)s, %(source_row_number)s, %(nama)s, %(provinsi)s, %(kabupaten_kota)s,
       %(kecamatan)s, %(kelurahan_desa)s, %(alamat)s, %(latitude)s, %(longitude)s,
       %(status)s, %(source)s, %(source_url)s, %(retrieved_at)s, NOW())
    ON CONFLICT (source_key) DO UPDATE SET
       source_row_number=EXCLUDED.source_row_number,
       nama=EXCLUDED.nama, provinsi=EXCLUDED.provinsi,
       kabupaten_kota=EXCLUDED.kabupaten_kota, kecamatan=EXCLUDED.kecamatan,
       kelurahan_desa=EXCLUDED.kelurahan_desa, alamat=EXCLUDED.alamat,
       latitude=COALESCE(EXCLUDED.latitude, sppg.latitude),
       longitude=COALESCE(EXCLUDED.longitude, sppg.longitude),
       status=EXCLUDED.status, source=EXCLUDED.source, source_url=EXCLUDED.source_url,
       retrieved_at=EXCLUDED.retrieved_at, updated_at=NOW()
    """
    from datetime import datetime
    retrieved = data.get("retrieved_at")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for r in records:
                row = dict(r)
                row["source_key"] = source_key(r)
                row["source"] = row.get("source", "BGN")
                row["source_url"] = row.get("source_url", data.get("source_url"))
                row["retrieved_at"] = retrieved
                cur.execute(sql, row)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM sppg")
            count = cur.fetchone()[0]
    print(f"Import selesai. Total baris di tabel sppg: {count}")
if __name__ == "__main__":
    if len(sys.argv) != 2: raise SystemExit("Usage: python import_to_neon.py data/sppg.json")
    main(sys.argv[1])
