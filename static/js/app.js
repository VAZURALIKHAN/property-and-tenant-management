/**
 * Property & Tenant Management System - Core Application Orchestrator
 * Handles Tab Navigation, Authentication State, Notifications Center, and Global Modals
 */

const App = {
  currentUser: null,
  activeTab: "dashboard",

  init() {
    this.checkAuth();
    this.bindGlobalEvents();
    this.loadNotifications();
    this.refreshDashboardStats();

    // Initialize all sub-modules
    PropertiesModule.init();
    TenantsModule.init();
    RentalsModule.init();
    SalesModule.init();
    PaymentsModule.init();
    MaintenanceModule.init();
    ReportsModule.init();

    // Listen for hash change for deep linking
    window.addEventListener("hashchange", () => this.handleHashChange());
    if (window.location.hash) {
      this.handleHashChange();
    }
  },

  checkAuth() {
    const savedUser = localStorage.getItem("ptm_user");
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
      }
    }

    if (!this.currentUser) {
      // Default to administrator for instant demo testing
      this.currentUser = {
        id: 1,
        name: "Administrator",
        email: "admin@property.com",
        role: "admin",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      };
      localStorage.setItem("ptm_user", JSON.stringify(this.currentUser));
    }

    this.renderUserInfo();
  },

  renderUserInfo() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById("user-display-name");
    const roleEl = document.getElementById("user-display-role");
    const avatarEl = document.getElementById("user-display-avatar");

    if (nameEl) nameEl.textContent = this.currentUser.name;
    if (roleEl) roleEl.textContent = this.currentUser.role;
    if (avatarEl && this.currentUser.avatar) avatarEl.src = this.currentUser.avatar;
  },

  bindGlobalEvents() {
    // Nav Items click
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        if (tab) {
          window.location.hash = tab;
          this.switchTab(tab);
        }
      });
    });

    // Notifications toggle
    const notifBtn = document.getElementById("btn-notifications-toggle");
    const notifDropdown = document.getElementById("notifications-dropdown");
    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle("active");
      });

      document.addEventListener("click", (e) => {
        if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
          notifDropdown.classList.remove("active");
        }
      });
    }

    // Clear notifications button
    const clearNotifBtn = document.getElementById("btn-clear-notifications");
    if (clearNotifBtn) {
      clearNotifBtn.addEventListener("click", async () => {
        await API.notifications.clearAll();
        this.loadNotifications();
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        themeBtn.innerHTML = newTheme === "light" ? `<i class="ph-bold ph-moon"></i>` : `<i class="ph-bold ph-sun"></i>`;
      });
    }

    // Modal close on backdrop click
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    // Close buttons in modals
    document.querySelectorAll(".btn-close-modal").forEach(btn => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-overlay");
        if (modal) this.closeModal(modal.id);
      });
    });

    // Switch Role / User Login Modal
    const switchUserBtn = document.getElementById("btn-switch-user");
    if (switchUserBtn) {
      switchUserBtn.addEventListener("click", () => this.openLoginModal());
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }
  },

  handleHashChange() {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      this.switchTab(hash);
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update sidebar active states
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabId);
    });

    // Update section visibility
    document.querySelectorAll(".module-section").forEach(sec => {
      sec.classList.remove("active");
    });

    const activeSec = document.getElementById(`section-${tabId}`);
    if (activeSec) {
      activeSec.classList.add("active");
    }

    // Trigger module data reload when switching
    if (tabId === "dashboard") this.refreshDashboardStats();
    else if (tabId === "properties") PropertiesModule.loadProperties();
    else if (tabId === "tenants") TenantsModule.loadPeople();
    else if (tabId === "rentals") { RentalsModule.loadRentals(); RentalsModule.loadAgreements(); }
    else if (tabId === "sales") { SalesModule.loadHouseSales(); SalesModule.loadPlotSales(); }
    else if (tabId === "payments") { PaymentsModule.loadPayments(); PaymentsModule.loadPendingAlerts(); }
    else if (tabId === "maintenance") MaintenanceModule.loadRequests();
    else if (tabId === "reports") ReportsModule.renderActiveReport();
  },

  async refreshDashboardStats() {
    try {
      const res = await API.dashboard.getStats();
      const s = res.stats;

      document.getElementById("kpi-total-properties").textContent = s.total_properties || 0;
      document.getElementById("kpi-occupancy").textContent = `${s.rented_count} Rented / ${s.available_count} Free`;
      document.getElementById("kpi-total-revenue").textContent = `$${Number(s.total_revenue || 0).toLocaleString()}`;
      document.getElementById("kpi-rent-collected").textContent = `Rent: $${Number(s.rent_collected || 0).toLocaleString()}`;
      document.getElementById("kpi-tenants-count").textContent = s.tenant_count || 0;
      document.getElementById("kpi-customers-count").textContent = `${s.customer_count || 0} Buyers/Leads`;
      document.getElementById("kpi-pending-payments").textContent = `$${Number(s.pending_payments_total || 0).toLocaleString()}`;
      document.getElementById("kpi-maintenance-count").textContent = s.open_maintenance_count || 0;

      // Update badge counters in nav
      const propBadge = document.getElementById("badge-properties-count");
      if (propBadge) propBadge.textContent = s.total_properties;
      const mntBadge = document.getElementById("badge-maintenance-count");
      if (mntBadge) mntBadge.textContent = s.open_maintenance_count;

      // Activity Feed
      const feed = document.getElementById("dashboard-activity-feed");
      if (feed && res.recent_activities) {
        if (res.recent_activities.length === 0) {
          feed.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No recent transactions recorded.</div>`;
        } else {
          feed.innerHTML = res.recent_activities.map(act => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color); font-size: 0.88rem;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${act.act_type === 'payment' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; color: ${act.act_type === 'payment' ? 'var(--accent-success)' : 'var(--accent-info)'}; display: flex; align-items: center; justify-content: center;">
                  <i class="ph-bold ${act.act_type === 'payment' ? 'ph-receipt' : 'ph-wrench'}"></i>
                </div>
                <div>
                  <strong>${act.person}</strong> - ${act.subtype}
                  <div style="font-size: 0.75rem; color: var(--text-dim);">${act.ref_code} &bull; ${act.created_at || 'Recent'}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <strong style="color: ${act.act_type === 'payment' ? 'var(--accent-success)' : 'var(--text-main)'};">
                  ${act.amount ? `$${Number(act.amount).toLocaleString()}` : ''}
                </strong>
                <div><span class="badge badge-${act.status}">${act.status}</span></div>
              </div>
            </div>
          `).join("");
        }
      }
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    }
  },

  async loadNotifications() {
    try {
      const res = await API.notifications.getAll();
      const list = res.notifications || [];
      const unreadCount = list.filter(n => !n.is_read).length;

      const badgeDot = document.getElementById("notif-badge-dot");
      if (badgeDot) {
        badgeDot.style.display = unreadCount > 0 ? "block" : "none";
      }

      const listContainer = document.getElementById("notifications-list-container");
      if (!listContainer) return;

      if (list.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.85rem;">No notifications right now.</div>`;
        return;
      }

      listContainer.innerHTML = list.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="App.markNotifRead(${n.id})">
          <div class="notif-icon" style="background: ${n.category === 'rent_due' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(79, 70, 229, 0.15)'}; color: ${n.category === 'rent_due' ? 'var(--accent-danger)' : 'var(--primary-light)'};">
            <i class="ph-bold ${n.category === 'rent_due' ? 'ph-alarm' : (n.category === 'maintenance' ? 'ph-wrench' : 'ph-bell')}"></i>
          </div>
          <div class="notif-content">
            <h5>${n.title}</h5>
            <p>${n.message}</p>
            <div class="notif-time">${n.created_at}</div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.error("Notifications error:", err);
    }
  },

  async markNotifRead(id) {
    try {
      await API.notifications.markRead(id);
      this.loadNotifications();
    } catch (e) {}
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  },

  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "ph-check-circle" : (type === "error" ? "ph-warning-circle" : "ph-info");
    toast.innerHTML = `<i class="ph-bold ${icon}" style="font-size: 1.2rem;"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  openLoginModal() {
    App.openModal("login-modal");
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const res = await API.auth.login({ email, password });
      this.currentUser = res.user;
      localStorage.setItem("ptm_user", JSON.stringify(res.user));
      localStorage.setItem("ptm_token", res.token);
      this.renderUserInfo();
      this.closeModal("login-modal");
      this.showToast(`Logged in as ${res.user.name} (${res.user.role})`, "success");
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }
};

// Auto-run on DOM ready
document.addEventListener("DOMContentLoaded", () => App.init());
