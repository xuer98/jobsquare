import json, re, glob, os
files = sorted(glob.glob("scratchpad/jd-200649800-*.html"), key=os.path.getmtime)
html = open(files[-1], encoding="utf-8").read()
idx = html.find("window.__staticRouterHydrationData")
start = html.find("JSON.parse(", idx) + len("JSON.parse(")
end = html.find(");</script>", start)
inner = html[start:end].strip()
if inner.startswith('"') and inner.endswith('"'): inner = inner[1:-1]
data = json.loads(json.loads('"' + inner + '"'))
jdroot = data["loaderData"]["jobDetails"]
print("jobDetails keys:", list(jdroot.keys()))
# dump full text search for pay/$ 
blob = json.dumps(data)
for kw in ["postingFooter", "Pay & Benefits", "Pay and Benefits", "annualized", "$1", "base pay", "salary", "compensation"]:
    print(f"kw {kw!r}:", blob.count(kw))
# show any footer-ish keys
for k,v in jdroot.items():
    if "foot" in k.lower() or "pay" in k.lower():
        print("KEY", k, "=>", json.dumps(v)[:500])
