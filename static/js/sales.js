/**
 * Module 4 & Module 5: House Sale & Plot Sale Management Modules
 * Handles Property & Land Sales, Buyer records, Sale Agreements, and Purchase Contracts
 */

const SalesModule = {
  activeTab: "house_sale",

  init() {
    this.bindEvents();
    this.loadHouseSales();
    this.loadPlotSales();
  },

  bindEvents() {
    // Switch between House Sales and Plot Sales subtabs
    const tabs = document.querySelectorAll(".sales-tab-btn");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeTab = tab.dataset.tab;

        const houseView = document.getElementById("house-sales-view");
        const plotView = document.getElementById("plot-sales-view");

        if (this.activeTab === "house_sale") {
          if (houseView) houseView.style.display = "block";
          if (plotView) plotView.style.display = "none";
          this.loadHouseSales();
        } else {
          if (houseView) houseView.style.display = "none";
          if (plotView) plotView.style.display = "block";
          this.loadPlotSales();
        }
      });
    });

    // Create House Sale Agreement Button
    const newHouseSaleBtn = document.getElementById("btn-new-house-sale");
    if (newHouseSaleBtn) {
      newHouseSaleBtn.addEventListener("click", () => this.openHouseSaleModal());
    }

    // Create Plot Sale Agreement Button
    const newPlotSaleBtn = document.getElementById("btn-new-plot-sale");
    if (newPlotSaleBtn) {
      newPlotSaleBtn.addEventListener("click", () => this.openPlotSaleModal());
    }

    // House sale form submit
    const houseSaleForm = document.getElementById("house-sale-form");
    if (houseSaleForm) {
      houseSaleForm.addEventListener("submit", (e) => this.handleHouseSaleSubmit(e));
    }

    // Plot sale form submit
    const plotSaleForm = document.getElementById("plot-sale-form");
    if (plotSaleForm) {
      plotSaleForm.addEventListener("submit", (e) => this.handlePlotSaleSubmit(e));
    }
  },

  async loadHouseSales() {
    const tbody = document.getElementById("house-sales-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px;"><i class="ph-bold ph-spinner" style="font-size: 1.5rem; animation: spin 1s infinite linear;"></i> Loading house sales...</td></tr>`;

    try {
      const res = await API.houseSales.getAll();
      const list = res.sales || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 35px; color: var(--text-muted);">No house sale agreements recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(s => `
        <tr>
          <td><code style="color: var(--secondary); font-weight: 700;">${s.agreement_no}</code></td>
          <td>
            <strong>${s.property_title}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.property_address}</div>
          </td>
          <td>
            <strong>${s.buyer_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.buyer_phone}</div>
          </td>
          <td>${s.sale_date}</td>
          <td>
            <strong style="color: var(--accent-success);">$${Number(s.agreed_price).toLocaleString()}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Deposit: $${Number(s.booking_amount).toLocaleString()}</div>
          </td>
          <td>
            <span class="badge ${s.payment_status === 'fully_paid' ? 'badge-paid' : 'badge-pending'}">
              ${s.payment_status.replace('_', ' ').toUpperCase()}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="SalesModule.viewSaleDoc('house', ${s.id})" title="View Contract">
              <i class="ph-bold ph-file-text"></i> Contract
            </button>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-danger);">${err.message}</td></tr>`;
    }
  },

  async loadPlotSales() {
    const tbody = document.getElementById("plot-sales-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px;"><i class="ph-bold ph-spinner" style="font-size: 1.5rem; animation: spin 1s infinite linear;"></i> Loading plot sales...</td></tr>`;

    try {
      const res = await API.plotSales.getAll();
      const list = res.plot_sales || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 35px; color: var(--text-muted);">No plot sale agreements recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(s => `
        <tr>
          <td><code style="color: var(--secondary); font-weight: 700;">${s.agreement_no}</code></td>
          <td>
            <strong>${s.property_title}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.property_address}</div>
          </td>
          <td>
            <strong>Plot #${s.plot_no}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${s.survey_no || 'Survey N/A'} (${s.area_sqft || 0} sqft)</div>
          </td>
          <td>
            <strong>${s.buyer_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${s.buyer_phone}</div>
          </td>
          <td>
            <strong style="color: var(--accent-success);">$${Number(s.agreed_price).toLocaleString()}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Booking: $${Number(s.booking_amount).toLocaleString()}</div>
          </td>
          <td>
            <span class="badge ${s.status === 'completed' ? 'badge-paid' : 'badge-pending'}">
              ${s.status.toUpperCase()}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="SalesModule.viewSaleDoc('plot', ${s.id})" title="View Deed Agreement">
              <i class="ph-bold ph-file-text"></i> Contract
            </button>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-danger);">${err.message}</td></tr>`;
    }
  },

  async openHouseSaleModal() {
    const form = document.getElementById("house-sale-form");
    if (form) form.reset();

    const propSelect = document.getElementById("hs-property-select");
    const buyerSelect = document.getElementById("hs-buyer-select");

    try {
      const [propsRes, peopleRes] = await Promise.all([
        API.properties.getAll({ type: "house_sale", status: "available" }),
        API.people.getAll({ type: "customer" })
      ]);

      if (propSelect) {
        propSelect.innerHTML = `<option value="">Select Available House for Sale</option>` +
          propsRes.properties.map(p => `<option value="${p.id}" data-price="${p.price}" data-deposit="${p.deposit}">${p.title} - $${Number(p.price).toLocaleString()}</option>`).join("");
      }

      if (buyerSelect) {
        buyerSelect.innerHTML = `<option value="">Select Buyer / Customer</option>` +
          peopleRes.people.map(b => `<option value="${b.id}">${b.name} (${b.phone})</option>`).join("");
      }

      document.getElementById("hs-date").value = new Date().toISOString().split("T")[0];
      App.openModal("house-sale-modal");
    } catch (err) {
      App.showToast("Failed to initialize sale form: " + err.message, "error");
    }
  },

  async openPlotSaleModal() {
    const form = document.getElementById("plot-sale-form");
    if (form) form.reset();

    const propSelect = document.getElementById("ps-property-select");
    const buyerSelect = document.getElementById("ps-buyer-select");

    try {
      const [propsRes, peopleRes] = await Promise.all([
        API.properties.getAll({ type: "plot_sale", status: "available" }),
        API.people.getAll({ type: "customer" })
      ]);

      if (propSelect) {
        propSelect.innerHTML = `<option value="">Select Available Plot</option>` +
          propsRes.properties.map(p => `<option value="${p.id}" data-price="${p.price}" data-deposit="${p.deposit}" data-plot="${p.plot_no}" data-survey="${p.survey_no}">${p.title} (${p.plot_no || 'Plot'}) - $${Number(p.price).toLocaleString()}</option>`).join("");
      }

      if (buyerSelect) {
        buyerSelect.innerHTML = `<option value="">Select Buyer / Customer</option>` +
          peopleRes.people.map(b => `<option value="${b.id}">${b.name} (${b.phone})</option>`).join("");
      }

      document.getElementById("ps-date").value = new Date().toISOString().split("T")[0];
      App.openModal("plot-sale-modal");
    } catch (err) {
      App.showToast("Failed to initialize plot sale form: " + err.message, "error");
    }
  },

  async handleHouseSaleSubmit(e) {
    e.preventDefault();
    const payload = {
      property_id: parseInt(document.getElementById("hs-property-select").value),
      buyer_id: parseInt(document.getElementById("hs-buyer-select").value),
      sale_date: document.getElementById("hs-date").value,
      agreed_price: parseFloat(document.getElementById("hs-price").value) || 0,
      booking_amount: parseFloat(document.getElementById("hs-deposit").value) || 0,
      payment_status: document.getElementById("hs-payment-status").value,
      terms: document.getElementById("hs-terms").value.trim()
    };

    try {
      const res = await API.houseSales.createAgreement(payload);
      App.showToast(res.message, "success");
      App.closeModal("house-sale-modal");
      this.loadHouseSales();
      PropertiesModule.loadProperties();
      PaymentsModule.loadPayments();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async handlePlotSaleSubmit(e) {
    e.preventDefault();
    const payload = {
      property_id: parseInt(document.getElementById("ps-property-select").value),
      buyer_id: parseInt(document.getElementById("ps-buyer-select").value),
      plot_no: document.getElementById("ps-plot-no").value.trim(),
      survey_no: document.getElementById("ps-survey-no").value.trim(),
      sale_date: document.getElementById("ps-date").value,
      agreed_price: parseFloat(document.getElementById("ps-price").value) || 0,
      booking_amount: parseFloat(document.getElementById("ps-deposit").value) || 0,
      payment_status: document.getElementById("ps-payment-status").value,
      terms: document.getElementById("ps-terms").value.trim()
    };

    try {
      const res = await API.plotSales.createAgreement(payload);
      App.showToast(res.message, "success");
      App.closeModal("plot-sale-modal");
      this.loadPlotSales();
      PropertiesModule.loadProperties();
      PaymentsModule.loadPayments();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async viewSaleDoc(type, id) {
    try {
      const res = type === "house" ? await API.houseSales.getAll() : await API.plotSales.getAll();
      const list = type === "house" ? res.sales : res.plot_sales;
      const s = list.find(item => item.id === id);
      if (!s) return;

      const modalBody = document.getElementById("generic-modal-body");
      document.getElementById("generic-modal-title").innerHTML = `<i class="ph-bold ph-certificate"></i> Official Sale Deed #${s.agreement_no}`;

      modalBody.innerHTML = `
        <div style="background: #ffffff; color: #0f172a; padding: 28px; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.6;">
          <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="font-size: 1.3rem; font-weight: 800; text-transform: uppercase;">Real Estate Sale & Purchase Deed</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Contract Ref: ${s.agreement_no} &bull; Date: ${s.sale_date}</p>
          </div>
          <p><strong>Property Conveyed:</strong> ${s.property_title} (${s.property_address})</p>
          ${type === 'plot' ? `<p><strong>Land Particulars:</strong> Plot Number ${s.plot_no}, Survey Reference ${s.survey_no || 'Approved Registry'}</p>` : ''}
          <p><strong>Purchaser / Grantee:</strong> ${s.buyer_name} (Contact: ${s.buyer_phone}, ${s.buyer_email || ''})</p>
          <p><strong>Total Consideration Price:</strong> $${Number(s.agreed_price).toLocaleString()} USD</p>
          <p><strong>Advance Consideration Received:</strong> $${Number(s.booking_amount).toLocaleString()} USD</p>
          <p><strong>Current Settlement Status:</strong> <span style="font-weight: 700; color: #059669; text-transform: uppercase;">${s.payment_status || s.status}</span></p>

          <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
            <strong>Title Covenant & Declarations:</strong>
            <p style="font-size: 0.82rem; margin-top: 4px; color: #334155;">${s.terms || 'The seller warrants good and marketable title free of encumbrances with rights of possession.'}</p>
          </div>

          <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b;">
            <div>_______________________<br/>Seller / Developer Rep</div>
            <div style="text-align: right;">_______________________<br/>Buyer / Purchaser Signature</div>
          </div>
        </div>
      `;

      App.openModal("generic-modal");
    } catch (err) {
      App.showToast("Failed to view contract: " + err.message, "error");
    }
  }
};
