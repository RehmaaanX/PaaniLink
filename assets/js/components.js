(function () {
  const U = () => window.PLUtil;

  function toast(message, type = "info") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${U().escape(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("hide");
      setTimeout(() => el.remove(), 280);
    }, 3800);
  }

  function confirmDialog({ title, message, confirmText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${U().escape(title)}</h3>
          <p>${U().escape(message)}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
            <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${U().escape(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("[data-act=cancel]").focus();
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.dataset.act === "cancel") {
          overlay.remove();
          resolve(false);
        }
        if (e.target.dataset.act === "ok") {
          overlay.remove();
          resolve(true);
        }
      });
    });
  }

  function promptDialog({ title, message, label, placeholder = "", textarea = false }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const field = textarea
        ? `<textarea class="input" rows="4" placeholder="${U().escape(placeholder)}"></textarea>`
        : `<input class="input" type="text" placeholder="${U().escape(placeholder)}">`;
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h3>${U().escape(title)}</h3>
          <p>${U().escape(message)}</p>
          <label class="field"><span>${U().escape(label || "Details")}</span>${field}<small class="field-error"></small></label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-act="ok">Submit</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector(".input");
      input.focus();
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.dataset.act === "cancel") {
          overlay.remove();
          resolve(null);
        }
        if (e.target.dataset.act === "ok") {
          const value = input.value.trim();
          if (!value) {
            overlay.querySelector(".field-error").textContent = "This field is required.";
            return;
          }
          overlay.remove();
          resolve(value);
        }
      });
    });
  }

  function badge(status) {
    return `<span class="badge ${U().statusClass(status)}">${U().escape(U().statusLabel(status))}</span>`;
  }

  function emptyState(title, text) {
    return `<div class="empty-state"><h3>${U().escape(title)}</h3><p>${U().escape(text)}</p></div>`;
  }

  function errorState(text) {
    return `<div class="empty-state error"><i class="fa-solid fa-triangle-exclamation"></i><h3>Unable to load data</h3><p>${U().escape(text)}</p></div>`;
  }

  function spinner(label = "Loading…") {
    return `<div class="loading-block" role="status"><span class="spinner"></span> ${U().escape(label)}</div>`;
  }

  function skeletonCards(n = 4) {
    return `<div class="stat-grid">${Array.from({ length: n }, () => `<div class="stat-card skeleton"></div>`).join("")}</div>`;
  }

  const NAV = {
    customer: [
      { href: "dashboard.html", icon: "fa-house", label: "Home", page: "dashboard" },
      { href: "book-tanker.html", icon: "fa-plus", label: "Book a tanker", page: "book" },
      { href: "book-group.html", icon: "fa-people-group", label: "Group request", page: "group" },
      { href: "bookings.html", icon: "fa-clipboard-list", label: "My bookings", page: "bookings" },
      { href: "bills.html", icon: "fa-file-invoice", label: "Bills", page: "bills" },
      { href: "subsidy.html", icon: "fa-file-lines", label: "Subsidy", page: "subsidy" },
      { href: "notifications.html", icon: "fa-bell", label: "Alerts", page: "notifications" },
      { href: "profile.html", icon: "fa-user", label: "Account", page: "profile" },
    ],
    zone_officer: [
      { href: "dashboard.html", icon: "fa-inbox", label: "Review queue", page: "dashboard" },
      { href: "subsidy-applications.html", icon: "fa-file-circle-check", label: "Subsidy files", page: "subsidy" },
      { href: "approvals.html", icon: "fa-stamp", label: "Booking approvals", page: "approvals" },
      { href: "bookings.html", icon: "fa-list", label: "Zone bookings", page: "bookings" },
      { href: "disputes.html", icon: "fa-flag", label: "Disputes", page: "disputes" },
      { href: "customers.html", icon: "fa-users", label: "Customers", page: "customers" },
      { href: "reports.html", icon: "fa-chart-column", label: "Reports", page: "reports" },
    ],
    hydrant_operator: [
      { href: "dashboard.html", icon: "fa-table-cells", label: "Dispatch board", page: "dashboard" },
      { href: "hydrant-bookings.html", icon: "fa-clipboard-check", label: "Today’s bookings", page: "bookings" },
      { href: "dispatch.html", icon: "fa-route", label: "Assign tanker", page: "dispatch" },
      { href: "tankers.html", icon: "fa-truck", label: "Tankers", page: "tankers" },
      { href: "drivers.html", icon: "fa-id-card", label: "Drivers", page: "drivers" },
      { href: "filling-records.html", icon: "fa-fill-drip", label: "Filling", page: "filling" },
      { href: "hydrant.html", icon: "fa-faucet-drip", label: "Hydrant", page: "hydrant" },
    ],
    driver: [
      { href: "dashboard.html", icon: "fa-location-dot", label: "Current trip", page: "dashboard" },
      { href: "my-trips.html", icon: "fa-clock-rotate-left", label: "History", page: "history" },
    ],
    administrator: [
      { href: "dashboard.html", icon: "fa-gauge", label: "Operations", page: "dashboard" },
      { href: "users.html", icon: "fa-user-gear", label: "Users", page: "users" },
      { href: "zones.html", icon: "fa-map", label: "Zones", page: "zones" },
      { href: "hydrants.html", icon: "fa-faucet-drip", label: "Hydrants", page: "hydrants" },
      { href: "tankers.html", icon: "fa-truck", label: "Tankers", page: "tankers" },
      { href: "drivers.html", icon: "fa-id-card", label: "Drivers", page: "drivers" },
      { href: "bookings.html", icon: "fa-clipboard-list", label: "Bookings", page: "bookings" },
      { href: "rates.html", icon: "fa-tags", label: "Rates & quotas", page: "rates" },
      { href: "reports.html", icon: "fa-chart-column", label: "Reports", page: "reports" },
      { href: "activity.html", icon: "fa-list", label: "Activity log", page: "activity" },
    ],
  };

  const ROLE_LABEL = {
    customer: "Customer",
    zone_officer: "Zone Officer",
    hydrant_operator: "Hydrant Operator",
    driver: "Driver",
    administrator: "Administrator",
  };

  const PORTAL_LABEL = {
    customer: "Customer account",
    zone_officer: "Zone office",
    hydrant_operator: "Hydrant desk",
    driver: "Driver",
    administrator: "Administration",
  };

  const SHELL_CLASS = {
    customer: "customer-shell",
    zone_officer: "officer-shell",
    hydrant_operator: "operator-shell",
    driver: "driver-shell",
    administrator: "admin-shell",
  };

  function renderShell({ role, page, title, subtitle }) {
    const session = window.PLAuth.requireRole(role);
    const items = NAV[session.role] || [];
    const root = document.getElementById("app-root");
    const collapsed = window.PLAuth.getPrefs().sidebarCollapsed;
    const showNotif = session.role === "customer";
    root.innerHTML = `
      <div class="app-shell ${collapsed ? "collapsed" : ""} ${SHELL_CLASS[session.role] || ""}">
        <aside class="sidebar" id="sidebar">
          <div class="brand">
            <img src="../assets/images/logo.svg" alt="">
            <div>
              <strong>PaaniLink</strong>
              <small>${PORTAL_LABEL[session.role]}</small>
            </div>
          </div>
          <nav aria-label="Primary">
            ${items
              .map(
                (item) =>
                  `<a href="${item.href}" class="${item.page === page ? "active" : ""}"><i class="fa-solid ${item.icon}"></i><span>${item.label}</span></a>`
              )
              .join("")}
          </nav>
          <button class="btn btn-ghost logout" type="button" id="logout-btn"><span>Sign out</span></button>
        </aside>
        <div class="main-col">
          <header class="topbar">
            <button class="icon-btn" id="menu-btn" aria-label="Toggle navigation"><i class="fa-solid fa-bars"></i></button>
            <div class="topbar-title">
              <h1>${U().escape(title)}</h1>
              ${subtitle ? `<p>${U().escape(subtitle)}</p>` : ""}
            </div>
            ${
              showNotif
                ? `<a class="icon-btn" href="notifications.html" aria-label="Notifications" id="notif-link">
              <i class="fa-solid fa-bell"></i>
              <span class="dot" id="notif-dot" hidden></span>
            </a>`
                : ""
            }
            <div class="profile-chip">
              <span class="avatar">${U().escape(U().initials(session.name))}</span>
              <div>
                <strong>${U().escape(session.name)}</strong>
                <small>${ROLE_LABEL[session.role]}</small>
              </div>
            </div>
          </header>
          <main id="page-content" class="page-content">${spinner("Loading…")}</main>
        </div>
      </div>
      <div class="nav-backdrop" id="nav-backdrop"></div>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => window.PLAuth.logout());
    const toggle = () => {
      const shell = document.querySelector(".app-shell");
      if (window.innerWidth < 1024) {
        document.querySelector(".sidebar").classList.toggle("open");
        document.getElementById("nav-backdrop").classList.toggle("show");
      } else {
        shell.classList.toggle("collapsed");
        window.PLAuth.setPref("sidebarCollapsed", shell.classList.contains("collapsed"));
      }
    };
    document.getElementById("menu-btn").addEventListener("click", toggle);
    document.getElementById("nav-backdrop").addEventListener("click", toggle);
    loadNotifications(session);
    return { session, content: document.getElementById("page-content") };
  }

  async function loadNotifications(session) {
    try {
      const list = await window.PLApi.get("notifications", { userId: session.userId });
      const unread = list.filter((n) => !n.read).length;
      const dot = document.getElementById("notif-dot");
      if (dot) {
        dot.hidden = unread === 0;
        dot.textContent = unread > 9 ? "9+" : String(unread);
      }
    } catch {
      /* ignore */
    }
  }

  function renderTable({ columns, rows, emptyTitle, emptyText }) {
    if (!rows.length) return emptyState(emptyTitle || "No records", emptyText || "There is nothing to show.");
    const head = columns.map((c) => `<th data-key="${c.key || ""}">${c.label}</th>`).join("");
    const body = rows
      .map((row) => {
        const cells = columns.map((c) => `<td data-label="${U().escape(c.label)}">${c.render ? c.render(row) : U().escape(row[c.key])}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function mountTable(el, options) {
    let page = 1;
    const size = options.pageSize || 8;
    const draw = () => {
      const total = options.rows.length;
      const pages = Math.max(1, Math.ceil(total / size));
      if (page > pages) page = pages;
      const slice = options.rows.slice((page - 1) * size, page * size);
      const pager =
        total > size
          ? `<div class="pager"><span>Showing ${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}</span>
              <span><button type="button" class="btn btn-ghost" data-p="prev" ${page === 1 ? "disabled" : ""}>Previous</button>
              <button type="button" class="btn btn-ghost" data-p="next" ${page === pages ? "disabled" : ""}>Next</button></span></div>`
          : "";
      el.innerHTML = renderTable({ ...options, rows: slice }) + pager;
      el.querySelectorAll("[data-p]").forEach((btn) => {
        btn.addEventListener("click", () => {
          page += btn.dataset.p === "next" ? 1 : -1;
          draw();
        });
      });
    };
    draw();
  }

  function progressTrack(status) {
    const halt = { cancelled: "Cancelled", rejected: "Rejected", failed: "Failed", disputed: "Disputed" };
    const steps = ["Submitted", "Queued", "On the way", "Delivered", "Closed"];
    let idx = 0;
    if (["approved", "dispatched", "filling"].includes(status)) idx = 1;
    if (["departed", "arrived"].includes(status)) idx = 2;
    if (status === "delivered") idx = 3;
    if (status === "confirmed") idx = 4;
    if (halt[status]) {
      return `<ol class="progress-track"><li class="halt">${halt[status]}</li></ol>`;
    }
    return `<ol class="progress-track">${steps
      .map((label, i) => `<li class="${i < idx ? "done" : i === idx ? "current" : ""}">${label}</li>`)
      .join("")}</ol>`;
  }

  function statCard(label, value) {
    return `<article class="kpi"><p>${U().escape(label)}</p><strong>${value}</strong></article>`;
  }

  function kpiRow(items) {
    return `<div class="kpi-row">${items.map((i) => statCard(i.label, i.value)).join("")}</div>`;
  }

  function kv(pairs) {
    return `<dl class="kv">${pairs
      .map(([k, v]) => `<dt>${U().escape(k)}</dt><dd>${v}</dd>`)
      .join("")}</dl>`;
  }

  function pageToolbar(inner) {
    return `<div class="page-toolbar">${inner}</div>`;
  }

  window.PLUI = {
    toast,
    confirmDialog,
    promptDialog,
    badge,
    emptyState,
    errorState,
    spinner,
    skeletonCards,
    renderShell,
    renderTable,
    mountTable,
    progressTrack,
    statCard,
    kpiRow,
    kv,
    pageToolbar,
    ROLE_LABEL,
    NAV,
  };
})();
