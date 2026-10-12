(function () {
  // Speaker biographies for the agenda embed. Clicking a speaker (a chip in a
  // session, or a card in All speakers) opens a panel with their photo, name,
  // full job title and biography. The panel sits inline, under the session's
  // speakers or after the card's row, because TI's page sizes the iframe to its
  // content: a fixed pop-up would open out of view. Biographies load on the
  // first click, from data/speaker-bios-*.json (generated from the platform by
  // build_bios.py; re-generate, don't hand-edit). Needs js/platform-skin.js.

  var SKIN = window.IACC_SKIN;
  if (!SKIN) return;

  var FILES = [
    "data/speaker-bios-1.json",
    "data/speaker-bios-2.json",
    "data/speaker-bios-3.json",
    "data/speaker-bios-4.json"
  ];
  // Reuse this script's ?v= (the deploy id), so each deploy refreshes the data.
  var script = document.currentScript;
  var version = script && script.src.indexOf("?v=") !== -1 ? script.src.split("?v=")[1] : "";
  var bios = null;
  var loading = null;

  function loadBios() {
    if (!loading) {
      // A part that fails to load just means fewer biographies: those panels
      // still show the name and full job title.
      loading = Promise.all(FILES.map(function (file) {
        return fetch(file + (version ? "?v=" + version : "")).then(function (r) {
          if (!r.ok) throw new Error(file + ": HTTP " + r.status);
          return r.json();
        }).catch(function () { return {}; });
      })).then(function (parts) {
        bios = Object.assign.apply(Object, [{}].concat(parts));
      });
    }
    return loading;
  }

  // The data is escaped HTML using p, br, strong, em and http(s) links only.
  // Belt and braces: it's parsed inert, anything else is reduced to its text,
  // and links open in a new tab rather than inside the agenda's frame.
  var ALLOWED = { P: true, BR: true, STRONG: true, EM: true, A: true };

  function fillBio(box, html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    tpl.content.querySelectorAll("*").forEach(function (el) {
      var href = el.tagName === "A" ? el.getAttribute("href") || "" : "";
      if (!ALLOWED[el.tagName] || (el.tagName === "A" && !/^https?:\/\//i.test(href))) {
        el.replaceWith(document.createTextNode(el.textContent));
        return;
      }
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        if (attr.name !== "href") el.removeAttribute(attr.name);
      });
      if (el.tagName === "A") {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    });
    box.textContent = "";
    box.appendChild(tpl.content);
  }

  function avatarFor(name) {
    var avatar = document.createElement("span");
    avatar.setAttribute("aria-hidden", "true");
    function initial() {
      avatar.className = "pf-bio-avatar speaker-avatar c-" + SKIN.colourIndex(name);
      avatar.textContent = name.charAt(0);
    }
    var photo = SKIN.photoUrl(name).replace("resize=width:140", "resize=width:240");
    if (photo) {
      avatar.className = "pf-bio-avatar speaker-avatar has-photo";
      var img = document.createElement("img");
      img.alt = "";
      img.addEventListener("error", initial);
      img.src = photo;
      avatar.appendChild(img);
    } else {
      initial();
    }
    return avatar;
  }

  var count = 0;

  function buildPanel(opener, name, title, onSessions) {
    var panel = document.createElement("div");
    panel.className = "pf-bio";
    panel.id = "pf-bio-" + (++count);
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", name);
    panel.pfOpener = opener;

    var close = document.createElement("button");
    close.type = "button";
    close.className = "pf-bio-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", function () { closePanel(panel, true); });

    var head = document.createElement("div");
    head.className = "pf-bio-head";
    var who = document.createElement("div");
    var heading = document.createElement("h4");
    heading.className = "pf-bio-name";
    heading.tabIndex = -1;
    heading.textContent = name;
    who.appendChild(heading);
    if (title) {
      var job = document.createElement("p");
      job.className = "pf-bio-title";
      job.textContent = title;
      who.appendChild(job);
    }
    head.appendChild(avatarFor(name));
    head.appendChild(who);

    var text = document.createElement("div");
    text.className = "pf-bio-text";

    panel.appendChild(close);
    panel.appendChild(head);
    panel.appendChild(text);

    if (onSessions) {
      var sessions = document.createElement("button");
      sessions.type = "button";
      sessions.className = "pf-bio-sessions";
      sessions.textContent = "Show sessions";
      sessions.addEventListener("click", function () {
        closePanel(panel, false);
        onSessions();
      });
      panel.appendChild(sessions);
    }

    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePanel(panel, true);
      }
    });

    function show() {
      var html = bios[name];
      text.classList.remove("is-loading");
      text.hidden = !html;
      if (html) fillBio(text, html);
      panel.removeAttribute("aria-busy");
    }
    if (bios) {
      show();
    } else {
      panel.setAttribute("aria-busy", "true");
      text.classList.add("is-loading");
      text.textContent = "Loading biography…";
      loadBios().then(show);
    }

    opener.setAttribute("aria-expanded", "true");
    opener.setAttribute("aria-controls", panel.id);
    return panel;
  }

  function closePanel(panel, refocus) {
    var opener = panel.pfOpener;
    panel.remove();
    if (opener) {
      opener.setAttribute("aria-expanded", "false");
      opener.removeAttribute("aria-controls");
      if (refocus) opener.focus({ preventScroll: true });
    }
  }

  // Close whatever is open inside `scope`; true if it was `opener`'s own panel.
  function closeOpen(scope, opener) {
    var open = scope && scope.querySelector(".pf-bio");
    if (!open) return false;
    var same = open.pfOpener === opener;
    closePanel(open, same);
    return same;
  }

  function reveal(panel) {
    panel.querySelector(".pf-bio-name").focus({ preventScroll: true });
    panel.scrollIntoView({ block: "nearest" });
  }

  // A chip in a session: the panel goes under that session's speakers.
  function toggleChip(chip, name, title) {
    if (closeOpen(chip.closest(".session"), chip)) return;
    var panel = buildPanel(chip, name, title, null);
    var speakers = chip.parentNode;
    speakers.parentNode.insertBefore(panel, speakers.nextSibling);
    reveal(panel);
  }

  // A card in All speakers: the panel spans the grid, after the card's row.
  function toggleCard(card, name, title, onSessions) {
    var grid = card.parentNode;
    if (closeOpen(grid, card)) return;
    var last = card;
    for (var el = card.nextElementSibling; el; el = el.nextElementSibling) {
      if (el.hidden || !el.classList.contains("pf-speaker-card")) continue;
      if (el.offsetTop !== card.offsetTop) break;
      last = el;
    }
    var panel = buildPanel(card, name, title, onSessions);
    grid.insertBefore(panel, last.nextSibling);
    reveal(panel);
  }

  function closeAll(selector) {
    document.querySelectorAll(selector).forEach(function (panel) { closePanel(panel, false); });
  }

  // Searching re-filters sessions on their text, so shut open panels first
  // (capture phase: before js/agenda.js reads the page).
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "session-search") closeAll(".pf-bio");
  }, true);

  // A narrower or wider grid moves where rows end. Only width counts: the
  // iframe growing taller as a panel opens is a resize too.
  var width = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    closeAll(".pf-speakers-grid > .pf-bio");
  });

  window.IACC_BIOS = { toggleChip: toggleChip, toggleCard: toggleCard };
})();
