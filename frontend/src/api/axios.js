import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Attach the JWT access token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, attempt a silent token refresh once, then retry the original request.
// Guards:
//   - Skip auth endpoints (login / register / token/refresh) — they don't need tokens
//     and retrying them on 401 would create an infinite OPTIONS loop.
//   - Use _retry flag so each request is only retried once.
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Skip retry for auth endpoints or already-retried requests.
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login/") ||
      originalRequest.url?.includes("/auth/register/") ||
      originalRequest.url?.includes("/auth/token/refresh/");

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const refresh = localStorage.getItem("refresh");

      if (refresh) {
        try {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/auth/token/refresh/`,
            { refresh }
          );

          localStorage.setItem("access", data.access);

          // ROTATE_REFRESH_TOKENS=True: backend invalidates the old refresh
          // token and returns a new one — persist it or the next refresh fails.
          if (data.refresh) {
            localStorage.setItem("refresh", data.refresh);
          }

          originalRequest.headers.Authorization = `Bearer ${data.access}`;

          return api.request(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
