
"use strict";
 
/* 
   Smart Gym — features.js
   Add-on features.
 
   1. Real QR check-in (QR codes + scan by camera or type the code)
   2. Notifications panel (replaces the plain alert on the bell)
   3. Duplicate phone check (members)
   4. Demo data buttons (load / remove)
   5. Expiring-soon status (memberships ending within 7 days)
 
   Uses the globals from script.js: $, data, access, today, dateKey,
   uid, isActive, fmtDate, esc, countBookings, checkIn, refresh, toast.
    */
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DAY = 864e5;
  const SOON_DAYS = 7;
 
  const isIn = () => document.documentElement.dataset.auth === "in";
  const role = () => ($("#profile-button small")?.textContent || "").trim();
  const isStaff = (r) => ["Gym Manager", "Reception Staff", "Trainer"].includes(r);
 
  /* The signed-in Member's own record (auth.js links it by name) */
  const ownMember = () => {
    const name = ($("#profile-button strong")?.textContent || "").trim().toLowerCase();
    return data.members.find((m) => m.name.toLowerCase() === name);
  };
 
  /* ---------- Phone numbers: 0911…, 911… and +251911… count as the same ---------- */
  function normPhone(p) {
    let d = String(p || "").replace(/\D/g, "");
    if (d.startsWith("251") && d.length === 12) d = "0" + d.slice(3);
    else if (d.length === 9 && /^[97]/.test(d)) d = "0" + d;
    return d;
  }
 
  /* ---------- Membership dates ---------- */
  const daysLeft = (m) =>
    Math.round((new Date(`${m.expiry}T12:00:00`) - new Date(`${today()}T12:00:00`)) / DAY);
  const isExpiring = (m) => isActive(m) && daysLeft(m) <= SOON_DAYS;
  const soonLabel = (n) => (n <= 0 ? "Expires today" : n === 1 ? "Expiring tomorrow" : `Expiring in ${n} days`);
 
  /* =========================================================
     5. EXPIRING-SOON STATUS
     ========================================================= */
  function paintExpiring() {
    $$("#member-table tr").forEach((tr) => {
      const id = tr.querySelector("[data-id]")?.dataset.id;
      const m = data.members.find((x) => x.id === id);
      const cell = tr.children[3];
      if (!m || !cell || !isExpiring(m)) return;
      cell.innerHTML = `<span class="status status-expiring" title="Expires ${esc(fmtDate(m.expiry))}">${soonLabel(daysLeft(m))}</span>`;
    });
 
    if (role() === "Member") {
      const m = ownMember();
      const el = $("#my-summary .status-active");
      if (m && el && isExpiring(m)) {
        el.outerHTML = `<span class="status status-expiring">${soonLabel(daysLeft(m))}</span>`;
      }
    }
  }
 
  /* =========================================================
     3. DUPLICATE PHONE CHECK
     Runs in the capture phase, before script.js saves the member.
     ========================================================= */
  document.addEventListener(
    "submit",
    (e) => {
      if (e.target.id !== "member-form") return;
      const phone = normPhone($("#member-phone").value);
      if (!phone) return;
      const editingId = $("#member-id").value;
      const clash = data.members.find((m) => m.id !== editingId && normPhone(m.phone) === phone);
      if (!clash) {
        $("#member-phone").removeAttribute("aria-invalid");
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      $("#member-phone").setAttribute("aria-invalid", "true");
      $("#member-phone").focus();
      toast(`This phone number already belongs to ${clash.name}.`);
    },
    true
  );
  $("#member-phone").addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));
 
  /* =========================================================
     1. REAL QR CHECK-IN
     ========================================================= */
 
  /* ----- Small QR code generator (no internet or library needed) -----
     Byte mode, error correction level M, versions 1–6, fixed mask 0. */
  /* QR-ENCODER-START */
  const QR_ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16];
  const QR_BLOCKS = [0, 1, 1, 1, 2, 2, 4];
 
  function qrMatrix(text) {
    const bytes = [...new TextEncoder().encode(text)];
 
    // pick the smallest version that fits
    const rawModules = (v) => {
      let r = (16 * v + 128) * v + 64;
      if (v >= 2) {
        const n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
      }
      return r;
    };
    let ver = 1;
    const dataCap = (v) => Math.floor(rawModules(v) / 8) - QR_ECC_PER_BLOCK[v] * QR_BLOCKS[v];
    while (ver <= 6 && bytes.length + 2 > dataCap(ver)) ver++;
    if (ver > 6) throw new RangeError("Text too long for QR code");
 
    const size = ver * 4 + 17;
    const dataLen = dataCap(ver);
 
    // 1) data bits
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0b0100, 4);
    put(bytes.length, 8);
    bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, dataLen * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const dataWords = [];
    for (let i = 0; i < bits.length; i += 8) dataWords.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let pad = 0xec; dataWords.length < dataLen; pad ^= 0xec ^ 0x11) dataWords.push(pad);
 
    // 2) Reed–Solomon error correction
    const gfMul = (x, y) => {
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    };
    const eccLen = QR_ECC_PER_BLOCK[ver];
    const divisor = new Array(eccLen).fill(0);
    divisor[eccLen - 1] = 1;
    for (let i = 0, root = 1; i < eccLen; i++) {
      for (let j = 0; j < divisor.length; j++) {
        divisor[j] = gfMul(divisor[j], root);
        if (j + 1 < divisor.length) divisor[j] ^= divisor[j + 1];
      }
      root = gfMul(root, 2);
    }
    const remainder = (block) => {
      const res = new Array(eccLen).fill(0);
      block.forEach((b) => {
        const factor = b ^ res.shift();
        res.push(0);
        divisor.forEach((c, i) => { res[i] ^= gfMul(c, factor); });
      });
      return res;
    };
 
    // 3) split into blocks and interleave
    const nBlocks = QR_BLOCKS[ver];
    const rawWords = Math.floor(rawModules(ver) / 8);
    const nShort = nBlocks - (rawWords % nBlocks);
    const shortLen = Math.floor(rawWords / nBlocks);
    const blocks = [];
    for (let i = 0, k = 0; i < nBlocks; i++) {
      const dat = dataWords.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = remainder(dat);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const words = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => {
        if (i !== shortLen - eccLen || j >= nShort) words.push(b[i]);
      });
    }
 
    // 4) draw the fixed patterns
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };
 
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            setFn(x, y, d !== 2 && d !== 4);
          }
        }
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
 
    if (ver > 1) {
      const n = Math.floor(ver / 7) + 2;
      const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      const pos = [6];
      for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
      pos.forEach((cx, i) => pos.forEach((cy, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }));
    }
 
    // reserve the format-information area (filled in properly below)
    const MASK = 0;
    const formatBits = (() => {
      const d = (0 << 3) | MASK; // error-correction level M = 0
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      return ((d << 10) | r) ^ 0x5412;
    })();
    const bit = (n, i) => ((n >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(formatBits, i));
    setFn(8, 7, bit(formatBits, 6));
    setFn(8, 8, bit(formatBits, 7));
    setFn(7, 8, bit(formatBits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(formatBits, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(formatBits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(formatBits, i));
    setFn(8, size - 8, true);
 
    // 5) place the data in the zig-zag order, then apply the mask
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const up = ((right + 1) & 2) === 0;
          const y = up ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < words.length * 8) {
            mod[y][x] = bit(words[bi >>> 3], 7 - (bi & 7));
            bi++;
          }
        }
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!fn[y][x] && (x + y) % 2 === 0) mod[y][x] = !mod[y][x]; // mask 0
      }
    }
    return mod;
  }
  /* QR-ENCODER-END */
 
  /* QR code as an SVG (always black on white so every scanner can read it) */
  function qrSvg(text) {
    const m = qrMatrix(text);
    const total = m.length + 8;
    let path = "";
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }
 
  const codeFor = (m) => "SG-" + String(m.id).toUpperCase();
 
  /* Turn what was scanned or typed into a member */
  function findByCode(raw) {
    let s = String(raw || "").trim().toUpperCase();
    if (s.startsWith("SG-")) s = s.slice(3);
    s = s.replace(/[^A-Z0-9]/g, "");
    if (!s) return null;
    return data.members.find((m) => String(m.id).toUpperCase().replace(/[^A-Z0-9]/g, "") === s) || null;
  }
 
  /* ----- Panel added to the Attendance page ----- */
  const qrPanel = document.createElement("section");
  qrPanel.className = "qr-panel";
  qrPanel.id = "qr-panel";
  qrPanel.setAttribute("aria-label", "QR check-in");
  qrPanel.hidden = true;
  qrPanel.innerHTML = `
    <div class="qr-box" id="qr-scan-box">
      <h3>QR check-in</h3>
      <p class="muted small">Scan a member's QR code, or type the code printed under it.</p>
      <form class="qr-form" id="qr-form">
        <label class="sr-only" for="qr-code-input">Member code</label>
        <input id="qr-code-input" placeholder="SG-XXXXXXXXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="button button-primary" type="submit">Check in</button>
      </form>
      <button class="button button-quiet" type="button" id="qr-camera-start">Scan with camera</button>
      <div class="qr-video-wrap" id="qr-video-wrap" hidden>
        <video id="qr-video" playsinline muted></video>
        <button class="button button-quiet button-full" type="button" id="qr-camera-stop">Stop camera</button>
      </div>
      <p class="qr-result small" id="qr-result" role="status" aria-live="polite"></p>
    </div>
    <div class="qr-box" id="qr-card-box">
      <h3 id="qr-card-title">Member QR code</h3>
      <label class="qr-pick" id="qr-pick">Member
        <select id="qr-member"></select>
      </label>
      <div class="qr-image" id="qr-image"></div>
      <p class="qr-name" id="qr-name"></p>
      <p class="qr-code-text" id="qr-code-text"></p>
      <button class="button button-quiet button-full" type="button" id="qr-print">Print QR card</button>
    </div>`;
  $("#checkin-form").after(qrPanel);
 
  const qrResult = (message, ok) => {
    const el = $("#qr-result");
    el.textContent = message;
    el.className = "qr-result small" + (message ? (ok ? " is-ok" : " is-error") : "");
  };
 
  function currentQrMember() {
    return role() === "Member" ? ownMember() : data.members.find((m) => m.id === $("#qr-member").value);
  }
 
  function renderQrCard() {
    const m = currentQrMember();
    $("#qr-image").hidden = !m;
    $("#qr-print").hidden = !m;
    if (!m) {
      $("#qr-name").textContent = role() === "Member" ? "No membership found." : "Add a member to see a QR code.";
      $("#qr-code-text").textContent = "";
      return;
    }
    $("#qr-image").innerHTML = qrSvg(codeFor(m));
    $("#qr-name").textContent = `${m.name} · ${m.plan} · ${isExpiring(m) ? soonLabel(daysLeft(m)) : isActive(m) ? "Active" : "Expired"}`;
    $("#qr-code-text").textContent = codeFor(m);
  }
 
  function syncQr() {
    const r = role();
    const member = r === "Member";
    qrPanel.hidden = !(isStaff(r) || member);
    $("#qr-scan-box").hidden = member;
    $("#qr-pick").hidden = member;
    $("#qr-card-title").textContent = member ? "My QR code" : "Member QR code";
    $("#qr-card-box").classList.toggle("is-single", member);
    qrPanel.classList.toggle("is-single", member);
 
    const sel = $("#qr-member");
    const old = sel.value;
    sel.innerHTML = data.members.length
      ? data.members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")
      : '<option value="">No members yet</option>';
    if (data.members.some((m) => m.id === old)) sel.value = old;
    renderQrCard();
  }
 
  $("#qr-member").addEventListener("change", renderQrCard);
 
  function handleCode(raw) {
    if (!isStaff(role())) return;
    const m = findByCode(raw);
    if (!m) {
      qrResult("Code not recognised. Check it and try again.", false);
      toast("Code not recognised.");
      return;
    }
    const r = checkIn(m.id, "QR scan");
    if (r.error) {
      qrResult(`${m.name}: ${r.error}`, false);
      toast(r.error);
      return;
    }
    qrResult(`${m.name} checked in.`, true);
    refresh();
    toast(`${m.name} checked in.`);
  }
 
  $("#qr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#qr-code-input");
    if (!input.value.trim()) return qrResult("Type or scan a member code.", false);
    handleCode(input.value);
    input.value = "";
    input.focus();
  });
 
  /* ----- Camera scanning (needs a browser with BarcodeDetector, e.g. Chrome / Android) ----- */
  let stream = null;
  let timer = 0;
 
  function stopCamera() {
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    const video = $("#qr-video");
    video.srcObject = null;
    $("#qr-video-wrap").hidden = true;
    $("#qr-camera-start").hidden = false;
  }
 
  /* Browsers without BarcodeDetector (Firefox, Safari, Windows Chrome) use the small jsQR
     library, loaded only when needed. */
  let jsQRLoading = null;
  const JSQR_SOURCES = [
    "jsQR.min.js", // a copy saved next to index.html (works offline)
    "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js",
    "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
  ];
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!jsQRLoading) {
      jsQRLoading = (async () => {
        for (const src of JSQR_SOURCES) {
          try {
            await new Promise((resolve, reject) => {
              const el = document.createElement("script");
              el.src = src;
              el.onload = resolve;
              el.onerror = () => { el.remove(); reject(new Error("load failed")); };
              document.head.append(el);
            });
            if (window.jsQR) return;
          } catch {
            /* try the next source */
          }
        }
        jsQRLoading = null;
        throw new Error("jsQR failed to load");
      })();
    }
    return jsQRLoading;
  }
 
  async function makeDecoder() {
    if ("BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue || "";
      } catch {
        /* fall through to jsQR */
      }
    }
    await loadJsQR();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return async (video) => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return "";
      const scale = Math.min(1, 640 / w);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || "";
    };
  }
 
  async function startCamera() {
    if (stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      return qrResult(
        window.isSecureContext
          ? "This browser cannot use the camera. Type the code instead."
          : "The camera only works on https:// or http://localhost. Open the site that way, or type the code.",
        false
      );
    }
    qrResult("Starting camera…", true);
    try {
      const decode = await makeDecoder();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (err) {
        if (err.name === "NotAllowedError" || err.name === "SecurityError") throw err;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); // no rear camera: use any camera
      }
      const video = $("#qr-video");
      $("#qr-video-wrap").hidden = false; // show it first, so the browser really plays and decodes it
      $("#qr-camera-start").hidden = true;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.srcObject = stream;
      await video.play();
      qrResult("Point the camera at the QR code.", true);
 
      const tick = async () => {
        if (!stream) return;
        try {
          if (video.readyState >= 2) {
            const raw = await decode(video);
            if (raw) {
              stopCamera();
              handleCode(raw);
              return;
            }
          }
        } catch {
          /* ignore a failed frame and try the next one */
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    } catch (err) {
      stopCamera();
      qrResult(
        err.name === "NotAllowedError" ? "Camera access was blocked. Allow it in the browser's site settings, or type the code."
        : err.name === "NotFoundError" ? "No camera was found on this device. Type the code instead."
        : err.name === "NotReadableError" ? "The camera is being used by another app. Close it and try again."
        : /jsQR/.test(err.message) ? "The scanner library could not load. Save jsQR.min.js next to index.html (see the instructions), or type the code instead."
        : "Could not start the camera. Type the code instead.",
        false
      );
    }
  }
 
  $("#qr-camera-start").addEventListener("click", startCamera);
  $("#qr-camera-stop").addEventListener("click", () => { stopCamera(); qrResult("", true); });
  window.addEventListener("hashchange", () => { if (location.hash !== "#attendance") stopCamera(); });
 
  $("#qr-print").addEventListener("click", () => {
    const m = currentQrMember();
    if (!m) return;
    const w = window.open("", "_blank", "width=420,height=580");
    if (!w) return toast("Allow pop-ups to print the QR card.");
    w.document.write(
      `<!doctype html><title>QR card – ${esc(m.name)}</title>` +
      `<body style="font-family:system-ui,sans-serif;text-align:center;padding:24px">` +
      `<h2>${esc(data.settings.gymName)}</h2><div style="width:260px;margin:0 auto">${qrSvg(codeFor(m))}</div>` +
      `<h3>${esc(m.name)}</h3><p style="font-family:monospace">${esc(codeFor(m))}</p>` +
      `<script>onload=function(){print()}<\/script></body>`
    );
    w.document.close();
  });
 
  /* =========================================================
     2. NOTIFICATIONS PANEL
     ========================================================= */
  const bell = $("#notification-button");
  const panel = document.createElement("div");
  panel.className = "notif-panel";
  panel.id = "notif-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Notifications");
  panel.hidden = true;
  $(".topbar-actions").append(panel);
  bell.setAttribute("aria-controls", "notif-panel");
  bell.setAttribute("aria-expanded", "false");
 
  const RANK = { danger: 0, warn: 1, info: 2 };
 
  function buildNotifications() {
    const r = role();
    const t = today();
    const out = [];
    const add = (level, title, text, href) => out.push({ level, title, text, href });
 
    if (r === "Member") {
      const m = ownMember();
      if (m) {
        if (!isActive(m)) add("danger", "Membership expired", `Your membership ended on ${fmtDate(m.expiry)}. Visit the front desk to renew.`, "#payments");
        else if (isExpiring(m)) add("warn", soonLabel(daysLeft(m)), `Your membership ends on ${fmtDate(m.expiry)}.`, "#payments");
        const next = data.bookings
          .filter((b) => b.memberId === m.id)
          .map((b) => data.classes.find((c) => c.id === b.classId))
          .filter((c) => c && c.date >= t)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (next) add("info", `Next class: ${next.name}`, fmtDate(next.date), "#classes");
      }
      return out;
    }
 
    data.members
      .filter(isExpiring)
      .sort((a, b) => daysLeft(a) - daysLeft(b))
      .forEach((m) => add("warn", m.name, `${soonLabel(daysLeft(m))} · ${m.plan}`, "#members"));
 
    const expired = data.members.filter((m) => !isActive(m)).length;
    if (expired) add("danger", `${expired} expired membership${expired > 1 ? "s" : ""}`, "These members need to renew.", "#members");
 
    access.classes(data.classes)
      .filter((c) => c.date >= t && countBookings(c.id) >= Number(c.capacity))
      .forEach((c) => add("warn", `${c.name} is full`, `${fmtDate(c.date)} · ${countBookings(c.id)} / ${c.capacity} booked`, "#classes"));
 
    if (r === "Gym Manager") {
      data.equipment
        .filter((e) => e.condition && e.condition !== "Good")
        .forEach((e) => add(e.condition === "Out of service" ? "danger" : "warn", e.name, `${e.condition}${e.notes ? " · " + e.notes : ""}`, "#equipment"));
    }
    return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
  }
 
  function renderNotifs(items = buildNotifications()) {
    panel.innerHTML =
      `<div class="notif-head"><strong>Notifications</strong><span class="pill">${items.length}</span></div>` +
      (items.length
        ? `<ul class="notif-list">${items
            .map((n) => `<li><a class="notif-item notif-${n.level}" href="${esc(n.href)}"><span class="notif-bullet" aria-hidden="true"></span><span><strong>${esc(n.title)}</strong><small>${esc(n.text)}</small></span></a></li>`)
            .join("")}</ul>`
        : '<p class="notif-empty">You are all caught up. Nothing needs attention.</p>');
  }
 
  function setNotif(open) {
    panel.hidden = !open;
    bell.setAttribute("aria-expanded", String(open));
    if (open) renderNotifs();
  }
 
  function updateBell() {
    const items = buildNotifications();
    const dot = bell.querySelector(".notification-dot");
    if (dot) dot.hidden = items.length === 0;
    bell.setAttribute("aria-label", items.length ? `Show notifications (${items.length})` : "Show notifications");
    if (!panel.hidden) renderNotifs(items);
  }
 
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setNotif(false); });
 
  /* Window capture runs before script.js / auth.js, so the old alert never opens */
  window.addEventListener(
    "click",
    (e) => {
      if (!isIn()) return;
      const t = e.target;
      if (t.closest("#notification-button")) {
        e.preventDefault();
        e.stopPropagation();
        const pm = $("#profile-menu");
        if (pm && !pm.hidden) {
          pm.hidden = true;
          $("#profile-button").setAttribute("aria-expanded", "false");
        }
        setNotif(panel.hidden);
        return;
      }
      if (t.closest("#logout-button, [data-signout]")) {
        stopCamera();
        setNotif(false);
        return;
      }
      if (!t.closest("#notif-panel")) setNotif(false);
    },
    true
  );
 
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setNotif(false);
      bell.focus();
    }
  });
 
  /* =========================================================
     4. DEMO DATA
     ========================================================= */
  const dayOffset = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return dateKey(d);
  };
 
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
 
  /* [name, phone, plan, started N days ago, days left (negative = expired)] */
  const DEMO_MEMBERS = [
    ["Abel Bekele", "0911000001", "Standard", 20, 10],
    ["Meron Tadesse", "0911000011", "Premium", 40, 50],
    ["Samuel Girma", "0911000012", "Basic", 27, 3],
    ["Hana Alemu", "0911000013", "Standard", 25, 5],
    ["Yonas Abebe", "0911000014", "Premium", 10, 80],
    ["Tigist Haile", "0911000015", "Basic", 45, -15],
    ["Biruk Assefa", "0911000016", "Standard", 15, 15],
    ["Liya Desta", "0911000017", "Premium", 60, 30],
    ["Kidus Worku", "0911000018", "Basic", 5, 25],
    ["Saron Negash", "0911000019", "Standard", 35, -5],
    ["Nahom Kebede", "0911000020", "Basic", 29, 1],
    ["Betelhem Mengistu", "0911000021", "Premium", 12, 18]
  ];
  const DEMO_TRAINERS = [
    ["Henok Tilahun", "0911000002", "Strength & conditioning", "Available"],
    ["Rahel Getachew", "0911000030", "Yoga & mobility", "Available"],
    ["Bereket Solomon", "0911000031", "HIIT & cardio", "Busy"]
  ];
  /* [name, trainer index, days from today, capacity, bookings] */
  const DEMO_CLASSES = [
    ["Morning Yoga", 1, 1, 12, 5],
    ["HIIT Blast", 2, 2, 4, 4],
    ["Strength Basics", 0, 3, 10, 6],
    ["Spin & Burn", 2, 4, 15, 7],
    ["Mobility Flow", 1, 6, 12, 3],
    ["Powerlifting Clinic", 0, 8, 6, 2]
  ];
  const DEMO_WORKOUTS = [
    ["Beginner strength", 0, "Build strength", "Mon / Wed / Fri"],
    ["Fat-loss circuit", 1, "Lose 5 kg", "Tue / Thu / Sat"],
    ["Mobility & core", 3, "Improve flexibility", "Mon / Thu"],
    ["Hypertrophy split", 4, "Gain muscle", "Mon–Fri"],
    ["Cardio endurance", 6, "Run 5 km", "Wed / Sat"]
  ];
  /* [member index, weight kg, goal, target days ahead] */
  const DEMO_PROGRESS = [
    [0, 78.5, "Reach 75 kg", 60],
    [1, 64.2, "Reach 60 kg", 90],
    [4, 82.0, "Gain 3 kg muscle", 75],
    [7, 70.4, "Reach 68 kg", 45],
    [8, 91.3, "Reach 85 kg", 120]
  ];
  const DEMO_EQUIPMENT = [
    ["Treadmill #1", "Good", "Serviced last month"],
    ["Treadmill #2", "Needs maintenance", "Belt is slipping"],
    ["Leg press", "Good", ""],
    ["Cable machine", "Out of service", "Cable snapped, part ordered"],
    ["Dumbbell rack", "Good", "Full set 2–50 kg"],
    ["Rowing machine", "Needs maintenance", "Seat rail is loose"]
  ];
  const PRICE = { Basic: 500, Standard: 800, Premium: 1200 };
  const PAY_METHODS = ["Cash", "Mobile money", "Bank transfer", "Card"];
 
  const hasDemo = () =>
    ["members", "trainers", "classes", "equipment"].some((c) => data[c].some((i) => i.demo));
 
  function loadDemo() {
    if (role() !== "Gym Manager") return toast("Only the Gym Manager can load demo data.");
    if (hasDemo()) return toast("Demo data is already loaded. Remove it first to load it again.");
    if (!window.confirm("Add sample members, classes, payments and more to your current records?")) return;
 
    const rand = mulberry32(2026);
    const counts = { members: 0, classes: 0, payments: 0, attendance: 0 };
 
    // members and trainers (an existing person with the same phone or name is reused, never duplicated)
    const memberIds = DEMO_MEMBERS.map(([name, phone, plan, ago, left]) => {
      const old = data.members.find((m) => normPhone(m.phone) === normPhone(phone) || m.name.toLowerCase() === name.toLowerCase());
      if (old) return old.id;
      const id = uid();
      data.members.push({ id, name, phone, plan, start: dayOffset(-ago), expiry: dayOffset(left), demo: true });
      counts.members++;
      return id;
    });
    const trainerIds = DEMO_TRAINERS.map(([name, phone, specialty, availability]) => {
      const old = data.trainers.find((t) => normPhone(t.phone) === normPhone(phone) || t.name.toLowerCase() === name.toLowerCase());
      if (old) return old.id;
      const id = uid();
      data.trainers.push({ id, name, phone, specialty, availability, demo: true });
      return id;
    });
 
    // attendance: the last 28 days, a few visits each, only while the membership was valid
    const now = new Date();
    for (let ago = 27; ago >= 0; ago--) {
      const date = dayOffset(-ago);
      DEMO_MEMBERS.forEach(([, , , started, left], i) => {
        if (ago > started || ago < -left || rand() > 0.35) return;
        const roll = rand();
        const hour = roll < 0.45 ? 6 + Math.floor(rand() * 6) : roll < 0.7 ? 12 + Math.floor(rand() * 5) : 17 + Math.floor(rand() * 4);
        if (ago === 0 && hour > now.getHours()) return;
        if (data.attendance.some((a) => a.memberId === memberIds[i] && a.date === date)) return;
        data.attendance.push({
          id: uid(),
          memberId: memberIds[i],
          date,
          time: new Date(2000, 0, 1, hour, Math.floor(rand() * 60)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          hour,
          method: rand() < 0.5 ? "QR scan" : "Manual check-in",
          demo: true
        });
        counts.attendance++;
      });
    }
 
    // payments: one membership fee each, plus a few extras
    DEMO_MEMBERS.forEach(([, , plan, ago], i) => {
      data.payments.push({ id: uid(), memberId: memberIds[i], amount: PRICE[plan], method: PAY_METHODS[i % 4], purpose: "Membership fee", date: dayOffset(-ago), demo: true });
      counts.payments++;
    });
    [[1, 1500, "Personal training (4 sessions)", 6], [4, 1500, "Personal training (4 sessions)", 3], [7, 150, "Locker rental", 12], [0, 150, "Locker rental", 2]].forEach(([i, amount, purpose, ago], k) => {
      data.payments.push({ id: uid(), memberId: memberIds[i], amount, method: PAY_METHODS[k % 4], purpose, date: dayOffset(-ago), demo: true });
      counts.payments++;
    });
 
    // classes and bookings (one class is full, so the notifications panel has something to show)
    const activeIds = memberIds.filter((_, i) => DEMO_MEMBERS[i][4] >= 0);
    DEMO_CLASSES.forEach(([name, trainer, ahead, capacity, booked], ci) => {
      const id = uid();
      const date = dayOffset(ahead);
      data.classes.push({ id, name, trainerId: trainerIds[trainer], date, capacity, demo: true });
      counts.classes++;
      for (let k = 0; k < booked; k++) {
        data.bookings.push({ id: uid(), memberId: activeIds[(ci * 3 + k) % activeIds.length], classId: id, date: today(), classDate: date, demo: true });
      }
    });
 
    DEMO_WORKOUTS.forEach(([name, i, goal, schedule]) =>
      data.workouts.push({ id: uid(), name, memberId: memberIds[i], goal, schedule, demo: true }));
    DEMO_PROGRESS.forEach(([i, weight, goal, ahead]) =>
      data.progress.push({ id: uid(), memberId: memberIds[i], weight, goal, target: dayOffset(ahead), date: today(), demo: true }));
    DEMO_EQUIPMENT.forEach(([name, condition, notes]) => {
      if (!data.equipment.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        data.equipment.push({ id: uid(), name, condition, notes, demo: true });
      }
    });
 
    refresh();
    toast(`Demo data added: ${counts.members} members, ${counts.classes} classes, ${counts.payments} payments.`);
  }
 
  function clearDemo() {
    if (role() !== "Gym Manager") return toast("Only the Gym Manager can remove demo data.");
    if (!hasDemo()) return toast("There is no demo data to remove.");
    if (!window.confirm("Remove all demo data? Records you added yourself are kept.")) return;
 
    const gone = new Set(data.members.filter((m) => m.demo).map((m) => m.id));
    const goneClasses = new Set(data.classes.filter((c) => c.demo).map((c) => c.id));
    ["attendance", "payments", "workouts", "progress"].forEach((c) => {
      data[c] = data[c].filter((i) => !i.demo && !gone.has(i.memberId));
    });
    data.bookings = data.bookings.filter((b) => !b.demo && !gone.has(b.memberId) && !goneClasses.has(b.classId));
    data.members = data.members.filter((m) => !m.demo);
    data.classes = data.classes.filter((c) => !c.demo);
    data.trainers = data.trainers.filter((t) => !t.demo);
    data.equipment = data.equipment.filter((e) => !e.demo);
    refresh();
    toast("Demo data removed.");
  }
 
  const demoActions = $("#settings-form .form-actions");
  const demoLoad = document.createElement("button");
  demoLoad.className = "button button-secondary";
  demoLoad.type = "button";
  demoLoad.id = "demo-load";
  demoLoad.textContent = "Load demo data";
  const demoClear = document.createElement("button");
  demoClear.className = "button button-quiet";
  demoClear.type = "button";
  demoClear.id = "demo-clear";
  demoClear.textContent = "Remove demo data";
  demoActions.append(demoLoad, demoClear);
  demoLoad.addEventListener("click", loadDemo);
  demoClear.addEventListener("click", clearDemo);

  function sync() {
    const manager = isIn() && role() === "Gym Manager";
    demoLoad.hidden = !manager;
    demoClear.hidden = !manager;
    if (!isIn()) return;
    paintExpiring();
    syncQr();
    updateBell();
  }
 
  const previous = window.applyRoleUI;
  window.applyRoleUI = function () {
    if (previous) previous.apply(this, arguments);
    try {
      sync();
    } catch (err) {
      console.error("features.js:", err);
    }
  };
 
  sync(); // auth.js may already have signed the person in from a saved session
})();