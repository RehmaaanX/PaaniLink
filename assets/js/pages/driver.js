(async function () {
  const page = document.body.dataset.page;
  const titles = {
    dashboard: ["Current trip", "Address, contact and actions"],
    history: ["History", "Trips assigned to you"],
    details: ["Trip", "Arrived, delivered or failed"],
  };
  const [title, subtitle] = titles[page] || ["Driver", ""];
  const { session, content } = window.PLUI.renderShell({
    role: "driver",
    page: page === "details" ? "dashboard" : page,
    title,
    subtitle,
  });
  const S = window.PLServices;
  const U = window.PLUtil;
  const UI = window.PLUI;
  const set = (html) => (content.innerHTML = html);
  const REASONS = [
    { id: "house_locked", label: "House locked" },
    { id: "road_blocked", label: "Road blocked" },
    { id: "customer_unavailable", label: "Customer unavailable" },
    { id: "vehicle_breakdown", label: "Vehicle breakdown" },
    { id: "other", label: "Other" },
  ];

  try {
    const trips = await S.trips.list({ driverId: session.driverId });
    const active = trips.filter((t) => !["delivered", "failed"].includes(t.status));

    async function enrich(trip) {
      const booking = await S.bookings.get(trip.bookingId);
      const customer = await S.customers.get(booking.customerId);
      const tanker = trip.tankerId ? await S.tankers.get(trip.tankerId) : null;
      return { trip, booking, customer, tanker };
    }

    if (page === "dashboard") {
      if (!active.length) {
        set(UI.emptyState("No active trip", "When the hydrant desk assigns you, it appears here."));
        return;
      }
      const cards = [];
      for (const t of active) {
        const e = await enrich(t);
        const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.booking.deliveryAddress)}`;
        cards.push(`
          <article class="panel">
            <div class="trip-status">${U.statusLabel(e.trip.status)}</div>
            <h3>${U.bookingRef(e.booking.id)}</h3>
            ${UI.kv([
              ["Address", U.escape(e.booking.deliveryAddress)],
              ["Customer", `${U.escape(e.customer.name)} · <a href="tel:${U.escape(e.customer.phone)}">${U.escape(e.customer.phone)}</a>`],
              ["Tanker", `${e.tanker ? U.escape(e.tanker.registrationNumber) : "—"} · ${U.formatGallons(e.booking.capacityGallons)}`],
              ["Slot", `${e.booking.preferredDate} ${e.booking.preferredTime}`],
            ])}
            <p><a class="maps-link" href="${maps}" target="_blank" rel="noopener">Open map</a></p>
            <p><a class="btn btn-primary" style="width:100%" href="trip-details.html?id=${e.trip.id}" onclick="PLUtil.remember('id',${e.trip.id})">Update trip</a></p>
          </article>`);
      }
      set(cards.join(""));
      return;
    }

    if (page === "history") {
      const rows = [];
      for (const t of trips) {
        const b = await S.bookings.get(t.bookingId);
        rows.push({ ...t, address: b.deliveryAddress });
      }
      set(UI.renderTable({
        columns: [
          { label: "Trip", render: (t) => `#${t.id}` },
          { label: "Booking", render: (t) => U.bookingRef(t.bookingId) },
          { label: "Address", key: "address" },
          { label: "Status", render: (t) => UI.badge(t.status) },
          { label: "", render: (t) => `<a href="trip-details.html?id=${t.id}" onclick="PLUtil.remember('id',${t.id})">View</a>` },
        ],
        rows: rows.slice().reverse(),
        emptyTitle: "No trips yet",
        emptyText: "Only trips assigned to you are listed.",
      }));
      return;
    }

    if (page === "details") {
      const id = U.qs("id");
      if (!id) {
        set(UI.emptyState("Select a trip", "Open a trip from My trips."));
        return;
      }
      const trip = await S.trips.get(id);
      if (Number(trip.driverId) !== Number(session.driverId)) {
        set(UI.errorState("You can only open trips assigned to you."));
        return;
      }
      const e = await enrich(trip);
      set(`
        <section class="panel">
          <div class="trip-status">${U.statusLabel(e.trip.status)}</div>
          <h3>${U.escape(e.customer.name)}</h3>
          ${UI.kv([
            ["Address", U.escape(e.booking.deliveryAddress)],
            ["Phone", `<a href="tel:${U.escape(e.customer.phone)}">${U.escape(e.customer.phone)}</a>`],
            ["Tanker", `${e.tanker ? U.escape(e.tanker.registrationNumber) : "—"} · ${U.formatGallons(e.booking.capacityGallons)}`],
            ["Booking", U.bookingRef(e.booking.id)],
          ])}
          <p><a class="maps-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.booking.deliveryAddress)}" target="_blank" rel="noopener">Open map</a></p>
        </section>
        <section class="panel driver-actions">
          ${e.trip.status === "assigned" || e.trip.status === "departed" ? `<button class="btn btn-water" id="arrived">Mark arrived</button>` : ""}
          ${["assigned", "arrived", "departed"].includes(e.trip.status) ? `<button class="btn btn-success" id="delivered">Mark delivered</button>` : ""}
          ${["assigned", "arrived", "departed"].includes(e.trip.status) ? `<button class="btn btn-danger" id="failed">Mark failed</button>` : ""}
          <div id="fail-box" hidden>
            <label class="field"><span>Failure reason</span>
              <select class="input" id="reason">${REASONS.map((r) => `<option value="${r.id}">${r.label}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Description (required for Other)</span><textarea class="input" id="desc" rows="3"></textarea></label>
            <button class="btn btn-danger" id="fail-go">Submit failure</button>
          </div>
        </section>
      `);
      const arrived = document.getElementById("arrived");
      if (arrived) {
        arrived.onclick = async () => {
          try {
            await S.trips.updateStatus(trip.id, "arrived", session);
            UI.toast("Marked arrived", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
      const delivered = document.getElementById("delivered");
      if (delivered) {
        delivered.onclick = async () => {
          const ok = await UI.confirmDialog({ title: "Confirm delivered", message: "Only mark delivered after emptying the ordered volume." });
          if (!ok) return;
          try {
            await S.trips.updateStatus(trip.id, "delivered", session);
            UI.toast("Delivered", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
      const failed = document.getElementById("failed");
      if (failed) {
        failed.onclick = () => {
          document.getElementById("fail-box").hidden = false;
        };
      }
      const failGo = document.getElementById("fail-go");
      if (failGo) {
        failGo.onclick = async () => {
          const reason = document.getElementById("reason").value;
          const desc = document.getElementById("desc").value.trim();
          try {
            await S.trips.updateStatus(trip.id, "failed", session, { failureReason: reason, failureDescription: desc });
            UI.toast("Trip failed", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      }
    }
  } catch (err) {
    set(UI.errorState(err.message));
  }
})();
