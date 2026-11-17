"""Wait for this exact commit's external Cloudflare deployment before browser tests."""
import json, os, time, urllib.request

sha=os.environ['GITHUB_SHA']
repo=os.environ.get('GITHUB_REPOSITORY','Broncos5523/Man-Cave-28-page-')
url=f'https://api.github.com/repos/{repo}/commits/{sha}/check-runs'
headers={'Accept':'application/vnd.github+json','User-Agent':'ManCaveDeploymentVerification/1.0'}
if os.environ.get('GITHUB_TOKEN'):headers['Authorization']='Bearer '+os.environ['GITHUB_TOKEN']
for attempt in range(55):
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as r:
        checks=json.load(r)['check_runs']
    builds=[c for c in checks if c['name']=='Workers Builds: man-cave-28-page']
    if builds:
        build=max(builds,key=lambda c:c['id'])
        if build['status']=='completed':
            if build['conclusion']!='success':raise SystemExit('This commit did not deploy: '+str(build['conclusion']))
            print('EXACT_COMMIT_CLOUDFLARE_DEPLOYED',sha,flush=True)
            break
    time.sleep(10)
else:raise SystemExit('Cloudflare did not finish deploying this exact commit')
