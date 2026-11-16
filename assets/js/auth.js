/**
 * Demonstration authentication (Phase 1).
 * Credentials are checked against the mock users collection.
 * Role is taken from the user record, never from a client-controlled dropdown alone.
 */
(function () {
  const { SESSION_KEY, PREFS_KEY } = window.PL_CONFIG;

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function setPref(key, value) {
    const prefs = getPrefs();
    prefs[key] = value;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  async function login(email, password, expectedRole) {
    const users = await window.PLApi.get("users", { email: String(email).trim().toLowerCase() });
    const user = Array.isArray(users) ? users[0] : null;
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password.");
    }
    if (user.status !== "active") {
      throw new Error("This account is deactivated. Contact the administrator.");
    }
    if (expectedRole && user.role !== expectedRole) {
      throw new Error("These credentials do not match the selected demo role.");
    }
    const session = {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      zoneId: user.zoneId || null,
      hydrantId: user.hydrantId || null,
      customerId: user.customerId || null,
      driverId: user.driverId || null,
      loggedInAt: new Date().toISOString(),
    };
    setSession(session);
    await window.PLApi.post("activityLogs", {
      userId: user.id,
      action: "login",
      details: `${user.name} signed in as ${user.role}`,
      createdAt: new Date().toISOString(),
    });
    return session;
  }

  const ROLE_FOLDER = {
    customer: "customer",
    zone_officer: "officer",
    hydrant_operator: "operator",
    driver: "driver",
    administrator: "admin",
  };

  const BOOK_NEXT = "customer/book-tanker.html";

  function isSafeNext(raw) {
    if (!raw) return false;
    try {
      const next = decodeURIComponent(String(raw)).replace(/\\/g, "/");
      if (next.includes("..") || next.includes("://") || next.startsWith("//") || next.startsWith("/")) return false;
      return /^(customer|officer|operator|driver|admin)\/[a-z0-9.-]+\.html(\?[\w.=&-]*)?$/i.test(next);
    } catch {
      return false;
    }
  }

  function requestedNext() {
    const q = new URLSearchParams(location.search).get("next");
    return isSafeNext(q) ? decodeURIComponent(q) : "";
  }

  function postLoginPath(session) {
    const next = requestedNext();
    if (next) {
      const folder = next.split("/")[0];
      if (folder === ROLE_FOLDER[session.role]) return next;
    }
    return roleHome(session.role);
  }

  function bookTankerHref() {
    const session = getSession();
    const base = basePath();
    if (!session) return `${base}login.html?next=${encodeURIComponent(BOOK_NEXT)}`;
    if (session.role === "customer") return `${base}${BOOK_NEXT}`;
    return roleHome(session.role);
  }

  function logout() {
    const session = getSession();
    clearSession();
    if (session) {
      window.PLApi
        .post("activityLogs", {
          userId: session.userId,
          action: "logout",
          details: `${session.name} signed out`,
          createdAt: new Date().toISOString(),
        })
        .catch(() => {});
    }
    location.href = `${basePath()}index.html`;
  }

  function basePath() {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/customer/") || path.includes("/officer/") || path.includes("/operator/") || path.includes("/driver/") || path.includes("/admin/")) {
      return "../";
    }
    return "";
  }

  function roleHome(role) {
    const base = basePath();
    const map = {
      customer: "customer/dashboard.html",
      zone_officer: "officer/dashboard.html",
      hydrant_operator: "operator/dashboard.html",
      driver: "driver/dashboard.html",
      administrator: "admin/dashboard.html",
    };
    return base + (map[role] || "login.html");
  }

  function currentAppPath() {
    const path = location.pathname.replace(/\\/g, "/");
    const match = path.match(/\/(customer|officer|operator|driver|admin)\/([^/?]+)/);
    if (!match) return "";
    const file = match[2].endsWith(".html") ? match[2] : `${match[2]}.html`;
    const next = `${match[1]}/${file}${location.search || ""}`;
    return isSafeNext(next.split("?")[0]) ? `${match[1]}/${file}` : "";
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      const next = currentAppPath();
      const q = next ? `?next=${encodeURIComponent(next)}` : "";
      location.href = `${basePath()}login.html${q}`;
      throw new Error("Not authenticated");
    }
    return session;
  }

  function bindPublicNav() {
    const session = getSession();
    document.querySelectorAll("[data-nav=book]").forEach((el) => {
      el.setAttribute("href", bookTankerHref());
    });
    document.querySelectorAll("[data-nav=signin]").forEach((el) => {
      if (session) {
        el.textContent = "My account";
        el.setAttribute("href", roleHome(session.role));
      } else {
        el.textContent = "Sign in";
        el.setAttribute("href", `${basePath()}login.html`);
      }
    });
    const host = document.querySelector("[data-nav-session]");
    if (host) {
      if (session) {
        host.hidden = false;
        host.innerHTML = `<button type="button" class="btn btn-ghost" id="public-logout">Sign out</button>`;
        document.getElementById("public-logout").addEventListener("click", () => logout());
      } else {
        host.hidden = true;
        host.innerHTML = "";
      }
    }
  }

  function requireRole(roles) {
    const session = requireAuth();
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(session.role)) {
      location.href = `${basePath()}unauthorized.html`;
      throw new Error("Unauthorized");
    }
    return session;
  }

  window.PLAuth = {
    getSession,
    setSession,
    clearSession,
    getPrefs,
    setPref,
    login,
    logout,
    basePath,
    roleHome,
    requireAuth,
    requireRole,
    postLoginPath,
    bookTankerHref,
    requestedNext,
    bindPublicNav,
    BOOK_NEXT,
  };
})();
