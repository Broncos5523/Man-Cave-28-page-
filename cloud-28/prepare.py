#!/usr/bin/env python3
"""Verify and extract the UNMODIFIED approved v8l production archive at build time."""
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen, Request
import hashlib, os, tempfile, zipfile

ROOT=Path(__file__).resolve().parent
DEST=ROOT/"source"
PACKAGE=DEST/"MAN_CAVE_28_BOARD_FINAL_PRODUCTION_v1"
SOURCE_SHA="e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f"

def extract(source):
    sha=hashlib.sha256()
    with open(source,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):sha.update(chunk)
    if sha.hexdigest()!=SOURCE_SHA:raise SystemExit("Approved source archive checksum mismatch. Deployment refused.")
    with zipfile.ZipFile(source) as z:
        entries=z.infolist()
        if len(entries)<700:raise SystemExit("Source package incomplete")
        for item in entries:
            p=Path(item.filename)
            if p.is_absolute() or ".." in p.parts or not item.filename.startswith(PACKAGE.name+"/"):
                raise SystemExit("Unrecognized archive member: "+item.filename)
            if ((item.external_attr>>16)&0o170000)==0o120000:
                raise SystemExit("Symlink rejected: "+item.filename)
        DEST.mkdir(exist_ok=True)
        z.extractall(DEST)
    if not (PACKAGE/"production_server.py").is_file():raise SystemExit("Production server missing from verified archive")
    print("Approved v8l archive verified and extracted unchanged.")

def main():
    if (PACKAGE/"production_server.py").is_file():
        print("Using previously verified source package")
        return
    # If the user explicitly approves storing the source shards in this
    # GitHub repository, validate and assemble all SIX parts in build time.
    # No part is checked in until that separate authorization is received.
    # The approved source is publicly uploaded as small Git blobs, and
    # concatenated deterministically in original six-part ordering.
    shards=ROOT/"source-parts"
    pieces=[]
    digests=[
        ("part01","cb17ced4fc72221656d1e2c228ea0d9d8c5c82bddcb56cd6f487caa1432c7a8a"),
        ("part02","967b276e7fdde80a31f43733119f640c430ff0b5f62271e56b53577c6a86563e"),
        ("part03","a6ec1cec40ddc594b383418128ac9ef167353c3e6b71248e5c1c565544777eab"),
        ("part04","394e7e437b52ada6bb5bc28aa7b3c500f71322123f6860dbae0a5415508e99d0"),
        ("part05","b004546dcedf60a887b3fc749148af9525b7af0750a1b0bcd4f23ff742a2f838"),
        ("part06","893fd3077d9b769a0ba146502d3fe726cbecd9655701e52c60e33f7a7160b9bc")
    ]
    have_signed_parts=all(os.environ.get("MANCAVE_SOURCE_PART_%02d"%i) for i in range(1,7))
    if shards.exists() and not have_signed_parts:
        for i in range(1,7):
            prefix="approved.zip.part"+str(i).zfill(2)+"."
            group=sorted(p for p in shards.iterdir() if p.name.startswith(prefix)
                         and p.name[len(prefix):].isdigit())
            if not group:
                raise SystemExit("Approved public archive incomplete: missing group "+str(i))
            if [p.name[len(prefix):] for p in group]!=[str(j).zfill(3) for j in range(len(group))]:
                raise SystemExit("Archive chunk sequence is not contiguous: "+prefix)
            pieces.extend(group)
        with tempfile.TemporaryDirectory(prefix="man-cave-v8l-") as tmp:
            full=Path(tmp)/"approved.zip"
            with full.open("wb") as out:
                for p in pieces:
                    with p.open("rb") as fragment:
                        for chunk in iter(lambda:fragment.read(1024*1024),b""):
                            out.write(chunk)
            return extract(full)
    # Short-lived, private connector-issued links are set only as Render env vars,
    # never committed to this public repository. Six concurrent downloads let the
    # cloud build complete before the signed links expire.
    signed=[os.environ.get("MANCAVE_SOURCE_PART_%02d"%i,"") for i in range(1,7)]
    if any(signed):
        if not all(signed):raise SystemExit("All six signed source parts are required.")
        from concurrent.futures import ThreadPoolExecutor
        from urllib.parse import urlparse
        expected=[x[1] for x in digests]
        with tempfile.TemporaryDirectory(prefix="man-cave-approved-source-") as temp:
            location=Path(temp)
            def fetch_one(item):
                index,url=item
                p=urlparse(url)
                if p.scheme!="https" or p.hostname!="sdmntprcentralus.oaiusercontent.com":
                    raise RuntimeError("Untrusted source part download host.")
                target=location/("part%02d"%(index+1))
                h=hashlib.sha256()
                req=Request(url,headers={"User-Agent":"ManCaveSportsBook-Approved-v8l"})
                with urlopen(req,timeout=120) as response,target.open("wb") as out:
                    for block in iter(lambda:response.read(1024*1024),b""):
                        h.update(block);out.write(block)
                if h.hexdigest()!=expected[index]:
                    raise RuntimeError("Source part %02d checksum mismatch."%(index+1))
                return target
            print("Retrieving six approved source parts from temporary, checksum-gated links...",flush=True)
            with ThreadPoolExecutor(max_workers=6) as executor:
                part_paths=list(executor.map(fetch_one,enumerate(signed)))
            full=location/"approved-production.zip"
            with full.open("wb") as out:
                for part in part_paths:
                    with part.open("rb") as source:
                        for chunk in iter(lambda:source.read(1024*1024),b""):
                            out.write(chunk)
            return extract(full)
    local=os.environ.get("MANCAVE_LOCAL_ARCHIVE","")
    if local:return extract(local)
    url=os.environ.get("MANCAVE_SOURCE_ARCHIVE_URL","")
    parsed=urlparse(url)
    if parsed.scheme!="https" or parsed.hostname not in {"github.com","drive.google.com","www.googleapis.com","storage.googleapis.com"}:
        raise SystemExit("Approved archive is not connected yet. Set MANCAVE_SOURCE_ARCHIVE_URL to an authorized HTTPS ZIP source.")
    with tempfile.TemporaryDirectory(prefix="mancave-v8l-") as tmp:
        path=Path(tmp)/"approved-v8l.zip"
        with urlopen(Request(url,headers={"User-Agent":"ManCaveSportsBook-v8l"}),timeout=150) as r,path.open("wb") as f:
            for chunk in iter(lambda:r.read(1024*1024),b""):f.write(chunk)
        extract(path)

if __name__=="__main__":main()
