/* GDHF 2026 interactive programme — filters, day tabs, saved sessions */
(function () {
  "use strict";

  var DATA = (window.GDHF_AGENDA && window.GDHF_AGENDA.sessions) || [];
  if (!DATA.length) return;

  /* PENDING: waitlist offers / sessions not yet confirmed (updated 4 Nov 2026).
     When a presenter confirms, delete their entry here and they reappear.
     hideSessions: whole sessions to hide. items: per session, abstract codes whose
     line is removed from the description, speakers to hide, and a replacement intro. */
  var PENDING = {
    hideSessions: ["s206", "s207", "s218", "s219", "s249"], /* s249 = Transform Health Youth Networking Reception - private, keep off website (12 Nov) */
    items: {
      s200: { codes: ["7195"], sp: ["Piyumi Gamage"], intro: "Three short presentations on how digital tools can help health systems respond to climate and community health risks, from heat exposure in pregnancy and hepatitis B case finding through community pharmacies in Vietnam to an offline, voice-first generative AI companion for climate disaster preparedness in Pakistan." },
      /* 8130 Vivian Korir confirmed not attending (12 Nov) - permanent removal, do not delete */
      s214: { codes: ["8130"], sp: ["Vivian Korir"], intro: "Four presentations on gender, leadership and the frontline digital health workforce, looking at the barriers women face in digital health roles, the digital capacity of women community health workers, women's leadership programmes and training for private pharmacy staff in Kenya." },
      s221: { codes: ["7387"], sp: ["Dr Rahul Mathew"], intro: "Two short presentations on paying and equipping frontline health workers: Cameroon's digital system for campaign worker payments and an inclusive decision support platform for community health workers." },
      s222: { codes: [], sp: [], intro: "Three short presentations on strengthening frontline delivery: facial recognition for workforce verification in malaria and Vitamin A campaigns in Bauchi State, Nigeria, re-linking children with delayed immunisation to care through Ethiopia's national digital community health system, and Rwanda's national digital system for managing the health workforce lifecycle." }, /* 7919 confirmed 6 Nov */
      s224: { codes: ["7128"], sp: ["MARTIN GITHIOMI"], intro: "Five presentations on moving digital solutions from pilots into public health infrastructure, covering school-based disease surveillance, a malaria tool in Burundi's national strategy, autonomous logistics in African health systems, open climate-health data infrastructure for mortality surveillance in Malawi, and Uttar Pradesh's state-owned labour-room platform." }, /* 7128 Martin Githiomi withdrew 9 Nov - permanent removal, keep. 8447 (Tattva) confirmed 9 Nov */
      s225: { codes: ["8050", "8078"], sp: ["Joseph Ross", "Madeline Pesec", "Merrick Schaeffer", "Carlos Yerena"], intro: "A small-group roundtable workshop on how youth co-design leads to better digital solutions for adolescent health." },
      s226: { codes: ["7993", "7882"], sp: ["Victor Femi-Lawal", "Poorna Fernando"], /* 7882 Poorna Fernando removed 11 Nov - permanent, do not delete */ intro: "An unconference-style session with small table discussions. Each table is hosted by a presenter on a topic such as AI at the last mile, digital health workforce, interoperability, health financing, and climate and health. Move between tables and join the conversations that interest you." },
      s227: { codes: ["7435"], sp: ["Karthika V Menon"], intro: "Four presentations on the costs, value and financing of digital health at scale, including an economic evaluation of Ethiopia's community health information system, outcome-based payments for community workers, linking private and public providers to Nepal's social security system and Rwanda's use of claims data to reform provider payment." },
      s228: { codes: ["8254"], sp: ["Benjamin Shaibu"], intro: "Three presentations on using climate and environmental data for health, from the effects of climate variability on child diarrhoeal deaths in Ethiopia to adding climate data to DHIS2 and AI-powered community surveillance for early outbreak detection." },
      /* s215: 7807 (Tahir Buhari) confirmed 9 Nov - pending entry removed */
      s10: { codes: ["7545"], sp: ["Harsha Jayakody"] }, /* dropped out 4 Nov - permanent removal, do not delete */
      /* 11 Nov export changes - permanent removals, do not delete */
      s215: { codes: [], sp: ["Aaron Zimba"] }, /* 7891: Aaron Zimba dropped (Joe Phiri swapped for Jacob Mutale below) */
      s54: { codes: [], sp: ["Shreya Bhatt"] }, /* 7984 Panel 3: Shreya Bhatt removed */
      s22: { codes: ["8045"], sp: ["Katherine Morris", "Matthew McCarroll", "Justin Manda", "Victor Ebhodaghe"] }, /* 8045 Victor Ebhodaghe can't attend (13 Nov) - permanent, do not delete */ /* 7856 moved from Appy Hour to virtual lightning talk (s234); 8630 Justin Manda not attending (12 Nov) - permanent, do not delete */
      s53: { codes: ["7668", "7627"], sp: ["Gabriela De Jesus Cipriano Flores", "Sreevatsan Raghavan", "Karthika Kumar", "Dosila Ogira", "Mridul Chowdhury"] },
      s254: { codes: [], sp: ["Mridul Chowdhury"] }, /* Mridul Chowdhury not attending (3 Nov email, confirmed 12 Nov) - removed from 8287 here and 8689 in s53 - permanent, do not delete */ /* 7668 moved to virtual lightning talk s253 (12 Nov); 7627 Dosila Ogira can't attend (12 Nov) - permanent, do not delete */
      s119: { codes: [], sp: ["Ambrose Agweyu", "Paul Mwaniki", "Marium Hasan Rizvi"] }, /* 17 Nov: 7608 Marium moved to virtual lightning talk s258 */ /* 8323: Ambrose and Paul can't travel (16 Nov) - Robert Korom presents, combined with 7917 - permanent, do not delete */
      s109: { codes: [], sp: ["Mitali Ayyangar", "Wanjiru Waruiru"] }, /* 8037 moved from poster round 3 to round 2 (17 Nov) - permanent, do not delete */
      s131: { codes: [], sp: ["Tigest Tamrat"] }, /* 7587: Tigest Tamrat can't attend (12 Nov) - permanent removal, do not delete */
    }
  };
  /* MOVES (5 Nov 2026): move a presentation (description line + speakers) to the session
     that contains the 'to' abstract code. Permanent; do not delete. */
  var MOVES = [
    { code: "8566", sp: ["Jane Mutegi"], to: "7729" },   /* IP6 -> IP13 */
    { code: "7577", sp: ["Rabikah Yahya"], to: "7746" },  /* IP13 -> IP6 */
    { code: "8404", sp: ["Kaiyan Yousaf"], to: "7629" }   /* IP16 (Fri 2pm) -> Perpetual Stage Wed 12:20, travel conflict, agreed 5 Nov */
  ];
  function findByCode(c) {
    var re = new RegExp("(^|\\n)" + c + " - ");
    for (var i = 0; i < DATA.length; i++) { if (re.test(String(DATA[i].desc || ""))) return DATA[i]; }
    return null;
  }
  var moved = MOVES.map(function (m) {
    var src = findByCode(m.code), dst = findByCode(m.to);
    if (!src || !dst || src === dst) return null;
    var mm = String(src.desc).match(new RegExp("(^|\\n)(" + m.code + " - [^\\n]*)"));
    var line = mm ? mm[2] : null;
    var people = (src.sp || []).filter(function (p) { return m.sp.indexOf(p.n) !== -1; });
    src.sp = (src.sp || []).filter(function (p) { return m.sp.indexOf(p.n) === -1; });
    if (line) src.desc = String(src.desc).replace(new RegExp("(^|\\n)" + m.code + " - [^\\n]*"), "");
    return { dst: dst, line: line, people: people };
  });
  moved.forEach(function (x) {
    if (!x) return;
    if (x.line) x.dst.desc = String(x.dst.desc).replace(/\s*$/, "") + "\n" + x.line;
    x.dst.sp = (x.dst.sp || []).concat(x.people);
  });
  /* SPEAKER SWAPS (6 Nov 2026): replace a speaker within the session containing 'code'. Permanent. */
  var SWAPS = [
    { code: "7272", out: "Emily Porrello", inn: { n: "Palepa Lenara Tupai-Fui", a: "Samoa", b: "Lenara is a Digital Health and ICT Governance Specialist from Samoa, with practical experience in digital transformation, health information systems and ICT policy across the Pacific region.\n\nA former President of the Pacific Health Information Network (PHIN) and currently a Digital Health Advisor to Samoa's Ministry of Health, she has played a key role in advancing the nationwide implementation of Samoa's electronic health record system, connecting rural health facilities and national hospitals to strengthen continuity of care.\n\nHer work focuses on bridging the gap between digital health policy and practical implementation, with particular emphasis on health worker adoption, interoperability, workforce capacity and national ownership.\n\nAt GDHF 2026, Lenara joins her co-authors in sharing Samoa's experience of scaling a national electronic health record, reflecting a collective effort supported by national leadership, healthcare professionals, technical teams, researchers and development partners. She is passionate about translating these experiences into practical lessons for inclusive, people-centred and sustainable digital health transformation, particularly in Pacific Island settings." } },
    /* 11 Nov export changes */
    { code: "7891", out: "Joe Phiri", inn: { n: "Jacob Mutale", a: "Centre for Infectious Disease Research in Zambia", b: "Jacob Mutale is Health Informatics Manager in the Strategic Information Department at the Centre for Infectious Disease Research in Zambia (CIDRZ). He has more than thirteen years of experience in health information systems, data management and software development. His work covers electronic health records (SmartCare), DHIS2, interoperability, AI-assisted digitisation of paper health registers, and data governance…" } },
    { code: "8479", out: "Aleksa Krolls", inn: { n: "Derek Treatman", a: "OpenFn", b: "" } },
    { code: "8479", out: "__add__", inn: { n: "Catherine Sieberhagen", a: "OpenFn", b: "" } },
    { code: "8528", id: "s62", out: "Sweety Pathak", inn: { n: "Vanessa D'Souza", a: "Society for Nutrition, Education and Health Action (SNEHA)", b: "Vanessa D’Souza has served as CEO of SNEHA since March 2013, following a volunteering stint with the organisation. Prior to that, she worked with Citibank India in various positions, her last role being: Director, Citigroup Private Bank. During her tenure with Citibank she worked across various divisions including Non-Resident Indian Business, Corporate Bank, Project Re-engineering and eventually with the Private…" } },
    { code: "7383", id: "s20", out: "__add__", inn: { n: "Abel Mestie Mekonnen", a: "Federal Ministry of Health, Ethiopia", b: "Dr. Abel Mestie Mekonnen is a physician and digital health strategist with about ten years of experience leading digital health programmes in Ethiopia and across Africa, from digital patient records and telemedicine to health data governance and the safe adoption of AI. He is a Public Health Informatics Fellow at Africa CDC and Digital Health Advisor to Ethiopia’s Federal Ministry of Health. He is also Founder and Editor of Digital Health Digest, where his Digital Health OS series sets out how health systems can govern and sustain digital tools, including AI, so they stay safe, accountable and useful long after launch." } },
    { code: "8623", id: "s82", out: "__add__", inn: { n: "Danya Siddiqi", a: "Grassroots Health, Education, and Development Initiative", b: "Ms. Danya Arif Siddiqi is a Director at Grassroots and an Assistant Professor at the London School of Hygiene & Tropical Medicine. She is a development practitioner specializing in global health. Danya earned her undergraduate degree in Economics from Pakistan and was awarded the prestigious Commonwealth Scholarship to pursue her graduate degree in Development Management at The London School of Economics and…" } },
    /* 12 Nov: Nikesh Shah replaced by Shekhar Waikar (Intelehealth) - bio/photo to follow */
    { code: "8502", id: "s226", out: "Dr. Nikesh Shah", inn: { n: "Dr. Shekhar Waikar", a: "Intelehealth", b: "Dr. Shekhar Waikar is a global public health leader with 23+ years of experience in health systems strengthening, digital health, and large-scale programme implementation. He has worked extensively with national and state governments, development partners—including USAID, the Global Fund, BMGF, WHO, UNICEF and UNFPA—and the private sector to design and scale sustainable health solutions.\n\nAs Chief Operating Officer at Intelehealth, he leads operations across four countries, providing strategic direction for scaling open-source digital health solutions, including telemedicine and AI-enabled clinical decision support, from pilots into routine public health delivery. His work focuses on health-system integration, evidence-driven implementation, data governance, operational excellence, and multi-stakeholder partnerships with governments.\n\nUnder his leadership, Intelehealth’s programmes have supported 20 million+ teleconsultations, reaching 18,600+ frontline health workers and 10,400+ doctors across four countries. He brings proven expertise in translating digital innovation into sustainable, system-level impact through strong government ownership and cross-sector collaboration.\n\nHe is an alumnus of the U.S. Department of State’s International Visitor Leadership Program (IVLP), 2011, focused on emergency and pandemic response." } },
    /* 12 Nov export changes */
    { code: "8542", id: "s66", out: "__add__", inn: { n: "Sara Chamberlain", a: "", b: "" } },
    { code: "7379", id: "s67", out: "__add__", inn: { n: "Joseph Wu", a: "Luke International", b: "Dr Joseph Wu is a public health and digital health specialist with nearly two decades of experience in Malawi. He holds a PhD in Informatics from the University of Oslo and an MSc in Epidemiology from National Taiwan University. He has worked at Luke International and has lived in Malawi since 2008; he currently serves as Acting Head of Programmes and Head of Research, Innovation, Monitoring and Evaluation. He has supported Malawi’s Ministry of Health and Sanitation in strengthening digital health governance, interoperable health information systems and One Health surveillance since 2008. His work connects government leadership, local technical capacity and implementation research to advance sustainable, nationally owned digital health infrastructure." } },
    /* 13 Nov export changes */
    { code: "7383", id: "s20", out: "__add__", inn: { n: "Maureen Macharia", a: "Spindle Design", b: "Maureen Macharia is the Founder and CEO of Spindle Design, a research, design and digital innovation firm helping organisations understand users, clinical workflows and operating contexts that determine whether digital health solutions will work in practice. With over 10 years of experience in product, research, design and venture building, she has supported organisations including the Bill & Melinda Gates Foundation, UNICEF and the World Bank to move from insights to product strategy and implementation. In digital health, she has worked with partners such as PharmAccess Foundation and FSD Kenya on solutions including MomCare, supporting maternal and child health, and Afya Credit, a digital health financing product. Maureen is a Google-Certified Design Sprint Master." } },
    { code: "7383", id: "s20", out: "__add__", inn: { n: "Claudel Sebaganwa", a: "Ministry of Health Rwanda", b: "Claudel Sebaganwa is a seasoned technology leader with over a decade of experience driving digital transformation, innovation, and data-driven decision-making across the public and health sectors. Currently working with the Ministry of Health in Rwanda as an eHealth Strategic Advisor through leveraging cutting-edge technology to strengthen health systems, enhance service delivery, and improve population health outcomes.\n\nHis expertise centers on Digital health Strategy Health, Systems digitization, where he leads high-impact initiatives such as the National Centralized Electronic Medical Records (EMR) implementation to reduce patient wait times, Data intelligence through the National Intelligence Health Intelligence Centre, emergency response system deployments for improved health crisis management, and pandemic preparedness frameworks to bolster disease surveillance and prevention.\n\nBefore working with the Ministry of Health, Claudel played a pivotal role in e-government transformation in Rwanda, spearheading the digitization of 100+ government services—replacing legacy, paper-based processes with streamlined, automated solutions to enhance efficiency and citizen access." } },
    { code: "7383", id: "s20", out: "__add__", inn: { n: "Kelvin Mokaya", a: "Spindle Design", b: "Kelvin is a communications and marketing professional with over nine years of experience helping organisations communicate ideas, build meaningful connections and amplify their impact. He currently leads Communications and Marketing at Spindle Design, an Africa-focused research, design and innovation firm. His work centres on translating complex research and ideas into compelling stories that connect with audiences and strengthen organisational visibility. He is particularly interested in how technology can improve access to essential services like healthcare and create more inclusive outcomes." } },
    { code: "8264", id: "s53", out: "Claudia Lopes", inn: { n: "Beatriz Torres", a: "UNU Global Health", b: "Beatriz Torres is a Digital Health Intern at the United Nations University International Institute for Global Health (UNU Global Health) in Kuala Lumpur. Working with Dr Claudia Abreu Lopes, she researches young people’s digital mental health in Malaysia. She also contributes to UNU Global Health’s Catalysing Policy Improvement in Africa (CPIA II) programme in Burkina Faso and Mozambique.\n\nBefore joining UNU, she spent four years in UK public policy. She worked as a Social Researcher and Policy Manager at the Department for Work and Pensions and the Department of Health and Social Care, where she led the design of a £1.4 million health programme evaluation, and in policy roles in the charity sector. She holds an MPhil in Development Studies from the University of Cambridge and an MSc in Global Health and Development from UCL." } },
    { code: "7383", id: "s20", out: "__add__", inn: { n: "Elizabeth Mwanika", a: "Clinical Research Health Network (CREA-N) | London School of Hygiene & Tropical Medicine (LSHTM)", b: "Dr. Elizabeth Wangari Mwanika is a Kenyan medical doctor, public health researcher, and MPhil/PhD candidate in Public Health and Policy at the London School of Hygiene & Tropical Medicine (LSHTM).\n\nShe has over 12 years of clinical experience and currently serves as a Research Scientist at the Clinical Research Health Network (CREA-N), where she contributes to clinical research and the development of longitudinal health registries.\n\nHer research focuses on health inequalities, cancer care pathways, and health systems strengthening in sub-Saharan Africa, with particular emphasis on improving equitable access to quality healthcare.\n\nBringing together frontline clinical experience and public health research, Dr. Mwanika is interested in the responsible integration of artificial intelligence into healthcare, particularly its potential to support clinical decision-making, improve efficiency, and strengthen patient-centred care in resource-constrained settings." } },
    { code: "8037", id: "s53", out: "__add__", inn: { n: "Mitali Ayyangar", a: "DataKind", b: "Mitali (Tali) is a data-for-social-impact leader working at the intersection of global development, data science and AI. She is the Director of Global Communities at DataKind, where she leads partnerships with NGOs, governments, and frontline organizations to co-create data and AI-driven solutions that strengthen health systems, improve humanitarian response, and progress sustainable, inclusive social change. Her work centers on translating data and emerging technologies into enabling solutions that organizations and communities can leverage to drive more equitable development outcomes." } },
    { code: "8037", id: "s53", out: "__add__", inn: { n: "Wanjiru Waruiru", a: "NDANI Public Health", b: "Wanjiru Waruiru, MBA, MPH is a global health leader and epidemiologist. Her work focuses on pandemic preparedness, disease surveillance, and strengthening health systems in low- and middle-income countries. She has led multi-country programs in partnership with ministries of health, donors, NGOs, and academic institutions, including the University of California, San Francisco (UCSF) and the U.S. Centers for Disease Control and Prevention (CDC). Wanjiru currently serves as Director of the Global Portfolio at UCSF’s Center for Pandemic Preparedness and Response, where she advances innovative approaches to disease surveillance and works to center equity in global pandemic preparedness and response." } },
    { code: "8345", id: "s104", out: "Nahashon Aluoka", inn: { n: "Kristiana Bruneau", a: "Transform Health", b: "" } },
    { code: "8345", id: "s104", out: "__add__", inn: { n: "Mathilde Forslund", a: "Transform Health", b: "" } },
    { code: "7984", id: "s54", out: "__add__", inn: { n: "Divya Nair", a: "Last Mile Health", b: "Divya is Chief Technical Officer at Last Mile Health, where she works with teams across Ethiopia, Liberia, Malawi, and Sierra Leone on health systems, evidence, health finance, and digital health. Her interest is in how AI, used responsibly and inside government systems, can help community health workers deliver better care. Last Mile Health’s work in this area includes HEP Assist, an AI clinical decision-support tool developed with Ethiopia’s Ministry of Health, and a multi-country effort to build community health systems that are more human-centered and improve quality of care. She holds a PhD from Johns Hopkins and an MPA from Princeton University. Before Last Mile Health she spent over fifteen years working across sub-Saharan Africa and South Asia with governments, multilaterals, and funders, most recently as a Director at IDinsight." } },
    { code: "7984", id: "s54", out: "__add__", inn: { n: "Isaya Mollel", a: "D-tree International", b: "Isaya Mollel is a software engineer and digital health leader with more than 10 years of experience, including over seven at D-tree International. As Technology and Data Manager, he leads D-tree’s technology and data work in Tanzania and coordinates engineering across its country offices. He works with Ministries, government ICT units and partners on national community health systems, with a focus on interoperability, health data governance and the responsible use of AI in health." } },
    { code: "8521", id: "s22", out: "Abbas Wandella", inn: { n: "Isaya Mollel", a: "D-tree International", b: "Isaya Mollel is a software engineer and digital health leader with more than 10 years of experience, including over seven at D-tree International. As Technology and Data Manager, he leads D-tree’s technology and data work in Tanzania and coordinates engineering across its country offices. He works with Ministries, government ICT units and partners on national community health systems, with a focus on interoperability, health data governance and the responsible use of AI in health." } }
  ];
  SWAPS.forEach(function (w) {
    var s = w.id ? DATA.filter(function (d) { return d.id === w.id; })[0] : findByCode(w.code);
    if (!s) return;
    var had = false;
    s.sp = (s.sp || []).map(function (p) { if (p.n === w.out) { had = true; return w.inn; } return p; });
    if (!had && !(s.sp || []).some(function (p) { return p.n === w.inn.n; })) s.sp.push(w.inn);
  });

  DATA = DATA.filter(function (s) { return PENDING.hideSessions.indexOf(s.id) === -1; });
  DATA.forEach(function (s) {
    var it = PENDING.items[s.id];
    if (!it) return;
    if (s.sp) s.sp = s.sp.filter(function (p) { return it.sp.indexOf(p.n) === -1; });
    var desc = String(s.desc || "");
    it.codes.forEach(function (c) { desc = desc.replace(new RegExp("(^|\\n)" + c + " - [^\\n]*", "g"), ""); });
    if (it.intro) {
      var cut = desc.indexOf("\n\n");
      desc = it.intro + (cut > -1 ? desc.slice(cut) : "");
      if (s.sum) s.sum = it.intro;
    }
    s.desc = desc;
  });

  /* Drop placeholder speakers (TBC / TBD / TBA) so nothing unconfirmed is shown */
  var PLACEHOLDER = /\b(tbc|tbd|tba|to be (confirmed|announced|determined))\b/i;
  DATA.forEach(function (s) {
    if (s.sp) s.sp = s.sp.filter(function (p) { return !PLACEHOLDER.test(String(p.n || "")); });
  });

  /* The confirmed programme, after the removals, moves and swaps above. The speakers page reads this
     so its list always matches the agenda. */
  window.GDHF_AGENDA_FINAL = DATA;

  var DAY_NAMES = {
    "2026-12-01": { short: "Tue 1 Dec", long: "Tuesday 1 December" },
    "2026-12-02": { short: "Wed 2 Dec", long: "Wednesday 2 December" },
    "2026-12-03": { short: "Thu 3 Dec", long: "Thursday 3 December" },
    "2026-12-04": { short: "Fri 4 Dec", long: "Friday 4 December" }
  };
  var FORMATS = ["Plenary", "Pre-formed Panel", "Interactive Workshop", "Lightning Talk", "Individual Presentation", "Sponsored Session", "Poster Presentation", "Solution Demonstration", "Discovery Stage", "Reception", "Spotlight Session"];
  var THEMES = ["AI for Health", "Governance and Digital Health at Scale", "Interoperability and Digital Public Infrastructure", "Workforce Capacity and Leadership for the Digital Future", "Financing for Sustainability", "Climate and Health", "Cybersecurity, Resilience, and Continuity"];
  var MODES = ["In-person", "Virtual", "Hybrid Livestream"];
  var MODE_LABEL = { "In-person": "In person", "Virtual": "Virtual", "Hybrid Livestream": "Hybrid livestream" };
  var THEME_SHORT = {
    "AI for Health": "AI for health",
    "Governance and Digital Health at Scale": "Governance at scale",
    "Interoperability and Digital Public Infrastructure": "Interoperability & DPI",
    "Workforce Capacity and Leadership for the Digital Future": "Workforce & leadership",
    "Financing for Sustainability": "Financing",
    "Climate and Health": "Climate & health",
    "Cybersecurity, Resilience, and Continuity": "Cybersecurity"
  };
  var SAVED_KEY = "gdhf-agenda-2026-saved";

  /* One day at a time. During the Forum the page opens on today (Bangkok time); otherwise on the first full day.
     A link ending in #tue, #wed, #thu, #fri or #all opens straight on that view. */
  function bangkokToday() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) { return ""; }
  }
  var HASH_DAY = { tue: "2026-12-01", wed: "2026-12-02", thu: "2026-12-03", fri: "2026-12-04", all: "all" };
  var DAY_HASH = { "2026-12-01": "tue", "2026-12-02": "wed", "2026-12-03": "thu", "2026-12-04": "fri", "all": "all" };
  var TODAY = bangkokToday();
  var DEFAULT_DAY = DAY_NAMES[TODAY] ? TODAY : "2026-12-02";
  var hashDay = HASH_DAY[String(window.location.hash || "").replace("#", "").toLowerCase()];
  var state = { day: hashDay || DEFAULT_DAY, fmt: {}, theme: {}, mode: {}, savedOnly: false, q: "" };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function t12(t) {
    if (!t) return "";
    var p = t.split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1] || "0", 10);
    var ap = h >= 12 ? "pm" : "am";
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + (m ? ":" + (m < 10 ? "0" + m : m) : "") + " " + ap;
  }
  function toMin(t) {
    var p = String(t || "").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  var PHOTOS = (typeof window !== "undefined" && window.AGENDA_PHOTOS) || {};
  function photoFor(name) { return PHOTOS[name] || null; }
  function initials(name) {
    var parts = String(name).replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }
  /* full bios (loaded from /js/agenda-bios-*.js) replace the shortened ones when they match */
  function bioFor(p) {
    var b = String(p.b || "");
    if (!b) return "";
    var AB = window.AGENDA_BIOS || {};
    var full = AB[p.n];
    var cut = /…\s*$/.test(b);
    var stub = b.replace(/…\s*$/, "").replace(/\s+/g, " ").trim();
    if (full && stub && full.replace(/\s+/g, " ").indexOf(stub.slice(0, Math.min(stub.length, 120))) === 0) return full;
    if (!cut) return b;
    /* fall back to the last complete sentence so a bio never ends mid-sentence */
    var t = b.replace(/…\s*$/, "").trim();
    var m = t.match(/^([\s\S]*[.!?]["'”’)]?)\s+[^.!?]*$/);
    if (m && m[1].length > t.length * 0.4) return m[1];
    return b;
  }
  function loadSaved() {
    try {
      var raw = localStorage.getItem(SAVED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function storeSaved(arr) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  var saved = {};
  loadSaved().forEach(function (id) { saved[id] = true; });

  /* ---------- hero stats ---------- */
  var sessionCount = DATA.length;
  var people = {};
  DATA.forEach(function (s) {
    /* count each person once, however their name is written ("Dr. Jane Doe" and "Jane Doe" are one speaker) */
    (s.sp || []).forEach(function (p) {
      var k = String(p.n || "").toLowerCase();
      if (k.normalize) k = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      k = k.replace(/^(dr|prof|professor|mr|ms|mrs)\.?\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
      if (k) people[k] = 1;
    });
  });
  var elHeroSessions = document.getElementById("agStatSessions");
  var elHeroSpeakers = document.getElementById("agStatSpeakers");
  if (elHeroSessions) elHeroSessions.textContent = sessionCount;
  if (elHeroSpeakers) elHeroSpeakers.textContent = Object.keys(people).length;

  /* ---------- chip builders ---------- */
  function countBy(field, value) {
    var n = 0;
    /* formats are matched on the session type or its tags, exactly as the filter does, so the number on a chip is the number it shows */
    DATA.forEach(function (s) { if (s[field] === value || (field === "fmt" && (s.tags || []).indexOf(value) > -1)) n++; });
    return n;
  }
  function buildChips(container, values, key, labelFn) {
    if (!container) return;
    var html = "";
    values.forEach(function (v) {
      var n = countBy(key, v);
      if (!n) return;
      html += '<button type="button" class="ag-chip" aria-pressed="false" data-value="' + esc(v) + '">' +
        esc(labelFn ? labelFn(v) : v) + "<small>" + n + "</small></button>";
    });
    container.innerHTML = html;
    container.addEventListener("click", function (e) {
      var btn = e.target.closest(".ag-chip");
      if (!btn) return;
      var v = btn.getAttribute("data-value");
      var on = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      if (on) delete state[key][v]; else state[key][v] = true;
      render();
    });
  }

  /* day tabs */
  var elDays = document.getElementById("agDays");
  function syncDayTabs() {
    if (!elDays) return;
    Array.prototype.forEach.call(elDays.querySelectorAll(".ag-daytab"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-value") === state.day ? "true" : "false");
    });
  }
  if (elDays) {
    var dayHtml = "";
    Object.keys(DAY_NAMES).forEach(function (d) {
      var n = 0;
      DATA.forEach(function (s) { if (s.d === d) n++; });
      if (!n) return;
      var bits = DAY_NAMES[d].short.split(" ");
      dayHtml += '<button type="button" class="ag-daytab" aria-pressed="false" data-value="' + d + '"><b><span class="ag-daytab__dow">' + bits[0] + '</span> <span class="ag-daytab__date">' + bits.slice(1).join(" ") + "</span></b><small>" + n + (n === 1 ? " session" : " sessions") + "</small></button>";
    });
    dayHtml += '<button type="button" class="ag-daytab" aria-pressed="false" data-value="all"><b><span class="ag-daytab__dow">All</span> <span class="ag-daytab__date">days</span></b><small>' + DATA.length + " sessions</small></button>";
    elDays.innerHTML = dayHtml;
    syncDayTabs();
    elDays.addEventListener("click", function (e) {
      var btn = e.target.closest(".ag-daytab");
      if (!btn) return;
      state.day = btn.getAttribute("data-value");
      syncDayTabs();
      try { window.history.replaceState(null, "", "#" + (DAY_HASH[state.day] || "all")); } catch (err) {}
      render();
      /* if the reader has scrolled down the list, bring them back to the top of the new day */
      var res = elDays.parentNode;
      if (res && res.getBoundingClientRect().top < 0) {
        var pad = window.matchMedia && window.matchMedia("(max-width: 1000px)").matches ? 70 : 8;
        window.scrollTo(0, res.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - pad);
      }
    });
  }

  buildChips(document.getElementById("agFormats"), FORMATS, "fmt");
  buildChips(document.getElementById("agThemes"), THEMES, "theme");
  buildChips(document.getElementById("agModes"), MODES, "mode", function (v) { return MODE_LABEL[v] || v; });

  /* ---------- search ---------- */
  var searchWrap = document.getElementById("agSearchWrap");
  var searchInput = document.getElementById("agSearch");
  var searchClear = document.getElementById("agSearchClear");
  if (searchInput) {
    var deb;
    searchInput.addEventListener("input", function () {
      var v = searchInput.value.trim();
      if (searchWrap) searchWrap.classList.toggle("has-value", v.length > 0);
      clearTimeout(deb);
      deb = setTimeout(function () { state.q = v.toLowerCase(); render(); }, 130);
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      state.q = "";
      if (searchWrap) searchWrap.classList.remove("has-value");
      render();
      searchInput.focus();
    });
  }

  /* ---------- saved + reset ---------- */
  var savedToggle = document.getElementById("agSavedToggle");
  var savedToggleMobile = document.getElementById("agSavedToggleMobile");
  function syncSavedToggles() {
    if (savedToggle) savedToggle.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
    if (savedToggleMobile) savedToggleMobile.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }
  function toggleSaved() {
    state.savedOnly = !state.savedOnly;
    syncSavedToggles();
    render();
  }
  if (savedToggle) savedToggle.addEventListener("click", toggleSaved);
  if (savedToggleMobile) savedToggleMobile.addEventListener("click", toggleSaved);

  var resetBtn = document.getElementById("agReset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state.day = DEFAULT_DAY; state.fmt = {}; state.theme = {}; state.mode = {}; state.savedOnly = false; state.q = "";
      if (searchInput) searchInput.value = "";
      if (searchWrap) searchWrap.classList.remove("has-value");
      Array.prototype.forEach.call(document.querySelectorAll(".ag-chips .ag-chip"), function (b) {
        b.setAttribute("aria-pressed", "false");
      });
      syncDayTabs();
      syncSavedToggles();
      render();
    });
  }

  /* ---------- mobile filter panel ---------- */
  var filterToggle = document.getElementById("agFilterToggle");
  var rail = document.getElementById("agRail");
  if (filterToggle && rail) {
    filterToggle.addEventListener("click", function () {
      var open = rail.classList.toggle("is-open");
      filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- filtering ---------- */
  function matches(s) {
    /* a search, or the saved view, looks across every day */
    if (!(state.q || state.savedOnly) && state.day !== "all" && s.d !== state.day) return false;
    return matchesFilters(s);
  }
  /* every filter except the day */
  function matchesFilters(s) {
    if (state.savedOnly && !saved[s.id]) return false;
    if (hasAny(state.fmt) && !state.fmt[s.fmt] && !(s.tags || []).some(function (t) { return state.fmt[t]; })) return false;
    if (hasAny(state.theme) && !state.theme[s.theme]) return false;
    if (hasAny(state.mode) && !state.mode[s.mode]) return false;
    if (state.q) {
      var hay = (s.t + " " + (s.sum || "") + " " + s.desc + " " + (s.tags || []).join(" ") + " " +
        (s.sp || []).map(function (p) { return p.n + " " + (p.a || ""); }).join(" ")).toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }
  function hasAny(o) {
    for (var k in o) { if (o.hasOwnProperty(k) && o[k]) return true; }
    return false;
  }

  /* ---------- render ---------- */
  var body = document.getElementById("agBody");
  var emptyEl = document.getElementById("agEmpty");
  var countEl = document.getElementById("agCount");
  var countMobileEl = document.getElementById("agCountMobile");

  function cardHtml(s, slotEnd) {
    var tags = "";
    /* a card that runs to a different end than its time band gets its own slot printed on it */
    var ownSpan = (slotEnd && s.e && toMin(s.e) !== toMin(slotEnd))
      ? '<span class="ag-card__span"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3.5 2"/></svg>' + esc(t12(s.s)) + " \u2013 " + esc(t12(s.e)) + "</span>"
      : "";
    /* Sponsored sessions: show the real session type (e.g. Breakout) plus a separate Sponsored tag */
    var stags = s.tags || [];
    var isSponsored = stags.indexOf("Sponsored Session") > -1;
    var typeLabel = s.fmt;
    if (typeLabel === "Sponsored Session") {
      typeLabel = stags.filter(function (t) {
        return t !== "Sponsored Session" && t !== "Invite Only" && t !== "In-person" && t !== "Hybrid Livestream" && t !== "Virtual" && t !== s.theme;
      })[0] || "";
    }
    if (typeLabel === "Sponsored Breakout") typeLabel = "Breakout";
    if (typeLabel) tags += '<span class="ag-tag ag-tag--fmt">' + esc(typeLabel) + "</span>";
    if (isSponsored) tags += '<span class="ag-flag">Sponsored</span>';
    if (stags.indexOf("Invite Only") > -1) tags += '<span class="ag-flag">Invite only</span>';
    if (s.mode === "Virtual") {
      tags += '<span class="ag-badge ag-badge-virtual"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg>Virtual only</span>';
    } else if (s.mode === "Hybrid Livestream") {
      tags += '<span class="ag-badge ag-badge-hybrid"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.4"/><path d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 7.6a6.2 6.2 0 0 1 0 8.8M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8"/></svg>Hybrid livestream</span>';
    } /* in-person is the default and carries no label; virtual and hybrid are marked */
    if (s.theme) tags += '<span class="ag-theme" data-theme="' + esc(s.theme) + '">' + esc(THEME_SHORT[s.theme] || s.theme) + "</span>";

    var sp = s.sp || [];
    var avatars = "";
    sp.slice(0, 4).forEach(function (p) {
      var ph = photoFor(p.n);
      if (ph) {
        avatars += '<span class="ag-avatar ag-avatar--img"><img src="' + esc(ph) + '" alt="" loading="lazy" width="27" height="27"></span>';
      } else {
        avatars += '<span class="ag-avatar" aria-hidden="true">' + esc(initials(p.n)) + "</span>";
      }
    });
    if (sp.length > 4) avatars += '<span class="ag-avatar ag-avatar--more" aria-hidden="true">+' + (sp.length - 4) + "</span>";

    var names = "";
    if (sp.length === 1) names = sp[0].n;
    else if (sp.length === 2) names = sp[0].n + " &amp; " + sp[1].n;
    else if (sp.length > 2) names = sp[0].n + " and " + (sp.length - 1) + " more";

    var hasDetail = !!s.desc || sp.length > 0;
    var detail = "";
    if (hasDetail) {
      var label = s.desc && sp.length ? "Abstract &amp; speakers" : (s.desc ? "Full abstract" : "Speakers");
      var inner = "";
      if (s.desc) inner += '<div class="ag-detail__desc">' + esc(s.desc) + "</div>";
      sp.forEach(function (p) {
        var ph = photoFor(p.n);
        inner += '<div class="ag-spk">';
        if (ph) inner += '<img class="ag-spk__photo" src="' + esc(ph) + '" alt="' + esc(p.n) + '" loading="lazy" width="40" height="40">';
        else inner += '<span class="ag-spk__photo ag-spk__photo--init" aria-hidden="true">' + esc(initials(p.n)) + "</span>";
        inner += '<div class="ag-spk__body"><p class="ag-spk__name">' + esc(p.n) + "</p>";
        if (p.a) inner += '<p class="ag-spk__org">' + esc(p.a) + "</p>";
        var bio = bioFor(p);
        if (bio) {
          var long = bio.length > 260;
          inner += '<p class="ag-spk__bio' + (long ? " is-clamped" : "") + '">' + esc(bio) + "</p>";
          if (long) inner += '<button type="button" class="ag-spk__more" data-more aria-expanded="false">Read more</button>';
        }
        inner += "</div></div>";
      });
      detail = "<details><summary>" + label + "</summary>" + inner + "</details>";
    }

    var isSaved = !!saved[s.id];
    var modeClass = s.mode === "Virtual" ? " ag-card--virtual" : (s.mode === "Hybrid Livestream" ? " ag-card--hybrid" : "");
    return '<article class="ag-card' + (isSaved ? " is-saved" : "") + modeClass + '" data-id="' + esc(s.id) + '">' +
      '<button type="button" class="ag-save" data-save="' + esc(s.id) + '" aria-pressed="' + (isSaved ? "true" : "false") + '" aria-label="Save ' + esc(s.t) + ' to your agenda" title="Save to your agenda">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="' + (isSaved ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
      "</button>" +
      (tags || ownSpan ? '<div class="ag-card__tags">' + ownSpan + tags + "</div>" : '<div class="ag-card__tags"></div>') +
      '<h3 class="ag-card__title">' + esc(s.t) + "</h3>" +
      ((s.sum || s.desc) ? '<p class="ag-card__desc">' + esc(s.sum || s.desc) + "</p>" : "") +
      (sp.length ? '<div class="ag-card__people"><div class="ag-avatars">' + avatars + '</div><p class="ag-card__names">' + names + "</p></div>" : "") +
      detail +
      "</article>";
  }

  /* A run of back-to-back virtual lightning talks, drawn as one compact block.
     Each row opens to the talk's full card (abstract, speaker, save). */
  function isVirtualTalk(s) { return s.fmt === "Lightning Talk" && s.mode === "Virtual"; }
  function runHtml(slot) {
    var rows = "";
    slot.items.forEach(function (s) {
      var sp = s.sp || [];
      var who = sp.length ? sp[0].n + (sp[0].a ? ", " + sp[0].a : "") + (sp.length > 1 ? " +" + (sp.length - 1) : "") : "";
      rows += '<details class="ag-run__item' + (saved[s.id] ? " is-saved" : "") + '"><summary>' +
        '<span class="ag-run__time">' + esc(t12(s.s)) + "</span>" +
        '<span class="ag-run__text"><span class="ag-run__name">' + esc(s.t) + "</span>" +
        (who ? '<span class="ag-run__who">' + esc(who) + "</span>" : "") + "</span>" +
        "</summary>" + cardHtml(s, s.e) + "</details>";
    });
    return '<div class="ag-slot ag-slot--run">' +
      '<div class="ag-slot__time">' + esc(t12(slot.start)) + "<span>" + (slot.end ? "\u00a0– " + esc(t12(slot.end)) : "") + "</span></div>" +
      '<div class="ag-run"><div class="ag-run__head">' +
      '<span class="ag-badge ag-badge-virtual"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg>Virtual only</span>' +
      '<h3 class="ag-run__title">Virtual lightning talks</h3>' +
      '<span class="ag-run__meta">' + slot.items.length + " talks. Select a talk for its abstract and speaker.</span>" +
      "</div>" + rows + "</div></div>";
  }

  function render() {
    var shown = DATA.filter(matches);
    var anyDay = !!(state.q || state.savedOnly);
    if (elDays) elDays.classList.toggle("is-anyday", anyDay);
    if (countEl) countEl.innerHTML = "<b>" + shown.length + "</b> " + (shown.length === 1 ? "session" : "sessions") + (shown.length !== DATA.length ? " of " + DATA.length : "") + (anyDay ? ' <span class="ag-results__any">across all days</span>' : "");
    if (countMobileEl) countMobileEl.textContent = shown.length + (shown.length === 1 ? " session" : " sessions");

    /* each day tab shows how many sessions match the current filters on that day */
    var perDay = {}, across = 0;
    DATA.forEach(function (s) { if (matchesFilters(s)) { perDay[s.d] = (perDay[s.d] || 0) + 1; across++; } });
    if (elDays) {
      Array.prototype.forEach.call(elDays.querySelectorAll(".ag-daytab"), function (b) {
        var v = b.getAttribute("data-value");
        var n = v === "all" ? across : (perDay[v] || 0);
        var sm = b.querySelector("small");
        if (sm) sm.textContent = n + (n === 1 ? " session" : " sessions");
        b.classList.toggle("is-zero", !n);
      });
    }

    if (!shown.length) {
      if (body) body.innerHTML = "";
      if (emptyEl) {
        /* nothing on the chosen day, but matches on other days: say so and offer the days that have them */
        if (across && DAY_NAMES[state.day]) {
          var eh = "<strong>Nothing on " + DAY_NAMES[state.day].short + " matches those filters.</strong> Matching sessions are on:<span class=\"ag-empty__days\">";
          Object.keys(DAY_NAMES).forEach(function (d) {
            if (perDay[d]) eh += '<button type="button" class="ag-empty__day" data-day="' + d + '">' + DAY_NAMES[d].short + " <b>" + perDay[d] + "</b></button>";
          });
          eh += '<button type="button" class="ag-empty__day" data-day="all">All days <b>' + across + "</b></button></span>";
          emptyEl.innerHTML = eh;
        } else {
          emptyEl.innerHTML = "<strong>No sessions match those filters.</strong> Try clearing a filter.";
        }
        emptyEl.hidden = false;
      }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var byDay = {};
    shown.forEach(function (s) {
      (byDay[s.d] = byDay[s.d] || []).push(s);
    });

    var html = "";
    Object.keys(byDay).sort().forEach(function (d) {
      var daySessions = byDay[d];
      var meta = DAY_NAMES[d] || { short: d, long: d };
      html += '<section class="ag-day" aria-label="' + esc(meta.long) + '">';
      html += '<div class="ag-day__head"><h2 class="ag-day__name">' + esc(meta.long) + "</h2>" +
        '<span class="ag-day__rule"></span>' +
        '<span class="ag-day__count">' + daySessions.length + (daySessions.length === 1 ? " session" : " sessions") + "</span></div>";

      /* Bands are keyed by start AND end time, so sessions of different lengths never share a
         band (e.g. a 90-minute poster round gets its own band next to 30-minute sessions).
         Breaks are drawn as a divider line on the timeline instead of a band. */
      var BREAK_RE = /\b(tea|coffee|lunch)\s*break\b/i;
      function isBreak(x) { return BREAK_RE.test(String(x.t || "")); }
      var slots = {};
      var order = [];
      /* Back-to-back virtual lightning talks collapse into one block (not while searching or in the saved view) */
      var inRun = {};
      if (!anyDay) {
        var runs = [];
        var cur = null;
        daySessions.filter(isVirtualTalk).sort(function (a, b) { return toMin(a.s) - toMin(b.s); }).forEach(function (s) {
          var sEnd = s.e || s.s;
          if (cur && toMin(s.s) - toMin(cur.end) <= 10) {
            cur.items.push(s);
            if (toMin(sEnd) > toMin(cur.end)) cur.end = sEnd;
          } else {
            cur = { start: s.s, end: sEnd, items: [s] };
            runs.push(cur);
          }
        });
        runs.forEach(function (r, i) {
          if (r.items.length < 2) return;
          r.items.forEach(function (s) { inRun[s.id] = true; });
          var rk = "R|" + r.start + "|" + r.end + "|" + i;
          slots[rk] = { start: r.start, end: r.end, brk: false, run: true, items: r.items };
          order.push(rk);
        });
      }
      daySessions.forEach(function (s) {
        if (inRun[s.id]) return;
        var brk = isBreak(s);
        var k = (brk ? "B" : "S") + "|" + s.s + "|" + (s.e || "") + (brk ? "|" + s.id : "");
        if (!slots[k]) { slots[k] = { start: s.s, end: s.e || "", brk: brk, items: [] }; order.push(k); }
        slots[k].items.push(s);
      });
      order.sort(function (a, b) {
        var A = slots[a], B = slots[b];
        return (toMin(A.start) - toMin(B.start)) || ((B.brk ? 1 : 0) - (A.brk ? 1 : 0)) || (toMin(A.end) - toMin(B.end));
      });

      order.forEach(function (key) {
        var slot = slots[key];
        if (slot.brk) {
          var b = slot.items[0];
          html += '<div class="ag-breakrow"><div class="ag-break" data-id="' + esc(b.id) + '"><span class="ag-break__label">' + esc(b.t) + '</span><span class="ag-break__time">' + esc(t12(b.s)) + (b.e ? " – " + esc(t12(b.e)) : "") + "</span></div></div>";
          return;
        }
        if (slot.run) { html += runHtml(slot); return; }
        var start = slot.start, end = slot.end;
        html += '<div class="ag-slot">';
        html += '<div class="ag-slot__time">' + esc(t12(start)) + "<span>" + (end ? "\u00a0– " + esc(t12(end)) : "") + "</span></div>";
        html += '<div class="ag-slot__cards">';
        slot.items.forEach(function (s) { html += cardHtml(s, end); });
        html += "</div></div>";
      });
      html += "</section>";
    });

    if (body) body.innerHTML = html;
  }

  /* ---------- bio read more / less (delegated) ---------- */
  if (body) {
    body.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-more]");
      if (!btn) return;
      var bioEl = btn.previousElementSibling;
      if (!bioEl) return;
      var open = bioEl.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Show less" : "Read more";
    });
  }

  /* ---------- empty view: jump to a day that has matching sessions ---------- */
  if (emptyEl) {
    emptyEl.addEventListener("click", function (e) {
      var b = e.target.closest(".ag-empty__day");
      if (!b) return;
      state.day = b.getAttribute("data-day");
      syncDayTabs();
      try { window.history.replaceState(null, "", "#" + (DAY_HASH[state.day] || "all")); } catch (err) {}
      render();
    });
  }

  /* ---------- lightning-talk rows: opening a row shows its abstract straight away ---------- */
  if (body) {
    body.addEventListener("toggle", function (e) {
      var it = e.target;
      if (!it || !it.classList || !it.classList.contains("ag-run__item") || !it.open) return;
      var inner = it.querySelector(".ag-card details");
      if (inner) inner.open = true;
    }, true);
  }

  /* ---------- save clicks (delegated) ---------- */
  if (body) {
    body.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-save]");
      if (!btn) return;
      var id = btn.getAttribute("data-save");
      var card = btn.closest(".ag-card");
      if (saved[id]) { delete saved[id]; } else { saved[id] = true; }
      var ids = Object.keys(saved);
      storeSaved(ids);
      btn.setAttribute("aria-pressed", saved[id] ? "true" : "false");
      var svg = btn.querySelector("svg path");
      if (svg) svg.setAttribute("fill", saved[id] ? "currentColor" : "none");
      if (card) card.classList.toggle("is-saved", !!saved[id]);
      var runItem = btn.closest(".ag-run__item");
      if (runItem) runItem.classList.toggle("is-saved", !!saved[id]);
      if (state.savedOnly) render();
    });
  }

  syncSavedToggles();
  render();
})();
