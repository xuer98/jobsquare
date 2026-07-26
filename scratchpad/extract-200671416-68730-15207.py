import json, re, sys, glob
# find the file uniquely - passed as arg
fn = sys.argv[1]
html = open(fn, encoding='utf-8').read()
# title
m = re.search(r'<title>(.*?)</title>', html, re.S)
print("TITLE:", m.group(1) if m else "NONE")
# hydration
i = html.find('window.__staticRouterHydrationData = JSON.parse(')
print("HYDRATION IDX:", i)
if i == -1:
    sys.exit("no hydration")
start = html.find('JSON.parse(', i) + len('JSON.parse(')
end = html.find(');</script>', start)
raw = html[start:end]
# raw is a quoted JS string literal
data = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(json.loads('"'+raw+'"'))
jd = data['loaderData']['jobDetails']['jobsData']
for k in ['positionId','jobNumber','reqId','postingTitle','postDateInGMT','homeOffice','standardWeeklyHours','employmentType','lowJobTitle','highJobTitle']:
    print(k, "=", jd.get(k))
print("LOCATIONS:", [l.get('name') for l in jd.get('locations',[])])
print("=== jobSummary ===")
print(jd.get('jobSummary'))
print("=== description ===")
print(jd.get('description'))
print("=== minimumQualifications ===")
print(jd.get('minimumQualifications'))
print("=== preferredQualifications ===")
print(jd.get('preferredQualifications'))
print("=== showPayAndBenefits ===", [l.get('showPayAndBenefits') for l in jd.get('locations',[])])
# comp footer
pf = data['loaderData']['jobDetails'].get('postingFooters') or jd.get('postingFooters')
print("=== postingFooters present:", bool(pf))
if pf:
    for f in pf:
        loc = f.get('localizations',{})
        en = loc.get('en_US')
        print("FOOTER name:", f.get('name'))
        if en:
            for e in en:
                print("  content:", e.get('content'))
