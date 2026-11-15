#!/usr/bin/env python3
"""Build approved immutable 28-board v8l source from permanent public Release.
The owner authorized public publication. Every build checks the original ZIP SHA.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse
import hashlib,os,tempfile,zipfile

ROOT=Path(__file__).resolve().parent
DEST=ROOT/'source'
PACKAGE=DEST/'MAN_CAVE_28_BOARD_FINAL_PRODUCTION_v1'
SOURCE_SHA='e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f'
RELEASE='https://github.com/Broncos5523/Man-Cave-28-page-/releases/download/approved-v8l-20261018/approved-v8l.zip'
def extract(filename):
    digest=hashlib.sha256()
    with open(filename,'rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''):
            digest.update(chunk)
    if digest.hexdigest()!=SOURCE_SHA:
        raise SystemExit('Approved source SHA256 mismatch: refusing deployment')
    with zipfile.ZipFile(filename) as z:
        members=z.infolist()
        if len(members)<700:raise SystemExit('Approved archive incomplete')
        for entry in members:
            member=Path(entry.filename)
            if member.is_absolute() or '..' in member.parts or not entry.filename.startswith(PACKAGE.name+'/'):
                raise SystemExit('Unrecognized archive path')
            if ((entry.external_attr>>16)&0o170000)==0o120000:
                raise SystemExit('Symlink in approved archive refused')
        DEST.mkdir(exist_ok=True)
        z.extractall(DEST)
    if not (PACKAGE/'production_server.py').is_file():
        raise SystemExit('Approved Python server missing from verified package')
    print('Verified original v8l SHA256; extracted all '+str(len(members))+' approved entries unchanged.',flush=True)

def main():
    if (PACKAGE/'production_server.py').is_file():
        print('Using existing approved source package.',flush=True)
        return
    url=os.environ.get('MANCAVE_SOURCE_ARCHIVE_URL') or RELEASE
    # No temporary connector links or credentials ever appear in the repository.
    parsed=urlparse(url)
    if parsed.scheme!='https' or parsed.hostname not in ('github.com','storage.googleapis.com'):
        raise SystemExit('Untrusted source URL')
    with tempfile.TemporaryDirectory(prefix='mancave-v8l-') as temp:
        filename=Path(temp)/'source.zip'
        print('Downloading permanent owner-approved production archive.',flush=True)
        with urlopen(Request(url,headers={'User-Agent':'ManCaveSportsBook-v8l'}),timeout=150) as src,filename.open('wb') as out:
            for chunk in iter(lambda:src.read(1024*1024),b''):
                out.write(chunk)
        extract(filename)

if __name__=='__main__':main()
