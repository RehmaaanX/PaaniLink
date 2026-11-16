/**
 * Reusable Fetch helper. All application data must go through this layer.
 */
(function () {
  const { API_BASE_URL } = window.PL_CONFIG;

  function buildUrl(path, query) {
    const url = new URL(String(path).replace(/^\//, ""), API_BASE_URL.endsWith("/") ? API_BASE_URL : API_BASE_URL + "/");
    if (query && typeof query === "object") {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  async function request(method, path, { body, query } = {}) {
    const headers = { Accept: "application/json" };
    const options = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(buildUrl(path, query), options);
    } catch (networkError) {
      const error = new Error(
        "Unable to reach the PaaniLink service. Confirm the API is running and try again."
      );
      error.cause = networkError;
      error.status = 0;
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error((data && data.message) || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  window.PLApi = {
    buildUrl,
    request,
    get: (path, query) => request("GET", path, { query }),
    post: (path, body) => request("POST", path, { body }),
    put: (path, body) => request("PUT", path, { body }),
    patch: (path, body) => request("PATCH", path, { body }),
    del: (path) => request("DELETE", path),
  };
})();
