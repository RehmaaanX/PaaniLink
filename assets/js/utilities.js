(function () {
  const STATUS_LABELS = {
    pending: "Pending",
    pending_approval: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    dispatched: "Dispatched",
    filling: "Filling",
    departed: "Departed",
    assigned: "Assigned",
    arrived: "Arrived",
    delivered: "Delivered",
    failed: "Failed",
    disputed: "Disputed",
    confirmed: "Confirmed",
    verified: "Verified",
    none: "None",
    available: "Available",
    unavailable: "Unavailable",
    in_service: "In Service",
    on_trip: "On Trip",
    active: "Active",
    inactive: "Inactive",
    paid: "Paid",
    unpaid: "Unpaid",
    simulated: "Recorded",
    subsidy_offset: "Subsidy offset",
    simulated_card: "Card",
    open: "Open",
    resolved: "Resolved",
    commercial: "Commercial",
    subsidised: "Subsidised",
    group: "Group",
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  window.PLUtil = {
    STATUS_LABELS,
    $(sel, root = document) {
      return root.querySelector(sel);
    },
    $all(sel, root = document) {
      return Array.from(root.querySelectorAll(sel));
    },
    qs(name) {
      const fromQuery = new URLSearchParams(location.search).get(name);
      if (fromQuery) return fromQuery;
      const hash = location.hash.replace(/^#/, "");
      if (hash) {
        if (hash.includes("=")) {
          const fromHash = new URLSearchParams(hash).get(name);
          if (fromHash) return fromHash;
        } else if (name === "id" || name === "bookingId") {
          return hash;
        }
      }
      return sessionStorage.getItem("pl_" + name);
    },
    remember(name, value) {
      sessionStorage.setItem("pl_" + name, String(value));
    },
    debounce(fn, wait = 250) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
      };
    },
    formatPKR(amount) {
      const n = Number(amount) || 0;
      return "Rs " + n.toLocaleString("en-PK");
    },
    formatGallons(n) {
      return (Number(n) || 0).toLocaleString("en-PK") + " gal";
    },
    formatDate(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    },
    formatDateTime(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    nowISO() {
      return new Date().toISOString();
    },
    statusLabel(status) {
      return STATUS_LABELS[status] || status || "—";
    },
    bookingRef(id) {
      return "PL-" + String(id).padStart(4, "0");
    },
    statusOptions(values, allLabel = "All statuses") {
      const opts = [`<option value="">${allLabel}</option>`];
      for (const v of values) {
        opts.push(`<option value="${v}">${STATUS_LABELS[v] || v}</option>`);
      }
      return opts.join("");
    },
    statusClass(status) {
      const map = {
        pending: "badge-warning",
        pending_approval: "badge-warning",
        unpaid: "badge-warning",
        open: "badge-warning",
        approved: "badge-info",
        assigned: "badge-info",
        dispatched: "badge-info",
        filling: "badge-info",
        departed: "badge-info",
        arrived: "badge-info",
        delivered: "badge-success",
        confirmed: "badge-success",
        verified: "badge-success",
        paid: "badge-success",
        available: "badge-success",
        active: "badge-success",
        resolved: "badge-success",
        rejected: "badge-danger",
        failed: "badge-danger",
        cancelled: "badge-danger",
        disputed: "badge-danger",
        unavailable: "badge-danger",
        inactive: "badge-muted",
        none: "badge-muted",
      };
      return map[status] || "badge-muted";
    },
    escape(str) {
      return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    initials(name) {
      return String(name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");
    },
    sortBy(list, key, dir = "asc") {
      const copy = [...list];
      copy.sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return dir === "asc" ? va - vb : vb - va;
        return dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      return copy;
    },
    downloadCSV(filename, rows) {
      const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    },
  };
})();
