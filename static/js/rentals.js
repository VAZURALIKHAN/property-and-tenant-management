/**
 * Module 3: House Rent Management Module
 * Handles Rental houses, Tenant allocations, Rent agreements, and Vacancy tracking
 */

const RentalsModule = {
  init() {
    this.bindEvents();
    this.loadRentals();
    this.loadAgreements();
  },

  bindEvents() {
    const allocateBtn = document.getElementById("btn-allocate-tenant");
    if (allocateBtn) {
      allocateBtn.addEventListener("click", () => this.openAllocateModal());
    }

    const allocateForm = document.getElementById("allocate-form");
    if (allocateForm) {
      allocateForm.addEventListener("submit", (e) => this.handleAllocateSubmit(e));
    }

    const rentalFilter = document.getElementById("rental-vacancy-filter");
    if (rentalFilter) {
      rentalFilter.addEventListener("change", () => this.loadRentals());
    }
  },

  async loadRentals() {
    const container = document.getElementById("rentals-list");
    if (!container) return;

    try {
      const res = await API.rentals.getAll();
      const filter = document.getElementById("rental-vacancy-filter")?.value || "all";
      let list = res.rentals || [];

      if (filter !== "all") {
        list = list.filter(r => r.status === filter);
      }

      if (list.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">No rental properties match this status filter.</div>`;
        return;
      }

      container.innerHTML = list.map(r => `
        <div class="content-card" style="margin-bottom: 16px; border-left: 4px solid ${r.status === 'rented' ? 'var(--primary)' : 'var(--accent-success)'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; gap: 16px; align-items: center;">
              <img src="${r.image_url || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400'}" style="width: 80px; height: 80px; border-radius: var(--radius-sm); object-fit: cover;" />
              <div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <h4 style="font-size: 1.1rem; font-weight: 700;">${r.title}</h4>
                  <span class="badge status-${r.status}">${r.status.toUpperCase()}</span>
                </div>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;"><i class="ph-bold ph-map-pin"></i> ${r.address}, ${r.city}</p>
                <div style="font-size: 0.82rem; margin-top: 6px;">
                  <strong>$${Number(r.price).toLocaleString()}</strong>/month &bull; Deposit: $${Number(r.deposit || 0).toLocaleString()} &bull; ${r.bedrooms} Bed, ${r.bathrooms} Bath (${r.area_sqft} sqft)
                </div>
              </div>
            </div>

            <div style="text-align: right; min-width: 200px;">
              ${r.status === 'rented' ? `
                <div style="background: rgba(79, 70, 229, 0.1); padding: 8px 12px; border-radius: var(--radius-sm); text-align: left; margin-bottom: 8px;">
                  <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Allocated Tenant</span>
                  <div style="font-weight: 700; font-size: 0.88rem;">${r.tenant_name || 'Assigned'}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${r.tenant_phone || ''}</div>
                  <div style="font-size: 0.75rem; color: var(--secondary); margin-top: 2px;">#${r.agreement_no || ''}</div>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="RentalsModule.terminateAgreement(${r.agreement_id})">
                  <i class="ph-bold ph-x-circle"></i> Vacate / Terminate
                </button>
              ` : `
                <button class="btn btn-primary btn-sm" onclick="RentalsModule.openAllocateModalFor(${r.id}, '${r.title.replace(/'/g, "\\'")}', ${r.price}, ${r.deposit || 0})">
                  <i class="ph-bold ph-user-plus"></i> Allocate Tenant
                </button>
              `}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div style="color: var(--accent-danger); text-align: center; padding: 20px;">Failed to load rentals: ${err.message}</div>`;
    }
  },

  async loadAgreements() {
    const tbody = document.getElementById("agreements-table-body");
    if (!tbody) return;

    try {
      const res = await API.rentals.getAgreements();
      const list = res.agreements || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No rental agreements recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(a => `
        <tr>
          <td><code style="color: var(--secondary); font-weight: 700;">${a.agreement_no}</code></td>
          <td><strong>${a.property_title}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${a.property_address}</div></td>
          <td><strong>${a.tenant_name}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${a.tenant_phone}</div></td>
          <td>${a.start_date} <span style="color: var(--text-dim)">to</span> ${a.end_date}</td>
          <td><strong>$${Number(a.monthly_rent).toLocaleString()}</strong><div style="font-size: 0.72rem; color: var(--text-dim);">Due: ${a.due_day}th</div></td>
          <td><span class="badge ${a.status === 'active' ? 'badge-active' : 'badge-low'}">${a.status.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="RentalsModule.viewAgreementDoc(${a.id})" title="View Agreement Details">
              <i class="ph-bold ph-file-text"></i> View Terms
            </button>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-danger);">${err.message}</td></tr>`;
    }
  },

  async openAllocateModal() {
    const form = document.getElementById("allocate-form");
    if (form) form.reset();

    // Populate available rental properties dropdown
    const propSelect = document.getElementById("alloc-property-select");
    const tenantSelect = document.getElementById("alloc-tenant-select");

    try {
      const [propsRes, peopleRes] = await Promise.all([
        API.properties.getAll({ type: "house_rent", status: "available" }),
        API.people.getAll({ type: "tenant" })
      ]);

      if (propSelect) {
        propSelect.innerHTML = `<option value="">Select Available Rental House</option>` +
          propsRes.properties.map(p => `<option value="${p.id}" data-price="${p.price}" data-deposit="${p.deposit}">${p.title} - $${p.price}/mo</option>`).join("");
      }

      if (tenantSelect) {
        tenantSelect.innerHTML = `<option value="">Select Tenant</option>` +
          peopleRes.people.map(t => `<option value="${t.id}">${t.name} (${t.phone})</option>`).join("");
      }

      // Default dates: today to +1 year
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);

      document.getElementById("alloc-start-date").value = today.toISOString().split("T")[0];
      document.getElementById("alloc-end-date").value = nextYear.toISOString().split("T")[0];

      App.openModal("allocate-modal");
    } catch (err) {
      App.showToast("Failed to load options: " + err.message, "error");
    }
  },

  openAllocateModalFor(propertyId, title, price, deposit) {
    this.openAllocateModal().then(() => {
      const propSelect = document.getElementById("alloc-property-select");
      if (propSelect) {
        propSelect.value = propertyId;
      }
      document.getElementById("alloc-rent").value = price;
      document.getElementById("alloc-deposit").value = deposit;
    });
  },

  async handleAllocateSubmit(e) {
    e.preventDefault();
    const payload = {
      property_id: parseInt(document.getElementById("alloc-property-select").value),
      tenant_id: parseInt(document.getElementById("alloc-tenant-select").value),
      start_date: document.getElementById("alloc-start-date").value,
      end_date: document.getElementById("alloc-end-date").value,
      monthly_rent: parseFloat(document.getElementById("alloc-rent").value) || 0,
      security_deposit: parseFloat(document.getElementById("alloc-deposit").value) || 0,
      due_day: parseInt(document.getElementById("alloc-due-day").value) || 5,
      terms: document.getElementById("alloc-terms").value.trim()
    };

    try {
      const res = await API.rentals.allocate(payload);
      App.showToast(res.message, "success");
      App.closeModal("allocate-modal");
      this.loadRentals();
      this.loadAgreements();
      PropertiesModule.loadProperties();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async terminateAgreement(id) {
    if (confirm("Are you sure you want to terminate this lease agreement? The property will be marked as available.")) {
      try {
        await API.rentals.terminate(id);
        App.showToast("Lease terminated. Property is now vacant.", "success");
        this.loadRentals();
        this.loadAgreements();
        PropertiesModule.loadProperties();
        App.refreshDashboardStats();
      } catch (err) {
        App.showToast(err.message, "error");
      }
    }
  },

  async viewAgreementDoc(id) {
    try {
      const res = await API.rentals.getAgreements();
      const agr = (res.agreements || []).find(a => a.id === id);
      if (!agr) return;

      const modalBody = document.getElementById("generic-modal-body");
      document.getElementById("generic-modal-title").innerHTML = `<i class="ph-bold ph-certificate"></i> Lease Agreement #${agr.agreement_no}`;

      modalBody.innerHTML = `
        <div style="background: #ffffff; color: #0f172a; padding: 28px; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="font-size: 1.3rem; font-weight: 800; text-transform: uppercase;">Residential Tenancy Agreement</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Official Reference: ${agr.agreement_no}</p>
          </div>
          <p><strong>Property:</strong> ${agr.property_title} (${agr.property_address})</p>
          <p><strong>Tenant:</strong> ${agr.tenant_name} (Phone: ${agr.tenant_phone}, Email: ${agr.tenant_email})</p>
          <p><strong>Tenancy Period:</strong> From <u>${agr.start_date}</u> to <u>${agr.end_date}</u></p>
          <p><strong>Monthly Rent:</strong> $${Number(agr.monthly_rent).toLocaleString()} USD (Payable by the ${agr.due_day}th of each month)</p>
          <p><strong>Security Deposit:</strong> $${Number(agr.security_deposit).toLocaleString()} USD (Held in compliance escrow)</p>
          <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
            <strong>Special Terms & Conditions:</strong>
            <p style="font-size: 0.82rem; margin-top: 4px; color: #334155;">${agr.terms || 'Standard residential upkeep obligations apply.'}</p>
          </div>
          <div style="margin-top: 32px; display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b;">
            <div>_______________________<br/>Authorized Landlord / Agent</div>
            <div style="text-align: right;">_______________________<br/>Tenant Signature</div>
          </div>
        </div>
      `;

      App.openModal("generic-modal");
    } catch (err) {
      App.showToast("Failed to view agreement: " + err.message, "error");
    }
  }
};
