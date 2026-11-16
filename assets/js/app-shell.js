(function () {
  const scripts = [
    "config.js",
    "api.js",
    "utilities.js",
    "validation.js",
    "auth.js",
    "permissions.js",
    "services.js",
    "components.js",
  ];

  window.PLBoot = {
    asset(path) {
      const p = location.pathname.replace(/\\/g, "/");
      const nested = /\/(customer|officer|operator|driver|admin)\//.test(p);
      return (nested ? "../" : "") + path;
    },
  };

  /* Shared head extras are expected to be included in each HTML file. */
  void scripts;
})();
