/**
 * Module 7: Maintenance Management Module
 * Handles Service requests, Dispatching, Status lifecycle, and Cost tracking
 */

const MaintenanceModule = {
  currentFilter: {
    status: "all",
    priority: "all",
    search: ""
  },

  init() {
    this.bindEvents();
    this.loadRequests();
  },

  bindEvents() {
    const searchInput = document.getElementById("maintenance-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.currentFilter.search = e.target.value;
        this.loadRequests();
      });
    }

    const statusFilter = document.getElementById("maintenance-status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.currentFilter.status = e.target.value;
        this.loadRequests();
      });
    }

    const priorityFilter = document.getElementById("maintenance-priority-filter");
    if (priorityFilter) {
      priorityFilter.addEventListener("change", (e) => {
        this.currentFilter.priority = e.target.value;
        this.loadRequests();
      });
    }

    const raiseBtn = document.getElementById("btn-raise-maintenance");
    if (raiseBtn) {
      raiseBtn.addEventListener("click", () => this.openRaiseModal());
    }

    const raiseForm = document.getElementById("maintenance-raise-form");
    if (raiseForm) {
      raiseForm.addEventListener("submit", (e) => this.handleRaiseSubmit(e));
    }

    const updateForm = document.getElementById("maintenance-update-form");
    if (updateForm) {
      updateForm.addEventListener("submit", (e) => this.handleUpdateSubmit(e));
    }
  },

  async loadRequests() {
    const grid = document.getElementById("maintenance-grid");
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px;"><i class="ph-bold ph-spinner" style="font-size: 1.5rem; animation: spin 1s infinite linear;"></i> Loading maintenance pipeline...</div>`;

    try {
      const res = await API.maintenance.getAll(this.currentFilter);
      const list = res.requests || [];

      if (list.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">No maintenance requests found.</div>`;
        return;
      }

      grid.innerHTML = list.map(m => `
        <div class="content-card" style="border-top: 3px solid ${this.getPriorityColor(m.priority)};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <code style="color: var(--secondary); font-weight: 700; font-size: 0.8rem;">${m.ticket_no}</code>
            <div style="display: flex; gap: 6px;">
              <span class="badge badge-${m.priority}">${m.priority.toUpperCase()}</span>
              <span class="badge badge-${m.status}">${m.status.toUpperCase()}</span>
            </div>
          </div>

          <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 6px; color: var(--text-main);">${m.title}</h4>
          <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 14px;">${m.description}</p>

          <div style="padding: 10px; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm); font-size: 0.8rem; margin-bottom: 14px;">
            <div><strong>Property:</strong> ${m.property_title}</div>
            <div><strong>Tenant:</strong> ${m.tenant_name} &bull; <strong>Category:</strong> ${m.category}</div>
            ${m.assigned_service_provider ? `
              <div style="margin-top: 4px; color: var(--secondary);">
                <i class="ph-bold ph-wrench"></i> ${m.assigned_service_provider} (${m.service_contact || 'Contact Pending'})
              </div>
            ` : '<div style="margin-top: 4px; color: var(--accent-warning);"><i class="ph-bold ph-warning-circle"></i> Service Provider Not Assigned</div>'}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: auto;">
            <div style="font-size: 0.8rem; color: var(--text-dim);">
              Est: $${m.estimated_cost || 0} ${m.actual_cost ? `| Act: $${m.actual_cost}` : ''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="MaintenanceModule.openUpdateModal(${m.id})">
              <i class="ph-bold ph-gear"></i> Manage Ticket
            </button>
          </div>
        </div>
      `).join("");
    } catch (err) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--accent-danger);">${err.message}</div>`;
    }
  },

  getPriorityColor(p) {
    switch (p) {
      case "urgent": return "var(--accent-danger)";
      case "high": return "var(--accent-warning)";
      case "medium": return "var(--accent-info)";
      default: return "var(--text-dim)";
    }
  },

  async openRaiseModal() {
    const form = document.getElementById("maintenance-raise-form");
    if (form) form.reset();

    const propSelect = document.getElementById("mnt-property-select");
    try {
      const res = await API.properties.getAll();
      if (propSelect) {
        propSelect.innerHTML = `<option value="">Select Property</option>` +
          res.properties.map(p => `<option value="${p.id}">${p.title} (${p.city})</option>`).join("");
      }
      App.openModal("maintenance-raise-modal");
    } catch (err) {
      App.showToast("Failed to prepare ticket form: " + err.message, "error");
    }
  },

  async handleRaiseSubmit(e) {
    e.preventDefault();
    const payload = {
      property_id: parseInt(document.getElementById("mnt-property-select").value),
      tenant_name: document.getElementById("mnt-tenant-name").value.trim(),
      category: document.getElementById("mnt-category").value,
      priority: document.getElementById("mnt-priority").value,
      title: document.getElementById("mnt-title").value.trim(),
      description: document.getElementById("mnt-desc").value.trim(),
      estimated_cost: parseFloat(document.getElementById("mnt-cost-est").value) || 0
    };

    try {
      const res = await API.maintenance.raise(payload);
      App.showToast(`Request logged! Ticket ${res.ticket_no}`, "success");
      App.closeModal("maintenance-raise-modal");
      this.loadRequests();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async openUpdateModal(ticketId) {
    try {
      const res = await API.maintenance.getAll();
      const t = (res.requests || []).find(item => item.id === ticketId);
      if (!t) return;

      document.getElementById("mnt-update-id").value = t.id;
      document.getElementById("mnt-update-title").innerText = `${t.ticket_no} - ${t.title}`;
      document.getElementById("mnt-update-status").value = t.status || "pending";
      document.getElementById("mnt-update-provider").value = t.assigned_service_provider || "";
      document.getElementById("mnt-update-contact").value = t.service_contact || "";
      document.getElementById("mnt-update-date").value = t.scheduled_date || "";
      document.getElementById("mnt-update-cost-act").value = t.actual_cost || 0;
      document.getElementById("mnt-update-notes").value = t.complaint_notes || "";

      App.openModal("maintenance-update-modal");
    } catch (err) {
      App.showToast("Failed to open ticket: " + err.message, "error");
    }
  },

  async handleUpdateSubmit(e) {
    e.preventDefault();
    const ticketId = document.getElementById("mnt-update-id").value;
    const payload = {
      status: document.getElementById("mnt-update-status").value,
      assigned_service_provider: document.getElementById("mnt-update-provider").value.trim(),
      service_contact: document.getElementById("mnt-update-contact").value.trim(),
      scheduled_date: document.getElementById("mnt-update-date").value,
      actual_cost: parseFloat(document.getElementById("mnt-update-cost-act").value) || 0,
      complaint_notes: document.getElementById("mnt-update-notes").value.trim()
    };

    try {
      await API.maintenance.update(ticketId, payload);
      App.showToast("Maintenance ticket updated successfully!", "success");
      App.closeModal("maintenance-update-modal");
      this.loadRequests();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }
};
