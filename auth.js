"use strict";

/*
   Smart Gym — auth.js
   Front-end login, roles and permissions.

   DEMO ONLY: these accounts live in the browser, so anyone with
   DevTools can read them. A real product checks the password on a
   server and returns a signed session token.

   Loads AFTER script.js and uses its globals ($, data, refresh, route…).
   */
(() => {
  const SESSION_KEY = "smartGymSession";
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Demo accounts (replace with a server call later) ---------- */
  const USERS = [
    { email: "manager@smartgym.com", password: "Manager123", name: "Dawit Mulugeta", role: "Gym Manager" },
    { email: "reception@smartgym.com", password: "Reception123", name: "Selam Mekonnen", role: "Reception Staff" },
    { email: "trainer@smartgym.com", password: "Trainer123", name: "Henok Tilahun", role: "Trainer", phone: "0911000002" },
    { email: "member@smartgym.com", password: "Member123", name: "Abel Bekele", role: "Member", phone: "0911000001" }
  ];

  /* ---------- What each role may do (null = everything) ---------- */
  const RULES = {
    "Gym Manager": { pages: null, forms: null, actions: null, tools: true },
    "Reception Staff": {
      pages: ["dashboard", "members", "memberships", "attendance", "payments", "classes"],
      forms: ["member-form", "checkin-form", "payment-form", "booking-form"],
      actions: ["edit-member", "checkin-member", "cancel-booking"],
      tools: false
    },
    Trainer: {
      pages: ["dashboard", "members", "attendance", "workouts", "classes", "progress"],
      forms: ["checkin-form", "workout-form", "class-form", "progress-form"],
      actions: ["checkin-member", "delete-workout", "delete-class", "delete-progress"],
      tools: false
    },
    Member: {
      pages: ["dashboard", "attendance", "payments", "workouts", "classes", "progress"],
      forms: ["booking-form", "progress-form"],
      actions: ["cancel-booking", "delete-progress"],
      tools: false
    }
  };

  const HERO_LINK = {
    "Gym Manager": ["#members", "View Members →"],
    "Reception Staff": ["#members", "View Members →"],
    Trainer: ["#workouts", "Workout Plans →"],
    Member: ["#classes", "Book a Class →"]
  };

  /* ---------- Wording for each role (anything not listed keeps the default text) ---------- */
  const WORDING = {
    "Gym Manager": {
      search: ["Search members, trainers, payments, pages…", "Search gym records"]
    },
    "Reception Staff": {
      search: ["Search members, payments, bookings…", "Search members, payments and bookings"],
      hero: "Register members, record check-ins and payments, and keep the front desk running smoothly.",
      classes: ["Classes & Bookings", "Book members into upcoming classes and manage their bookings."]
    },
    Trainer: {
      search: ["Search members, workout plans, my classes…", "Search members, workout plans and your classes"],
      hero: "Plan workouts, run your classes and follow your members' progress.",
      labels: { classes: "My Classes" },
      members: ["Members", "View your gym's members and check them in."],
      classes: ["My Classes", "Create your own classes and see who has booked them."],
      empty: {
        "#classes-empty": "You have not created any classes yet.",
        "#bookings-empty": "No one has booked your classes yet."
      }
    },
    Member: {
      search: ["Search classes, my workouts, my payments…", "Search classes and your own workouts and payments"],
      hero: "Track your membership, book classes and follow your own progress.",
      labels: {
        attendance: "My Attendance",
        payments: "My Payments",
        workouts: "My Workout Plans",
        progress: "My Progress"
      },
      attendance: ["My Attendance", "Your check-ins at the gym."],
      payments: ["My Payments", "Your payment history."],
      workouts: ["My Workout Plans", "Plans your trainer has assigned to you."],
      classes: ["Classes & Bookings", "See upcoming classes and book your spot."],
      progress: ["My Progress & Goals", "Log your weight and track your fitness goals."],
      paymentTotal: "Total paid: ",
      empty: {
        "#attendance-empty": "You have no check-ins yet.",
        "#payments-empty": "You have no payments recorded yet.",
        "#workouts-empty": "No workout plan has been assigned to you yet.",
        "#classes-empty": "No classes are scheduled yet.",
        "#bookings-empty": "You have not booked any classes yet.",
        "#progress-empty": "You have not logged any progress yet."
      }
    }
  };

  /* Where each piece of wording lives on the page */
  const TEXT_TARGETS = {
    members: ["#members .section-heading h2", "#members .section-heading p"],
    attendance: ["#attendance .section-heading h2", "#attendance .section-heading p"],
    payments: ["#payments .section-heading h2", "#payments .section-heading p"],
    workouts: ["#workouts .section-heading h2", "#workouts .section-heading p"],
    classes: ["#classes .section-heading h2", "#classes .section-heading p"],
    progress: ["#progress .section-heading h2", "#progress .section-heading p"]
  };
  const EMPTY_IDS = ["#attendance-empty", "#payments-empty", "#workouts-empty", "#classes-empty", "#bookings-empty", "#progress-empty"];

  const DEFAULT_LABELS = { ...PAGES };
  const DEFAULT_TOTAL_LABEL = $("#payments .summary-line").firstChild.textContent;

  const OWNED = { Attendance: "attendance", Payment: "payments", "Workout plan": "workouts", Booking: "bookings", Progress: "progress" };

  /* Pickers that are locked to the signed-in person: [selector, role, own id] */
  const SELF_SELECTS = [
    ["#booking-member", "Member", () => session.memberId],
    ["#progress-member", "Member", () => session.memberId],
    ["#class-trainer", "Trainer", () => session.trainerId]
  ];

  let session = null;
  let attempts = 0;
  let lockedUntil = 0;

  const allow = (kind, id) => {
    const list = RULES[session.role][kind];
    return !list || list.includes(id);
  };
  const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const ownClassIds = () => new Set(data.classes.filter((c) => c.trainerId === session.trainerId).map((c) => c.id));

  /* ---------- Hooks used by script.js ---------- */
  access.records = (items) => {
    if (!session) return items;
    if (session.role === "Member") return items.filter((i) => i.memberId === session.memberId);
    if (session.role === "Trainer") {
      const mine = ownClassIds();
      return items.filter((i) => !i.classId || mine.has(i.classId)); // bookings only for their own classes
    }
    return items;
  };

  access.classes = (items) =>
    session && session.role === "Trainer" ? items.filter((c) => c.trainerId === session.trainerId) : items;

  access.results = (items) => {
    if (!session) return items;
    return items.filter((r) => {
      if (!allow("pages", r.page)) return false;
      if (session.role === "Member") {
        const collection = OWNED[r.type];
        return !collection || data[collection].find((i) => i.id === r.id)?.memberId === session.memberId;
      }
      if (session.role === "Trainer") {
        if (r.type === "Class") return data.classes.find((c) => c.id === r.id)?.trainerId === session.trainerId;
        if (r.type === "Booking") {
          const b = data.bookings.find((x) => x.id === r.id);
          return Boolean(b) && ownClassIds().has(b.classId);
        }
      }
      return true;
    });
  };

  /* ---------- Records linked to the Member and Trainer accounts ---------- */
  function ensureMember(user) {
    let m = data.members.find(
      (x) => (user.phone && x.phone === user.phone) || x.name.toLowerCase() === user.name.toLowerCase()
    );
    if (!m) {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      m = { id: uid(), name: user.name, phone: user.phone || "", plan: "Basic", start: today(), expiry: dateKey(end) };
      data.members.push(m);
    }
    return m.id;
  }

  function ensureTrainer(user) {
    let t = data.trainers.find(
      (x) => (user.phone && x.phone === user.phone) || x.name.toLowerCase() === user.name.toLowerCase()
    );
    if (!t) {
      t = { id: uid(), name: user.name, specialty: "General fitness", phone: user.phone || "", availability: "Available" };
      data.trainers.push(t);
    }
    return t.id;
  }

  /* ---------- Profile menu ---------- */
  const profileBtn = $("#profile-button");
  const menu = document.createElement("div");
  menu.className = "profile-menu";
  menu.id = "profile-menu";
  menu.hidden = true;
  $(".topbar-actions").append(menu);
  profileBtn.setAttribute("aria-controls", "profile-menu");

  function setMenuOpen(open) {
    menu.hidden = !open;
    profileBtn.setAttribute("aria-expanded", String(open));
  }

  function renderProfileMenu() {
    menu.innerHTML = `
      <p><strong>${esc(session.name)}</strong><small>${esc(session.role)}</small><small>${esc(session.email)}</small></p>
      <button class="button button-quiet button-full" type="button" data-signout>Sign out</button>`;
  }

  /* ---------- Member summary card ---------- */
  function renderMySummary() {
    const box = $("#my-summary");
    box.hidden = session.role !== "Member";
    if (box.hidden) return;
    const m = data.members.find((x) => x.id === session.memberId);
    if (!m) { box.innerHTML = "<h2 id=\"my-summary-title\">My membership</h2><p class=\"muted\">No membership found.</p>"; return; }
    const visits = data.attendance.filter((a) => a.memberId === m.id).length;
    const next = data.bookings
      .filter((b) => b.memberId === m.id)
      .map((b) => data.classes.find((c) => c.id === b.classId))
      .filter((c) => c && c.date >= today())
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    box.innerHTML = `
      <h2 id="my-summary-title">My membership</h2>
      <dl class="summary-grid">
        <div><dt>Plan</dt><dd>${esc(m.plan)}</dd></div>
        <div><dt>Status</dt><dd>${pill(isActive(m) ? "Active" : "Expired")}</dd></div>
        <div><dt>Expires</dt><dd>${fmtDate(m.expiry)}</dd></div>
        <div><dt>My check-ins</dt><dd>${visits}</dd></div>
        <div><dt>Next class</dt><dd>${next ? `${esc(next.name)} · ${fmtDate(next.date)}` : "None booked"}</dd></div>
      </dl>`;
  }

  /* ---------- Role-specific wording ---------- */
  function setText(el, text) {
    if (!el) return;
    if (el.dataset.default === undefined) el.dataset.default = el.textContent;
    el.textContent = text ?? el.dataset.default;
  }

  function applyWording() {
    const w = WORDING[session.role];

    Object.assign(PAGES, DEFAULT_LABELS, w.labels); // page names used by the sidebar, breadcrumbs, title and search
    $$(".nav-link").forEach((link) => {
      link.querySelector("span").textContent = PAGES[link.getAttribute("href").slice(1)];
    });

    const [placeholder, searchLabel] = w.search;
    $("#global-search").placeholder = placeholder;
    $('label[for="global-search"]').textContent = searchLabel;

    setText($(".welcome-copy > p.muted"), w.hero);
    Object.entries(TEXT_TARGETS).forEach(([key, [heading, intro]]) => {
      setText($(heading), w[key]?.[0]);
      setText($(intro), w[key]?.[1]);
    });
    $("#payments .summary-line").firstChild.textContent = w.paymentTotal ?? DEFAULT_TOTAL_LABEL;
    EMPTY_IDS.forEach((sel) => setText($(sel), w.empty?.[sel]));

    const crumb = $("#crumbs li[aria-current]");
    if (crumb) crumb.textContent = PAGES[currentPage];
    updateTitle();
  }

  /* ---------- Apply the role to the whole interface ---------- */
  function applyRoleUI() {
    if (!session) return;
    const rules = RULES[session.role];
    document.documentElement.dataset.role = session.role.split(" ")[0].toLowerCase();

    $$(".nav-link").forEach((link) => { link.hidden = !allow("pages", link.getAttribute("href").slice(1)); });
    $(".upgrade-card").hidden = !allow("pages", "reports");
    $$("form.data-form").forEach((form) => { form.hidden = !allow("forms", form.id); });
    $$("[data-scroll-form]").forEach((b) => { b.hidden = !allow("forms", b.dataset.scrollForm); });
    $$("[data-action]").forEach((b) => { b.hidden = !allow("actions", b.dataset.action); });
    $("#export-csv").hidden = !rules.tools;
    $("#reset-demo").hidden = !rules.tools;

    SELF_SELECTS.forEach(([sel, role, ownId]) => {
      const select = $(sel);
      const lock = session.role === role;
      if (lock) {
        [...select.options].forEach((o) => { if (o.value && o.value !== ownId()) o.remove(); });
        select.value = ownId();
      }
      select.disabled = lock;
      select.closest("label").hidden = lock; // people always act as themselves, so no picker
    });

    const [href, label] = HERO_LINK[session.role];
    const heroLink = $(".welcome-copy .button");
    heroLink.setAttribute("href", href);
    heroLink.textContent = label;
    $(".welcome-label").textContent = `Welcome back, ${session.name.split(" ")[0]}`;

    $("#profile-button .avatar").textContent = initials(session.name);
    $("#profile-button strong").textContent = session.name;
    $("#profile-button small").textContent = session.role;
    $("#user-role").value = session.role;
    $("#user-role").disabled = true; // the role now comes from the account

    applyWording();
    renderMySummary();
    renderProfileMenu();
  }
  window.applyRoleUI = applyRoleUI; // called at the end of refresh() in script.js

  /* ---------- Page guard ---------- */
  function guardPage() {
    if (!session) return;
    const key = location.hash.slice(1);
    if (PAGES[key] && !allow("pages", key)) {
      location.hash = "dashboard";
      toast("Your role cannot open that page.");
    }
  }
  window.addEventListener("hashchange", guardPage);

  /* ---------- Sign in / out ---------- */
  function openApp(user, fresh) {
    session = {
      ...user,
      memberId: user.role === "Member" ? ensureMember(user) : "",
      trainerId: user.role === "Trainer" ? ensureTrainer(user) : ""
    };
    document.documentElement.dataset.auth = "in";
    $(".app-shell").inert = false;
    $("#login-form").reset();
    hideError();
    refresh(); // re-renders the lists for this role and runs applyRoleUI()
    if (fresh) {
      if (location.hash !== "#dashboard") location.hash = "dashboard";
      else route();
      toast(`Signed in as ${session.role}.`);
    } else {
      guardPage();
    }
    setMenu(false);
    updateTitle();
  }

  function logout() {
    session = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked */
    }
    document.documentElement.dataset.auth = "out";
    document.documentElement.dataset.role = "";
    $(".app-shell").inert = true;
    setMenuOpen(false);
    setMenu(false);
    history.replaceState(null, "", location.pathname + location.search);
    document.title = `Sign in | ${data.settings.gymName}`;
    $("#login-email").focus();
    toast("You have been signed out.");
  }

  function restore() {
    let email = "";
    try {
      email = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY))?.email || "";
    } catch {
      email = "";
    }
    const user = USERS.find((u) => u.email === email);
    if (user) return openApp(user, false);
    document.documentElement.dataset.auth = "out";
    $(".app-shell").inert = true;
    document.title = `Sign in | ${data.settings.gymName}`;
  }

  /* ---------- Login form ---------- */
  const errorBox = $("#login-error");

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    $("#login-email").setAttribute("aria-invalid", "true");
    $("#login-password").setAttribute("aria-invalid", "true");
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
    $("#login-email").removeAttribute("aria-invalid");
    $("#login-password").removeAttribute("aria-invalid");
  }

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim().toLowerCase();
    const password = $("#login-password").value;

    if (Date.now() < lockedUntil) {
      return showError(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds.`);
    }
    if (!email || !password) return showError("Enter your email and password.");

    const user = USERS.find((u) => u.email === email && u.password === password);
    if (!user) {
      attempts += 1;
      if (attempts >= 5) {
        attempts = 0;
        lockedUntil = Date.now() + 30000;
        return showError("Too many failed attempts. Please wait 30 seconds.");
      }
      return showError("Incorrect email or password.");
    }

    attempts = 0;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      (($("#login-remember").checked ? localStorage : sessionStorage)).setItem(SESSION_KEY, JSON.stringify({ email: user.email }));
    } catch {
      /* the session just lasts until the page reloads */
    }
    openApp(user, true);
  });

  $("#login-form").addEventListener("input", hideError);

  $("#toggle-password").addEventListener("click", (e) => {
    const input = $("#login-password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.textContent = show ? "Hide" : "Show";
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
    e.currentTarget.setAttribute("aria-pressed", String(show));
  });

  $("#demo-list").innerHTML = USERS.map(
    (u) => `<li><button class="demo-btn" type="button" data-email="${esc(u.email)}"><strong>${esc(u.role)}</strong><small>${esc(u.email)} · ${esc(u.password)}</small></button></li>`
  ).join("");

  $("#demo-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-email]");
    const user = btn && USERS.find((u) => u.email === btn.dataset.email);
    if (!user) return;
    $("#login-email").value = user.email;
    $("#login-password").value = user.password;
    hideError();
    $("#login-form button[type=submit]").focus();
  });

  /* ---------- Capture-phase guards (run before script.js handlers) ---------- */
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;

      if (t.closest("#profile-button")) {
        e.stopImmediatePropagation();
        if (session) setMenuOpen(menu.hidden);
        return;
      }
      if (t.closest("#logout-button, [data-signout]")) {
        e.stopImmediatePropagation();
        logout();
        return;
      }
      if (!t.closest("#profile-menu")) setMenuOpen(false);
      if (!session) return;

      // Members only see their own membership in the bell, not gym-wide numbers
      if (session.role === "Member" && t.closest("#notification-button")) {
        e.stopImmediatePropagation();
        const m = data.members.find((x) => x.id === session.memberId);
        window.alert(
          m ? `Membership: ${isActive(m) ? "Active" : "Expired"}\nExpires: ${fmtDate(m.expiry)}` : "No membership found."
        );
        return;
      }

      const action = t.closest("[data-action]");
      const blocked =
        (action && !allow("actions", action.dataset.action)) ||
        (t.closest("#export-csv, .report-tile, #reset-demo") && !RULES[session.role].tools);

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toast("Your role does not have permission for that action.");
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    (e) => {
      if (!session || !e.target.classList.contains("data-form")) return;
      if (!allow("forms", e.target.id)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toast("Your role does not have permission for that action.");
        return;
      }
      // Force locked pickers back to the signed-in person before the form is processed
      SELF_SELECTS.forEach(([sel, role, ownId]) => {
        if (session.role === role) $(sel).value = ownId();
      });
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  restore();
})();