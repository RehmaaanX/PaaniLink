(async function () {
  const page = document.body.dataset.page;
  const titleMap = {
    dashboard: ["Home", "Current booking and account"],
    book: ["Book a tanker", "Hydrant, capacity and delivery slot"],
    group: ["Group request", "Several addresses on one date"],
    bookings: ["My bookings", "Search and open a request"],
    details: ["Booking details", "Status, tanker and actions"],
    bills: ["Bills", "Charges on your bookings"],
    subsidy: ["Subsidy", "Household eligibility"],
    notifications: ["Alerts", "Booking and approval messages"],
    profile: ["Account", "Name, phone and address"],
  };
  const [title, subtitle] = titleMap[page] || ["Customer", ""];
  const { session, content } = window.PLUI.renderShell({ role: "customer", page: page === "details" ? "bookings" : page, title, subtitle });
  const S = window.PLServices;
  const U = window.PLUtil;
  const V = window.PLValidate;
  const UI = window.PLUI;

  function set(html) {
    content.innerHTML = html;
  }

  try {
    const customer = await S.customers.get(session.customerId);
    const [zones, hydrants, bookings, notifications] = await Promise.all([
      S.zones.list(),
      S.hydrants.list(),
      S.bookings.list({ customerId: customer.id }),
      S.notifications.list({ userId: session.userId }),
    ]);

    if (page === "dashboard") {
      const open = bookings.filter((b) => !["confirmed", "cancelled", "rejected"].includes(b.status));
      const current = open.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      const zoneName = (zones.find((z) => z.id === customer.zoneId) || {}).name || "—";
      set(`
        <div class="btn-row">
          <a class="btn btn-primary" href="book-tanker.html">Book a tanker</a>
          <a class="btn btn-ghost" href="book-group.html">Group request</a>
          <a class="btn btn-ghost" href="bookings.html">All bookings</a>
        </div>
        <section class="panel current-booking">
          <h3>Current booking</h3>
          ${
            current
              ? `${UI.progressTrack(current.status)}
                 ${UI.kv([
                   ["Reference", U.bookingRef(current.id)],
                   ["Type", `${U.statusLabel(current.type)} · ${U.formatGallons(current.capacityGallons)}`],
                   ["Address", U.escape(current.deliveryAddress)],
                   ["Slot", `${U.escape(current.preferredDate)} ${U.escape(current.preferredTime)}`],
                   ["Status", UI.badge(current.status)],
                 ])}
                 <p><a href="booking-details.html?id=${current.id}" onclick="PLUtil.remember('id',${current.id})">View booking</a></p>`
              : `<p>No booking in progress.</p>`
          }
        </section>
        <p class="account-strip">${U.escape(zoneName)} · Subsidy ${U.statusLabel(customer.subsidyStatus)} · ${open.length} open · ${notifications.filter((n) => !n.read).length} unread alerts</p>
      `);
      return;
    }

    if (page === "book") {
      const eligible = hydrants.filter((h) => h.zoneId === customer.zoneId && h.status === "active");
      set(`
        <form class="panel" id="book-form" novalidate>
          <fieldset class="form-section">
            <legend>Delivery</legend>
            <div class="form-grid">
              <label class="field"><span class="req">Address</span><input class="input" name="deliveryAddress" value="${U.escape(customer.address)}"><small class="field-error" data-error-for="deliveryAddress"></small></label>
              <label class="field"><span>Zone</span>
                <select class="input" name="zoneId">
                  ${zones.filter((z) => z.id === customer.zoneId).map((z) => `<option value="${z.id}">${U.escape(z.name)}</option>`).join("")}
                </select>
                <small class="field-error" data-error-for="zoneId"></small>
              </label>
              <label class="field"><span class="req">Hydrant</span>
                <select class="input" name="hydrantId">
                  <option value="">Select hydrant</option>
                  ${eligible.map((h) => `<option value="${h.id}">${U.escape(h.name)} (${h.operatingHoursStart}–${h.operatingHoursEnd})</option>`).join("")}
                </select>
                <small class="field-error" data-error-for="hydrantId"></small>
              </label>
            </div>
          </fieldset>
          <fieldset class="form-section">
            <legend>Tanker and slot</legend>
            <div class="form-grid">
              <label class="field"><span class="req">Capacity</span>
                <select class="input" name="capacityGallons">
                  <option value="1000">1,000 gallons</option>
                  <option value="3000">3,000 gallons</option>
                  <option value="6000">6,000 gallons</option>
                </select>
                <small class="field-error" data-error-for="capacityGallons"></small>
              </label>
              <label class="field"><span>Category</span>
                <select class="input" name="type">
                  <option value="commercial">Commercial</option>
                  <option value="subsidised">Subsidised</option>
                </select>
                <small class="hint">Subsidised bookings need a verified record and officer approval.</small>
                <small class="field-error" data-error-for="type"></small>
              </label>
              <label class="field"><span class="req">Date</span><input class="input" type="date" name="preferredDate" min="${U.todayISO()}"><small class="field-error" data-error-for="preferredDate"></small></label>
              <label class="field"><span class="req">Time</span><input class="input" type="time" name="preferredTime"><small class="hint">Must fall within hydrant hours.</small><small class="field-error" data-error-for="preferredTime"></small></label>
              <label class="field" style="grid-column:1/-1"><span>Notes</span><input class="input" name="notes"></label>
            </div>
          </fieldset>
          <fieldset class="form-section">
            <legend>Charge</legend>
            <div class="charge-box">
              <p>Rate card estimate</p>
              <strong id="est">Rs —</strong>
            </div>
            <p class="hint">Commercial requests go to the hydrant. Subsidised requests wait for the zone officer.</p>
            <button class="btn btn-primary" type="submit">Submit booking</button>
          </fieldset>
        </form>
      `);
      const form = document.getElementById("book-form");
      async function refreshEstimate() {
        try {
          const type = form.type.value;
          const cap = Number(form.capacityGallons.value);
          const amount = await S.estimateCharges(type, cap);
          document.getElementById("est").textContent = U.formatPKR(amount);
        } catch (err) {
          document.getElementById("est").textContent = "Unavailable";
        }
      }
      form.type.addEventListener("change", refreshEstimate);
      form.capacityGallons.addEventListener("change", refreshEstimate);
      refreshEstimate();
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = V.collect(form);
        const errors = {
          deliveryAddress: V.required(data.deliveryAddress, "Address"),
          hydrantId: V.required(data.hydrantId, "Hydrant"),
          preferredDate: V.futureDate(data.preferredDate, "Delivery date"),
          preferredTime: V.required(data.preferredTime, "Time") || V.timeValue(data.preferredTime),
          capacityGallons: V.capacity(data.capacityGallons),
        };
        V.showErrors(form, errors);
        if (Object.values(errors).some(Boolean)) return;
        try {
          const booking = await S.bookings.create(
            {
              customerId: customer.id,
              type: data.type,
              capacityGallons: Number(data.capacityGallons),
              zoneId: Number(data.zoneId),
              hydrantId: Number(data.hydrantId),
              deliveryAddress: data.deliveryAddress,
              preferredDate: data.preferredDate,
              preferredTime: data.preferredTime,
              notes: data.notes,
              groupBookingId: null,
            },
            session
          );
          await S.payments.create({
            bookingId: booking.id,
            customerId: customer.id,
            amount: booking.estimatedCharges,
            method: data.type === "subsidised" ? "subsidy_offset" : "simulated_card",
            status: "simulated",
            paidAt: new Date().toISOString(),
          });
          UI.toast("Booking #" + booking.id + " submitted", "success");
          location.href = "booking-details.html?id=" + booking.id;
        } catch (err) {
          UI.toast(err.message, "error");
        }
      });
      return;
    }

    if (page === "group") {
      const eligible = hydrants.filter((h) => h.zoneId === customer.zoneId && h.status === "active");
      set(`
        <p class="hint">Each address is a separate delivery on the same date. Capacities are 1,000, 3,000 or 6,000 gallons.</p>
        <form class="panel" id="group-form" novalidate>
          <div class="form-grid">
            <label class="field"><span>Group / institution name</span><input class="input" name="groupName"><small class="field-error" data-error-for="groupName"></small></label>
            <label class="field"><span>Household count</span><input class="input" name="householdCount" type="number" min="2"><small class="field-error" data-error-for="householdCount"></small></label>
            <label class="field"><span>Hydrant</span><select class="input" name="hydrantId"><option value="">Select</option>${eligible.map((h) => `<option value="${h.id}">${U.escape(h.name)}</option>`).join("")}</select><small class="field-error" data-error-for="hydrantId"></small></label>
            <label class="field"><span>Date</span><input class="input" type="date" name="preferredDate" min="${U.todayISO()}"><small class="field-error" data-error-for="preferredDate"></small></label>
            <label class="field"><span>Time</span><input class="input" type="time" name="preferredTime"><small class="field-error" data-error-for="preferredTime"></small></label>
          </div>
          <div id="deliveries"></div>
          <p><button class="btn btn-ghost" type="button" id="add-del">Add delivery</button></p>
          <p>Total gallons: <strong id="g-total">0</strong></p>
          <button class="btn btn-primary" type="submit">Submit group booking</button>
        </form>
      `);
      const box = document.getElementById("deliveries");
      function row() {
        const el = document.createElement("div");
        el.className = "delivery-row";
        el.innerHTML = `<label class="field"><span>Delivery address</span><input class="input" name="address"></label>
          <label class="field"><span>Capacity</span><select class="input" name="gallons"><option value="1000">1,000 gal</option><option value="3000">3,000 gal</option><option value="6000">6,000 gal</option></select></label>`;
        box.appendChild(el);
        el.querySelector("[name=gallons]").addEventListener("change", sum);
        sum();
      }
      function sum() {
        const total = U.$all("[name=gallons]", box).reduce((s, i) => s + Number(i.value), 0);
        document.getElementById("g-total").textContent = U.formatGallons(total);
      }
      row();
      row();
      document.getElementById("add-del").addEventListener("click", row);
      document.getElementById("group-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = V.collect(form);
        const errors = {
          groupName: V.required(data.groupName, "Group name"),
          householdCount: V.positiveNumber(data.householdCount, "Household count"),
          hydrantId: V.required(data.hydrantId, "Hydrant"),
          preferredDate: V.futureDate(data.preferredDate, "Date"),
          preferredTime: V.required(data.preferredTime, "Time"),
        };
        V.showErrors(form, errors);
        if (Object.values(errors).some(Boolean)) return;
        const deliveries = U.$all("#deliveries .delivery-row").map((rowEl) => ({
          address: rowEl.querySelector("[name=address]").value.trim(),
          gallons: Number(rowEl.querySelector("[name=gallons]").value),
        }));
        try {
          const group = await S.groupBookings.create(
            {
              customerId: customer.id,
              groupName: data.groupName,
              householdCount: data.householdCount,
              hydrantId: data.hydrantId,
              zoneId: customer.zoneId,
              preferredDate: data.preferredDate,
              preferredTime: data.preferredTime,
              deliveries,
            },
            session
          );
          UI.toast("Group booking #" + group.id + " created", "success");
          location.href = "bookings.html";
        } catch (err) {
          UI.toast(err.message, "error");
        }
      });
      return;
    }

    if (page === "bookings") {
      set(`
        ${UI.pageToolbar(`
          <input class="input" id="q" placeholder="Reference or address" style="max-width:240px">
          <select class="input" id="st" style="max-width:200px">
            ${U.statusOptions(["pending","pending_approval","approved","dispatched","delivered","confirmed","failed","disputed","cancelled","rejected"])}
          </select>
        `)}
        <div id="table"></div>
      `);
      const draw = () => {
        const q = document.getElementById("q").value.toLowerCase();
        const st = document.getElementById("st").value;
        const rows = bookings.filter((b) => {
          const matchQ = !q || String(b.id).includes(q) || (b.deliveryAddress || "").toLowerCase().includes(q);
          const matchS = !st || b.status === st;
          return matchQ && matchS;
        });
        UI.mountTable(document.getElementById("table"), {
          columns: [
            { label: "Ref.", key: "id", render: (b) => U.bookingRef(b.id) },
            { label: "Type", render: (b) => U.statusLabel(b.type) },
            { label: "Date", render: (b) => b.preferredDate },
            { label: "Capacity", render: (b) => U.formatGallons(b.capacityGallons) },
            { label: "Charges", render: (b) => U.formatPKR(b.estimatedCharges) },
            { label: "Status", render: (b) => UI.badge(b.status) },
            { label: "", render: (b) => `<a class="btn btn-ghost" href="booking-details.html?id=${b.id}" onclick="PLUtil.remember('id',${b.id})">Details</a>` },
          ],
          rows,
          pageSize: 8,
          emptyTitle: "No bookings match",
          emptyText: "Change the search or status filter.",
        });
      };
      document.getElementById("q").addEventListener("input", U.debounce(draw, 150));
      document.getElementById("st").addEventListener("change", draw);
      draw();
      return;
    }

    if (page === "details") {
      const id = U.qs("id");
      if (!id) {
        set(UI.emptyState("Missing booking", "Open a booking from My bookings."));
        return;
      }
      const booking = await S.bookings.get(id);
      if (Number(booking.customerId) !== Number(customer.id)) {
        set(UI.errorState("You can only view your own bookings."));
        return;
      }
      const [tanker, driver, hydrant, zone] = await Promise.all([
        booking.tankerId ? S.tankers.get(booking.tankerId) : null,
        booking.driverId ? S.drivers.get(booking.driverId) : null,
        S.hydrants.get(booking.hydrantId),
        S.zones.get(booking.zoneId),
      ]);
      const canCancel = window.PLPerm.can("cancel_booking", session, booking);
      const canConfirm = window.PLPerm.can("confirm_delivery", session, booking);
      set(`
        ${UI.progressTrack(booking.status)}
        <div class="split">
          <section class="panel">
            <h3>${U.bookingRef(booking.id)} ${UI.badge(booking.status)}</h3>
            ${UI.kv([
              ["Address", U.escape(booking.deliveryAddress)],
              ["Zone / hydrant", `${U.escape(zone.name)} · ${U.escape(hydrant.name)}`],
              ["Type", `${U.statusLabel(booking.type)} · ${U.formatGallons(booking.capacityGallons)}`],
              ["Charge", U.formatPKR(booking.estimatedCharges)],
              ["Slot", `${U.escape(booking.preferredDate)} ${U.escape(booking.preferredTime)}`],
              ["Tanker", tanker ? U.escape(tanker.registrationNumber) : "Not assigned"],
              ["Driver", driver ? `${U.escape(driver.name)} · ${U.escape(driver.phone)}` : "Not assigned"],
            ])}
            <div class="badge-row" style="margin-top:12px">
              ${canCancel ? `<button class="btn btn-danger" id="cancel-btn">Cancel booking</button>` : ""}
              ${canConfirm ? `<button class="btn btn-success" id="confirm-btn">Confirm delivery</button>` : ""}
              ${canConfirm ? `<button class="btn btn-ghost" id="dispute-btn">Report / dispute</button>` : ""}
            </div>
          </section>
          <section class="panel">
            <h3>Status history</h3>
            <ol class="timeline">${(booking.statusHistory || []).map((h) => `<li><strong>${U.statusLabel(h.status)}</strong><br><small>${U.formatDateTime(h.at)}</small><br>${U.escape(h.note || "")}</li>`).join("") || "<li>No history</li>"}</ol>
          </section>
        </div>
      `);
      const cancelBtn = document.getElementById("cancel-btn");
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          const ok = await UI.confirmDialog({ title: "Cancel booking", message: "Only pending or approved bookings that are not yet dispatched can be cancelled.", confirmText: "Cancel booking", danger: true });
          if (!ok) return;
          try {
            await S.bookings.cancel(booking.id, session, "Customer cancelled from details");
            UI.toast("Booking cancelled", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
      const confirmBtn = document.getElementById("confirm-btn");
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const ok = await UI.confirmDialog({ title: "Confirm delivery", message: "Confirm that the ordered volume arrived successfully." });
          if (!ok) return;
          try {
            await S.bookings.confirm(booking.id, session);
            UI.toast("Delivery confirmed", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
      const disputeBtn = document.getElementById("dispute-btn");
      if (disputeBtn) {
        disputeBtn.onclick = async () => {
          const desc = await UI.promptDialog({ title: "Dispute delivery", message: "Describe the problem (short fill, no show, quality).", label: "Description", textarea: true });
          if (!desc) return;
          try {
            await S.disputes.open(booking.id, desc, session);
            UI.toast("Dispute submitted", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
      return;
    }

    if (page === "bills") {
      const payments = await S.payments.list({ customerId: customer.id });
      set(`
        ${UI.renderTable({
          columns: [
            { label: "Bill", render: (p) => `#${p.id}` },
            { label: "Booking", render: (p) => U.bookingRef(p.bookingId) },
            { label: "Amount", render: (p) => U.formatPKR(p.amount) },
            { label: "Method", render: (p) => U.statusLabel(p.method) },
            { label: "Status", render: (p) => UI.badge(p.status) },
            { label: "Date", render: (p) => U.formatDateTime(p.paidAt) },
          ],
          rows: payments,
          emptyTitle: "No bills yet",
          emptyText: "Charges appear after you submit a booking.",
        })}
      `);
      return;
    }

    if (page === "subsidy") {
      const apps = await S.subsidy.list({ customerId: customer.id });
      set(`
        <section class="panel">
          <h3>Eligibility ${UI.badge(customer.subsidyStatus)}</h3>
          <p>Monthly subsidised limit ${U.formatGallons(customer.monthlySubsidyLimitGallons)}. Verified households may still need officer approval on each subsidised booking.</p>
        </section>
        <section class="panel">
          <h3>Application history</h3>
          ${UI.renderTable({
            columns: [
              { label: "ID", render: (a) => `#${a.id}` },
              { label: "Household", key: "householdSize" },
              { label: "Income", render: (a) => U.formatPKR(a.monthlyIncome) },
              { label: "Status", render: (a) => UI.badge(a.status) },
              { label: "Remarks", key: "officerRemarks" },
            ],
            rows: apps,
            emptyTitle: "No applications",
            emptyText: "Use the form below if you are not yet verified.",
          })}
        </section>
        ${customer.subsidyStatus === "verified" ? "" : `
        <form class="panel form-grid" id="sub-form" novalidate>
          <label class="field"><span>Household size</span><input class="input" name="householdSize" type="number"><small class="field-error" data-error-for="householdSize"></small></label>
          <label class="field"><span>Monthly income (PKR)</span><input class="input" name="monthlyIncome" type="number"><small class="field-error" data-error-for="monthlyIncome"></small></label>
          <label class="field" style="grid-column:1/-1"><span>Proof details</span><textarea class="input" name="proofDetails" rows="3" placeholder="Bill number, BISP id, NADRA family certificate…"></textarea><small class="field-error" data-error-for="proofDetails"></small></label>
          <div><button class="btn btn-primary" type="submit">Submit application</button></div>
        </form>`}
      `);
      const form = document.getElementById("sub-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const data = V.collect(form);
          const errors = {
            householdSize: V.positiveNumber(data.householdSize, "Household size"),
            monthlyIncome: V.positiveNumber(data.monthlyIncome, "Income"),
            proofDetails: V.required(data.proofDetails, "Proof details"),
          };
          V.showErrors(form, errors);
          if (Object.values(errors).some(Boolean)) return;
          try {
            await S.subsidy.apply({ customerId: customer.id, ...data, householdSize: Number(data.householdSize), monthlyIncome: Number(data.monthlyIncome) }, session);
            UI.toast("Application submitted", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        });
      }
      return;
    }

    if (page === "notifications") {
      set(UI.renderTable({
        columns: [
          { label: "Title", key: "title" },
          { label: "Message", key: "message" },
          { label: "When", render: (n) => U.formatDateTime(n.createdAt) },
          { label: "State", render: (n) => (n.read ? "Read" : "Unread") },
          { label: "", render: (n) => `<button class="btn btn-ghost" data-read="${n.id}">Mark read</button>` },
        ],
        rows: notifications.slice().reverse(),
        emptyTitle: "No notifications",
        emptyText: "Approvals and dispatch updates appear here.",
      }));
      content.addEventListener("click", async (e) => {
        const id = e.target.dataset.read;
        if (!id) return;
        await S.notifications.markRead(id);
        UI.toast("Marked read", "success");
        location.reload();
      });
      return;
    }

    if (page === "profile") {
      const zone = zones.find((z) => z.id === customer.zoneId);
      set(`
        <form class="panel form-grid" id="prof" novalidate>
          <label class="field"><span>Full name</span><input class="input" name="name" value="${U.escape(customer.name)}"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>CNIC</span><input class="input" name="cnic" value="${U.escape(customer.cnic)}"><small class="field-error" data-error-for="cnic"></small></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" value="${U.escape(customer.phone)}"><small class="field-error" data-error-for="phone"></small></label>
          <label class="field"><span>Email</span><input class="input" value="${U.escape(customer.email)}" disabled></label>
          <label class="field" style="grid-column:1/-1"><span>Address</span><textarea class="input" name="address">${U.escape(customer.address)}</textarea><small class="field-error" data-error-for="address"></small></label>
          <p class="hint">Zone: <strong>${U.escape(zone ? zone.name : "—")}</strong>. To change zone, contact the tanker desk.</p>
          <div><button class="btn btn-primary" type="submit">Save profile</button></div>
        </form>
      `);
      document.getElementById("prof").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = V.collect(e.target);
        const errors = {
          name: V.required(data.name, "Name"),
          cnic: V.cnic(data.cnic),
          phone: V.phone(data.phone),
          address: V.required(data.address, "Address"),
        };
        V.showErrors(e.target, errors);
        if (Object.values(errors).some(Boolean)) return;
        await S.customers.update(customer.id, data);
        await S.users.update(session.userId, { name: data.name, phone: data.phone, cnic: data.cnic });
        UI.toast("Profile updated", "success");
      });
    }
  } catch (err) {
    set(UI.errorState(err.message));
  }
})();
