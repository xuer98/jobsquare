import json, re, sys, glob
path = sorted(glob.glob("scratchpad/jd-200649127-*.html"))[-1]
html = open(path, encoding="utf-8").read()
# title guard
m = re.search(r'<title>(.*?)</title>', html, re.S)
print("TITLE:", m.group(1).strip() if m else "NONE")
print("ID in html:", "200649127" in html)

marker = "window.__staticRouterHydrationData = JSON.parse("
i = html.find(marker)
if i == -1:
    print("NO HYDRATION MARKER"); sys.exit(1)
start = i + len(marker)
end = html.find(");</script>", start)
raw = html[start:end]
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
print("lowJobTitle:", jd.get("lowJobTitle"), "| highJobTitle:", jd.get("highJobTitle"))
print("locations:", [l.get("name") for l in jd.get("locations",[])])
print("showPayAndBenefits:", [l.get("showPayAndBenefits") for l in jd.get("locations",[])])
print("\n=== jobSummary ===\n", jd.get("jobSummary"))
print("\n=== description ===\n", jd.get("description"))
print("\n=== minimumQualifications ===\n", jd.get("minimumQualifications"))
print("\n=== preferredQualifications ===\n", jd.get("preferredQualifications"))
# comp footer
footers = jd.get("postingFooters") or data["loaderData"]["jobDetails"].get("postingFooters")
print("\n=== postingFooters raw ===")
try:
    print(json.dumps(footers, indent=1)[:3000])
except Exception as e:
    print("footers err", e, type(footers))
