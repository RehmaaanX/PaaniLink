(async function () {
  const page = document.body.dataset.page;
  const titles = {
    dashboard: ["Operations", "City booking and fleet totals"],
    users: ["Users", "Accounts and deactivation"],
    zones: ["Zones", "Activate or deactivate"],
    hydrants: ["Hydrants", "Zones, quotas and hours"],
    tankers: ["Tankers", "1,000 / 3,000 / 6,000 gal"],
    drivers: ["Drivers", "Hydrant fleet assignment"],
    bookings: ["Bookings", "City register"],
    rates: ["Rates and quotas", "Rate cards and daily quotas"],
    reports: ["Reports", "Bookings and hydrant fill"],
    activity: ["Activity log", "Account and dispatch events"],
  };
  const [title, subtitle] = titles[page] || ["Admin", ""];
  const { session, content } = window.PLUI.renderShell({ role: "administrator", page, title, subtitle });
  const S = window.PLServices;
  const U = window.PLUtil;
  const V = window.PLValidate;
  const UI = window.PLUI;
  const set = (html) => (content.innerHTML = html);

  function bindForm(id, handler) {
    const form = document.getElementById(id);
    if (form) form.addEventListener("submit", handler);
  }

  try {
    const [users, zones, hydrants, tankers, drivers, bookings, rates, logs, customers] = await Promise.all([
      S.users.list(),
      S.zones.list(),
      S.hydrants.list(),
      S.tankers.list(),
      S.drivers.list(),
      S.bookings.list(),
      S.rates.list(),
      S.logs.list(),
      S.customers.list(),
    ]);

    if (page === "dashboard") {
      const gallons = (await S.dispatches.list()).reduce((s, d) => s + Number(d.gallonsFilled || 0), 0);
      set(`
        <p class="queue-strip">
          <span>Bookings <strong>${bookings.length}</strong></span>
          <span>Pending <strong>${bookings.filter((b) => ["pending", "pending_approval"].includes(b.status)).length}</strong></span>
          <span>Delivered <strong>${bookings.filter((b) => ["delivered", "confirmed"].includes(b.status)).length}</strong></span>
          <span>Filled <strong>${U.formatGallons(gallons)}</strong></span>
          <span>Hydrants <strong>${hydrants.length}</strong></span>
          <span>Tankers <strong>${tankers.length}</strong></span>
        </p>
        <section class="panel">
          <h3>Recent bookings</h3>
          ${UI.renderTable({
            columns: [
              { label: "Ref.", render: (b) => U.bookingRef(b.id) },
              { label: "Type", render: (b) => U.statusLabel(b.type) },
              { label: "Zone", render: (b) => (zones.find((z) => z.id === b.zoneId) || {}).name || "—" },
              { label: "Status", render: (b) => UI.badge(b.status) },
              { label: "Gallons", render: (b) => U.formatGallons(b.capacityGallons) },
            ],
            rows: bookings.slice().reverse().slice(0, 10),
            emptyTitle: "No bookings",
            emptyText: "New requests appear here.",
          })}
        </section>
      `);
      return;
    }

    if (page === "users") {
      set(`
        <details class="panel add-panel">
        <summary>Create user</summary>
        <form class="form-grid" id="uform" novalidate>
          <label class="field"><span>Name</span><input class="input" name="name"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>Email</span><input class="input" name="email"><small class="field-error" data-error-for="email"></small></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password"><small class="field-error" data-error-for="password"></small></label>
          <label class="field"><span>Role</span><select class="input" name="role">
            <option value="customer">Customer</option><option value="zone_officer">Zone officer</option>
            <option value="hydrant_operator">Hydrant operator</option><option value="driver">Driver</option>
            <option value="administrator">Administrator</option>
          </select></label>
          <label class="field"><span>Zone</span><select class="input" name="zoneId"><option value="">—</option>${zones.map((z) => `<option value="${z.id}">${U.escape(z.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Hydrant</span><select class="input" name="hydrantId"><option value="">—</option>${hydrants.map((h) => `<option value="${h.id}">${U.escape(h.name)}</option>`).join("")}</select></label>
          <div><button class="btn btn-primary" type="submit">Create user</button></div>
        </form>
        </details>
        ${UI.pageToolbar(`<input class="input" id="q" placeholder="Name, email or role" style="max-width:240px">`)}
        <div id="t"></div>
      `);
      const draw = () => {
        const q = document.getElementById("q").value.toLowerCase();
        const rows = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q) || u.role.includes(q));
        document.getElementById("t").innerHTML = UI.renderTable({
          columns: [
            { label: "Name", key: "name" },
            { label: "Email", key: "email" },
            { label: "Role", render: (u) => UI.ROLE_LABEL[u.role] || u.role },
            { label: "Status", render: (u) => UI.badge(u.status) },
            {
              label: "",
              render: (u) =>
                u.status === "active"
                  ? `<button class="btn btn-danger" data-off="${u.id}">Deactivate</button>`
                  : `<button class="btn btn-success" data-on="${u.id}">Activate</button>`,
            },
          ],
          rows,
          emptyTitle: "No users",
          emptyText: "Adjust the search.",
        });
      };
      document.getElementById("q").oninput = U.debounce(draw, 120);
      draw();
      content.addEventListener("click", async (e) => {
        if (e.target.dataset.off) await S.users.update(e.target.dataset.off, { status: "inactive" });
        if (e.target.dataset.on) await S.users.update(e.target.dataset.on, { status: "active" });
        if (e.target.dataset.off || e.target.dataset.on) location.reload();
      });
      bindForm("uform", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = { name: V.required(data.name, "Name"), email: V.email(data.email), password: V.password(data.password) };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        const existing = await S.users.list({ email: data.email.toLowerCase() });
        if (existing.length) return UI.toast("Email already registered", "error");
        await S.users.create({
          ...data,
          email: data.email.toLowerCase(),
          phone: "03000000000",
          cnic: "00000-0000000-0",
          status: "active",
          zoneId: data.zoneId ? Number(data.zoneId) : null,
          hydrantId: data.hydrantId ? Number(data.hydrantId) : null,
          customerId: null,
          driverId: null,
          createdAt: new Date().toISOString(),
        });
        UI.toast("User created", "success");
        location.reload();
      });
      return;
    }

    if (page === "zones") {
      set(`
        <details class="panel add-panel">
        <summary>Add zone</summary>
        <form class="form-grid" id="zform">
          <label class="field"><span>Name</span><input class="input" name="name"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>Code</span><input class="input" name="code"><small class="field-error" data-error-for="code"></small></label>
          <div><button class="btn btn-primary" type="submit">Add zone</button></div>
        </form>
        </details>
        ${UI.renderTable({
          columns: [
            { label: "Name", key: "name" },
            { label: "Code", key: "code" },
            { label: "Status", render: (z) => UI.badge(z.status) },
            {
              label: "",
              render: (z) =>
                `<button class="btn btn-ghost" data-toggle="${z.id}" data-st="${z.status}">${z.status === "active" ? "Deactivate" : "Activate"}</button>`,
            },
          ],
          rows: zones,
          emptyTitle: "No zones",
          emptyText: "Create a service zone.",
        })}
      `);
      bindForm("zform", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = { name: V.required(data.name, "Name"), code: V.required(data.code, "Code") };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        await S.zones.create({ name: data.name, code: data.code, city: "Karachi", status: "active", officerUserId: null });
        location.reload();
      });
      content.addEventListener("click", async (e) => {
        if (!e.target.dataset.toggle) return;
        await S.zones.update(e.target.dataset.toggle, { status: e.target.dataset.st === "active" ? "inactive" : "active" });
        location.reload();
      });
      return;
    }

    if (page === "hydrants") {
      set(`
        <details class="panel add-panel">
        <summary>Register hydrant</summary>
        <form class="form-grid" id="hform">
          <label class="field"><span>Name</span><input class="input" name="name"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>Address</span><input class="input" name="address"><small class="field-error" data-error-for="address"></small></label>
          <label class="field"><span>Zone</span><select class="input" name="zoneId">${zones.map((z) => `<option value="${z.id}">${U.escape(z.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Daily quota (gallons)</span><input class="input" name="dailyQuotaGallons" type="number"><small class="field-error" data-error-for="dailyQuotaGallons"></small></label>
          <label class="field"><span>Opens</span><input class="input" type="time" name="operatingHoursStart" value="06:00"></label>
          <label class="field"><span>Closes</span><input class="input" type="time" name="operatingHoursEnd" value="22:00"></label>
          <div><button class="btn btn-primary" type="submit">Save hydrant</button></div>
        </form>
        </details>
        ${UI.renderTable({
          columns: [
            { label: "Name", key: "name" },
            { label: "Zone", render: (h) => (zones.find((z) => z.id === h.zoneId) || {}).name },
            { label: "Quota", render: (h) => U.formatGallons(h.dailyQuotaGallons) },
            { label: "Hours", render: (h) => `${h.operatingHoursStart}–${h.operatingHoursEnd}` },
            { label: "Status", render: (h) => UI.badge(h.status) },
            { label: "", render: (h) => `<button class="btn btn-ghost" data-q="${h.id}">Edit quota</button>` },
          ],
          rows: hydrants,
          emptyTitle: "No hydrants",
          emptyText: "Register a filling point.",
        })}
      `);
      bindForm("hform", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = { name: V.required(data.name, "Name"), address: V.required(data.address, "Address"), dailyQuotaGallons: V.positiveNumber(data.dailyQuotaGallons, "Quota") };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        await S.hydrants.create({
          ...data,
          zoneId: Number(data.zoneId),
          dailyQuotaGallons: Number(data.dailyQuotaGallons),
          status: "active",
          operatorUserId: null,
        });
        UI.toast("Hydrant created", "success");
        location.reload();
      });
      content.addEventListener("click", async (e) => {
        if (!e.target.dataset.q) return;
        const q = await UI.promptDialog({ title: "Daily quota", message: "Positive gallons per calendar day (Asia/Karachi).", label: "Gallons" });
        if (!q) return;
        if (V.positiveNumber(q, "Quota")) return UI.toast(V.positiveNumber(q, "Quota"), "error");
        await S.hydrants.update(e.target.dataset.q, { dailyQuotaGallons: Number(q) });
        location.reload();
      });
      return;
    }

    if (page === "tankers") {
      set(`
        <details class="panel add-panel">
        <summary>Register tanker</summary>
        <form class="form-grid" id="tform">
          <label class="field"><span>Registration</span><input class="input" name="registrationNumber"><small class="field-error" data-error-for="registrationNumber"></small></label>
          <label class="field"><span>Hydrant fleet</span><select class="input" name="hydrantId">${hydrants.map((h) => `<option value="${h.id}">${U.escape(h.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Capacity</span><select class="input" name="capacityGallons"><option>1000</option><option>3000</option><option>6000</option></select></label>
          <div><button class="btn btn-primary" type="submit">Register tanker</button></div>
        </form>
        </details>
        ${UI.renderTable({
          columns: [
            { label: "Reg.", key: "registrationNumber" },
            { label: "Hydrant", render: (t) => (hydrants.find((h) => h.id === t.hydrantId) || {}).name },
            { label: "Capacity", render: (t) => U.formatGallons(t.capacityGallons) },
            { label: "Status", render: (t) => UI.badge(t.status) },
          ],
          rows: tankers,
          emptyTitle: "No tankers",
          emptyText: "Register a vehicle into a hydrant fleet.",
        })}
      `);
      bindForm("tform", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = { registrationNumber: V.required(data.registrationNumber, "Registration"), capacityGallons: V.capacity(data.capacityGallons) };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        await S.tankers.create({ ...data, hydrantId: Number(data.hydrantId), capacityGallons: Number(data.capacityGallons), status: "available" });
        location.reload();
      });
      return;
    }

    if (page === "drivers") {
      set(`
        <details class="panel add-panel">
        <summary>Register driver</summary>
        <form class="form-grid" id="dform">
          <label class="field"><span>Name</span><input class="input" name="name"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>Phone</span><input class="input" name="phone"><small class="field-error" data-error-for="phone"></small></label>
          <label class="field"><span>License</span><input class="input" name="licenseNumber"><small class="field-error" data-error-for="licenseNumber"></small></label>
          <label class="field"><span>Hydrant</span><select class="input" name="hydrantId">${hydrants.map((h) => `<option value="${h.id}">${U.escape(h.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Login email</span><input class="input" name="email"><small class="field-error" data-error-for="email"></small></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password"><small class="field-error" data-error-for="password"></small></label>
          <div><button class="btn btn-primary" type="submit">Register driver</button></div>
        </form>
        </details>
        ${UI.renderTable({
          columns: [
            { label: "Name", key: "name" },
            { label: "Phone", key: "phone" },
            { label: "Hydrant", render: (d) => (hydrants.find((h) => h.id === d.hydrantId) || {}).name },
            { label: "Status", render: (d) => UI.badge(d.status) },
          ],
          rows: drivers,
          emptyTitle: "No drivers",
          emptyText: "Register a driver account.",
        })}
      `);
      bindForm("dform", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = { name: V.required(data.name, "Name"), phone: V.phone(data.phone), licenseNumber: V.required(data.licenseNumber, "License"), email: V.email(data.email), password: V.password(data.password) };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        const driver = await S.drivers.create({
          name: data.name,
          phone: data.phone,
          hydrantId: Number(data.hydrantId),
          licenseNumber: data.licenseNumber,
          status: "available",
          userId: null,
        });
        const user = await S.users.create({
          name: data.name,
          email: data.email.toLowerCase(),
          password: data.password || "Driver@123",
          role: "driver",
          phone: data.phone,
          cnic: "00000-0000000-0",
          status: "active",
          zoneId: hydrants.find((h) => h.id === Number(data.hydrantId)).zoneId,
          hydrantId: Number(data.hydrantId),
          customerId: null,
          driverId: driver.id,
          createdAt: new Date().toISOString(),
        });
        await S.drivers.update(driver.id, { userId: user.id });
        UI.toast("Driver registered", "success");
        location.reload();
      });
      return;
    }

    if (page === "bookings") {
      set(`
        ${UI.pageToolbar(`<input class="input" id="q" placeholder="Reference or address" style="max-width:220px">
          <select class="input" id="st" style="max-width:200px">${U.statusOptions(["pending","pending_approval","approved","delivered","failed","disputed"])}</select>
          <button class="btn btn-ghost" id="csv">Export CSV</button>`)}
        <div id="t"></div>
      `);
      const filtered = () => {
        const q = document.getElementById("q").value.toLowerCase();
        const st = document.getElementById("st").value;
        return bookings.filter((b) => (!st || b.status === st) && (!q || String(b.id).includes(q) || (b.deliveryAddress || "").toLowerCase().includes(q)));
      };
      const draw = () => {
        document.getElementById("t").innerHTML = UI.renderTable({
          columns: [
            { label: "Ref.", render: (b) => U.bookingRef(b.id) },
            { label: "Type", render: (b) => U.statusLabel(b.type) },
            { label: "Zone", render: (b) => (zones.find((z) => z.id === b.zoneId) || {}).name },
            { label: "Status", render: (b) => UI.badge(b.status) },
            { label: "Gallons", render: (b) => b.capacityGallons },
            { label: "Charges", render: (b) => U.formatPKR(b.estimatedCharges) },
          ],
          rows: filtered(),
          emptyTitle: "No bookings",
          emptyText: "Try another filter.",
        });
      };
      document.getElementById("q").oninput = U.debounce(draw, 100);
      document.getElementById("st").onchange = draw;
      document.getElementById("csv").onclick = () => {
        U.downloadCSV("paanilink-bookings.csv", [["id", "type", "status", "gallons", "charges"], ...filtered().map((b) => [b.id, b.type, b.status, b.capacityGallons, b.estimatedCharges])]);
      };
      draw();
      return;
    }

    if (page === "rates") {
      set(`
        <section class="panel">
          <h3>Rate cards</h3>
          ${UI.renderTable({
            columns: [
              { label: "Type", render: (r) => U.statusLabel(r.type) },
              { label: "Capacity", render: (r) => U.formatGallons(r.capacityGallons) },
              { label: "Amount", render: (r) => U.formatPKR(r.amountPKR) },
              { label: "", render: (r) => `<button class="btn btn-ghost" data-rate="${r.id}">Update</button>` },
            ],
            rows: rates,
            emptyTitle: "No rates",
            emptyText: "No rate rows are configured.",
          })}
        </section>
        <section class="panel">
          <h3>Hydrant daily quotas</h3>
          ${UI.renderTable({
            columns: [
              { label: "Hydrant", key: "name" },
              { label: "Quota", render: (h) => U.formatGallons(h.dailyQuotaGallons) },
              { label: "Hours", render: (h) => `${h.operatingHoursStart}–${h.operatingHoursEnd}` },
            ],
            rows: hydrants,
            emptyTitle: "No hydrants",
            emptyText: "",
          })}
        </section>
      `);
      content.addEventListener("click", async (e) => {
        if (!e.target.dataset.rate) return;
        const amount = await UI.promptDialog({ title: "Update rate", message: "Enter a positive PKR amount.", label: "PKR" });
        if (!amount) return;
        if (V.positiveNumber(amount, "Amount")) return UI.toast(V.positiveNumber(amount, "Amount"), "error");
        await S.rates.update(e.target.dataset.rate, { amountPKR: Number(amount) });
        UI.toast("Rate updated", "success");
        location.reload();
      });
      return;
    }

    if (page === "reports") {
      const dispatches = await S.dispatches.list();
      const byHydrant = hydrants.map((h) => ({
        name: h.name,
        gallons: dispatches.filter((d) => d.hydrantId === h.id).reduce((s, d) => s + Number(d.gallonsFilled || 0), 0),
      }));
      const month = new Date().toISOString().slice(0, 7);
      const subsidyUsed = bookings.filter((b) => b.type === "subsidised" && String(b.createdAt).startsWith(month) && !["rejected", "cancelled"].includes(b.status)).reduce((s, b) => s + b.capacityGallons, 0);
      const maxG = Math.max(1, ...byHydrant.map((h) => h.gallons));
      set(`
        ${UI.kpiRow([
          { label: "Bookings", value: bookings.length },
          { label: "Pending", value: bookings.filter((b) => b.status === "pending" || b.status === "pending_approval").length },
          { label: "Completed", value: bookings.filter((b) => ["delivered", "confirmed"].includes(b.status)).length },
          { label: "Subsidy this month", value: U.formatGallons(subsidyUsed) },
        ])}
        <section class="panel">
          <h3>Hydrant fill (recorded gallons)</h3>
          ${UI.renderTable({
            columns: [
              { label: "Hydrant", key: "name" },
              { label: "Gallons", render: (h) => U.formatGallons(h.gallons) },
              {
                label: "Share",
                render: (h) => `<div class="quota-bar" aria-hidden="true"><span style="width:${Math.round((h.gallons / maxG) * 100)}%"></span></div>`,
              },
            ],
            rows: byHydrant,
            emptyTitle: "No fill records",
            emptyText: "Filling is recorded at each hydrant.",
          })}
        </section>
      `);
      return;
    }

    if (page === "activity") {
      set(UI.renderTable({
        columns: [
          { label: "When", render: (l) => U.formatDateTime(l.createdAt) },
          { label: "User", render: (l) => (users.find((u) => u.id === l.userId) || {}).name || l.userId },
          { label: "Action", key: "action" },
          { label: "Details", key: "details" },
        ],
        rows: logs.slice().reverse(),
        emptyTitle: "No activity",
        emptyText: "Login, booking and dispatch events appear here.",
      }));
    }
  } catch (err) {
    set(UI.errorState(err.message));
  }
})();
