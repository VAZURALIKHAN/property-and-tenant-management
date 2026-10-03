/**
 * Property & Tenant Management System - RESTful API Client
 */

const API = {
  // Helper for requests
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("ptm_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // 1. Auth Endpoints
  auth: {
    login: (credentials) => API.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),
    register: (userData) => API.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    })
  },

  // 2. Dashboard Endpoints
  dashboard: {
    getStats: () => API.request("/api/dashboard/stats")
  },

  // 3. Property Management Endpoints
  properties: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/properties${query ? `?${query}` : ""}`);
    },
    getById: (id) => API.request(`/api/properties/${id}`),
    create: (data) => API.request("/api/properties", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    update: (id, data) => API.request(`/api/properties/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
    delete: (id) => API.request(`/api/properties/${id}`, {
      method: "DELETE"
    })
  },

  // 4. Tenant & Customer Endpoints
  people: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/people${query ? `?${query}` : ""}`);
    },
    getById: (id) => API.request(`/api/people/${id}`),
    create: (data) => API.request("/api/people", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    update: (id, data) => API.request(`/api/people/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
    delete: (id) => API.request(`/api/people/${id}`, {
      method: "DELETE"
    })
  },

  // 5. House Rent Management Endpoints
  rentals: {
    getAll: () => API.request("/api/rentals"),
    getAgreements: () => API.request("/api/rentals/agreements"),
    allocate: (data) => API.request("/api/rentals/allocate", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    terminate: (agrId) => API.request(`/api/rentals/agreement/${agrId}/terminate`, {
      method: "POST"
    })
  },

  // 6. House Sale Management Endpoints
  houseSales: {
    getAll: () => API.request("/api/house-sales"),
    createAgreement: (data) => API.request("/api/house-sales/agreement", {
      method: "POST",
      body: JSON.stringify(data)
    })
  },

  // 7. Plot Sale Management Endpoints
  plotSales: {
    getAll: () => API.request("/api/plot-sales"),
    createAgreement: (data) => API.request("/api/plot-sales/agreement", {
      method: "POST",
      body: JSON.stringify(data)
    })
  },

  // 8. Payment & Billing Endpoints
  payments: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/payments${query ? `?${query}` : ""}`);
    },
    create: (data) => API.request("/api/payments", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    updateStatus: (id, status) => API.request(`/api/payments/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    }),
    getReceipt: (id) => API.request(`/api/payments/${id}/receipt`),
    getPending: () => API.request("/api/payments/pending")
  },

  // 9. Maintenance Management Endpoints
  maintenance: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/maintenance${query ? `?${query}` : ""}`);
    },
    raise: (data) => API.request("/api/maintenance", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    update: (id, data) => API.request(`/api/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    })
  },

  // 10. Report & Analytics Endpoints
  reports: {
    getData: () => API.request("/api/reports")
  },

  // 11. Notifications
  notifications: {
    getAll: () => API.request("/api/notifications"),
    markRead: (id) => API.request(`/api/notifications/${id}/read`, { method: "POST" }),
    clearAll: () => API.request("/api/notifications/clear", { method: "POST" })
  }
};
