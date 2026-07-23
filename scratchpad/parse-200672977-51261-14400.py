import re, json, glob, sys
# find the unique file for this job we just wrote
files = sorted(glob.glob("scratchpad/jd-200672977-*.html"))
path = files[-1]
html = open(path, encoding="utf-8").read()
m = re.search(r'<title>(.*?)</title>', html, re.S)
print("TITLE:", m.group(1).strip() if m else None)
# hydration data
idx = html.find("window.__staticRouterHydrationData = JSON.parse(")
start = html.index("JSON.parse(", idx) + len("JSON.parse(")
end = html.index(");</script>", start)
raw = html[start:end].strip()
# raw is a quoted JS string literal
data = json.loads(json.loads(raw))
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
print("locations:", [l.get("name") for l in jd.get("locations",[])])
print("showPayAndBenefits:", [l.get("showPayAndBenefits") for l in jd.get("locations",[])])
print("=== jobSummary ===")
print(jd.get("jobSummary"))
print("=== description ===")
print(jd.get("description"))
print("=== minimumQualifications ===")
print(jd.get("minimumQualifications"))
print("=== preferredQualifications ===")
print(jd.get("preferredQualifications"))
# comp footer
pf = jd.get("postingFooters")
print("=== postingFooters ===")
if pf:
    for f in pf:
        loc = f.get("localizations",{})
        en = loc.get("en_US")
        print("FOOTER name:", f.get("name"))
        if en:
            for e in en:
                print(e.get("content"))
else:
    print("NO postingFooters key; value:", pf)
