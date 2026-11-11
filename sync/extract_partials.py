"""Cut _partials/agenda-day-N.html and _partials/agenda-filters.html out of the published embed page.

The embed page is embed.html with the day partials pasted in verbatim, so each
partial is the <div class="day-panel" id="panel-N">…</ol></div> block plus the
newline the partial file ends with.
"""
import re, sys
live = sys.argv[1]
page = open(f"{live}/embed.html", encoding="utf-8").read()
for d in range(1, 5):
    m = re.search(rf'<div class="day-panel[^"]*" id="panel-{d}"', page)
    if not m: sys.exit(f"panel-{d} not found in the embed page")
    end = page.find("</ol></div>", m.start())
    if end < 0: sys.exit(f"panel-{d} has no end")
    block = page[m.start(): end + len("</ol></div>")]
    if block.count('<div class="day-panel') != 1: sys.exit(f"panel-{d} boundaries look wrong")
    open(f"{live}/_partials/agenda-day-{d}.html", "w", encoding="utf-8").write(block + "\n")
a = page.find('<div class="agenda-filters">')
b = page.find("\n</div>\n", page.find('class="filter-status"', a))
if a < 0 or b < 0: sys.exit("filter bar not found in the embed page")
open(f"{live}/_partials/agenda-filters.html", "w", encoding="utf-8").write(page[a: b + len("\n</div>\n")])
print("embed: 4 day partials and the filter bar extracted")
