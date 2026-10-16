#!/usr/bin/env python3
"""Geocode SPPG addresses via Nominatim (OpenStreetMap) and update Neon PostgreSQL."""

import os
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime

# Load DATABASE_URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError('Set DATABASE_URL env var: export DATABASE_URL="postgresql://..."')

PROGRESS_FILE = 'geocoding_progress.json'
NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'MBG-MONITORING-Geocoder/1.0 (internal-tool)'
RATE_LIMIT_SEC = 1.2  # Nominatim ToS: max 1 req/sec


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    return {'processed': [], 'failed': [], 'last_run': None}


def save_progress(progress):
    progress['last_run'] = datetime.now().isoformat()
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)


def geocode_address(address, provinsi):
    """Geocode address using Nominatim. Returns (lat, lon) or (None, None)."""
    query = f"{address}, {provinsi}, Indonesia"
    params = urllib.parse.urlencode({
        'q': query,
        'countrycodes': 'id',
        'format': 'json',
        'limit': 1,
        'addressdetails': 0
    })
    url = f'{NOMINATIM_URL}?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f'  Geocode error: {e}')
    return None, None


def main():
    import psycopg
    progress = load_progress()
    already_done = set(progress['processed'])

    with psycopg.connect(DATABASE_URL) as conn:
        # Fetch all ungeocoded SPPG
        rows = conn.execute(
            "SELECT id, source_key, nama, alamat, provinsi FROM sppg WHERE latitude IS NULL ORDER BY id"
        ).fetchall()

        print(f'Found {len(rows)} ungeocoded SPPG records.')
        skipped = 0
        updated = 0
        failed = 0

        for row in rows:
            sid, source_key, nama, alamat, provinsi = row

            if source_key in already_done:
                skipped += 1
                continue

            print(f'[{sid}] Geocoding: {nama} — {alamat}')
            lat, lon = geocode_address(alamat or nama, provinsi or '')

            if lat is not None:
                conn.execute(
                    "UPDATE sppg SET latitude=%s, longitude=%s, updated_at=NOW() WHERE id=%s",
                    (lat, lon, sid)
                )
                conn.commit()
                progress['processed'].append(source_key)
                updated += 1
                print(f'  → {lat}, {lon}')
            else:
                progress['failed'].append(source_key)
                failed += 1
                print('  → Failed to geocode')

            save_progress(progress)
            time.sleep(RATE_LIMIT_SEC)

        print(f'\nDone. Updated: {updated}, Failed: {failed}, Skipped: {skipped}')


if __name__ == '__main__':
    main()
