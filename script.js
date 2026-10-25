"use strict";

const $ = (s) => document.querySelector(s);
const KEY = "smartGymDataV1";
const COLLECTIONS = ["members", "trainers", "attendance", "payments", "workouts", "classes", "bookings", "progress", "equipment"];
const PLANS = ["Basic", "Standard", "Premium"];
const COLORS = ["#ff8a24", "#ffbd69", "#d95516"];
const DELETE_MAP = {
  "delete-member": "members",
  "delete-trainer": "trainers",
  "delete-payment": "payments",
  "delete-workout": "workouts",
  "delete-class": "classes",
  "cancel-booking": "bookings",
  "delete-progress": "progress",
  "delete-equipment": "equipment"
};

/* ---------- Helpers ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dateKey();
const val = (id) => $("#" + id).value.trim();
const money = (v) => "ETB " + Number(v || 0).toFixed(2);
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z]+/g, "-");
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(`${v}T12:00:00`);
  return isNaN(d) ? esc(v) : d.toLocaleDateString();
};
const pill = (label) => `<span class="status status-${slug(label)}">${esc(label)}</span>`;
const btn = (action, id, label = "Delete") =>
  `<button type="button" class="action-button" data-action="${action}" data-id="${esc(id)}">${label}</button>`;

const defaults = () => ({
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  settings: { role: "Gym Manager", gymName: "Smart Gym" }
});

let data = (() => {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return defaults();
  }
})();
let searchTerm = "";

/* ---------- Access hooks (auth.js fills these in after sign-in) ---------- */
const access = {
  records: (items) => items,
  results: (items) => items
};

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    toast("Unable to save data.");
  }
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("is-visible"), 2500);
}

const memberName = (id) => data.members.find((m) => m.id === id)?.name || "Unknown member";
const isActive = (m) => Boolean(m && m.expiry && m.expiry >= today());
const countBookings = (classId) => data.bookings.filter((b) => b.classId === classId).length;

function fillSelect(sel, items, placeholder) {
  const el = $(sel);
  if (!el) return;
  const old = el.value;
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");
  if (items.some((i) => i.id === old)) el.value = old;
}

function list(box, empty, items, render) {
  $(box).innerHTML = items.map(render).join("");
  $(empty).hidden = items.length > 0;
}

/* ---------- Dashboard ---------- */

function donut(donutSel, totalSel, legendSel, labels, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  let pos = 0;
  const parts = counts.map((c, i) => {
    const start = pos;
    pos += total ? (c / total) * 100 : 0;
    return `${COLORS[i]} ${start}% ${pos}%`;
  });
  $(donutSel).style.background = total ? `conic-gradient(${parts.join(",")})` : "#343434";
  $(totalSel).textContent = total;
  $(legendSel).innerHTML = labels
    .map((l, i) => `<li><span class="legend-dot" style="background:${COLORS[i]}"></span><span>${l}</span><strong>${counts[i]}</strong></li>`)
    .join("");
}

function renderDashboard() {
  const t = today();
  $("#total-members").textContent = data.members.length;
  $("#active-members").textContent = data.members.filter(isActive).length;
  $("#attendance-total").textContent = data.attendance.filter((a) => a.date === t).length;
  $("#trainer-total").textContent = data.trainers.filter((x) => x.availability === "Available").length;
  $("#today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  // Weekly attendance bars
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const key = dateKey(d);
    return {
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: data.attendance.filter((a) => a.date === key).length
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  $("#attendance-chart").innerHTML = days
    .map((d) => `
      <div class="bar-column">
        <span class="bar-label">${d.count}</span>
        <div class="bar-track"><div class="bar-fill" style="height:${Math.max(4, (d.count / max) * 100)}%"></div></div>
        <span class="bar-label">${esc(d.label)}</span>
      </div>`)
    .join("");

  // Membership donut (by plan)
  donut("#membership-donut", "#member-donut-total", "#membership-legend", PLANS,
    PLANS.map((p) => data.members.filter((m) => m.plan === p).length));

  // Activity donut (by time of day, for the chosen period)
  const period = Number($("#activity-period").value) || 7;
  const base = new Date(`${t}T12:00:00`);
  const recent = data.attendance.filter((a) => {
    const diff = Math.round((base - new Date(`${a.date}T12:00:00`)) / 864e5);
    return diff >= 0 && diff < period;
  });
  const hr = (a) => Number(a.hour);
  $("#activity-donut .donut-center span").textContent = "Check-ins";
  donut("#activity-donut", "#donut-total", "#activity-legend", ["Morning", "Afternoon", "Evening"], [
    recent.filter((a) => hr(a) < 12).length,
    recent.filter((a) => hr(a) >= 12 && hr(a) < 17).length,
    recent.filter((a) => hr(a) >= 17).length
  ]);

  // Today by time slot
  const slots = ["6–9 AM", "9 AM–12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "9 PM–12 AM"];
  const counts = slots.map(() => 0);
  data.attendance
    .filter((a) => a.date === t)
    .forEach((a) => counts[Math.min(5, Math.max(0, Math.floor(((Number(a.hour) || 0) - 6) / 3)))]++);
  $("#time-list").innerHTML = slots.map((s, i) => `<li><span>${s}</span><strong>${counts[i]}</strong></li>`).join("");
}

/* ---------- Lists ---------- */

function renderMembers() {
  const q = searchTerm.toLowerCase();
  const items = data.members.filter((m) => `${m.name} ${m.phone} ${m.plan}`.toLowerCase().includes(q));
  list("#member-table", "#members-empty", items, (m) => `
    <tr>
      <td><strong>${esc(m.name)}</strong><br><small>${esc(m.phone)}</small></td>
      <td>${esc(m.plan)}</td>
      <td>${fmtDate(m.expiry)}</td>
      <td>${pill(isActive(m) ? "Active" : "Expired")}</td>
      <td>${data.attendance.filter((a) => a.memberId === m.id).length}</td>
      <td><div class="table-actions">${btn("edit-member", m.id, "Edit")}${btn("checkin-member", m.id, "Check in")}${btn("delete-member", m.id)}</div></td>
    </tr>`);
}

function renderAll() {
  renderMembers();

  list("#trainer-list", "#trainers-empty", data.trainers, (t) => `
    <article class="record-card">
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.specialty || "General fitness")}</p>
      <p>${esc(t.phone || "No phone")}</p>
      ${pill(t.availability || "Available")}
      <div class="card-actions">${btn("delete-trainer", t.id)}</div>
    </article>`);

  list("#attendance-table", "#attendance-empty", access.records([...data.attendance]).reverse(), (a) => `
    <tr>
      <td>${fmtDate(a.date)} · ${esc(a.time || "")}</td>
      <td>${esc(memberName(a.memberId))}</td>
      <td>${esc(a.method)}</td>
      <td>${pill("Confirmed")}</td>
    </tr>`);

  $("#payment-total").textContent = money(access.records(data.payments).reduce((s, p) => s + Number(p.amount || 0), 0));

  list("#payment-table", "#payments-empty", access.records([...data.payments]).reverse(), (p) => `
    <tr>
      <td>${fmtDate(p.date)}</td>
      <td>${esc(memberName(p.memberId))}</td>
      <td>${esc(p.purpose)}</td>
      <td>${esc(p.method)}</td>
      <td><div class="table-actions"><strong>${money(p.amount)}</strong>${btn("delete-payment", p.id)}</div></td>
    </tr>`);

  list("#workout-list", "#workouts-empty", access.records(data.workouts), (w) => `
    <article class="record-card">
      <h3>${esc(w.name)}</h3>
      <p>Member: ${esc(memberName(w.memberId))}</p>
      <p>Goal: ${esc(w.goal || "General fitness")}</p>
      <small>${esc(w.schedule || "Schedule not set")}</small>
      <div class="card-actions">${btn("delete-workout", w.id)}</div>
    </article>`);

  list("#class-list", "#classes-empty", data.classes, (c) => `
    <article class="record-card">
      <h3>${esc(c.name)}</h3>
      <p>Trainer: ${esc(data.trainers.find((t) => t.id === c.trainerId)?.name || "No trainer")}</p>
      <p>Date: ${fmtDate(c.date)}</p>
      <small>${countBookings(c.id)} / ${esc(c.capacity)} booked</small>
      <div class="card-actions">${btn("delete-class", c.id)}</div>
    </article>`);

  list("#booking-table", "#bookings-empty", access.records([...data.bookings]).reverse(), (b) => `
    <tr>
      <td>${esc(memberName(b.memberId))}</td>
      <td>${esc(data.classes.find((c) => c.id === b.classId)?.name || "Unknown class")}</td>
      <td>${fmtDate(b.classDate || data.classes.find((c) => c.id === b.classId)?.date || b.date)}</td>
      <td><div class="table-actions">${pill("Confirmed")}${btn("cancel-booking", b.id, "Cancel")}</div></td>
    </tr>`);

  list("#progress-table", "#progress-empty", access.records([...data.progress]).reverse(), (p) => `
    <tr>
      <td>${esc(memberName(p.memberId))}</td>
      <td>${esc(p.weight)} kg</td>
      <td>${esc(p.goal || "—")}</td>
      <td>${fmtDate(p.target)}</td>
      <td><div class="table-actions">${fmtDate(p.date)}${btn("delete-progress", p.id)}</div></td>
    </tr>`);

  list("#equipment-list", "#equipment-empty", data.equipment, (e) => `
    <article class="record-card">
      <h3>${esc(e.name)}</h3>
      ${pill(e.condition)}
      <p>${esc(e.notes || "No notes")}</p>
      <div class="card-actions">${btn("delete-equipment", e.id)}</div>
    </article>`);

  $("#report-members").textContent = data.members.length;
  $("#report-payments").textContent = data.payments.length;
  $("#report-attendance").textContent = data.attendance.length;
  $("#report-workouts").textContent = data.workouts.length;
}

function renderSettings() {
  const { role, gymName } = data.settings;
  $("#user-role").value = role;
  if (!$("#user-role").value) $("#user-role").value = "Gym Manager";
  $("#gym-name").value = gymName;
  updateTitle();
  $("#profile-button small").textContent = role;
  const words = gymName.split(" ");
  const last = words.pop();
  $(".brand strong").innerHTML = `${esc(words.join(" "))} <em>${esc(last)}</em>`.trim();
  $(".footer span").textContent = `${gymName} · Fitness Management System`;
}

function refresh() {
  save();
  ["#checkin-member", "#payment-member", "#workout-member", "#booking-member", "#progress-member"]
    .forEach((s) => fillSelect(s, data.members, "Choose a member"));
  fillSelect("#class-trainer", data.trainers, "No trainer assigned");
  fillSelect("#booking-class", data.classes, "Choose a class");
  renderDashboard();
  renderAll();
  renderSettings();
  window.applyRoleUI?.();
}

/* ---------- Members ---------- */

function resetMemberForm() {
  $("#member-form").reset();
  $("#member-id").value = "";
  $("#member-start").value = today();
  $("#member-submit").textContent = "Save Member";
  $("#member-cancel").hidden = true;
}

function editMember(id) {
  const m = data.members.find((x) => x.id === id);
  if (!m) return;
  $("#member-id").value = m.id;
  $("#member-name").value = m.name;
  $("#member-phone").value = m.phone;
  $("#member-plan").value = m.plan;
  $("#member-start").value = m.start || "";
  $("#member-expiry").value = m.expiry || "";
  $("#member-submit").textContent = "Update Member";
  $("#member-cancel").hidden = false;
  $("#member-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function checkIn(memberId, method = "Manual check-in") {
  const m = data.members.find((x) => x.id === memberId);
  if (!m) return { error: "Select a member first." };
  if (!isActive(m)) return { error: "This member's membership has expired." };
  if (data.attendance.some((a) => a.memberId === memberId && a.date === today()))
    return { error: "This member is already checked in today." };
  const now = new Date();
  data.attendance.push({
    id: uid(),
    memberId,
    date: today(),
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    hour: now.getHours(),
    method
  });
  return { ok: "Attendance recorded." };
}

function remove(collection, id) {
  if (!window.confirm("Are you sure you want to delete this record?")) return;
  data[collection] = data[collection].filter((i) => i.id !== id);
  if (collection === "members") {
    ["attendance", "payments", "workouts", "bookings", "progress"].forEach((c) => {
      data[c] = data[c].filter((i) => i.memberId !== id);
    });
  }
  if (collection === "classes") data.bookings = data.bookings.filter((b) => b.classId !== id);
  refresh();
  toast("Record deleted.");
}

/* ---------- Forms ---------- */

function onSubmit(formId, handler, after) {
  $("#" + formId).addEventListener("submit", (e) => {
    e.preventDefault();
    const r = handler();
    if (r.error) return toast(r.error);
    e.target.reset();
    if (after) after();
    refresh();
    toast(r.ok);
  });
}

onSubmit("member-form", () => {
  const rec = {
    name: val("member-name"),
    phone: val("member-phone"),
    plan: val("member-plan"),
    start: val("member-start"),
    expiry: val("member-expiry")
  };
  if (!rec.name || !rec.phone || !rec.start || !rec.expiry) return { error: "Please complete all required member fields." };
  if (rec.expiry < rec.start) return { error: "Expiry date must be after the start date." };
  const existing = val("member-id") && data.members.find((m) => m.id === val("member-id"));
  if (existing) Object.assign(existing, rec);
  else data.members.push({ id: uid(), ...rec });
  return { ok: existing ? "Member updated." : "Member added." };
}, resetMemberForm);

onSubmit("trainer-form", () => {
  if (!val("trainer-name")) return { error: "Enter a trainer name." };
  data.trainers.push({
    id: uid(),
    name: val("trainer-name"),
    specialty: val("trainer-specialty"),
    phone: val("trainer-phone"),
    availability: val("trainer-availability")
  });
  return { ok: "Trainer added." };
});

onSubmit("checkin-form", () => {
  if (!val("checkin-member")) return { error: "Select a member." };
  return checkIn(val("checkin-member"), val("checkin-method"));
});

onSubmit("payment-form", () => {
  const amount = Number(val("payment-amount"));
  if (!val("payment-member") || !(amount > 0) || !val("payment-purpose")) return { error: "Enter valid payment details." };
  data.payments.push({
    id: uid(),
    memberId: val("payment-member"),
    amount,
    method: val("payment-method"),
    purpose: val("payment-purpose"),
    date: today()
  });
  return { ok: "Payment recorded." };
});

onSubmit("workout-form", () => {
  if (!val("workout-name") || !val("workout-member")) return { error: "Enter a workout name and choose a member." };
  data.workouts.push({
    id: uid(),
    name: val("workout-name"),
    memberId: val("workout-member"),
    goal: val("workout-goal"),
    schedule: val("workout-schedule")
  });
  return { ok: "Workout plan added." };
});

onSubmit("class-form", () => {
  const capacity = Number(val("class-capacity"));
  if (!val("class-name") || !val("class-date") || !Number.isInteger(capacity) || capacity < 1)
    return { error: "Enter the class name, date, and a valid capacity." };
  data.classes.push({
    id: uid(),
    name: val("class-name"),
    trainerId: val("class-trainer"),
    date: val("class-date"),
    capacity
  });
  return { ok: "Class created." };
});

onSubmit("booking-form", () => {
  const memberId = val("booking-member");
  const classId = val("booking-class");
  const member = data.members.find((m) => m.id === memberId);
  const cls = data.classes.find((c) => c.id === classId);
  if (!member || !cls) return { error: "Choose a member and a class." };
  if (!isActive(member)) return { error: "Only active members can book classes." };
  if (data.bookings.some((b) => b.memberId === memberId && b.classId === classId))
    return { error: "This member already booked this class." };
  if (countBookings(classId) >= Number(cls.capacity)) return { error: "This class is full." };
  data.bookings.push({
    id: uid(),
    memberId,
    classId,
    date: today(),
    classDate: cls.date
  });
  return { ok: "Class booking saved." };
});

onSubmit("progress-form", () => {
  const weight = Number(val("progress-weight"));
  if (!val("progress-member") || !(weight > 0)) return { error: "Select a member and enter a valid weight." };
  data.progress.push({
    id: uid(),
    memberId: val("progress-member"),
    weight,
    goal: val("progress-goal"),
    target: val("progress-target"),
    date: today()
  });
  return { ok: "Progress saved." };
});

onSubmit("equipment-form", () => {
  if (!val("equipment-name")) return { error: "Enter the equipment name." };
  data.equipment.push({
    id: uid(),
    name: val("equipment-name"),
    condition: val("equipment-condition"),
    notes: val("equipment-notes")
  });
  return { ok: "Equipment added." };
});

$("#settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  data.settings = { role: val("user-role") || "Gym Manager", gymName: val("gym-name") || "Smart Gym" };
  refresh();
  toast("Settings saved.");
});

/* ---------- Reports ---------- */

const REPORTS = {
  members: [
    ["Name", "Phone", "Plan", "Start Date", "Expiry Date", "Status"],
    () => data.members.map((m) => [m.name, m.phone, m.plan, m.start, m.expiry, isActive(m) ? "Active" : "Expired"])
  ],
  payments: [
    ["Member", "Amount", "Method", "Purpose", "Date"],
    () => data.payments.map((p) => [memberName(p.memberId), p.amount, p.method, p.purpose, p.date])
  ],
  attendance: [
    ["Member", "Date", "Time", "Method"],
    () => data.attendance.map((a) => [memberName(a.memberId), a.date, a.time, a.method])
  ],
  workouts: [
    ["Workout", "Member", "Goal", "Schedule"],
    () => data.workouts.map((w) => [w.name, memberName(w.memberId), w.goal, w.schedule])
  ]
};

function exportCSV(type) {
  const [header, rows] = REPORTS[type];
  const csv = [header, ...rows()]
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `gym-${type}-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSV file downloaded.");
}

/* ---------- Navigation & events ---------- */

function setMenu(open) {
  $("#sidebar").classList.toggle("is-open", open);
  $("#backdrop").hidden = !open;
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
}

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]");
  if (action) {
    const { action: name, id } = action.dataset;
    if (name === "edit-member") editMember(id);
    else if (name === "checkin-member") {
      const r = checkIn(id);
      toast(r.error || r.ok);
      if (r.ok) refresh();
    } else if (DELETE_MAP[name]) remove(DELETE_MAP[name], id);
    return;
  }

  const scroll = e.target.closest("[data-scroll-form]");
  if (scroll) {
    const form = $("#" + scroll.dataset.scrollForm);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector("input:not([type=hidden])")?.focus({ preventScroll: true });
    return;
  }

  if (e.target.closest(".nav-link")) setMenu(false);
});

$("#menu-toggle").addEventListener("click", () => setMenu(!$("#sidebar").classList.contains("is-open")));
$("#backdrop").addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

$("#activity-period").addEventListener("change", renderDashboard);
$("#member-cancel").addEventListener("click", resetMemberForm);
$("#export-csv").addEventListener("click", () => exportCSV("members"));

document.querySelectorAll(".report-tile").forEach((tile) => {
  const type = tile.querySelector("strong").id.replace("report-", "");
  tile.style.cursor = "pointer";
  tile.title = "Click to download as CSV";
  tile.addEventListener("click", () => exportCSV(type));
});

$("#notification-button").addEventListener("click", () => {
  const expired = data.members.filter((m) => !isActive(m)).length;
  const equipment = data.equipment.filter((e) => /maintenance|service/i.test(e.condition)).length;
  window.alert(`Expired memberships: ${expired}\nEquipment needing attention: ${equipment}`);
});

$("#profile-button").addEventListener("click", () => {
  window.alert(`Gym: ${data.settings.gymName}\nRole: ${data.settings.role}`);
});

$("#logout-button").addEventListener("click", () => toast("Sign-out is not enabled in this version."));

$("#reset-demo").addEventListener("click", () => {
  if (!window.confirm("Delete all saved data? This cannot be undone.")) return;
  data = defaults();
  searchTerm = "";
  document.querySelectorAll("form").forEach((f) => f.reset());
  resetMemberForm();
  refresh();
  toast("All data has been reset.");
});

/* ---------- Theme (dark / light) ---------- */

const THEME_ICONS = {
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
};

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem("smartGymTheme", theme);
    } catch {
      /* storage blocked: the theme still changes for this visit */
    }
  }
  const button = $("#theme-toggle");
  button.innerHTML = theme === "dark" ? THEME_ICONS.sun : THEME_ICONS.moon;
  button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  $('meta[name="theme-color"]').content = theme === "dark" ? "#0b0f14" : "#f3f5f9";
}

$("#theme-toggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

/* ---------- Pages (hash routing) ---------- */

const PAGES = {
  dashboard: "Dashboard",
  members: "Members",
  memberships: "Memberships",
  trainers: "Trainers",
  attendance: "Attendance / QR",
  payments: "Payments",
  workouts: "Workout Plans",
  classes: "Classes & Bookings",
  progress: "Progress & Goals",
  equipment: "Equipment",
  reports: "Reports",
  settings: "Settings / Roles"
};

/* Which page(s) each section belongs to */
[
  ["#dashboard", "dashboard"],
  [".stats-grid", "dashboard"],
  [".analytics-grid", "dashboard memberships"],
  [".chart-panel", "dashboard"],
  ["#members", "members memberships"],
  ["#trainers", "trainers"],
  ["#attendance", "attendance"],
  ["#payments", "payments"],
  ["#workouts", "workouts"],
  ["#classes", "classes"],
  ["#progress", "progress"],
  ["#equipment", "equipment"],
  ["#reports", "reports"],
  ["#settings", "settings"]
].forEach(([selector, pages]) => $(selector)?.setAttribute("data-page", pages));

let currentPage = "dashboard";
let firstRoute = true;

function updateTitle() {
  const name = data.settings.gymName;
  document.title =
    currentPage === "dashboard" ? `${name} | Fitness Management Dashboard` : `${PAGES[currentPage]} | ${name}`;
  $('meta[name="description"]').content = `${PAGES[currentPage]} page of the ${name} fitness management dashboard.`;
}

function route() {
  const key = location.hash.slice(1);
  if (!PAGES[key] && !firstRoute) return; // other hashes, such as the skip link, keep the current page
  currentPage = PAGES[key] ? key : "dashboard";

  document.querySelectorAll("[data-page]").forEach((el) => {
    el.hidden = !el.dataset.page.split(" ").includes(currentPage);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    const on = link.getAttribute("href") === "#" + currentPage;
    link.classList.toggle("is-active", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const crumbs = $("#crumbs");
  crumbs.hidden = currentPage === "dashboard";
  crumbs.innerHTML = `<ol><li><a href="#dashboard">Dashboard</a></li><li aria-current="page">${esc(PAGES[currentPage])}</li></ol>`;

  updateTitle();
  setMenu(false);
  window.scrollTo({ top: 0, behavior: "instant" });

  const heading = $("#main-content [data-page]:not([hidden]) :is(h1, h2)");
  if (heading && !firstRoute) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true }); // tells screen readers the page changed
  }
  firstRoute = false;
}

window.addEventListener("hashchange", route);

/* ---------- Global search (every record + pages) ---------- */

function searchIndex() {
  const out = [];
  const add = (type, page, id, label, sub = "") =>
    out.push({ type, page, id, label, sub, text: `${label} ${sub}`.toLowerCase() });

  Object.entries(PAGES).forEach(([key, name]) => add("Page", key, "", name));
  data.members.forEach((m) => add("Member", "members", m.id, m.name, `${m.plan} · ${m.phone}`));
  data.trainers.forEach((t) => add("Trainer", "trainers", t.id, t.name, t.specialty || ""));
  data.attendance.forEach((a) => add("Attendance", "attendance", a.id, memberName(a.memberId), `${a.date} ${a.time || ""}`));
  data.payments.forEach((p) => add("Payment", "payments", p.id, memberName(p.memberId), `${p.purpose} · ${money(p.amount)}`));
  data.workouts.forEach((w) => add("Workout plan", "workouts", w.id, w.name, memberName(w.memberId)));
  data.classes.forEach((c) => add("Class", "classes", c.id, c.name, c.date));
  data.bookings.forEach((b) =>
    add("Booking", "classes", b.id, memberName(b.memberId), data.classes.find((c) => c.id === b.classId)?.name || ""));
  data.progress.forEach((p) => add("Progress", "progress", p.id, memberName(p.memberId), p.goal || ""));
  data.equipment.forEach((e) => add("Equipment", "equipment", e.id, e.name, e.condition));
  return out;
}

const searchInput = $("#global-search");
const resultsBox = $("#search-results");
let found = [];
let activeResult = -1;

function closeResults() {
  resultsBox.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  activeResult = -1;
}

function setActiveResult(i) {
  activeResult = i;
  resultsBox.querySelectorAll("li").forEach((li, n) => li.classList.toggle("is-active", n === i));
  if (i < 0) searchInput.removeAttribute("aria-activedescendant");
  else searchInput.setAttribute("aria-activedescendant", "sr-" + i);
}

function highlightRecord(id) {
  if (!id) return;
  const row = document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.closest("tr, article");
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.add("is-found");
  setTimeout(() => row.classList.remove("is-found"), 2500);
}

function openResult(result) {
  closeResults();
  searchInput.value = "";
  if (location.hash === "#" + result.page) {
    highlightRecord(result.id);
  } else {
    window.addEventListener("hashchange", () => highlightRecord(result.id), { once: true });
    location.hash = result.page;
  }
}

searchInput.addEventListener("input", () => {
  const words = searchInput.value.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return closeResults();

  found = access.results(searchIndex()).filter((r) => words.every((w) => r.text.includes(w))).slice(0, 8);
  resultsBox.innerHTML = found.length
    ? found
        .map((r, i) => `<li role="option" id="sr-${i}" data-i="${i}"><strong>${esc(r.label)}</strong><small>${esc(r.type)}${r.sub ? " · " + esc(r.sub) : ""}</small></li>`)
        .join("")
    : `<li class="no-result" role="option" aria-disabled="true">No matches for “${esc(searchInput.value.trim())}”</li>`;
  resultsBox.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  activeResult = -1;
  $("#search-status").textContent = found.length ? `${found.length} results` : "No results";
});

searchInput.addEventListener("keydown", (e) => {
  if (resultsBox.hidden) return;
  if (e.key === "Escape") return closeResults();
  if (!found.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    setActiveResult((activeResult + (e.key === "ArrowDown" ? 1 : -1) + found.length) % found.length);
  } else if (e.key === "Enter") {
    e.preventDefault();
    openResult(found[activeResult < 0 ? 0 : activeResult]);
  }
});

resultsBox.addEventListener("click", (e) => {
  const item = e.target.closest("li[data-i]");
  if (item) openResult(found[Number(item.dataset.i)]);
});

$("#search-form").addEventListener("submit", (e) => e.preventDefault());
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-form")) closeResults();
});

/* ---------- Start ---------- */

applyTheme(document.documentElement.dataset.theme || "dark", false);
resetMemberForm();
refresh();
route();