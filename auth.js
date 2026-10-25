"use strict";

/* =========================================================
   Smart Gym — auth.js
   Front-end login, roles and permissions.

   DEMO ONLY: these accounts live in the browser, so anyone with
   DevTools can read them. A real product checks the password on a
   server and returns a signed session token.

   Loads AFTER script.js and uses its globals ($, data, refresh, route…).
   ========================================================= */
(() => {
  const SESSION_KEY = "smartGymSession";
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Demo accounts (replace with a server call later) ---------- */
  const USERS = [
    { email: "manager@smartgym.com", password: "Manager123", name: "Dawit Mulugeta", role: "Gym Manager" },
    { email: "reception@smartgym.com", password: "Reception123", name: "Selam Mekonnen", role: "Reception Staff" },
    { email: "trainer@smartgym.com", password: "Trainer123", name: "Henok Tilahun", role: "Trainer" },
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
      forms: ["checkin-form", "workout-form", "class-form", "booking-form", "progress-form"],
      actions: ["checkin-member", "delete-workout", "delete-class", "cancel-booking", "delete-progress"],
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

  const OWNED = { Attendance: "attendance", Payment: "payments", "Workout plan": "workouts", Booking: "bookings", Progress: "progress" };
  const SELF_SELECTS = ["#booking-member", "#progress-member"];

  let session = null;
  let attempts = 0;
  let lockedUntil = 0;

  const allow = (kind, id) => {
    const list = RULES[session.role][kind];
    return !list || list.includes(id);
  };
  const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  /* ---------- Hooks used by script.js ---------- */
  access.records = (items) =>
    session && session.role === "Member" ? items.filter((i) => i.memberId === session.memberId) : items;

  access.results = (items) => {
    if (!session) return items;
    return items.filter((r) => {
      if (!allow("pages", r.page)) return false;
      if (session.role !== "Member") return true;
      const collection = OWNED[r.type];
      return !collection || data[collection].find((i) => i.id === r.id)?.memberId === session.memberId;
    });
  };

  /* ---------- Member record linked to the Member account ---------- */
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

    SELF_SELECTS.forEach((sel) => {
      const select = $(sel);
      if (session.role === "Member") {
        [...select.options].forEach((o) => { if (o.value && o.value !== session.memberId) o.remove(); });
        select.value = session.memberId;
        select.disabled = true;
      } else {
        select.disabled = false;
      }
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
    session = { ...user, memberId: user.role === "Member" ? ensureMember(user) : "" };
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
      if (session.role === "Member") SELF_SELECTS.forEach((sel) => { $(sel).value = session.memberId; });
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  restore();
})();