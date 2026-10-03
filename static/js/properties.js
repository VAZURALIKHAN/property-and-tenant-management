/**
 * Module 1: Property Management Module
 * Handles Property CRUD, Search, Filter & Detailed Property View
 */

const PropertiesModule = {
  currentFilter: {
    type: "all",
    status: "all",
    search: ""
  },

  init() {
    this.bindEvents();
    this.loadProperties();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById("property-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.currentFilter.search = e.target.value;
        this.loadProperties();
      });
    }

    // Type filter
    const typeFilter = document.getElementById("property-type-filter");
    if (typeFilter) {
      typeFilter.addEventListener("change", (e) => {
        this.currentFilter.type = e.target.value;
        this.loadProperties();
      });
    }

    // Status filter
    const statusFilter = document.getElementById("property-status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.currentFilter.status = e.target.value;
        this.loadProperties();
      });
    }

    // Add property button
    const addBtn = document.getElementById("btn-add-property");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.openAddModal());
    }

    // Save property form submit
    const propForm = document.getElementById("property-form");
    if (propForm) {
      propForm.addEventListener("submit", (e) => this.handleSaveProperty(e));
    }
  },

  async loadProperties() {
    const grid = document.getElementById("properties-grid");
    if (!grid) return;

    grid.innerHTML = `<div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);"><i class="ph-bold ph-spinner" style="font-size: 2rem; animation: spin 1s infinite linear;"></i><p style="margin-top: 8px;">Loading properties...</p></div>`;

    try {
      const res = await API.properties.getAll(this.currentFilter);
      if (!res.properties || res.properties.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="ph-bold ph-buildings" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 12px;"></i><h4 style="font-size: 1.1rem; color: var(--text-main);">No properties found</h4><p style="color: var(--text-muted); font-size: 0.88rem;">Try adjusting your search criteria or add a new property.</p></div>`;
        return;
      }

      grid.innerHTML = res.properties.map(p => this.renderPropertyCard(p)).join("");
    } catch (err) {
      grid.innerHTML = `<div class="error-state" style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--accent-danger);">Failed to load properties: ${err.message}</div>`;
    }
  },

  renderPropertyCard(p) {
    const formattedPrice = Number(p.price).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const isRental = p.property_type === "house_rent";
    const isPlot = p.property_type === "plot_sale";
    const typeLabel = isRental ? "Rental House" : (isPlot ? "Land Plot" : "House For Sale");

    return `
      <div class="property-card" data-id="${p.id}">
        <div class="property-thumbnail">
          <img src="${p.image_url || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800'}" alt="${p.title}" loading="lazy" />
          <span class="property-type-tag">${typeLabel}</span>
          <span class="property-status-tag status-${p.status}">${p.status}</span>
        </div>
        <div class="property-body">
          <div class="property-price">
            ${formattedPrice}
            ${isRental ? '<small>/month</small>' : ''}
          </div>
          <h3 class="property-title">${p.title}</h3>
          <div class="property-location">
            <i class="ph-bold ph-map-pin"></i>
            <span>${p.address}, ${p.city}</span>
          </div>
          <div class="property-specs">
            ${!isPlot ? `
              <span><i class="ph-bold ph-bed"></i> ${p.bedrooms || 0} Beds</span>
              <span><i class="ph-bold ph-bathtub"></i> ${p.bathrooms || 0} Baths</span>
            ` : `
              <span><i class="ph-bold ph-hash"></i> Plot: ${p.plot_no || 'N/A'}</span>
            `}
            <span><i class="ph-bold ph-arrows-out"></i> ${p.area_sqft || 0} sqft</span>
          </div>
          <div class="property-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="PropertiesModule.viewProperty(${p.id})">
              <i class="ph-bold ph-eye"></i> View Details
            </button>
            <button class="btn btn-secondary btn-sm" onclick="PropertiesModule.openEditModal(${p.id})">
              <i class="ph-bold ph-pencil"></i> Edit
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="PropertiesModule.confirmDelete(${p.id}, '${p.title.replace(/'/g, "\\'")}')">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openAddModal() {
    const form = document.getElementById("property-form");
    if (!form) return;
    form.reset();
    document.getElementById("property-id-field").value = "";
    document.getElementById("property-modal-title").innerHTML = `<i class="ph-bold ph-plus-circle"></i> Add New Property`;
    this.togglePlotFields("house_rent");
    App.openModal("property-modal");
  },

  async openEditModal(id) {
    try {
      const res = await API.properties.getById(id);
      const p = res.property;
      document.getElementById("property-id-field").value = p.id;
      document.getElementById("prop-title").value = p.title || "";
      document.getElementById("prop-type").value = p.property_type || "house_rent";
      document.getElementById("prop-status").value = p.status || "available";
      document.getElementById("prop-price").value = p.price || "";
      document.getElementById("prop-deposit").value = p.deposit || "";
      document.getElementById("prop-area").value = p.area_sqft || "";
      document.getElementById("prop-beds").value = p.bedrooms || 0;
      document.getElementById("prop-baths").value = p.bathrooms || 0;
      document.getElementById("prop-plot-no").value = p.plot_no || "";
      document.getElementById("prop-survey-no").value = p.survey_no || "";
      document.getElementById("prop-address").value = p.address || "";
      document.getElementById("prop-city").value = p.city || "";
      document.getElementById("prop-state").value = p.state || "";
      document.getElementById("prop-zip").value = p.zip_code || "";
      document.getElementById("prop-image").value = p.image_url || "";
      document.getElementById("prop-features").value = p.features || "";
      document.getElementById("prop-desc").value = p.description || "";

      this.togglePlotFields(p.property_type);
      document.getElementById("property-modal-title").innerHTML = `<i class="ph-bold ph-pencil-simple"></i> Edit Property Details`;
      App.openModal("property-modal");
    } catch (err) {
      App.showToast("Failed to fetch property details: " + err.message, "error");
    }
  },

  togglePlotFields(type) {
    const bedsGroup = document.getElementById("group-prop-beds");
    const bathsGroup = document.getElementById("group-prop-baths");
    const plotGroup = document.getElementById("group-prop-plot");
    const surveyGroup = document.getElementById("group-prop-survey");

    if (type === "plot_sale") {
      if (bedsGroup) bedsGroup.style.display = "none";
      if (bathsGroup) bathsGroup.style.display = "none";
      if (plotGroup) plotGroup.style.display = "block";
      if (surveyGroup) surveyGroup.style.display = "block";
    } else {
      if (bedsGroup) bedsGroup.style.display = "block";
      if (bathsGroup) bathsGroup.style.display = "block";
      if (plotGroup) plotGroup.style.display = "none";
      if (surveyGroup) surveyGroup.style.display = "none";
    }
  },

  async handleSaveProperty(e) {
    e.preventDefault();
    const id = document.getElementById("property-id-field").value;
    const propertyType = document.getElementById("prop-type").value;

    const payload = {
      title: document.getElementById("prop-title").value.trim(),
      property_type: propertyType,
      status: document.getElementById("prop-status").value,
      price: parseFloat(document.getElementById("prop-price").value) || 0,
      deposit: parseFloat(document.getElementById("prop-deposit").value) || 0,
      area_sqft: parseFloat(document.getElementById("prop-area").value) || 0,
      bedrooms: parseInt(document.getElementById("prop-beds").value) || 0,
      bathrooms: parseInt(document.getElementById("prop-baths").value) || 0,
      plot_no: document.getElementById("prop-plot-no").value.trim(),
      survey_no: document.getElementById("prop-survey-no").value.trim(),
      address: document.getElementById("prop-address").value.trim(),
      city: document.getElementById("prop-city").value.trim(),
      state: document.getElementById("prop-state").value.trim(),
      zip_code: document.getElementById("prop-zip").value.trim(),
      image_url: document.getElementById("prop-image").value.trim(),
      features: document.getElementById("prop-features").value.trim(),
      description: document.getElementById("prop-desc").value.trim()
    };

    try {
      if (id) {
        await API.properties.update(id, payload);
        App.showToast("Property updated successfully!", "success");
      } else {
        await API.properties.create(payload);
        App.showToast("New property listed successfully!", "success");
      }
      App.closeModal("property-modal");
      this.loadProperties();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async viewProperty(id) {
    try {
      const res = await API.properties.getById(id);
      const p = res.property;
      const modalBody = document.getElementById("property-details-body");
      if (!modalBody) return;

      const formattedPrice = Number(p.price).toLocaleString("en-US", { style: "currency", currency: "USD" });
      const formattedDeposit = Number(p.deposit || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

      modalBody.innerHTML = `
        <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px;">
          <div style="flex: 1; min-width: 280px; height: 260px; border-radius: var(--radius-md); overflow: hidden;">
            <img src="${p.image_url || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800'}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1.2; min-width: 280px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <span class="badge" style="background: rgba(79, 70, 229, 0.2); color: #818cf8;">${p.property_type.replace('_', ' ').toUpperCase()}</span>
              <span class="badge status-${p.status}">${p.status.toUpperCase()}</span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 8px;">${p.title}</h2>
            <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 14px;"><i class="ph-bold ph-map-pin"></i> ${p.address}, ${p.city}, ${p.state || ''} ${p.zip_code || ''}</p>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--secondary); margin-bottom: 16px;">
              ${formattedPrice} <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">${p.property_type === 'house_rent' ? '/ month' : 'total'}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div><span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Area</span><strong>${p.area_sqft} sqft</strong></div>
              <div><span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Deposit</span><strong>${formattedDeposit}</strong></div>
              <div><span style="font-size: 0.75rem; color: var(--text-dim); display: block;">Beds / Baths</span><strong>${p.bedrooms || 0} / ${p.bathrooms || 0}</strong></div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 6px; color: var(--text-main);">Description</h4>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">${p.description || 'No description provided.'}</p>
        </div>

        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Features & Amenities</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${(p.features || 'Standard amenities').split(',').map(f => `<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-main);"><i class="ph-bold ph-check" style="color: var(--accent-success)"></i> ${f.trim()}</span>`).join('')}
          </div>
        </div>

        ${p.active_agreement ? `
          <div style="padding: 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); margin-bottom: 20px;">
            <h4 style="font-size: 0.95rem; color: var(--accent-success); font-weight: 700; margin-bottom: 6px;"><i class="ph-bold ph-user-check"></i> Current Tenant Allocation</h4>
            <p style="font-size: 0.88rem;"><strong>Tenant:</strong> ${p.active_agreement.tenant_name} (${p.active_agreement.tenant_phone})</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">Agreement #${p.active_agreement.agreement_no} | Period: ${p.active_agreement.start_date} to ${p.active_agreement.end_date}</p>
          </div>
        ` : ''}

        ${p.maintenance_records && p.maintenance_records.length > 0 ? `
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 10px; color: var(--text-main);">Maintenance History (${p.maintenance_records.length})</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${p.maintenance_records.slice(0, 3).map(m => `
                <div style="padding: 10px 14px; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm); border-left: 3px solid var(--accent-info); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="font-size: 0.85rem;">${m.title}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${m.category} &bull; ${m.created_at}</div>
                  </div>
                  <span class="badge badge-${m.status}">${m.status}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;

      App.openModal("property-details-modal");
    } catch (err) {
      App.showToast("Failed to fetch property details: " + err.message, "error");
    }
  },

  confirmDelete(id, title) {
    if (confirm(`Are you sure you want to delete property '${title}'? This action cannot be undone.`)) {
      this.deleteProperty(id);
    }
  },

  async deleteProperty(id) {
    try {
      await API.properties.delete(id);
      App.showToast("Property deleted successfully", "success");
      this.loadProperties();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }
};
