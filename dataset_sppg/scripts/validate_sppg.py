#!/usr/bin/env python3
import json, sys, re
from pathlib import Path
def norm(v): return re.sub(r"\s+", " ", str(v or "")).strip().casefold()
def main(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    assert isinstance(data, dict), "Root JSON harus object"
    records = data.get("records")
    assert isinstance(records, list), "records harus array"
    required = ["nama", "provinsi", "kabupaten_kota", "kecamatan", "kelurahan_desa", "alamat", "status"]
    errors, warnings, seen = [], [], {}
    for i, r in enumerate(records):
        if not isinstance(r, dict):
            errors.append(f"records[{i}] bukan object"); continue
        for field in required:
            if not norm(r.get(field)):
                warnings.append(f"records[{i}] field kosong: {field}")
        lat, lon = r.get("latitude"), r.get("longitude")
        if (lat is None) != (lon is None):
            errors.append(f"records[{i}] hanya satu koordinat terisi")
        if lat is not None and not (-90 <= float(lat) <= 90):
            errors.append(f"records[{i}] latitude di luar rentang")
        if lon is not None and not (-180 <= float(lon) <= 180):
            errors.append(f"records[{i}] longitude di luar rentang")
        sig = "|".join(norm(r.get(k)) for k in ["nama","provinsi","kabupaten_kota","kecamatan","kelurahan_desa","alamat"])
        if sig in seen:
            warnings.append(f"Duplikat potensial records[{i}] dan records[{seen[sig]}]")
        else: seen[sig] = i
    declared = data.get("record_count")
    if declared != len(records):
        errors.append(f"record_count={declared}, tetapi records berisi {len(records)}")
    print(f"Jumlah rekaman: {len(records)}")
    print(f"Error: {len(errors)} | Peringatan: {len(warnings)}")
    for e in errors: print("ERROR:", e)
    for w in warnings[:200]: print("WARN:", w)
    if len(warnings) > 200: print(f"... {len(warnings)-200} peringatan lainnya")
    if errors: sys.exit(1)
if __name__ == "__main__":
    if len(sys.argv) != 2: print("Usage: python validate_sppg.py data/sppg.json"); sys.exit(2)
    main(sys.argv[1])
