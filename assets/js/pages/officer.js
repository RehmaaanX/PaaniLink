(async function () {
  const page = document.body.dataset.page;
  const titles = {
    dashboard: ["Review queue", "Subsidy, approvals and disputes"],
    subsidy: ["Subsidy files", "Household eligibility"],
    approvals: ["Booking approvals", "Subsidised requests"],
    bookings: ["Zone bookings", "All types in this zone"],
    disputes: ["Disputes", "Record a decision"],
    customers: ["Customers", "Registered households"],
    reports: ["Zone reports", "Counts for this zone"],
  };
  const [title, subtitle] = titles[page] || ["Officer", ""];
  const { session, content } = window.PLUI.renderShell({ role: "zone_officer", page, title, subtitle });
  const S = window.PLServices;
  const U = window.PLUtil;
  const UI = window.PLUI;
  const set = (html) => (content.innerHTML = html);

  try {
    const zone = await S.zones.get(session.zoneId);
    const [bookings, customers, apps, disputes, drivers] = await Promise.all([
      S.bookings.list({ zoneId: session.zoneId }),
      S.customers.list({ zoneId: session.zoneId }),
      S.subsidy.list(),
      S.disputes.list({ zoneId: session.zoneId }),
      S.drivers.list(),
    ]);
    const zoneApps = [];
    for (const app of apps) {
      const c = customers.find((x) => x.id === app.customerId) || (await S.customers.get(app.customerId).catch(() => null));
      if (c && Number(c.zoneId) === Number(session.zoneId)) zoneApps.push({ ...app, customer: c });
    }

    if (page === "dashboard") {
      set(`
        <p class="queue-strip"><span>${U.escape(zone.name)}</span>
          <span>Subsidy <strong>${zoneApps.filter((a) => a.status === "pending").length}</strong></span>
          <span>Approvals <strong>${bookings.filter((b) => b.status === "pending_approval").length}</strong></span>
          <span>Disputes <strong>${disputes.filter((d) => d.status === "open").length}</strong></span></p>
        <section class="panel">
          <h3>Subsidy applications</h3>
          ${UI.renderTable({
            columns: [
              { label: "ID", render: (a) => `#${a.id}` },
              { label: "Customer", render: (a) => U.escape(a.customer.name) },
              { label: "Income", render: (a) => U.formatPKR(a.monthlyIncome) },
              { label: "", render: (a) => `<a href="subsidy-applications.html">Open</a>` },
            ],
            rows: zoneApps.filter((a) => a.status === "pending"),
            emptyTitle: "No pending subsidy files",
            emptyText: "New applications appear here.",
          })}
        </section>
        <section class="panel">
          <h3>Subsidised bookings</h3>
          ${UI.renderTable({
            columns: [
              { label: "Ref.", render: (b) => U.bookingRef(b.id) },
              { label: "Customer", render: (b) => (customers.find((c) => c.id === b.customerId) || {}).name || b.customerId },
              { label: "Gallons", render: (b) => U.formatGallons(b.capacityGallons) },
              { label: "", render: (b) => `<a href="approvals.html">Review</a>` },
            ],
            rows: bookings.filter((b) => b.status === "pending_approval"),
            emptyTitle: "No pending approvals",
            emptyText: "No subsidised bookings waiting.",
          })}
        </section>
      `);
      return;
    }

    if (page === "subsidy") {
      set(`
        ${UI.pageToolbar(`<select class="input" id="st" style="max-width:200px">${U.statusOptions(["pending","verified","rejected"], "All files")}</select>`)}
        <div id="t"></div>
      `);
      const draw = () => {
        const st = document.getElementById("st").value;
        const rows = zoneApps.filter((a) => !st || a.status === st);
        document.getElementById("t").innerHTML = UI.renderTable({
          columns: [
            { label: "ID", render: (a) => `#${a.id}` },
            { label: "Customer", render: (a) => U.escape(a.customer.name) },
            { label: "Household", key: "householdSize" },
            { label: "Income", render: (a) => U.formatPKR(a.monthlyIncome) },
            { label: "Proof", key: "proofDetails" },
            { label: "Status", render: (a) => UI.badge(a.status) },
            {
              label: "Actions",
              render: (a) =>
                a.status === "pending"
                  ? `<button class="btn btn-success" data-ok="${a.id}">Approve</button> <button class="btn btn-danger" data-no="${a.id}">Reject</button>`
                  : U.escape(a.officerRemarks || "—"),
            },
          ],
          rows,
          emptyTitle: "No applications",
          emptyText: "No subsidy files in this zone.",
        });
      };
      document.getElementById("st").onchange = draw;
      content.addEventListener("click", async (e) => {
        if (e.target.dataset.ok) {
          try {
            await S.subsidy.decide(e.target.dataset.ok, session, "verified", "Verified by zone officer");
            UI.toast("Subsidy verified", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        }
        if (e.target.dataset.no) {
          const remarks = await UI.promptDialog({ title: "Reject subsidy", message: "Provide a rejection reason.", label: "Reason", textarea: true });
          if (!remarks) return;
          try {
            await S.subsidy.decide(e.target.dataset.no, session, "rejected", remarks);
            UI.toast("Application rejected", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        }
      });
      draw();
      return;
    }

    if (page === "approvals") {
      const rows = bookings.filter((b) => b.type === "subsidised" || b.status === "pending_approval");
      set(UI.renderTable({
        columns: [
          { label: "ID", render: (b) => `#${b.id}` },
          { label: "Customer", render: (b) => (customers.find((c) => c.id === b.customerId) || {}).name || b.customerId },
          { label: "Date", key: "preferredDate" },
          { label: "Gallons", render: (b) => U.formatGallons(b.capacityGallons) },
          { label: "Status", render: (b) => UI.badge(b.status) },
          {
            label: "Actions",
            render: (b) =>
              b.status === "pending_approval"
                ? `<button class="btn btn-success" data-ok="${b.id}">Approve</button> <button class="btn btn-danger" data-no="${b.id}">Reject</button>`
                : U.escape(b.officerRemarks || "—"),
          },
        ],
        rows,
        emptyTitle: "No subsidised bookings",
        emptyText: "Waiting for customer requests.",
      }));
      content.addEventListener("click", async (e) => {
        if (e.target.dataset.ok) {
          const remarks = await UI.promptDialog({ title: "Approve booking", message: "Optional remarks for the customer.", label: "Remarks", placeholder: "Approved" });
          if (remarks === null) return;
          try {
            await S.bookings.approve(e.target.dataset.ok, session, remarks || "Approved");
            UI.toast("Booking approved", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        }
        if (e.target.dataset.no) {
          const remarks = await UI.promptDialog({ title: "Reject booking", message: "A rejection reason is required.", label: "Reason", textarea: true });
          if (!remarks) return;
          try {
            await S.bookings.reject(e.target.dataset.no, session, remarks);
            UI.toast("Booking rejected", "success");
            location.reload();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        }
      });
      return;
    }

    if (page === "bookings") {
      set(`
        ${UI.pageToolbar(`<input class="input" id="q" placeholder="Reference or address" style="max-width:220px"><select class="input" id="st" style="max-width:200px">${U.statusOptions(["pending","pending_approval","approved","delivered","disputed"])}</select>`)}
        <div id="t"></div>
      `);
      const draw = () => {
        const q = document.getElementById("q").value.toLowerCase();
        const st = document.getElementById("st").value;
        const rows = bookings.filter((b) => (!st || b.status === st) && (!q || String(b.id).includes(q) || (b.deliveryAddress || "").toLowerCase().includes(q)));
        document.getElementById("t").innerHTML = UI.renderTable({
          columns: [
            { label: "Ref.", render: (b) => U.bookingRef(b.id) },
            { label: "Type", render: (b) => U.statusLabel(b.type) },
            { label: "Address", key: "deliveryAddress" },
            { label: "Status", render: (b) => UI.badge(b.status) },
            { label: "Driver", render: (b) => (drivers.find((d) => d.id === b.driverId) || {}).name || "—" },
          ],
          rows,
          emptyTitle: "No zone bookings",
          emptyText: "Bookings from other zones are hidden.",
        });
      };
      document.getElementById("q").oninput = U.debounce(draw, 120);
      document.getElementById("st").onchange = draw;
      draw();
      return;
    }

    if (page === "disputes") {
      set(UI.renderTable({
        columns: [
          { label: "ID", render: (d) => `#${d.id}` },
          { label: "Booking", render: (d) => `#${d.bookingId}` },
          { label: "Description", key: "description" },
          { label: "Status", render: (d) => UI.badge(d.status) },
          {
            label: "Actions",
            render: (d) => (d.status === "open" ? `<button class="btn btn-primary" data-res="${d.id}">Resolve</button>` : U.escape(d.officerRemarks)),
          },
        ],
        rows: disputes,
        emptyTitle: "No disputes",
        emptyText: "Customer disputes in this zone will appear here.",
      }));
      content.addEventListener("click", async (e) => {
        if (!e.target.dataset.res) return;
        const remarks = await UI.promptDialog({ title: "Resolve dispute", message: "Record how the case was closed.", label: "Remarks", textarea: true });
        if (!remarks) return;
        try {
          await S.disputes.resolve(e.target.dataset.res, remarks, session);
          UI.toast("Dispute resolved", "success");
          location.reload();
        } catch (err) {
          UI.toast(err.message, "error");
        }
      });
      return;
    }

    if (page === "customers") {
      set(UI.renderTable({
        columns: [
          { label: "Name", key: "name" },
          { label: "CNIC", key: "cnic" },
          { label: "Phone", key: "phone" },
          { label: "Subsidy", render: (c) => UI.badge(c.subsidyStatus) },
          { label: "Address", key: "address" },
        ],
        rows: customers,
        emptyTitle: "No customers",
        emptyText: "No households in this zone.",
      }));
      return;
    }

    if (page === "reports") {
      const subsidised = bookings.filter((b) => b.type === "subsidised");
      set(`
        ${UI.kpiRow([
          { label: "Bookings", value: bookings.length },
          { label: "Subsidised", value: subsidised.length },
          { label: "Completed", value: bookings.filter((b) => ["delivered", "confirmed"].includes(b.status)).length },
          { label: "Disputed", value: bookings.filter((b) => b.status === "disputed").length },
        ])}
        <p class="hint">This office reviews subsidy and disputes. Tanker assignment is done at the hydrant desk.</p>
      `);
    }
  } catch (err) {
    set(UI.errorState(err.message));
  }
})();
