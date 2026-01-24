/* global Parse */
(function () {
  function $(id) { return document.getElementById(id); }

  function isPage(name) {
    return window.location.pathname.endsWith("/" + name) || window.location.pathname.endsWith(name);
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message || "";
    el.className = "text-sm " + (type === "ok" ? "text-success" : type === "err" ? "text-danger" : "text-muted");
  }

  async function bootHeaderAuth() {
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
  }

  // Patients page
  async function bootPatients() {
    await bootHeaderAuth();

    const listEl = $("patientList");
    const searchEl = $("search");
    const statusEl = $("pStatus");

    let all = [];
    let activePatient = null;

    function render(list) {
      if (!listEl) return;
      if (!list.length) {
        listEl.innerHTML = '<div class="text-sm text-muted">No patients yet.</div>';
        return;
      }
      listEl.innerHTML = list.map(p => {
        const name = `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim();
        const phone = p.get("phone") || "—";
        const email = p.get("email") || "—";
        return `
          <button data-id="${p.id}" class="w-full text-left p-3 rounded-lg border border-border bg-bg/30 hover:bg-bg/50">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">${name || "Unnamed"}</div>
              <div class="text-xs text-muted">${p.id}</div>
            </div>
            <div class="text-xs text-muted mt-1">${phone} • ${email}</div>
          </button>
        `;
      }).join("");

      listEl.querySelectorAll("button[data-id]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          activePatient = await window.API.getPatient(id);
          showPatientView(activePatient);
        });
      });
    }

    function showPatientView(p) {
      const sec = $("patientViewSection");
      if (!sec) return;
      sec.classList.remove("hidden");

      $("pvGenerated").textContent = new Date().toLocaleString();
      $("pvName").textContent = `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim() || "—";
      $("pvContact").textContent = [p.get("phone") || "", p.get("email") || ""].filter(Boolean).join(" • ") || "—";
      $("pvDob").textContent = p.get("dob") ? new Date(p.get("dob")).toLocaleDateString() : "—";
      $("pvId").textContent = p.id;

      const printBtn = $("pPrintBtn");
      if (printBtn) {
        printBtn.onclick = () => {
          const card = $("patientCard");
          const w = window.open("", "PRINT", "height=650,width=900");
          w.document.write("<html><head><title>Patient Summary</title>");
          w.document.write("<style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;}</style>");
          w.document.write("</head><body>");
          w.document.write(card.outerHTML);
          w.document.write("</body></html>");
          w.document.close();
          w.focus();
          w.print();
          w.close();
        };
      }

      const pdfBtn = $("pPdfBtn");
      if (pdfBtn) {
        pdfBtn.onclick = async () => {
          const card = $("patientCard");
          await window.PDF.downloadElementAsPDF(card, `patient-${p.id}.pdf`);
        };
      }
    }

    try {
      all = await window.API.listPatients();
      render(all);
    } catch (e) {
      console.error(e);
      if (listEl) listEl.innerHTML = '<div class="text-sm text-muted">Failed to load.</div>';
    }

    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const q = searchEl.value.trim().toLowerCase();
        const filtered = !q ? all : all.filter(p => {
          const name = `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.toLowerCase();
          return name.includes(q);
        });
        render(filtered);
      });
    }

    const form = $("patientForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        setStatus(statusEl, "Saving…", "muted");
        try {
          await window.API.createPatient({
            firstName: $("pFirst").value,
            lastName: $("pLast").value,
            dob: $("pDob").value ? new Date($("pDob").value + "T00:00:00") : null,
            phone: $("pPhone").value.trim(),
            email: $("pEmail").value.trim().toLowerCase()
          });
          form.reset();
          setStatus(statusEl, "Saved.", "ok");
          all = await window.API.listPatients();
          render(all);
        } catch (err) {
          console.error(err);
          setStatus(statusEl, err.message, "err");
        }
      });
    }
  }

  // Billing page
  async function bootBilling() {
    await bootHeaderAuth();

    const invPatient = $("invPatient");
    const itemsWrap = $("itemsWrap");
    const invTax = $("invTax");
    const invStatus = $("invStatus");
    const invStatusSelect = $("invStatusSelect");

    let itemIndex = 0;

    function addItemRow(seed = { name: "", qty: 1, unitPrice: 0 }) {
      itemIndex += 1;
      const id = `item-${itemIndex}`;
      const row = document.createElement("div");
      row.className = "grid sm:grid-cols-12 gap-2 items-end";
      row.dataset.row = id;
      row.innerHTML = `
        <div class="sm:col-span-6">
          <label class="block text-xs text-muted">Item</label>
          <input class="w-full rounded-lg bg-bg border border-border px-3 py-2" data-field="name" value="${seed.name}" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs text-muted">Qty</label>
          <input type="number" min="1" class="w-full rounded-lg bg-bg border border-border px-3 py-2" data-field="qty" value="${seed.qty}" />
        </div>
        <div class="sm:col-span-3">
          <label class="block text-xs text-muted">Unit price</label>
          <input type="number" step="0.01" min="0" class="w-full rounded-lg bg-bg border border-border px-3 py-2" data-field="unitPrice" value="${seed.unitPrice}" />
        </div>
        <div class="sm:col-span-1">
          <button type="button" class="w-full px-3 py-2 rounded-lg border border-border hover:bg-white/5" data-action="remove">×</button>
        </div>
      `;

      row.querySelector('[data-action="remove"]').addEventListener("click", () => {
        row.remove();
        recalc();
      });

      row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", recalc));
      itemsWrap.appendChild(row);
      recalc();
    }

    function collectItems() {
      const rows = Array.from(itemsWrap.querySelectorAll("[data-row]"));
      return rows.map(r => {
        const name = r.querySelector('[data-field="name"]').value.trim();
        const qty = Number(r.querySelector('[data-field="qty"]').value || 0);
        const unitPrice = Number(r.querySelector('[data-field="unitPrice"]').value || 0);
        const total = qty * unitPrice;
        return { name, qty, unitPrice, total };
      }).filter(it => it.name && it.qty > 0);
    }

    function recalc() {
      const items = collectItems();
      const subtotal = items.reduce((s, it) => s + it.total, 0);
      const tax = Number(invTax.value || 0);
      const total = subtotal + tax;

      $("invSubtotal").textContent = window.API.money(subtotal);
      $("invTaxView").textContent = window.API.money(tax);
      $("invTotal").textContent = window.API.money(total);
    }

    async function loadPatients() {
      invPatient.innerHTML = '<option value="">Loading…</option>';
      const list = await window.API.listPatients();
      if (!list.length) {
        invPatient.innerHTML = '<option value="">No patients yet</option>';
        return;
      }
      invPatient.innerHTML = '<option value="">Select a patient…</option>';
      list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.get("lastName") || ""}, ${p.get("firstName") || ""}`.replace(/^,\s*/, "");
        invPatient.appendChild(opt);
      });
    }

    async function loadInvoices() {
      const listEl = $("invoiceList");
      listEl.innerHTML = '<div class="text-sm text-muted">Loading…</div>';
      try {
        const list = await window.API.listInvoices();
        if (!list.length) {
          listEl.innerHTML = '<div class="text-sm text-muted">No invoices yet.</div>';
          return;
        }

        listEl.innerHTML = list.map(inv => {
          const p = inv.get("patient");
          const patientName = p ? `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim() : "Patient";
          const status = inv.get("status") || "UNPAID";
          const total = window.API.money(inv.get("total") || 0);
          const badgeClass = status === "PAID" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30";
          return `
            <button data-id="${inv.id}" class="w-full text-left p-3 rounded-lg border border-border bg-bg/30 hover:bg-bg/50">
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-medium">${inv.get("number") || inv.id} • ${patientName}</div>
                <span class="text-xs px-2 py-1 rounded-full border ${badgeClass}">${status}</span>
              </div>
              <div class="text-xs text-muted mt-1">Total: ${total} • ${new Date(inv.get("issuedAt") || inv.createdAt).toLocaleString()}</div>
            </button>
          `;
        }).join("");

        listEl.querySelectorAll("button[data-id]").forEach(btn => {
          btn.addEventListener("click", async () => {
            const inv = await window.API.getInvoice(btn.getAttribute("data-id"));
            showReceipt(inv);
          });
        });
      } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div class="text-sm text-muted">Failed to load.</div>';
      }
    }

    function showReceipt(inv) {
      const sec = $("receiptSection");
      sec.classList.remove("hidden");

      $("rNumber").textContent = inv.get("number") || inv.id;
      $("rDate").textContent = new Date(inv.get("issuedAt") || inv.createdAt).toLocaleString();

      const p = inv.get("patient");
      const name = p ? `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim() : "—";
      const contact = p ? [p.get("phone") || "", p.get("email") || ""].filter(Boolean).join(" • ") : "—";

      $("rPatient").textContent = name || "—";
      $("rPatientContact").textContent = contact || "—";
      $("rStatus").textContent = inv.get("status") || "—";

      const items = inv.get("items") || [];
      const body = $("rItems");
      body.innerHTML = items.map(it => {
        return `
          <tr class="border-b">
            <td class="py-2">${it.name}</td>
            <td class="py-2 text-right">${it.qty}</td>
            <td class="py-2 text-right">${window.API.money(it.unitPrice)}</td>
            <td class="py-2 text-right">${window.API.money(it.total)}</td>
          </tr>
        `;
      }).join("");

      $("rSubtotal").textContent = window.API.money(inv.get("subtotal") || 0);
      $("rTax").textContent = window.API.money(inv.get("tax") || 0);
      $("rTotal").textContent = window.API.money(inv.get("total") || 0);

      $("printBtn").onclick = () => {
        const receipt = $("receipt");
        const w = window.open("", "PRINT", "height=650,width=900");
        w.document.write("<html><head><title>Receipt</title>");
        w.document.write("<style>body{font-family:Arial,sans-serif;padding:20px;background:#fff;} table{border-collapse:collapse;} th,td{padding:6px 8px;}</style>");
        w.document.write("</head><body>");
        w.document.write(receipt.outerHTML);
        w.document.write("</body></html>");
        w.document.close();
        w.focus();
        w.print();
        w.close();
      };

      $("pdfBtn").onclick = async () => {
        const receipt = $("receipt");
        await window.PDF.downloadElementAsPDF(receipt, `receipt-${inv.get("number") || inv.id}.pdf`);
      };

      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    $("addItemBtn").addEventListener("click", () => addItemRow());
    invTax.addEventListener("input", recalc);

    addItemRow({ name: "Consultation", qty: 1, unitPrice: 0 });

    await loadPatients();
    await loadInvoices();

    const form = $("invoiceForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus(invStatus, "Creating…", "muted");

      try {
        const patientId = invPatient.value;
        if (!patientId) throw new Error("Please select a patient.");

        const items = collectItems();
        if (!items.length) throw new Error("Add at least one line item.");

        const status = invStatusSelect.value;
        const tax = Number(invTax.value || 0);

        const inv = await window.API.createInvoice({
          patientId,
          items,
          status,
          tax,
          number: "INV-" + Date.now()
        });

        setStatus(invStatus, "Invoice created.", "ok");
        await loadInvoices();
        const full = await window.API.getInvoice(inv.id);
        showReceipt(full);
      } catch (err) {
        console.error(err);
        setStatus(invStatus, err.message, "err");
      }
    });
  }

  // Messages page
  async function bootMessages() {
    await bootHeaderAuth();

    const threadList = $("threadList");
    const msgList = $("msgList");
    const sendBtn = $("sendBtn");
    const msgForm = $("msgForm");
    const tPatient = $("tPatient");
    const tStatus = $("tStatus");

    let activeThreadId = null;

    async function loadPatientsDropdown() {
      const list = await window.API.listPatients();
      tPatient.innerHTML = '<option value="">No link</option>';
      list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.get("lastName") || ""}, ${p.get("firstName") || ""}`.replace(/^,\s*/, "");
        tPatient.appendChild(opt);
      });
    }

    async function loadThreads() {
      threadList.innerHTML = '<div class="text-sm text-muted">Loading…</div>';
      try {
        const list = await window.API.listThreads();
        if (!list.length) {
          threadList.innerHTML = '<div class="text-sm text-muted">No threads yet.</div>';
          return;
        }
        threadList.innerHTML = list.map(t => {
          const p = t.get("patient");
          const pName = p ? `${p.get("firstName") || ""} ${p.get("lastName") || ""}`.trim() : "";
          const meta = [pName, new Date(t.get("lastMessageAt") || t.updatedAt).toLocaleString()].filter(Boolean).join(" • ");
          return `
            <button data-id="${t.id}" class="w-full text-left p-3 rounded-lg border border-border bg-bg/30 hover:bg-bg/50">
              <div class="text-sm font-medium">${t.get("subject") || "Thread"}</div>
              <div class="text-xs text-muted mt-1">${meta}</div>
            </button>
          `;
        }).join("");

        threadList.querySelectorAll("button[data-id]").forEach(btn => {
          btn.addEventListener("click", async () => {
            activeThreadId = btn.getAttribute("data-id");
            sendBtn.disabled = false;
            await loadMessages();
          });
        });
      } catch (e) {
        console.error(e);
        threadList.innerHTML = '<div class="text-sm text-muted">Failed to load.</div>';
      }
    }

    async function loadMessages() {
      msgList.innerHTML = '<div class="text-sm text-muted">Loading…</div>';
      try {
        const msgs = await window.API.listMessages(activeThreadId);
        if (!msgs.length) {
          msgList.innerHTML = '<div class="text-sm text-muted">No messages yet.</div>';
          return;
        }

        msgList.innerHTML = msgs.map(m => {
          const sender = m.get("sender");
          const mine = sender && Parse.User.current() && sender.id === Parse.User.current().id;
          const align = mine ? "justify-end" : "justify-start";
          const bubble = mine ? "bg-primary text-white" : "bg-bg/40 border border-border";
          const who = mine ? "You" : (sender ? (sender.get("email") || sender.get("username") || "User") : "User");
          return `
            <div class="flex ${align}">
              <div class="max-w-[85%] p-3 rounded-lg ${bubble}">
                <div class="text-xs opacity-80">${who} • ${new Date(m.get("sentAt") || m.createdAt).toLocaleString()}</div>
                <div class="text-sm mt-1 whitespace-pre-wrap">${escapeHtml(m.get("body") || "")}</div>
              </div>
            </div>
          `;
        }).join("");

        msgList.scrollTop = msgList.scrollHeight;
      } catch (e) {
        console.error(e);
        msgList.innerHTML = '<div class="text-sm text-muted">Failed to load.</div>';
      }
    }

    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    const threadForm = $("threadForm");
    threadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus(tStatus, "Creating…", "muted");
      try {
        const subject = $("tSubject").value;
        const patientId = tPatient.value || null;
        await window.API.createThread({ subject, patientId });
        threadForm.reset();
        setStatus(tStatus, "Created.", "ok");
        await loadThreads();
      } catch (err) {
        console.error(err);
        setStatus(tStatus, err.message, "err");
      }
    });

    msgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!activeThreadId) return;
      const body = $("msgBody").value;
      if (!body.trim()) return;
      try {
        await window.API.sendMessage(activeThreadId, body);
        $("msgBody").value = "";
        await loadMessages();
        await loadThreads();
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    });

    await loadPatientsDropdown();
    await loadThreads();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (isPage("patients.html")) await bootPatients();
    if (isPage("billing.html")) await bootBilling();
    if (isPage("messages.html")) await bootMessages();
  });
})();