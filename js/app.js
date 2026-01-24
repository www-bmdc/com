/* global Parse */
(function () {
  function $(id) { return document.getElementById(id); }

  function setAlert(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("hidden", !message);
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message || "";
    el.className = "text-sm " + (type === "ok" ? "text-success" : type === "err" ? "text-danger" : "text-muted");
  }

  function isPage(name) {
    return window.location.pathname.endsWith("/" + name) || window.location.pathname.endsWith(name);
  }

  async function bootNavCounts() {
    const statPatients = $("stat-patients");
    const statAppointments = $("stat-appointments");

    try {
      const Patient = Parse.Object.extend("Patient");
      const pq = new Parse.Query(Patient);
      pq.limit(1);
      const patientCount = await pq.count();

      const Appointment = Parse.Object.extend("Appointment");
      const aq = new Parse.Query(Appointment);
      aq.limit(1);
      const apptCount = await aq.count();

      if (statPatients) statPatients.textContent = String(patientCount);
      if (statAppointments) statAppointments.textContent = String(apptCount);
    } catch (error) {
      console.error(error);
      if (statPatients) statPatients.textContent = "—";
      if (statAppointments) statAppointments.textContent = "—";
    }

    const navAuth = $("nav-auth");
    const ctaRow = $("cta-row");
    const user = Parse.User.current();

    if (navAuth) {
      navAuth.innerHTML = user
        ? `<a href="app.html" class="px-3 py-2 rounded-lg bg-primary hover:bg-primaryHover">Dashboard</a>
           <button id="logoutTop" class="px-3 py-2 rounded-lg border border-border hover:bg-white/5">Logout</button>`
        : `<a href="login.html" class="px-3 py-2 rounded-lg border border-border hover:bg-white/5">Login</a>
           <a href="signup.html" class="px-3 py-2 rounded-lg bg-primary hover:bg-primaryHover">Create account</a>`;

      const logoutTop = $("logoutTop");
      if (logoutTop) {
        logoutTop.addEventListener("click", async () => {
          await Parse.User.logOut();
          window.location.href = "index.html";
        });
      }
    }

    if (ctaRow) {
      ctaRow.innerHTML = user
        ? `<a href="app.html" class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary hover:bg-primaryHover">Open dashboard</a>
           <button id="logoutCta" class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border hover:bg-white/5">Logout</button>`
        : `<a href="login.html" class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border hover:bg-white/5">Login</a>
           <a href="signup.html" class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary hover:bg-primaryHover">Create account</a>`;

      const logoutCta = $("logoutCta");
      if (logoutCta) {
        logoutCta.addEventListener("click", async () => {
          await Parse.User.logOut();
          window.location.href = "index.html";
        });
      }
    }
  }

  async function bootLogin() {
    const form = $("form");
    const alert = $("alert");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert(alert, "");

      const email = $("email").value.trim().toLowerCase();
      const password = $("password").value;

      try {
        await Parse.User.logIn(email, password);
        window.location.href = "app.html";
      } catch (error) {
        console.error(error);
        setAlert(alert, error.message);
      }
    });
  }

  async function bootSignup() {
    const form = $("form");
    const alert = $("alert");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert(alert, "");

      const email = $("email").value.trim().toLowerCase();
      const password = $("password").value;
      const password2 = $("password2").value;

      if (password !== password2) {
        setAlert(alert, "Passwords do not match.");
        return;
      }

      try {
        const user = new Parse.User();
        user.set("username", email);
        user.set("email", email);
        user.set("password", password);
        await user.signUp();
        window.location.href = "app.html";
      } catch (error) {
        console.error(error);
        setAlert(alert, error.message);
      }
    });
  }

  async function bootApp() {
    const user = Parse.User.current();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const userLabel = $("userLabel");
    if (userLabel) userLabel.textContent = user.get("email") || user.get("username") || "Signed in";

    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await Parse.User.logOut();
        window.location.href = "index.html";
      });
    }

    const Patient = Parse.Object.extend("Patient");
    const Appointment = Parse.Object.extend("Appointment");

    async function loadPatientsIntoSelect() {
      const sel = $("apptPatient");
      if (!sel) return;

      sel.innerHTML = `<option value="">Loading…</option>`;

      try {
        const q = new Parse.Query(Patient);
        q.descending("createdAt");
        q.limit(200);
        const list = await q.find();

        if (!list.length) {
          sel.innerHTML = `<option value="">No patients yet</option>`;
          return;
        }

        sel.innerHTML = `<option value="">Select a patient…</option>`;
        for (const p of list) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.get("lastName") || ""}, ${p.get("firstName") || ""}`.replace(/^,\s*/, "");
          sel.appendChild(opt);
        }
      } catch (error) {
        console.error(error);
        sel.innerHTML = `<option value="">Failed to load</option>`;
      }
    }

    async function loadUpcomingAppointments() {
      const wrap = $("apptList");
      if (!wrap) return;
      wrap.innerHTML = `<div class="text-sm text-muted">Loading…</div>`;

      try {
        const q = new Parse.Query(Appointment);
        q.ascending("startsAt");
        q.greaterThanOrEqualTo("startsAt", new Date(Date.now() - 60 * 60 * 1000));
        q.include("patient");
        q.limit(20);
        const list = await q.find();

        if (!list.length) {
          wrap.innerHTML = `<div class="text-sm text-muted">No upcoming appointments.</div>`;
          return;
        }

        wrap.innerHTML = "";
        for (const a of list) {
          const p = a.get("patient");
          const patientName = p ? `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim() : "Patient";
          const when = a.get("startsAt") ? new Date(a.get("startsAt")).toLocaleString() : "";
          const reason = a.get("reason") || "—";

          const div = document.createElement("div");
          div.className = "p-3 rounded-lg border border-border bg-bg/30";
          div.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">${patientName}</div>
              <div class="text-xs text-muted">${when}</div>
            </div>
            <div class="text-sm text-muted mt-1">${reason}</div>
          `;
          wrap.appendChild(div);
        }
      } catch (error) {
        console.error(error);
        wrap.innerHTML = `<div class="text-sm text-muted">Failed to load.</div>`;
      }
    }

    const patientForm = $("patientForm");
    if (patientForm) {
      patientForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setStatus($("patientStatus"), "Saving…", "muted");

        try {
          const p = new Patient();
          p.set("firstName", $("pFirst").value.trim());
          p.set("lastName", $("pLast").value.trim());
          const dob = $("pDob").value ? new Date($("pDob").value + "T00:00:00") : null;
          if (dob) p.set("dob", dob);
          const phone = $("pPhone").value.trim();
          if (phone) p.set("phone", phone);
          const email = $("pEmail").value.trim().toLowerCase();
          if (email) p.set("email", email);
          p.set("createdBy", user);

          await p.save();
          patientForm.reset();
          setStatus($("patientStatus"), "Patient saved.", "ok");
          await loadPatientsIntoSelect();
        } catch (error) {
          console.error(error);
          setStatus($("patientStatus"), error.message, "err");
        }
      });
    }

    const apptForm = $("apptForm");
    if (apptForm) {
      apptForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setStatus($("apptStatus"), "Saving…", "muted");

        try {
          const patientId = $("apptPatient").value;
          if (!patientId) throw new Error("Please select a patient.");

          const date = $("apptDate").value;
          const time = $("apptTime").value;
          const startsAt = new Date(`${date}T${time}:00`);
          if (isNaN(startsAt.getTime())) throw new Error("Invalid appointment date/time.");

          const patient = new Patient();
          patient.id = patientId;

          const a = new Appointment();
          a.set("patient", patient);
          a.set("startsAt", startsAt);
          const reason = $("apptReason").value.trim();
          if (reason) a.set("reason", reason);
          a.set("createdBy", user);
          a.set("status", "SCHEDULED");

          await a.save();
          apptForm.reset();
          setStatus($("apptStatus"), "Appointment created.", "ok");
          await loadUpcomingAppointments();
        } catch (error) {
          console.error(error);
          setStatus($("apptStatus"), error.message, "err");
        }
      });
    }

    await loadPatientsIntoSelect();
    await loadUpcomingAppointments();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (isPage("index.html") || window.location.pathname.endsWith("/")) await bootNavCounts();
    if (isPage("login.html")) await bootLogin();
    if (isPage("signup.html")) await bootSignup();
    if (isPage("app.html")) await bootApp();
  });
})();