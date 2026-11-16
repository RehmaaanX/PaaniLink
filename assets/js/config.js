/**
 * PaaniLink Phase 1 configuration.
 * Change API_BASE_URL in Phase 2 to point at the real REST API.
 * No other UI workflow files should hardcode the host.
 */
window.PL_CONFIG = {
  APP_NAME: "PaaniLink",
  APP_TAGLINE: "Karachi Water Board",
  API_BASE_URL: "http://localhost:3000",
  SESSION_KEY: "paanilink_session",
  PREFS_KEY: "paanilink_prefs",
  CITY: "Karachi",
  AUTHORITY: "Karachi Water Board",
  TIMEZONE: "Asia/Karachi",
  CURRENCY: "PKR",
  CAPACITIES: [1000, 3000, 6000],
  MONTHLY_SUBSIDY_LIMIT_GALLONS: 6000,
  CNIC_PATTERN: /^\d{5}-\d{7}-\d{1}$/,
  PHONE_PATTERN: /^((\+92)|0)?3\d{9}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DEMO_NOTICE: "Staff accounts are issued by the Water Board. Customers register on this site.",
};
