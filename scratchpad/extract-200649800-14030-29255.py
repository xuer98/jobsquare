import json, re, glob, sys, os

# find MY file
files = sorted(glob.glob("scratchpad/jd-200649800-*.html"), key=os.path.getmtime)
path = files[-1]
html = open(path, encoding="utf-8").read()
print("FILE:", path, "len", len(html))

m = re.search(r'<title>(.*?)</title>', html, re.S)
print("TITLE:", m.group(1) if m else None)

idx = html.find("window.__staticRouterHydrationData")
print("hydration idx:", idx)
start = html.find("JSON.parse(", idx)
after = start + len("JSON.parse(")
end = html.find(");</script>", after)
raw = html[after:end]
# raw is a JS string literal starting with " ... "
# strip surrounding quotes then double-decode
raw = raw.strip()
# raw currently is like "..."; per recipe: json.loads(json.loads('"'+inner+'"'))
# Actually raw includes the quotes. Let's handle:
if raw.startswith('"') and raw.endswith('"'):
    inner = raw[1:-1]
else:
    inner = raw
data = json.loads(json.loads('"' + inner + '"'))
jd = data["loaderData"]["jobDetails"]["jobsData"]
print("positionId:", jd.get("positionId"))
print("jobNumber:", jd.get("jobNumber"))
print("reqId:", jd.get("reqId"))
print("postingTitle:", jd.get("postingTitle"))
print("postDateInGMT:", jd.get("postDateInGMT"))
print("employmentType:", jd.get("employmentType"))
print("standardWeeklyHours:", jd.get("standardWeeklyHours"))
print("homeOffice:", jd.get("homeOffice"))
print("lowJobTitle:", jd.get("lowJobTitle"))
print("highJobTitle:", jd.get("highJobTitle"))
print("locations:", [l.get("name") for l in jd.get("locations", [])])
print("showPayAndBenefits:", [l.get("showPayAndBenefits") for l in jd.get("locations", [])])
print("\n=== jobSummary ===\n", jd.get("jobSummary"))
print("\n=== description ===\n", jd.get("description"))
print("\n=== minimumQualifications ===\n", jd.get("minimumQualifications"))
print("\n=== preferredQualifications ===\n", jd.get("preferredQualifications"))

# comp footer
pf = data["loaderData"]["jobDetails"].get("postingFooters")
print("\n=== postingFooters ===")
if pf:
    for f in pf:
        loc = f.get("localizations", {})
        en = loc.get("en_US")
        print("footer name:", f.get("name"))
        if en:
            for e in en:
                print("  content:", e.get("content"))
else:
    print("NONE")
