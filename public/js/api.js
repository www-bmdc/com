/* global Parse */
window.API = (function () {
  const Patient = Parse.Object.extend("Patient");
  const Invoice = Parse.Object.extend("Invoice");
  const MessageThread = Parse.Object.extend("MessageThread");
  const Message = Parse.Object.extend("Message");

  function money(n) {
    const v = Number(n || 0);
    return v.toFixed(2);
  }

  async function requireUser() {
    const user = Parse.User.current();
    if (!user) {
      window.location.href = "login.html";
      throw new Error("Not signed in");
    }
    return user;
  }

  async function listPatients(limit = 200) {
    const q = new Parse.Query(Patient);
    q.descending("createdAt");
    q.limit(limit);
    return q.find();
  }

  async function createPatient(data) {
    const user = await requireUser();
    const p = new Patient();
    p.set("firstName", (data.firstName || "").trim());
    p.set("lastName", (data.lastName || "").trim());
    if (data.dob) p.set("dob", data.dob);
    if (data.phone) p.set("phone", data.phone);
    if (data.email) p.set("email", data.email);
    p.set("createdBy", user);
    return p.save();
  }

  async function getPatient(id) {
    const q = new Parse.Query(Patient);
    return q.get(id);
  }

  async function createInvoice(payload) {
    const user = await requireUser();
    const inv = new Invoice();

    const patient = new Patient();
    patient.id = payload.patientId;

    const items = (payload.items || []).map(it => ({
      name: String(it.name || "").trim(),
      qty: Number(it.qty || 0),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.total || 0)
    })).filter(it => it.name && it.qty > 0);

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const tax = Number(payload.tax || 0);
    const total = subtotal + tax;

    inv.set("patient", patient);
    inv.set("number", payload.number || ("INV-" + Date.now()));
    inv.set("items", items);
    inv.set("subtotal", subtotal);
    inv.set("tax", tax);
    inv.set("total", total);
    inv.set("status", payload.status || "UNPAID");
    inv.set("issuedAt", new Date());
    if (payload.status === "PAID") inv.set("paidAt", new Date());
    inv.set("createdBy", user);

    return inv.save();
  }

  async function listInvoices(limit = 50) {
    const q = new Parse.Query(Invoice);
    q.descending("createdAt");
    q.include("patient");
    q.limit(limit);
    return q.find();
  }

  async function getInvoice(id) {
    const q = new Parse.Query(Invoice);
    q.include("patient");
    return q.get(id);
  }

  async function createThread({ subject, patientId }) {
    const user = await requireUser();
    const t = new MessageThread();
    t.set("subject", String(subject || "").trim());
    t.set("participants", [user.id]);
    if (patientId) {
      const p = new Patient();
      p.id = patientId;
      t.set("patient", p);
    }
    t.set("lastMessageAt", new Date());
    return t.save();
  }

  async function listThreads(limit = 50) {
    const user = await requireUser();
    const q = new Parse.Query(MessageThread);
    q.containedIn("participants", [user.id]);
    q.descending("lastMessageAt");
    q.include("patient");
    q.limit(limit);
    return q.find();
  }

  async function sendMessage(threadId, body) {
    const user = await requireUser();
    const t = new MessageThread();
    t.id = threadId;

    const m = new Message();
    m.set("thread", t);
    m.set("sender", user);
    m.set("body", String(body || "").trim());
    m.set("sentAt", new Date());
    await m.save();

    const tq = new Parse.Query(MessageThread);
    const thread = await tq.get(threadId);
    thread.set("lastMessageAt", new Date());
    await thread.save();

    return m;
  }

  async function listMessages(threadId, limit = 50) {
    const t = new MessageThread();
    t.id = threadId;

    const q = new Parse.Query(Message);
    q.equalTo("thread", t);
    q.ascending("sentAt");
    q.include("sender");
    q.limit(limit);
    return q.find();
  }

  return {
    money,
    requireUser,
    listPatients,
    createPatient,
    getPatient,
    createInvoice,
    listInvoices,
    getInvoice,
    createThread,
    listThreads,
    sendMessage,
    listMessages
  };
})();