"""Extract only the EXACT approved V24.8 dashboard and three original assets.
Existing 28-board player source is untouched."""
from pathlib import Path
from zipfile import ZipFile
from hashlib import sha256

ROOT=Path(__file__).resolve().parent
ARCHIVE=ROOT/"original-v24.8.zip"
EXPECTED="80f4aca94c417baef690b5a2c2bb11fd9ef4737a6ddf764cff479981dd75ab6b"
assert sha256(ARCHIVE.read_bytes()).hexdigest()==EXPECTED, "Fantasy V24.8 original ZIP checksum mismatch"
ALLOWED=(
 "templates/dashboard.html",
 "static/stadium_night_bg.jpg",
 "static/man_cave_fantasy_logo.png",
 "static/fantasy_football_field.jpeg",
)
with ZipFile(ARCHIVE) as z:
 assert all(x in z.namelist() for x in ALLOWED), "Missing approved fantasy source assets"
 for name in ALLOWED:
  target=ROOT/"runtime"/name
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_bytes(z.read(name))
print("Fantasy V24.8: approved HTML + original three artworks extracted unchanged.",flush=True)
