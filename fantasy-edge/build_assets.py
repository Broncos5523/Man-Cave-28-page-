#!/usr/bin/env python3
"""Copy the SHA-locked approved V24.8 fantasy board unchanged for Cloudflare assets."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile
import shutil
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/"fantasy-cloud"/"original-v24.8.zip"
EXPECTED="80f4aca94c417baef690b5a2c2bb11fd9ef4737a6ddf764cff479981dd75ab6b"
NAMES={
 "templates/dashboard.html":"index.html",
 "static/stadium_night_bg.jpg":"static/stadium_night_bg.jpg",
 "static/man_cave_fantasy_logo.png":"static/man_cave_fantasy_logo.png",
 "static/fantasy_football_field.jpeg":"static/fantasy_football_field.jpeg",
}
if sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:
    raise SystemExit("Approved original fantasy archive changed: stop")
OUT=ROOT/"dist"
if OUT.exists():shutil.rmtree(OUT)
with ZipFile(SOURCE) as zip_file:
    for original,dest in NAMES.items():
        assert original in zip_file.namelist(), original
        path=OUT/dest
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(zip_file.read(original))
        assert path.read_bytes()==zip_file.read(original)
print("PASS: exact original V24.8 HTML and three artwork assets retained, unchanged")
