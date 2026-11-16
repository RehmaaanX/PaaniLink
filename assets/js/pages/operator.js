(async function () {
  const page = document.body.dataset.page;
  const titles = {
    dashboard: ["Dispatch board", "Bookings, fleet and quota"],
    bookings: ["Hydrant bookings", "Unapproved subsidy cannot be dispatched"],
    dispatch: ["Assign tanker", "Available vehicles and drivers only"],
    tankers: ["Tankers", "Mark off the road when needed"],
    drivers: ["Drivers", "Assigned to this hydrant"],
    filling: ["Filling", "Record gallons before departure"],
    hydrant: ["Hydrant", "Quota, hours and availability"],
  };
  const [title, subtitle] = titles[page] || ["Operator", ""];
  const { session, content } = window.PLUI.renderShell({
    role: "hydrant_operator",
    page,
    title,
    subtitle,
  });
  const S = window.PLServices;
  const U = window.PLUtil;
  const V = window.PLValidate;
  const UI = window.PLUI;
  const set = (html) => (content.innerHTML = html);

  try {
    const hydrant = await S.hydrants.get(session.hydrantId);
    const [bookings, tankers, drivers, dispatches] = await Promise.all([
      S.bookings.list({ hydrantId: hydrant.id }),
      S.tankers.list({ hydrantId: hydrant.id }),
      S.drivers.list({ hydrantId: hydrant.id }),
      S.dispatches.list({ hydrantId: hydrant.id }),
    ]);
    const dispatchable = bookings.filter((b) => ["pending", "approved"].includes(b.status) && b.status !== "pending_approval");

    if (page === "dashboard") {
      const used = await S.hydrantUsageOn(hydrant.id, U.todayISO());
      const pct = Math.min(100, Math.round((used / Number(hydrant.dailyQuotaGallons || 1)) * 100));
      set(`
        <p class="queue-strip"><span>${U.escape(hydrant.name)}</span>
          <span>Ready <strong>${dispatchable.length}</strong></span>
          <span>Tankers <strong>${tankers.filter((t) => t.status === "available").length}</strong></span>
          <span>Drivers <strong>${drivers.filter((d) => d.status === "available").length}</strong></span></p>
        <section class="panel">
          <h3>Daily quota</h3>
          <p>${U.formatGallons(used)} of ${U.formatGallons(hydrant.dailyQuotaGallons)} filled today</p>
          <div class="quota-bar" aria-label="Quota used"><span style="width:${pct}%"></span></div>
        </section>
        <section class="panel">
          <h3>Waiting for dispatch</h3>
          ${UI.renderTable({
            columns: [
              { label: "Booking", render: (b) => U.bookingRef(b.id) },
              { label: "Date", key: "preferredDate" },
              { label: "Capacity", render: (b) => U.formatGallons(b.capacityGallons) },
              { label: "Status", render: (b) => UI.badge(b.status) },
              { label: "", render: (b) => `<a class="btn btn-primary" href="dispatch.html?bookingId=${b.id}" onclick="PLUtil.remember('bookingId',${b.id})">Assign</a>` },
            ],
            rows: dispatchable.slice(0, 8),
            emptyTitle: "Nothing to dispatch",
            emptyText: "Approved and pending commercial bookings appear here.",
          })}
        </section>
      `);
      return;
    }

    if (page === "bookings") {
      set(UI.renderTable({
        columns: [
          { label: "Ref.", render: (b) => U.bookingRef(b.id) },
          { label: "Type", render: (b) => U.statusLabel(b.type) },
          { label: "Date", key: "preferredDate" },
          { label: "Gallons", render: (b) => U.formatGallons(b.capacityGallons) },
          { label: "Status", render: (b) => UI.badge(b.status) },
          {
            label: "",
            render: (b) =>
              ["pending", "approved"].includes(b.status)
                ? `<a class="btn btn-primary" href="dispatch.html?bookingId=${b.id}" onclick="PLUtil.remember('bookingId',${b.id})">Dispatch</a>`
                : "—",
          },
        ],
        rows: bookings.filter((b) => !["cancelled", "rejected"].includes(b.status)),
        emptyTitle: "No hydrant bookings",
        emptyText: "Other hydrants are hidden.",
      }));
      return;
    }

    if (page === "dispatch") {
      const pre = U.qs("bookingId");
      set(`
        <form class="panel form-grid" id="disp" novalidate>
          <label class="field"><span>Booking</span>
            <select class="input" name="bookingId">
              <option value="">Select booking</option>
              ${dispatchable.map((b) => `<option value="${b.id}" ${String(b.id) === String(pre) ? "selected" : ""}>${U.bookingRef(b.id)} · ${b.preferredDate} · ${b.capacityGallons} gal</option>`).join("")}
            </select>
            <small class="field-error" data-error-for="bookingId"></small>
          </label>
          <label class="field"><span>Tanker</span>
            <select class="input" name="tankerId"></select>
            <small class="hint">Available, matching capacity</small>
            <small class="field-error" data-error-for="tankerId"></small>
          </label>
          <label class="field"><span>Driver</span>
            <select class="input" name="driverId">
              ${drivers.filter((d) => d.status === "available").map((d) => `<option value="${d.id}">${U.escape(d.name)} · ${d.phone}</option>`).join("")}
            </select>
            <small class="field-error" data-error-for="driverId"></small>
          </label>
          <div style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Assign and dispatch</button></div>
        </form>
        <section class="panel"><h3>Active dispatches</h3><div id="active"></div></section>
      `);
      const form = document.getElementById("disp");
      function fillTankers() {
        const b = dispatchable.find((x) => String(x.id) === form.bookingId.value);
        const list = tankers.filter((t) => t.status === "available" && (!b || Number(t.capacityGallons) === Number(b.capacityGallons)));
        form.tankerId.innerHTML = list.map((t) => `<option value="${t.id}">${t.registrationNumber} · ${t.capacityGallons} gal</option>`).join("") || `<option value="">No matching tanker</option>`;
      }
      form.bookingId.addEventListener("change", fillTankers);
      fillTankers();
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = V.collect(form);
        const errors = { bookingId: V.required(data.bookingId, "Booking"), tankerId: V.required(data.tankerId, "Tanker"), driverId: V.required(data.driverId, "Driver") };
        V.showErrors(form, errors);
        if (Object.values(errors).some(Boolean)) return;
        try {
          await S.dispatches.create(Number(data.bookingId), Number(data.tankerId), Number(data.driverId), session);
          UI.toast("Dispatch created", "success");
          location.href = "filling-records.html";
        } catch (err) {
          UI.toast(err.message, "error");
        }
      });
      document.getElementById("active").innerHTML = UI.renderTable({
        columns: [
          { label: "Dispatch", render: (d) => `#${d.id}` },
          { label: "Booking", render: (d) => `#${d.bookingId}` },
          { label: "Status", render: (d) => UI.badge(d.status) },
          { label: "Gallons", render: (d) => d.gallonsFilled || 0 },
        ],
        rows: dispatches.filter((d) => !["completed", "failed", "cancelled"].includes(d.status)),
        emptyTitle: "No active dispatches",
        emptyText: "Create a dispatch above.",
      });
      return;
    }

    if (page === "tankers") {
      set(`
        ${UI.renderTable({
          columns: [
            { label: "Reg.", key: "registrationNumber" },
            { label: "Capacity", render: (t) => U.formatGallons(t.capacityGallons) },
            { label: "Status", render: (t) => UI.badge(t.status) },
            {
              label: "Actions",
              render: (t) =>
                t.status === "available"
                  ? `<button class="btn btn-ghost" data-off="${t.id}">Mark unavailable</button>`
                  : t.status === "unavailable"
                    ? `<button class="btn btn-ghost" data-on="${t.id}">Mark available</button>`
                    : "In service",
            },
          ],
          rows: tankers,
          emptyTitle: "No tankers",
          emptyText: "Fleet is registered by the administrator.",
        })}
      `);
      content.addEventListener("click", async (e) => {
        if (e.target.dataset.off) await S.tankers.update(e.target.dataset.off, { status: "unavailable" });
        if (e.target.dataset.on) await S.tankers.update(e.target.dataset.on, { status: "available" });
        if (e.target.dataset.off || e.target.dataset.on) location.reload();
      });
      return;
    }

    if (page === "drivers") {
      set(UI.renderTable({
        columns: [
          { label: "Name", key: "name" },
          { label: "Phone", key: "phone" },
          { label: "License", key: "licenseNumber" },
          { label: "Status", render: (d) => UI.badge(d.status) },
        ],
        rows: drivers,
        emptyTitle: "No drivers",
        emptyText: "Drivers are assigned to this hydrant by admin.",
      }));
      return;
    }

    if (page === "filling") {
      const open = dispatches.filter((d) => !["completed", "failed"].includes(d.status));
      set(UI.renderTable({
        columns: [
          { label: "Dispatch", render: (d) => `#${d.id}` },
          { label: "Booking", render: (d) => `#${d.bookingId}` },
          { label: "Status", render: (d) => UI.badge(d.status) },
          { label: "Filled", render: (d) => d.gallonsFilled || 0 },
          {
            label: "Actions",
            render: (d) => {
              if (d.status === "assigned") return `<button class="btn btn-water" data-start="${d.id}">Start filling</button>`;
              if (d.status === "filling" && !d.fillingCompletedAt) return `<button class="btn btn-water" data-fill="${d.id}">Record gallons</button>`;
              if (!d.departedAt && d.fillingCompletedAt) return `<button class="btn btn-primary" data-go="${d.id}">Record departure</button>`;
              return U.formatDateTime(d.departedAt);
            },
          },
        ],
        rows: open,
        emptyTitle: "No filling records",
        emptyText: "Dispatch a booking first.",
      }));
      content.addEventListener("click", async (e) => {
        try {
          if (e.target.dataset.start) await S.dispatches.startFilling(e.target.dataset.start, session);
          if (e.target.dataset.fill) {
            const g = await UI.promptDialog({ title: "Gallons filled", message: "Enter positive gallons within the daily quota.", label: "Gallons" });
            if (!g) return;
            await S.dispatches.completeFilling(e.target.dataset.fill, g, session);
          }
          if (e.target.dataset.go) await S.dispatches.depart(e.target.dataset.go, session);
          if (e.target.dataset.start || e.target.dataset.fill || e.target.dataset.go) {
            UI.toast("Updated", "success");
            location.reload();
          }
        } catch (err) {
          UI.toast(err.message, "error");
        }
      });
      return;
    }

    if (page === "hydrant") {
      const used = await S.hydrantUsageOn(hydrant.id, U.todayISO());
      set(`
        <section class="panel">
          <h3>${U.escape(hydrant.name)} ${UI.badge(hydrant.status)}</h3>
          ${UI.kv([
            ["Address", U.escape(hydrant.address)],
            ["Hours", `${hydrant.operatingHoursStart}–${hydrant.operatingHoursEnd}`],
            ["Quota today", `${U.formatGallons(used)} / ${U.formatGallons(hydrant.dailyQuotaGallons)}`],
          ])}
          <p style="margin-top:12px">
            ${hydrant.status === "active"
              ? `<button class="btn btn-danger" id="off">Mark hydrant unavailable</button>`
              : `<button class="btn btn-success" id="on">Mark hydrant available</button>`}
          </p>
        </section>
      `);
      const btn = document.getElementById("off") || document.getElementById("on");
      btn.onclick = async () => {
        await S.hydrants.update(hydrant.id, { status: hydrant.status === "active" ? "inactive" : "active" });
        UI.toast("Hydrant status updated", "success");
        location.reload();
      };
    }
  } catch (err) {
    set(UI.errorState(err.message));
  }
})();
