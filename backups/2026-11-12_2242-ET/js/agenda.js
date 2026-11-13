(function () {
  // Expand/collapse toggles for descriptions and job titles (event delegation)
  document.addEventListener("click", function (e) {
    var descBtn = e.target.closest(".desc-toggle");
    if (descBtn) {
      var p = descBtn.previousElementSibling;
      var short = p.querySelector(".desc-short");
      var full = p.querySelector(".desc-full");
      var wasHidden = full.classList.contains("is-hidden");
      full.classList.toggle("is-hidden");
      short.classList.toggle("is-hidden");
      descBtn.textContent = wasHidden ? "Less" : "More";
      return;
    }
    var bioBtn = e.target.closest(".bio-toggle");
    if (bioBtn) {
      var spk = bioBtn.closest(".speaker");
      var bio = spk.querySelector(".speaker-bio");
      var wasHiddenBio = bio.classList.contains("is-hidden");
      bio.classList.toggle("is-hidden");
      spk.classList.toggle("bio-open", wasHiddenBio);
      bioBtn.textContent = wasHiddenBio ? "Hide bio" : "Bio";
      return;
    }
    var orgBtn = e.target.closest(".org-toggle");
    if (orgBtn) {
      var container = orgBtn.parentElement;
      var oshort = container.querySelector(".org-short");
      var ofull = container.querySelector(".org-full");
      var wasHiddenOrg = ofull.classList.contains("is-hidden");
      ofull.classList.toggle("is-hidden");
      oshort.classList.toggle("is-hidden");
      orgBtn.textContent = wasHiddenOrg ? "less" : "more";
    }
  });

  // Room location: take the room out of the tag row, show it prominently beside the time,
  // and build a Room Location filter group from whatever rooms appear on the sessions.
  var rooms = {};
  document.querySelectorAll(".session").forEach(function (session) {
    var tag = session.querySelector('.session-tags .tag[class*="theme-room-location-"]');
    if (!tag) return;
    var label = tag.textContent.replace(/^\s*Room Location:\s*/i, "").trim();
    var match = tag.className.match(/theme-room-location-([a-z0-9-]+)/);
    var slug = match ? match[1] : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    tag.remove();
    session.setAttribute("data-room", slug);
    rooms[slug] = label;
    var heading = session.querySelector(".session-body h3");
    if (heading) {
      var box = document.createElement("div");
      box.className = "session-room";
      box.setAttribute("aria-label", "Room location: " + label);
      box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg><div class="room-text"><small>Room</small><strong></strong></div>';
      box.querySelector("strong").textContent = label;
      heading.insertAdjacentElement("afterend", box);
    }
  });
  (function () {
    var slugs = Object.keys(rooms).sort(function (a, b) {
      return rooms[a].localeCompare(rooms[b], undefined, { numeric: true });
    });
    // the filter bar may already carry the room group (built from the platform by the daily sync)
    if (!slugs.length || document.querySelector('.filter-chips[data-filter-facet="room"]')) return;
    var group = document.createElement("div");
    group.className = "filter-group";
    group.innerHTML = '<span class="filter-label">Room Location</span><div class="filter-chips" data-filter-facet="room"></div>';
    var holder = group.querySelector(".filter-chips");
    slugs.forEach(function (slug) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("data-value", slug);
      b.textContent = rooms[slug];
      holder.appendChild(b);
    });
    var dayChips = document.querySelector('.filter-chips[data-filter-facet="day"]');
    var dayGroup = dayChips && dayChips.parentNode;
    var statusEl = document.querySelector(".agenda-filters .filter-status");
    if (dayGroup && dayGroup.parentNode) {
      dayGroup.parentNode.insertBefore(group, dayGroup.nextSibling);
    } else if (statusEl) {
      statusEl.parentNode.insertBefore(group, statusEl);
    }
  })();

  // Session filtering (search + day/type/theme/room chips)
  (function () {
    var searchInput = document.getElementById("session-search");
    var chips = document.querySelectorAll(".chip");
    var clearBtn = document.getElementById("filter-clear");
    var countEl = document.getElementById("filter-count");
    if (!chips.length) return; // filter bar not on this page

    var sessions = Array.prototype.slice.call(document.querySelectorAll(".session"));
    var dayPanels = document.querySelectorAll(".day-panel");

    var active = { type: new Set(), theme: new Set(), day: new Set(), room: new Set() };

    function ensureEmptyState(panel) {
      var el = panel.querySelector(".day-empty");
      if (!el) {
        el = document.createElement("p");
        el.className = "day-empty";
        el.textContent = "No sessions match your filters on this day.";
        panel.appendChild(el);
      }
      return el;
    }

    function apply() {
      var query = (searchInput.value || "").trim().toLowerCase();
      var visibleTotal = 0;

      dayPanels.forEach(function (panel) {
        var visibleInPanel = 0;
        var dayOk = active.day.size === 0 || active.day.has(panel.id.replace("panel-", ""));
        panel.querySelectorAll(".session").forEach(function (session) {
          var type = session.getAttribute("data-type") || "";
          var themes = (session.getAttribute("data-themes") || "").split(" ").filter(Boolean);

          var typeOk = active.type.size === 0 || type.split(" ").some(function (t) { return active.type.has(t); });
          var themeOk = active.theme.size === 0 || themes.some(function (t) { return active.theme.has(t); });

          var roomOk = active.room.size === 0 || active.room.has(session.getAttribute("data-room") || "");

          var textOk = true;
          if (query) {
            var text = session.textContent.toLowerCase();
            textOk = text.indexOf(query) !== -1;
          }

          var show = dayOk && typeOk && themeOk && roomOk && textOk;
          session.classList.toggle("is-hidden", !show);
          if (show) { visibleInPanel++; visibleTotal++; }
        });

        var emptyState = ensureEmptyState(panel);
        emptyState.classList.toggle("is-visible", visibleInPanel === 0);

        var tab = document.querySelector('.day-tab[aria-controls="' + panel.id + '"]');
        if (tab) {
          var countSpan = tab.querySelector(".day-tab-count");
          if (!countSpan) {
            countSpan = document.createElement("span");
            countSpan.className = "day-tab-count";
            tab.appendChild(countSpan);
          }
          var hasFilters = active.type.size > 0 || active.theme.size > 0 || active.day.size > 0 || active.room.size > 0 || query;
          countSpan.textContent = hasFilters ? visibleInPanel + " match" + (visibleInPanel === 1 ? "" : "es") : "";
        }
      });

      var hasFilters = active.type.size > 0 || active.theme.size > 0 || active.day.size > 0 || active.room.size > 0 || query;
      countEl.textContent = hasFilters ? visibleTotal + " session" + (visibleTotal === 1 ? "" : "s") + " match" : sessions.length + " sessions";
      clearBtn.hidden = !hasFilters;
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var facet = chip.parentElement.getAttribute("data-filter-facet");
        var value = chip.getAttribute("data-value");
        var set = active[facet];
        if (set.has(value)) { set.delete(value); chip.classList.remove("is-active"); }
        else { set.add(value); chip.classList.add("is-active"); }
        apply();
      });
    });

    searchInput.addEventListener("input", apply);

    clearBtn.addEventListener("click", function () {
      active.type.clear();
      active.theme.clear();
      active.day.clear();
      active.room.clear();
      searchInput.value = "";
      chips.forEach(function (c) { c.classList.remove("is-active"); });
      apply();
    });

    apply();
  })();

  // Day tabs
  var tabs = document.querySelectorAll(".day-tab");
  var panels = document.querySelectorAll(".day-panel");

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var day = tab.getAttribute("data-day");

      tabs.forEach(function (t) {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

      panels.forEach(function (panel) {
        var isTarget = panel.id === "panel-" + day;
        panel.classList.toggle("is-active", isTarget);
        panel.hidden = !isTarget;
      });
    });
  });

  // FAQ accordion
  var triggers = document.querySelectorAll(".accordion-trigger");
  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var expanded = trigger.getAttribute("aria-expanded") === "true";
      var panel = trigger.nextElementSibling;
      trigger.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
    });
  });

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = toggle && document.getElementById(toggle.getAttribute("aria-controls"));
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.documentElement.classList.add("js");
  }
})();
