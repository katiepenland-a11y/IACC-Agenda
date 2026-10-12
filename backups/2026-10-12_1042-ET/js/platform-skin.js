(function () {
  // Platform skin: small markup additions that make the embed read like the
  // agenda on the IACC participant platform. Done here at runtime, rather than
  // in the _partials/agenda-day-*.html files, so any page that doesn't load
  // this script (e.g. index.html) is untouched.

  // The day tabs only say "Tue 1 Dec" and session times are conference-local
  // (AST, UTC-4, no daylight saving) — needed to sort into Past / Live / Upcoming.
  var CONFERENCE_YEAR = 2026;
  var CONFERENCE_UTC_OFFSET = "-04:00";

  var WEEKDAYS = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
  var MONTHS = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
    Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };

  function startOf(session) {
    var first = session.querySelector(".session-time span");
    return first ? first.textContent.trim() : "";
  }

  // "Tue 1 Dec" -> "Tuesday, December 1"; anything unexpected is shown as-is.
  function longDate(short) {
    var p = short.trim().split(/\s+/);
    if (p.length === 3 && WEEKDAYS[p[0]] && MONTHS[p[2]]) {
      return WEEKDAYS[p[0]] + ", " + MONTHS[p[2]] + " " + p[1];
    }
    return short;
  }

  // 0. One column for the whole event, like the platform: every day in sequence
  //    under its own heading, instead of one day at a time behind tabs.
  var widget = document.querySelector(".agenda-widget");
  if (widget) {
    widget.classList.add("pf-one-column");
    document.querySelectorAll(".day-panel").forEach(function (panel) {
      panel.hidden = false;
      panel.removeAttribute("role");  // no longer a tab panel
    });
  }

  // 1. Day heading row at the top of each panel, like the platform.
  document.querySelectorAll(".day-tab").forEach(function (tab) {
    var panel = document.getElementById(tab.getAttribute("aria-controls"));
    var date = tab.querySelector(".day-date");
    var list = panel && panel.querySelector(".session-list");
    if (!list || !date || panel.querySelector(".day-heading")) return;
    var heading = document.createElement("div");
    heading.className = "day-heading";
    heading.innerHTML = '<span class="day-heading-gutter" aria-hidden="true"></span><h2></h2>';
    heading.querySelector("h2").textContent = longDate(date.textContent);
    panel.insertBefore(heading, list);
  });

  // 2. "start - end" line above each title (the gutter only shows the start).
  document.querySelectorAll(".session").forEach(function (session) {
    var times = session.querySelectorAll(".session-time span");
    var body = session.querySelector(".session-body");
    if (times.length < 2 || !body || body.querySelector(".session-range")) return;
    var range = document.createElement("p");
    range.className = "session-range";
    range.textContent = times[0].textContent.trim() + " - " + times[1].textContent.trim();
    body.insertBefore(range, body.firstChild);
  });

  // 3. Speaker chips, from js/speakers-data.js (window.IACC_SPEAKERS: [name, job
  //    title]) and js/speakers-photos.js (window.IACC_SPEAKER_PHOTOS) when they're
  //    loaded. Keyed by day panel + start time + normalised title, so the data
  //    survives re-ordering of the day files. Built with textContent only.
  var SPEAKERS = window.IACC_SPEAKERS || {};
  var PHOTOS = window.IACC_SPEAKER_PHOTOS || {};

  // [handle, expiry, signature] -> the resized Filestack URL the platform's
  // Avatar uses (a 70px chip at 2x); the read/convert policy is rebuilt as-is.
  function photoUrl(name) {
    var p = PHOTOS[name];
    if (!p) return "";
    var policy = btoa(JSON.stringify({ expiry: p[1], call: ["read", "convert"], handle: p[0] }));
    return "https://cdn.filestackcontent.com/resize=width:140/rotate=deg:exif/security=policy:" +
      policy + ",signature:" + p[2] + "/" + p[0];
  }

  function norm(s) {
    return (s || "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  // Same colour as the platform: its Avatar sums the name's char codes mod 10.
  function colourIndex(name) {
    var total = 0;
    for (var i = 0; i < name.length; i++) total += name.charCodeAt(i);
    return total % 10;
  }

  function showInitial(avatar, name) {
    avatar.className = "speaker-avatar c-" + colourIndex(name);
    avatar.textContent = name.charAt(0);
  }

  // One speaker chip: portrait (the platform's photo where it has one, the
  // coloured initial otherwise) beside the name and job title. Clicking opens
  // the biography; without js/speaker-bios.js it just expands the chip.
  function makeChip(name, job) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "speaker-chip";
    chip.title = job ? name + " — " + job : name;
    chip.setAttribute("aria-expanded", "false");
    chip.addEventListener("click", function () {
      if (window.IACC_BIOS) return window.IACC_BIOS.toggleChip(chip, name, job);
      var open = chip.classList.toggle("is-expanded");
      chip.setAttribute("aria-expanded", String(open));
    });

    var avatar = document.createElement("span");
    avatar.setAttribute("aria-hidden", "true");
    var photo = photoUrl(name);
    if (photo) {
      // Photo like the platform's Avatar; the coloured initial if it fails.
      avatar.className = "speaker-avatar has-photo";
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () { showInitial(avatar, name); });
      img.src = photo;
      avatar.appendChild(img);
    } else {
      showInitial(avatar, name);
    }

    var details = document.createElement("div");
    details.className = "speaker-details";
    var n = document.createElement("span");
    n.className = "speaker-name";
    n.textContent = name;
    details.appendChild(n);
    if (job) {
      var t = document.createElement("span");
      t.className = "speaker-title";
      t.textContent = job;
      details.appendChild(t);
    }

    chip.appendChild(avatar);
    chip.appendChild(details);
    return chip;
  }

  document.querySelectorAll(".day-panel").forEach(function (panel) {
    panel.querySelectorAll(".session").forEach(function (session) {
      var title = session.querySelector("h3");
      var body = session.querySelector(".session-body");
      if (!title || !body || body.querySelector(".session-speakers")) return;
      var people = SPEAKERS[panel.id + "|" + startOf(session) + "|" + norm(title.textContent)];
      var wrap = document.createElement("div");
      wrap.className = "session-speakers";
      var legacy = body.querySelector(".speakers-grid");

      if (people && people.length) {
        people.forEach(function (person) {
          wrap.appendChild(makeChip(person[0], person[1] || ""));
        });
      } else if (legacy) {
        // No skin data for this session, so build the chips from the names and
        // organisations the day file already carries — same chip, so the list
        // stacks by the same rule instead of sitting in its fixed two columns.
        legacy.querySelectorAll(".speaker").forEach(function (speaker) {
          var nameEl = speaker.querySelector("strong");
          var full = speaker.querySelector(".org-full");
          if (!nameEl) return;
          wrap.appendChild(makeChip(nameEl.textContent.trim(), full ? full.textContent.trim() : ""));
        });
      }
      if (!wrap.children.length) return;
      // The hand-authored list has now been read into chips, so drop it and
      // let the chips stand alone.
      if (legacy) legacy.remove();
      body.insertBefore(wrap, body.querySelector(".session-tags"));
    });
  });

  // Shared with optional add-ons (e.g. js/speakers-view.js).
  window.IACC_SKIN = { photoUrl: photoUrl, colourIndex: colourIndex };

  // 4. Past | Live | Upcoming, following the clock the same way the platform
  //    does: live from 5 min before a session starts until 5 min before it ends,
  //    only non-empty tabs shown, re-sorted every minute. Within the chosen tab:
  //    a start time shows once per time slot, and a day with nothing left drops
  //    out of the column. TI's label for the Upcoming tab is "Programme".
  var LIVE_BUFFER_MS = 5 * 60 * 1000;
  var BUCKETS = [["past", "Past"], ["live", "Live"], ["upcoming", "Programme"]];

  // ?pf-now=2026-12-02T10:00:00-04:00 previews the agenda at another moment.
  var nowOverride = Date.parse(new URLSearchParams(location.search).get("pf-now") || "");
  function now() { return isNaN(nowOverride) ? Date.now() : nowOverride; }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // "8:30 PM" on "Tue 1 Dec" -> epoch ms in conference-local time.
  function toMillis(dayLabel, clock) {
    var d = dayLabel.trim().split(/\s+/);
    var t = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(clock.trim());
    var month = Object.keys(MONTHS).indexOf(d[2]) + 1;
    if (d.length !== 3 || !month || !t) return NaN;
    var hour = (+t[1] % 12) + (t[3].toUpperCase() === "PM" ? 12 : 0);
    return Date.parse(CONFERENCE_YEAR + "-" + pad(month) + "-" + pad(+d[1]) + "T" +
      pad(hour) + ":" + t[2] + ":00" + CONFERENCE_UTC_OFFSET);
  }

  var timing = [];
  document.querySelectorAll(".day-tab").forEach(function (tab) {
    var panel = document.getElementById(tab.getAttribute("aria-controls"));
    var date = tab.querySelector(".day-date");
    if (!panel || !date) return;
    panel.querySelectorAll(".session").forEach(function (session) {
      var times = session.querySelectorAll(".session-time span");
      if (times.length < 2) return;
      var start = toMillis(date.textContent, times[0].textContent);
      var end = toMillis(date.textContent, times[1].textContent);
      if (end <= start) end += 24 * 60 * 60 * 1000;  // runs past midnight
      timing.push({ session: session, start: start, end: end });
    });
  });

  function bucketOf(t, at) {
    if (isNaN(t.start) || isNaN(t.end) || at < t.start - LIVE_BUFFER_MS) return "upcoming";
    return at < t.end - LIVE_BUFFER_MS ? "live" : "past";
  }

  var chosen = null;  // the tab a visitor picked; kept while it has sessions
  var bar = document.createElement("div");
  bar.className = "pf-buckets";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Show sessions");
  var buttons = {};
  BUCKETS.forEach(function (b) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pf-bucket";
    btn.innerHTML = '<span></span><span class="pf-bucket-count"></span>';
    btn.firstChild.textContent = b[1];
    btn.addEventListener("click", function () { chosen = b[0]; refresh(); });
    buttons[b[0]] = btn;
    bar.appendChild(btn);
  });
  var main = document.querySelector(".agenda-main");
  if (main && timing.length) main.insertBefore(bar, main.firstChild);

  var noMatches = document.createElement("p");
  noMatches.className = "pf-no-matches";
  noMatches.textContent = "No sessions match your filters.";
  noMatches.hidden = true;
  var panelsWrap = document.querySelector(".day-panels");
  if (panelsWrap) panelsWrap.appendChild(noMatches);

  function refresh() {
    var at = now();
    var counts = { past: 0, live: 0, upcoming: 0 };
    timing.forEach(function (t) {
      t.bucket = bucketOf(t, at);
      if (!t.session.classList.contains("is-hidden")) counts[t.bucket]++;
    });

    // Same rule as the platform: the visitor's tab while it has sessions,
    // otherwise Live, then Upcoming, then Past.
    var active = chosen && counts[chosen] ? chosen
      : counts.live ? "live" : counts.upcoming ? "upcoming" : counts.past ? "past" : "upcoming";

    BUCKETS.forEach(function (b) {
      var btn = buttons[b[0]];
      btn.hidden = counts[b[0]] === 0;
      btn.lastChild.textContent = "(" + counts[b[0]] + ")";
      btn.classList.toggle("is-active", b[0] === active);
      btn.setAttribute("aria-pressed", String(b[0] === active));
    });

    // An attribute, not a class: the observer below only watches classes.
    timing.forEach(function (t) {
      t.session.toggleAttribute("data-pf-out", t.bucket !== active);
    });

    var anyVisible = false;
    document.querySelectorAll(".day-panel").forEach(function (panel) {
      var prev = null, visible = 0;
      panel.querySelectorAll(".session").forEach(function (session) {
        if (session.classList.contains("is-hidden") || session.hasAttribute("data-pf-out")) return;
        visible++;
        var time = session.querySelector(".session-time");
        var start = startOf(session);
        if (time) time.classList.toggle("is-repeat", start === prev);
        prev = start;
      });
      panel.classList.toggle("pf-empty", visible === 0);
      if (visible) anyVisible = true;
    });
    noMatches.hidden = anyVisible;
  }

  refresh();
  setInterval(refresh, 60 * 1000);

  // Watch only each session's own class (the filters toggle .is-hidden on it);
  // refresh writes attributes and other elements, so it can't re-trigger itself.
  var observer = new MutationObserver(refresh);
  document.querySelectorAll(".session").forEach(function (session) {
    observer.observe(session, { attributes: true, attributeFilter: ["class"] });
  });

  // 5. Sidebar: a search prompt that fits the column (speakers and
  //    organisations still match), and filter chips that tell assistive
  //    technology whether they're on.
  var search = document.getElementById("session-search");
  if (search) search.placeholder = "Search sessions";

  function syncChips() {
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.setAttribute("aria-pressed", String(chip.classList.contains("is-active")));
    });
  }
  syncChips();
  // agenda.js toggles the chips in its own handlers, which run before this one.
  document.addEventListener("click", function (e) {
    if (e.target.closest(".chip, .filter-clear")) syncChips();
  });
})();
