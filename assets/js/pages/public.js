(async function () {
  const page = document.body.dataset.page;
  const root = document.getElementById("public-root");
  const U = window.PLUtil;
  const V = window.PLValidate;

  const DEMOS = [
    { role: "customer", label: "Customer · Ahmed Khan", email: "customer.ahmed@paanilink.pk", password: "Customer@123" },
    { role: "zone_officer", label: "Zone Officer · Saima Zahid (Gulshan)", email: "officer.gulshan@paanilink.pk", password: "Officer@123" },
    { role: "hydrant_operator", label: "Hydrant Operator · Gulshan Hydrant A", email: "operator.h1@paanilink.pk", password: "Operator@123" },
    { role: "driver", label: "Driver · Ali Raza", email: "driver.ali@paanilink.pk", password: "Driver@123" },
    { role: "administrator", label: "Administrator · Director Water Ops", email: "admin@paanilink.pk", password: "Admin@123" },
  ];

  function layout(visualTitle, visualText, formHtml) {
    root.innerHTML = `
      <div class="auth-page">
        <section class="auth-visual">
          <a class="brand" href="index.html"><img src="assets/images/logo.svg" alt=""><div><strong>PaaniLink</strong><small>Karachi Water Board</small></div></a>
          <div>
            <h1>${visualTitle}</h1>
            <p>${visualText}</p>
          </div>
          <p>${U.escape(PL_CONFIG.DEMO_NOTICE)}</p>
        </section>
        <section class="auth-form-wrap">${formHtml}</section>
      </div>`;
  }

  if (page === "unauthorized") {
    layout(
      "This screen is not available on your account",
      "You are signed in with a role that cannot open this page.",
      `<div class="auth-card">
        <h2>Access denied</h2>
        <p>Return to sign in if you need a different account.</p>
        <p><a class="btn btn-primary" href="login.html">Sign in</a></p>
      </div>`
    );
    return;
  }

  if (page === "login") {
    const session = window.PLAuth.getSession();
    if (session) {
      location.href = window.PLAuth.postLoginPath(session);
      return;
    }
    const nextQuery = location.search && location.search.includes("next=") ? location.search : "";
      const bookingNote = window.PLAuth.requestedNext() === window.PLAuth.BOOK_NEXT
      ? "<p class=\"notice\">Sign in with a customer account to continue to the booking form.</p>"
      : "";
    layout(
      "Karachi Water Board",
      "Tanker booking desk. Use the email on your customer or staff account.",
      `<div class="auth-card">
        <h2>Sign in</h2>
        ${bookingNote}
        <form id="login-form" novalidate>
          <input type="hidden" name="role" value="">
          <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="username"><small class="field-error" data-error-for="email"></small></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password"><small class="field-error" data-error-for="password"></small></label>
          <button class="btn btn-primary" type="submit" style="width:100%">Sign in</button>
        </form>
        <details class="demo-box" id="demo-wrap">
          <summary>Fill a sample account</summary>
          <div class="demo-roles" id="demo-roles">
            ${DEMOS.map((d, i) => `<button type="button" data-i="${i}"><strong>${U.escape(d.label)}</strong><br><small>${U.escape(d.email)}</small></button>`).join("")}
          </div>
        </details>
        <p><a href="register.html${nextQuery}">Register as a customer</a> · <a href="index.html">Home</a> · <a href="track.html">Track</a></p>
      </div>`
    );
    const form = document.getElementById("login-form");
    document.getElementById("demo-roles").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      document.querySelectorAll(".demo-roles button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const demo = DEMOS[Number(btn.dataset.i)];
      form.email.value = demo.email;
      form.password.value = demo.password;
      form.role.value = demo.role;
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = V.collect(form);
      const errors = {
        email: V.required(data.email, "Email") || V.email(data.email),
        password: V.required(data.password, "Password"),
      };
      V.showErrors(form, errors);
      if (Object.values(errors).some(Boolean)) return;
      try {
        const session = await window.PLAuth.login(data.email, data.password, data.role || undefined);
        window.PLUI.toast("Signed in as " + session.name, "success");
        location.href = window.PLAuth.postLoginPath(session);
      } catch (err) {
        window.PLUI.toast(err.message, "error");
      }
    });
    return;
  }

  if (page === "register") {
    let zones = [];
    try {
      zones = await window.PLApi.get("zones", { status: "active" });
    } catch (err) {
      layout("Registration", "Create a customer account.", `<div class="auth-card">${window.PLUI.errorState(err.message)}</div>`);
      return;
    }
    const nextQuery = location.search && location.search.includes("next=") ? location.search : "";
    layout(
      "Customer registration",
      "Households and businesses register here. Staff accounts are issued by the administrator.",
      `<div class="auth-card">
        <h2>Register</h2>
        <form id="reg-form" novalidate>
          <label class="field"><span>Full name</span><input class="input" name="name"><small class="field-error" data-error-for="name"></small></label>
          <label class="field"><span>CNIC</span><input class="input" name="cnic" placeholder="42101-1234567-1"><small class="field-error" data-error-for="cnic"></small></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" placeholder="03XXXXXXXXX"><small class="field-error" data-error-for="phone"></small></label>
          <label class="field"><span>Email</span><input class="input" name="email" type="email"><small class="field-error" data-error-for="email"></small></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password"><small class="field-error" data-error-for="password"></small></label>
          <label class="field"><span>Confirm password</span><input class="input" name="confirm" type="password"><small class="field-error" data-error-for="confirm"></small></label>
          <label class="field"><span>Address</span><textarea class="input" name="address" rows="2"></textarea><small class="field-error" data-error-for="address"></small></label>
          <label class="field"><span>Zone</span><select class="input" name="zoneId"><option value="">Select zone</option>${zones.map((z) => `<option value="${z.id}">${U.escape(z.name)}</option>`).join("")}</select><small class="field-error" data-error-for="zoneId"></small></label>
          <button class="btn btn-primary" type="submit" style="width:100%">Create account</button>
        </form>
        <p><a href="login.html${nextQuery}">Already registered? Sign in</a></p>
      </div>`
    );
    const form = document.getElementById("reg-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = V.collect(form);
      const errors = {
        name: V.required(data.name, "Full name"),
        cnic: V.required(data.cnic, "CNIC") || V.cnic(data.cnic),
        phone: V.required(data.phone, "Phone") || V.phone(data.phone),
        email: V.required(data.email, "Email") || V.email(data.email),
        password: V.required(data.password, "Password") || V.password(data.password),
        confirm: V.confirmPassword(data.password, data.confirm),
        address: V.required(data.address, "Address"),
        zoneId: V.required(data.zoneId, "Zone"),
      };
      V.showErrors(form, errors);
      if (Object.values(errors).some(Boolean)) return;
      try {
        const email = data.email.toLowerCase();
        const [byEmail, byCnic] = await Promise.all([
          window.PLApi.get("users", { email }),
          window.PLApi.get("customers", { cnic: data.cnic }),
        ]);
        if (byEmail.length) throw new Error("An account with this email already exists.");
        if (byCnic.length) throw new Error("An account with this CNIC already exists.");
        const customer = await window.PLServices.customers.create({
          name: data.name,
          cnic: data.cnic,
          phone: data.phone,
          email,
          address: data.address,
          zoneId: Number(data.zoneId),
          subsidyStatus: "none",
          monthlySubsidyLimitGallons: window.PL_CONFIG.MONTHLY_SUBSIDY_LIMIT_GALLONS,
          usedThisMonthGallons: 0,
          userId: null,
        });
        const user = await window.PLServices.users.create({
          name: data.name,
          email,
          password: data.password,
          role: "customer",
          phone: data.phone,
          cnic: data.cnic,
          status: "active",
          zoneId: Number(data.zoneId),
          hydrantId: null,
          customerId: customer.id,
          driverId: null,
          createdAt: new Date().toISOString(),
        });
        await window.PLServices.customers.update(customer.id, { userId: user.id });
        const session = await window.PLAuth.login(email, data.password, "customer");
        window.PLUI.toast("Account created. You are signed in.", "success");
        location.href = window.PLAuth.postLoginPath(session);
      } catch (err) {
        window.PLUI.toast(err.message, "error");
      }
    });
    return;
  }

  if (page === "track") {
    window.PLAuth.bindPublicNav();
    const form = document.getElementById("track-form");
    const out = document.getElementById("track-result");
    if (!form || !out) return;

    function parseRef(raw) {
      const cleaned = String(raw || "")
        .trim()
        .toUpperCase()
        .replace(/^PL-/, "");
      const n = Number(cleaned);
      return Number.isInteger(n) && n > 0 ? n : null;
    }

    async function show(id) {
      out.innerHTML = window.PLUI.spinner("Looking up booking…");
      try {
        const booking = await window.PLApi.get(`bookings/${id}`);
        const hydrant = await window.PLApi.get(`hydrants/${booking.hydrantId}`).catch(() => null);
        const tanker = booking.tankerId ? await window.PLApi.get(`tankers/${booking.tankerId}`).catch(() => null) : null;
        const session = window.PLAuth.getSession();
        const own = session && session.role === "customer" && Number(session.customerId) === Number(booking.customerId);
        const ref = U.bookingRef(booking.id);
        out.innerHTML = `
          <section class="panel">
            <h2>${U.escape(ref)} ${window.PLUI.badge(booking.status)}</h2>
            ${window.PLUI.progressTrack(booking.status)}
            ${window.PLUI.kv([
              ["Category", `${U.escape(U.statusLabel(booking.type))} · ${U.formatGallons(booking.capacityGallons)}`],
              ["Requested", `${U.escape(booking.preferredDate)} ${U.escape(booking.preferredTime)}`],
              ["Hydrant", U.escape(hydrant ? hydrant.name : "—")],
              ["Tanker", tanker ? U.escape(tanker.registrationNumber) : "Not assigned"],
            ])}
            ${own ? `<p><a href="customer/booking-details.html?id=${booking.id}">Open in your account</a></p>` : ""}
          </section>`;
      } catch (err) {
        out.innerHTML = window.PLUI.emptyState("Booking not found", "Check the reference (for example PL-0003) and try again.");
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = parseRef(form.reference.value);
      if (!id) {
        out.innerHTML = window.PLUI.emptyState("Enter a booking reference", "Use the number from your confirmation.");
        return;
      }
      history.replaceState(null, "", "track.html?ref=" + encodeURIComponent("PL-" + String(id).padStart(4, "0")));
      show(id);
    });

    const preset = parseRef(new URLSearchParams(location.search).get("ref"));
    if (preset) {
      form.reference.value = "PL-" + String(preset).padStart(4, "0");
      show(preset);
    }
  }
})();
