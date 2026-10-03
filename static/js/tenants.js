/**
 * Module 2: Tenant & Customer Management Module
 * Handles Tenant/Customer Records, Search, KYC Verification, and Profile Inspector
 */

const TenantsModule = {
  currentType: "all",
  searchQuery: "",

  init() {
    this.bindEvents();
    this.loadPeople();
  },

  bindEvents() {
    const searchInput = document.getElementById("person-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.loadPeople();
      });
    }

    const typeTabs = document.querySelectorAll(".person-type-tab");
    typeTabs.forEach(tab => {
      tab.addEventListener("click", (e) => {
        typeTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.currentType = tab.dataset.type;
        this.loadPeople();
      });
    });

    const addTenantBtn = document.getElementById("btn-add-tenant");
    if (addTenantBtn) {
      addTenantBtn.addEventListener("click", () => this.openAddModal("tenant"));
    }

    const addCustomerBtn = document.getElementById("btn-add-customer");
    if (addCustomerBtn) {
      addCustomerBtn.addEventListener("click", () => this.openAddModal("customer"));
    }

    const personForm = document.getElementById("person-form");
    if (personForm) {
      personForm.addEventListener("submit", (e) => this.handleSavePerson(e));
    }
  },

  async loadPeople() {
    const tbody = document.getElementById("people-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;"><i class="ph-bold ph-spinner" style="font-size: 1.5rem; animation: spin 1s infinite linear;"></i> Loading records...</td></tr>`;

    try {
      const res = await API.people.getAll({
        type: this.currentType,
        search: this.searchQuery
      });

      if (!res.people || res.people.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No tenant or customer profiles found.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.people.map(p => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 0.85rem;">
                ${p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style="color: var(--text-main); font-size: 0.9rem;">${p.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${p.occupation || 'N/A'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${p.type === 'tenant' ? 'badge-active' : 'badge-completed'}">
              ${p.type.toUpperCase()}
            </span>
          </td>
          <td>
            <div style="font-size: 0.85rem;"><i class="ph-bold ph-phone" style="color: var(--secondary)"></i> ${p.phone}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.email || 'No email registered'}</div>
          </td>
          <td>
            <div style="font-size: 0.82rem;"><strong>${p.id_proof_type || 'ID Proof'}:</strong></div>
            <code style="font-size: 0.78rem; color: var(--secondary);">${p.id_proof_number || 'Pending KYC'}</code>
          </td>
          <td>
            <span class="badge ${p.status === 'active' ? 'badge-active' : 'badge-pending'}">
              ${p.status.toUpperCase()}
            </span>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${p.emergency_contact || 'None'}
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="TenantsModule.viewPerson(${p.id})" title="View Profile">
                <i class="ph-bold ph-eye"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="TenantsModule.openEditModal(${p.id})" title="Edit Details">
                <i class="ph-bold ph-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="TenantsModule.confirmDelete(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Delete">
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-danger); padding: 20px;">Error: ${err.message}</td></tr>`;
    }
  },

  openAddModal(defaultType = "tenant") {
    const form = document.getElementById("person-form");
    if (!form) return;
    form.reset();
    document.getElementById("person-id-field").value = "";
    document.getElementById("person-type-select").value = defaultType;
    document.getElementById("person-modal-title").innerHTML = `<i class="ph-bold ph-user-plus"></i> Add New ${defaultType === 'tenant' ? 'Tenant' : 'Customer'}`;
    App.openModal("person-modal");
  },

  async openEditModal(id) {
    try {
      const res = await API.people.getById(id);
      const p = res.person;
      document.getElementById("person-id-field").value = p.id;
      document.getElementById("person-type-select").value = p.type;
      document.getElementById("person-name").value = p.name || "";
      document.getElementById("person-email").value = p.email || "";
      document.getElementById("person-phone").value = p.phone || "";
      document.getElementById("person-id-type").value = p.id_proof_type || "Passport";
      document.getElementById("person-id-number").value = p.id_proof_number || "";
      document.getElementById("person-address").value = p.address || "";
      document.getElementById("person-occupation").value = p.occupation || "";
      document.getElementById("person-emergency").value = p.emergency_contact || "";
      document.getElementById("person-status").value = p.status || "active";
      document.getElementById("person-notes").value = p.notes || "";

      document.getElementById("person-modal-title").innerHTML = `<i class="ph-bold ph-pencil"></i> Edit Details: ${p.name}`;
      App.openModal("person-modal");
    } catch (err) {
      App.showToast("Failed to fetch person details: " + err.message, "error");
    }
  },

  async handleSavePerson(e) {
    e.preventDefault();
    const id = document.getElementById("person-id-field").value;
    const payload = {
      type: document.getElementById("person-type-select").value,
      name: document.getElementById("person-name").value.trim(),
      email: document.getElementById("person-email").value.trim(),
      phone: document.getElementById("person-phone").value.trim(),
      id_proof_type: document.getElementById("person-id-type").value,
      id_proof_number: document.getElementById("person-id-number").value.trim(),
      address: document.getElementById("person-address").value.trim(),
      occupation: document.getElementById("person-occupation").value.trim(),
      emergency_contact: document.getElementById("person-emergency").value.trim(),
      status: document.getElementById("person-status").value,
      notes: document.getElementById("person-notes").value.trim()
    };

    try {
      if (id) {
        await API.people.update(id, payload);
        App.showToast("Record updated successfully!", "success");
      } else {
        await API.people.create(payload);
        App.showToast(`${payload.type === 'tenant' ? 'Tenant' : 'Customer'} created successfully!`, "success");
      }
      App.closeModal("person-modal");
      this.loadPeople();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async viewPerson(id) {
    try {
      const res = await API.people.getById(id);
      const p = res.person;
      const modalBody = document.getElementById("person-details-body");
      if (!modalBody) return;

      modalBody.innerHTML = `
        <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: #fff; font-weight: 700;">
            ${p.name.charAt(0)}
          </div>
          <div>
            <h3 style="font-size: 1.3rem; font-weight: 700;">${p.name}</h3>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <span class="badge ${p.type === 'tenant' ? 'badge-active' : 'badge-completed'}">${p.type.toUpperCase()}</span>
              <span class="badge badge-active">${p.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="background: rgba(0,0,0,0.15); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Contact Number</span>
            <strong>${p.phone}</strong>
          </div>
          <div style="background: rgba(0,0,0,0.15); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Email Address</span>
            <strong>${p.email || 'N/A'}</strong>
          </div>
          <div style="background: rgba(0,0,0,0.15); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">KYC Verification (${p.id_proof_type || 'ID'})</span>
            <strong style="color: var(--secondary);">${p.id_proof_number || 'Pending'}</strong>
          </div>
          <div style="background: rgba(0,0,0,0.15); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Emergency Contact</span>
            <strong>${p.emergency_contact || 'None'}</strong>
          </div>
        </div>

        ${p.rent_agreements && p.rent_agreements.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;"><i class="ph-bold ph-file-text"></i> Active Lease Agreements</h4>
            ${p.rent_agreements.map(ra => `
              <div style="padding: 12px; background: rgba(79, 70, 229, 0.1); border-left: 3px solid var(--primary); border-radius: var(--radius-sm); margin-bottom: 6px;">
                <strong>${ra.property_title}</strong> - Agreement #${ra.agreement_no}
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Rent: $${ra.monthly_rent}/mo | Lease: ${ra.start_date} to ${ra.end_date}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${p.payments && p.payments.length > 0 ? `
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;"><i class="ph-bold ph-receipt"></i> Recent Transaction Ledger</h4>
            <div style="max-height: 180px; overflow-y: auto;">
              ${p.payments.slice(0, 4).map(py => `
                <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
                  <span>Receipt #${py.receipt_no} (${py.payment_type})</span>
                  <strong>$${Number(py.amount).toLocaleString()} <span class="badge badge-${py.payment_status}">${py.payment_status}</span></strong>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;

      App.openModal("person-details-modal");
    } catch (err) {
      App.showToast("Failed to fetch profile: " + err.message, "error");
    }
  },

  confirmDelete(id, name) {
    if (confirm(`Are you sure you want to delete profile '${name}'? This will remove associated records.`)) {
      this.deletePerson(id);
    }
  },

  async deletePerson(id) {
    try {
      await API.people.delete(id);
      App.showToast("Record deleted successfully", "success");
      this.loadPeople();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }
};
