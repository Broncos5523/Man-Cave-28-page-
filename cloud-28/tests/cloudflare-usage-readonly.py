"""Read-only Cloudflare GraphQL snapshot; never changes Worker scripts or account settings.
Outputs only aggregated numeric sample summaries; missing access is NOT zero traffic.
"""
from datetime import datetime,timedelta,timezone
import json,os,sys
from urllib import request,error

token=os.environ.get("CLOUDFLARE_API_TOKEN","")
account=os.environ.get("CLOUDFLARE_ACCOUNT_ID","")
if not token or not account:
    print("CLOUDFLARE_ANALYTICS_UNAVAILABLE missing configured credentials")
    sys.exit(0)

now=datetime.now(timezone.utc)
periods=[("last_60m",now-timedelta(hours=1),now),
         ("last_24h",now-timedelta(hours=24),now)]
query="""query Metrics($tag:string,$lo:string,$hi:string){
  viewer { accounts(filter:{accountTag:$tag}) {
    workersInvocationsAdaptive(
      limit:1000,filter:{datetime_geq:$lo,datetime_lt:$hi}
    ){dimensions{scriptName previewSlug status}sum{requests errors}}
  }}
}"""
for label,start,end in periods:
    body={"query":query,"variables":{"tag":account,
      "lo":start.isoformat(timespec="seconds").replace("+00:00","Z"),
      "hi":end.isoformat(timespec="seconds").replace("+00:00","Z")}}
    req=request.Request("https://api.cloudflare.com/client/v4/graphql",
       data=json.dumps(body).encode(),method="POST",
       headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
    try:
        with request.urlopen(req,timeout=28) as response:
            data=json.load(response)
        if data.get("errors"):
            # Avoid printing raw authorization or account details from API errors.
            print("CLOUDFLARE_ANALYTICS_UNAVAILABLE",label,"GraphQL replied with errors; check Analytics Read scope")
            continue
        accounts=data.get("data",{}).get("viewer",{}).get("accounts",[])
        if not accounts:
            print("CLOUDFLARE_ANALYTICS_UNAVAILABLE",label,"No accessible accounts")
            continue
        records=accounts[0].get("workersInvocationsAdaptive") or []
        if not records:
            print("CLOUDFLARE_ANALYTICS_UNAVAILABLE",label,"No records; not proof of zero requests")
            continue
        by_script={}
        for row in records:
            d=row.get("dimensions") or {}
            script=str(d.get("scriptName") or "(unnamed)")
            preview=d.get("previewSlug") or "production-or-unknown"
            key=script+" ["+str(preview)+"]"
            total=by_script.setdefault(key,{"requests":0,"errors":0,"rows":0})
            total["rows"]+=1
            total["requests"]+=int((row.get("sum") or {}).get("requests") or 0)
            total["errors"]+=int((row.get("sum") or {}).get("errors") or 0)
        print("CLOUDFLARE_ANALYTICS_SAMPLE",json.dumps({
          "window":label,"start":body["variables"]["lo"],"end":body["variables"]["hi"],
          "records":len(records),"recordLimit":1000,"possiblyTruncated":len(records)>=1000,
          "sampledOrAggregatedNotAuthoritativeBilling":True,
          "byScript":by_script},sort_keys=True))
    except error.HTTPError as exc:
        print("CLOUDFLARE_ANALYTICS_UNAVAILABLE",label,"HTTP",exc.code,
          "Likely missing Account Analytics Read permission; no account changes made")
    except Exception as exc:
        print("CLOUDFLARE_ANALYTICS_UNAVAILABLE",label,type(exc).__name__)
