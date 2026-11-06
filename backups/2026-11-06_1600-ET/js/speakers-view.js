(function () {
  // All-speakers view for the agenda embed, in the style of the platform's
  // Speakers page: an alphabetical card grid (photo or coloured initial, name,
  // job title). An "All speakers" pill sits at the end of the Past | Live |
  // Programme bar; the search box filters the cards; clicking a card opens the
  // speaker's biography (js/speaker-bios.js) or, without it, returns to the
  // agenda showing that speaker's sessions. Needs js/platform-skin.js first.
  // ?pf-view=speakers opens straight onto this view (for previews).

  var SKIN = window.IACC_SKIN;
  var DATA = window.IACC_SPEAKERS || {};
  var bar = document.querySelector(".pf-buckets");
  var main = document.querySelector(".agenda-main");
  var widget = document.querySelector(".agenda-widget");
  var search = document.getElementById("session-search");
  if (!SKIN || !bar || !main || !widget) return;

  // One entry per person, alphabetical like the platform's speaker list.
  var people = {};
  Object.keys(DATA).forEach(function (key) {
    DATA[key].forEach(function (p) {
      if (!people[p[0]]) people[p[0]] = { name: p[0], title: p[1] || "" };
    });
  });
  var list = Object.keys(people).sort(function (a, b) {
    return a.toUpperCase() < b.toUpperCase() ? -1 : a.toUpperCase() > b.toUpperCase() ? 1 : 0;
  }).map(function (n) { return people[n]; });
  if (!list.length) return;

  var pill = document.createElement("button");
  pill.type = "button";
  pill.className = "pf-bucket pf-speakers-pill";
  pill.innerHTML = '<span>All speakers</span><span class="pf-bucket-count"></span>';
  pill.lastChild.textContent = "(" + list.length + ")";
  pill.setAttribute("aria-pressed", "false");
  bar.appendChild(pill);

  var view = document.createElement("section");
  view.className = "pf-speakers";
  view.setAttribute("aria-label", "All speakers");
  view.hidden = true;
  var grid = document.createElement("div");
  grid.className = "pf-speakers-grid";
  var none = document.createElement("p");
  none.className = "pf-no-matches";
  none.textContent = "No speakers match your search.";
  none.hidden = true;
  view.appendChild(grid);
  view.appendChild(none);
  main.appendChild(view);

  list.forEach(function (person) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "pf-speaker-card";
    card.title = person.title ? person.name + " — " + person.title : person.name;
    card.setAttribute("data-search", (person.name + " " + person.title).toLowerCase());

    var photo = SKIN.photoUrl(person.name).replace("resize=width:140", "resize=width:360");
    var art = document.createElement("span");
    art.setAttribute("aria-hidden", "true");
    if (photo) {
      art.className = "pf-speaker-card-art has-photo";
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () {
        art.className = "pf-speaker-card-art speaker-avatar c-" + SKIN.colourIndex(person.name);
        art.textContent = person.name.charAt(0);
      });
      img.src = photo;
      art.appendChild(img);
    } else {
      art.className = "pf-speaker-card-art speaker-avatar c-" + SKIN.colourIndex(person.name);
      art.textContent = person.name.charAt(0);
    }

    var text = document.createElement("span");
    text.className = "pf-speaker-card-text";
    var n = document.createElement("span");
    n.className = "pf-speaker-card-name";
    n.textContent = person.name;
    var t = document.createElement("span");
    t.className = "pf-speaker-card-title";
    t.textContent = person.title;
    text.appendChild(n);
    text.appendChild(t);

    card.appendChild(art);
    card.appendChild(text);
    // Back to the agenda, showing this speaker's sessions.
    function showSessions() {
      show(false);
      if (search) {
        search.value = person.name;
        search.dispatchEvent(new Event("input"));
      }
      widget.scrollIntoView({ block: "start" });
    }
    card.addEventListener("click", function () {
      // With js/speaker-bios.js a click opens the speaker's biography, which has
      // a "Show sessions" button; without it, straight to their sessions.
      if (window.IACC_BIOS) return window.IACC_BIOS.toggleCard(card, person.name, person.title, showSessions);
      showSessions();
    });
    grid.appendChild(card);
  });

  function filterCards() {
    var q = ((search && search.value) || "").trim().toLowerCase();
    var shown = 0;
    grid.querySelectorAll(".pf-speaker-card").forEach(function (card) {
      var ok = !q || card.getAttribute("data-search").indexOf(q) !== -1;
      card.hidden = !ok;
      if (ok) shown++;
    });
    none.hidden = shown > 0;
    pill.lastChild.textContent = "(" + (q ? shown : list.length) + ")";
  }

  function show(on) {
    widget.classList.toggle("pf-speakers-view", on);
    view.hidden = !on;
    pill.classList.toggle("is-active", on);
    pill.setAttribute("aria-pressed", String(on));
    if (on) filterCards();
  }

  pill.addEventListener("click", function () {
    if (search && search.value) {
      search.value = "";
      search.dispatchEvent(new Event("input"));
    }
    show(true);
  });
  // Picking Past / Live / Programme goes back to the agenda.
  bar.addEventListener("click", function (e) {
    if (e.target.closest(".pf-bucket") && !e.target.closest(".pf-speakers-pill")) show(false);
  });
  if (search) {
    search.addEventListener("input", function () {
      if (widget.classList.contains("pf-speakers-view")) filterCards();
    });
  }

  if (new URLSearchParams(location.search).get("pf-view") === "speakers") show(true);
})();
