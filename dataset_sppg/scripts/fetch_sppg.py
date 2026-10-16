#!/usr/bin/env python3
"""Fetch publicly listed operational SPPG records from BGN and export JSON.

Conservative HTML scraper: stops rather than fabricating records if the table
cannot be recognized. Review BGN's terms and robots/access guidance before use.
"""
from __future__ import annotations
import argparse, json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.bgn.go.id/operasional-sppg/"
HEADERS = {
    "User-Agent": "SPPG-MBG-monitoring-data-client/1.0 (public-data; contact project maintainer)"
}
FIELD_ALIASES = {
    "provinsi": ["provinsi sppg", "provinsi"],
    "kabupaten_kota": ["kab./kota sppg", "kabupaten/kota sppg", "kabupaten kota", "kab./kota"],
    "kecamatan": ["kecamatan sppg", "kecamatan"],
    "kelurahan_desa": ["kelurahan/desa sppg", "kelurahan/desa", "desa/kelurahan"],
    "alamat": ["alamat sppg", "alamat"],
    "nama": ["nama sppg", "nama satuan pelayanan", "nama"],
}
def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()
def key(s: str) -> str:
    return re.sub(r"[^a-z0-9/]+", " ", norm(s).lower()).strip()
def page_url(page: int) -> str:
    # The public listing has been indexed with ?page=N&search=. If the site
    # changes its pagination convention, update this function after inspection.
    return BASE_URL + "?" + urlencode({"page": page, "search": ""})
def parse_page(html: str, url: str):
    soup = BeautifulSoup(html, "html.parser")
    # Find the table whose header includes the SPPG location/name fields.
    chosen = None
    header_map = None
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue
        for tr in rows[:3]:
            headers = [norm(x.get_text(" ", strip=True)) for x in tr.find_all(["th", "td"])]
            normalized = [key(h) for h in headers]
            mapping = {}
            for field, aliases in FIELD_ALIASES.items():
                alias_keys = [key(a) for a in aliases]
                for i, h in enumerate(normalized):
                    if h in alias_keys or any(a in h for a in alias_keys):
                        mapping[field] = i
                        break
            if all(f in mapping for f in FIELD_ALIASES):
                chosen, header_map = table, mapping
                break
        if chosen:
            break
    if chosen is None:
        title = norm(soup.title.get_text(" ", strip=True)) if soup.title else "(no title)"
        raise RuntimeError(f"Tabel SPPG tidak ditemukan pada {url}; title={title!r}. Situs mungkin berubah atau memblokir request.")
    records = []
    for tr in chosen.find_all("tr"):
        cells = [norm(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
        if not cells or len(cells) <= max(header_map.values()):
            continue
        if any(key(c) in [key(a) for aliases in FIELD_ALIASES.values() for a in aliases] for c in cells):
            continue
        record = {field: cells[idx] for field, idx in header_map.items()}
        if not record.get("nama") or not record.get("provinsi"):
            continue
        # Source row number is only kept if the first cell is a plain integer.
        record["source_row_number"] = int(cells[0]) if cells[0].isdigit() else None
        record["latitude"] = None
        record["longitude"] = None
        record["status"] = "operasional"
        record["source"] = "BGN"
        record["source_url"] = url
        records.append(record)
    return records

def dedupe(records):
    seen, out = set(), []
    for r in records:
        ident = "|".join(key(r.get(k, "")) for k in
                         ("nama", "provinsi", "kabupaten_kota", "kecamatan", "kelurahan_desa", "alamat"))
        if ident in seen:
            continue
        seen.add(ident)
        out.append(r)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/sppg.json")
    ap.add_argument("--max-pages", type=int, default=10000)
    ap.add_argument("--delay", type=float, default=1.0, help="jeda antar-request dalam detik")
    ap.add_argument("--start-page", type=int, default=1)
    args = ap.parse_args()
    if args.delay < 0.5:
        ap.error("--delay minimal 0.5 detik untuk menghindari request agresif")
    session = requests.Session()
    session.headers.update(HEADERS)
    all_records, page_stats = [], []
    empty_streak = 0
    for page in range(args.start_page, args.start_page + args.max_pages):
        url = page_url(page)
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise SystemExit(f"Gagal mengambil halaman {page}: {exc}") from exc
        if "text/html" not in response.headers.get("Content-Type", "text/html"):
            raise SystemExit(f"Respons bukan HTML di halaman {page}; berhenti.")
        records = parse_page(response.text, url)
        page_stats.append({"page": page, "rows": len(records), "url": url, "http_status": response.status_code})
        print(f"Halaman {page}: {len(records)} baris", file=sys.stderr)
        if not records:
            empty_streak += 1
            if empty_streak >= 1:
                break
        else:
            empty_streak = 0
            all_records.extend(records)
        time.sleep(args.delay)
    else:
        print("Peringatan: max-pages tercapai; pastikan data tidak terpotong.", file=sys.stderr)

    if not all_records:
        raise SystemExit("Tidak ada rekaman yang terbaca. Tidak membuat dataset kosong; periksa portal/parser.")
    unique_records = dedupe(all_records)
    retrieved = datetime.now(timezone.utc).isoformat()
    output = {
        "source": "Badan Gizi Nasional (BGN)",
        "source_url": BASE_URL,
        "retrieved_at": retrieved,
        "record_count": len(unique_records),
        "records": unique_records
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    metadata = {
        "source": BASE_URL, "retrieved_at": retrieved,
        "pages_attempted": len(page_stats), "raw_rows": len(all_records),
        "unique_rows": len(unique_records),
        "duplicate_rows_removed": len(all_records) - len(unique_records),
        "pages": page_stats,
        "warning": "Cocokkan jumlah dengan portal resmi; pagination/HTML bisa berubah. Koordinat tidak dihasilkan."
    }
    meta_path = out_path.with_name(out_path.stem + ".metadata.json")
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"JSON: {out_path.resolve()}")
    print(f"Metadata: {meta_path.resolve()}")
    print(f"Rekaman unik: {len(unique_records)}")
if __name__ == "__main__":
    main()
