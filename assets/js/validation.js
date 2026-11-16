(function () {
  const { CNIC_PATTERN, PHONE_PATTERN, EMAIL_PATTERN, CAPACITIES } = window.PL_CONFIG;

  function required(value, label) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return `${label} is required.`;
    }
    return "";
  }

  function cnic(value) {
    if (!CNIC_PATTERN.test(String(value).trim())) {
      return "CNIC must use the format 12345-1234567-1.";
    }
    return "";
  }

  function phone(value) {
    const compact = String(value).replace(/[\s-]/g, "");
    if (!PHONE_PATTERN.test(compact)) {
      return "Enter a valid Pakistani mobile number (e.g. 03XXXXXXXXX).";
    }
    return "";
  }

  function email(value) {
    if (!EMAIL_PATTERN.test(String(value).trim())) {
      return "Enter a valid email address.";
    }
    return "";
  }

  function password(value) {
    if (String(value).length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
      return "Password must include upper, lower, and a number.";
    }
    return "";
  }

  function confirmPassword(a, b) {
    if (a !== b) return "Password confirmation does not match.";
    return "";
  }

  function positiveNumber(value, label) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
    return "";
  }

  function capacity(value) {
    if (!CAPACITIES.includes(Number(value))) {
      return "Tanker capacity must be 1,000, 3,000, or 6,000 gallons.";
    }
    return "";
  }

  function futureDate(value, label = "Date") {
    const msg = required(value, label);
    if (msg) return msg;
    const today = window.PLUtil.todayISO();
    if (String(value) < today) return `${label} cannot be in the past.`;
    return "";
  }

  function timeValue(value, label = "Time") {
    if (!/^\d{2}:\d{2}$/.test(String(value))) return `${label} must use HH:MM format.`;
    return "";
  }

  function withinHours(time, start, end) {
    if (time < start || time > end) {
      return `Preferred time must fall within hydrant operating hours (${start}–${end}).`;
    }
    return "";
  }

  function showErrors(form, errors) {
    form.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = "";
    });
    form.querySelectorAll("[data-error-for]").forEach((el) => {
      el.textContent = "";
    });
    Object.entries(errors).forEach(([name, message]) => {
      const field = form.querySelector(`[name="${name}"]`);
      const holder =
        form.querySelector(`[data-error-for="${name}"]`) ||
        (field && field.closest(".field") && field.closest(".field").querySelector(".field-error"));
      if (holder) holder.textContent = message;
      if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
    });
  }

  function collect(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = typeof value === "string" ? value.trim() : value;
    });
    return data;
  }

  window.PLValidate = {
    required,
    cnic,
    phone,
    email,
    password,
    confirmPassword,
    positiveNumber,
    capacity,
    futureDate,
    timeValue,
    withinHours,
    showErrors,
    collect,
  };
})();
