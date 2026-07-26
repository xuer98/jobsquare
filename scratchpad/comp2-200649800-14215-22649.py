import json, re, glob, os
files = sorted(glob.glob("scratchpad/jd-200649800-*.html"), key=os.path.getmtime)
html = open(files[-1], encoding="utf-8").read()
idx = html.find("window.__staticRouterHydrationData")
start = html.find("JSON.parse(", idx) + len("JSON.parse(")
end = html.find(");</script>", start)
inner = html[start:end].strip()
if inner.startswith('"') and inner.endswith('"'): inner = inner[1:-1]
data = json.loads(json.loads('"' + inner + '"'))
jd = data["loaderData"]["jobDetails"]["jobsData"]
print("jobsData keys:", list(jd.keys()))
pf = jd.get("postingFooters")
print("\npostingFooters type:", type(pf))
print(json.dumps(pf, indent=2)[:3000])
