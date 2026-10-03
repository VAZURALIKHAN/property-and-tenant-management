/**
 * Module 8: Report & Analytics Module
 * Renders 7 dedicated reports, Chart.js visual analytics, and CSV exports
 */

const ReportsModule = {
  activeReport: "property",
  charts: {},

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const reportTabs = document.querySelectorAll(".report-nav-btn");
    reportTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        reportTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeReport = tab.dataset.report;
        this.renderActiveReport();
      });
    });

    const exportBtn = document.getElementById("btn-export-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        let type = "properties";
        if (this.activeReport === "tenant") type = "tenants";
        else if (this.activeReport === "rent" || this.activeReport === "payment") type = "payments";
        else if (this.activeReport === "maintenance") type = "maintenance";
        window.location.href = `/api/reports/export/${type}`;
      });
    }

    const printBtn = document.getElementById("btn-print-report");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  },

  async loadReports() {
    try {
      const res = await API.reports.getData();
      this.reportData = res.reports;
      this.renderActiveReport();
    } catch (err) {
      console.error("Failed to load reports:", err);
    }
  },

  renderActiveReport() {
    if (!this.reportData) {
      this.loadReports();
      return;
    }

    const container = document.getElementById("report-view-container");
    if (!container) return;

    // Destroy prior charts to prevent canvas re-use errors
    Object.values(this.charts).forEach(c => c && c.destroy && c.destroy());
    this.charts = {};

    switch (this.activeReport) {
      case "property":
        this.renderPropertyReport(container);
        break;
      case "tenant":
        this.renderTenantReport(container);
        break;
      case "rent":
        this.renderRentReport(container);
        break;
      case "house_sale":
        this.renderHouseSaleReport(container);
        break;
      case "plot_sale":
        this.renderPlotSaleReport(container);
        break;
      case "payment":
        this.renderPaymentReport(container);
        break;
      case "maintenance":
        this.renderMaintenanceReport(container);
        break;
    }
  },

  // 1. Property Report
  renderPropertyReport(container) {
    const list = this.reportData.property_summary || [];
    const totalCount = list.reduce((acc, curr) => acc + curr.count, 0);
    const totalVal = list.reduce((acc, curr) => acc + (curr.total_val || 0), 0);

    container.innerHTML = `
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-icon blue"><i class="ph-bold ph-buildings"></i></div>
          <div class="kpi-info"><span>Total Portfolio Units</span><h3>${totalCount}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="ph-bold ph-currency-circle-dollar"></i></div>
          <div class="kpi-info"><span>Portfolio Asset Value</span><h3>$${Number(totalVal).toLocaleString()}</h3></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div class="content-card">
          <h4 style="margin-bottom: 14px; font-size: 0.95rem; font-weight: 700;">Property Types & Status Breakdown</h4>
          <canvas id="propChart" style="max-height: 250px;"></canvas>
        </div>
        <div class="content-card">
          <h4 style="margin-bottom: 14px; font-size: 0.95rem; font-weight: 700;">Inventory Summary Table</h4>
          <table class="data-table">
            <thead>
              <tr><th>Type</th><th>Status</th><th>Count</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${list.map(r => `
                <tr>
                  <td>${r.property_type.replace('_', ' ').toUpperCase()}</td>
                  <td><span class="badge status-${r.status}">${r.status}</span></td>
                  <td><strong>${r.count}</strong></td>
                  <td>$${Number(r.total_val || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      const ctx = document.getElementById("propChart");
      if (ctx && window.Chart) {
        this.charts.prop = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: list.map(r => `${r.property_type.replace('_', ' ')} (${r.status})`),
            datasets: [{
              data: list.map(r => r.count),
              backgroundColor: ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }, 50);
  },

  // 2. Tenant Report
  renderTenantReport(container) {
    const list = this.reportData.tenant_report || [];
    container.innerHTML = `
      <div class="content-card">
        <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Tenant Directory & Active Lease Compliance</h4>
        <table class="data-table">
          <thead>
            <tr><th>Tenant</th><th>Contact</th><th>Property Unit</th><th>Lease Number</th><th>Term</th><th>Monthly Rent</th></tr>
          </thead>
          <tbody>
            ${list.map(t => `
              <tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.phone}<br/><small style="color: var(--text-muted);">${t.email || ''}</small></td>
                <td>${t.property_title || '<span style="color: var(--text-dim)">No active lease</span>'}</td>
                <td><code style="color: var(--secondary);">${t.agreement_no || 'N/A'}</code></td>
                <td>${t.start_date ? `${t.start_date} &rarr; ${t.end_date}` : 'None'}</td>
                <td><strong style="color: var(--accent-success);">${t.monthly_rent ? `$${Number(t.monthly_rent).toLocaleString()}` : '-'}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 3. Rent Collection Report
  renderRentReport(container) {
    const list = this.reportData.rent_collection_report || [];
    const collected = list.filter(r => r.payment_status === 'paid').reduce((a, c) => a + c.amount, 0);
    const pending = list.filter(r => r.payment_status !== 'paid').reduce((a, c) => a + c.amount, 0);

    container.innerHTML = `
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="ph-bold ph-check-circle"></i></div>
          <div class="kpi-info"><span>Total Rent Collected</span><h3>$${Number(collected).toLocaleString()}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon amber"><i class="ph-bold ph-clock"></i></div>
          <div class="kpi-info"><span>Arrears / Pending Dues</span><h3>$${Number(pending).toLocaleString()}</h3></div>
        </div>
      </div>

      <div class="content-card">
        <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Rent Invoicing & Settlement Ledger</h4>
        <table class="data-table">
          <thead>
            <tr><th>Receipt</th><th>Tenant</th><th>Property</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td><code>${r.receipt_no}</code></td>
                <td><strong>${r.payer_name}</strong></td>
                <td>${r.property_title || 'N/A'}</td>
                <td><strong style="color: var(--accent-success);">$${Number(r.amount).toLocaleString()}</strong></td>
                <td>${r.payment_method}</td>
                <td><span class="badge badge-${r.payment_status}">${r.payment_status.toUpperCase()}</span></td>
                <td>${r.paid_at || r.due_date || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 4. House Sale Report
  renderHouseSaleReport(container) {
    const list = this.reportData.house_sale_report || [];
    const totalRev = list.reduce((a, c) => a + (c.agreed_price || 0), 0);

    container.innerHTML = `
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-icon purple"><i class="ph-bold ph-house-line"></i></div>
          <div class="kpi-info"><span>Total House Sales</span><h3>${list.length}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="ph-bold ph-bank"></i></div>
          <div class="kpi-info"><span>Aggregate Realized Value</span><h3>$${Number(totalRev).toLocaleString()}</h3></div>
        </div>
      </div>

      <div class="content-card">
        <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Completed & Active House Sales</h4>
        <table class="data-table">
          <thead>
            <tr><th>Agreement</th><th>House Property</th><th>Buyer</th><th>Date</th><th>Agreed Price</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${list.map(s => `
              <tr>
                <td><code>${s.agreement_no}</code></td>
                <td><strong>${s.property_title}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${s.address}</div></td>
                <td><strong>${s.buyer_name}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${s.buyer_phone}</div></td>
                <td>${s.sale_date}</td>
                <td><strong style="color: var(--secondary);">$${Number(s.agreed_price).toLocaleString()}</strong></td>
                <td><span class="badge ${s.status === 'completed' ? 'badge-paid' : 'badge-pending'}">${s.status.toUpperCase()}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 5. Plot Sale Report
  renderPlotSaleReport(container) {
    const list = this.reportData.plot_sale_report || [];
    const totalPlotRev = list.reduce((a, c) => a + (c.agreed_price || 0), 0);
    const totalSqft = list.reduce((a, c) => a + (c.area_sqft || 0), 0);

    container.innerHTML = `
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="ph-bold ph-map-trifold"></i></div>
          <div class="kpi-info"><span>Plots Transacted</span><h3>${list.length}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon blue"><i class="ph-bold ph-arrows-out"></i></div>
          <div class="kpi-info"><span>Total Land Area</span><h3>${Number(totalSqft).toLocaleString()} sqft</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon purple"><i class="ph-bold ph-currency-circle-dollar"></i></div>
          <div class="kpi-info"><span>Total Revenue</span><h3>$${Number(totalPlotRev).toLocaleString()}</h3></div>
        </div>
      </div>

      <div class="content-card">
        <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Land & Plot Sale Transactions</h4>
        <table class="data-table">
          <thead>
            <tr><th>Agreement</th><th>Layout Title</th><th>Plot Details</th><th>Buyer</th><th>Date</th><th>Price</th></tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td><code>${p.agreement_no}</code></td>
                <td><strong>${p.property_title}</strong></td>
                <td>Plot ${p.plot_no} (${p.survey_no || 'Survey N/A'})</td>
                <td><strong>${p.buyer_name}</strong></td>
                <td>${p.sale_date}</td>
                <td><strong style="color: var(--accent-success);">$${Number(p.agreed_price).toLocaleString()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 6. Payment Report
  renderPaymentReport(container) {
    const list = this.reportData.payment_report || [];
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="content-card">
          <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Payment Flow Channels</h4>
          <canvas id="paymentChart" style="max-height: 250px;"></canvas>
        </div>
        <div class="content-card">
          <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Payment Summary by Stream</h4>
          <table class="data-table">
            <thead>
              <tr><th>Payment Category</th><th>Status</th><th>Transactions</th><th>Total Value</th></tr>
            </thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  <td><strong>${p.payment_type.replace('_', ' ').toUpperCase()}</strong></td>
                  <td><span class="badge badge-${p.payment_status}">${p.payment_status.toUpperCase()}</span></td>
                  <td>${p.txn_count}</td>
                  <td><strong style="color: var(--accent-success);">$${Number(p.total_amount).toLocaleString()}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      const ctx = document.getElementById("paymentChart");
      if (ctx && window.Chart) {
        this.charts.pay = new Chart(ctx, {
          type: "bar",
          data: {
            labels: list.map(p => `${p.payment_type} (${p.payment_status})`),
            datasets: [{
              label: "Revenue ($)",
              data: list.map(p => p.total_amount),
              backgroundColor: "#4f46e5"
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }, 50);
  },

  // 7. Maintenance Report
  renderMaintenanceReport(container) {
    const list = this.reportData.maintenance_report || [];
    const totalEst = list.reduce((a, c) => a + (c.total_est || 0), 0);
    const totalAct = list.reduce((a, c) => a + (c.total_act || 0), 0);

    container.innerHTML = `
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-icon blue"><i class="ph-bold ph-wrench"></i></div>
          <div class="kpi-info"><span>Total Repair Tickets</span><h3>${list.reduce((a, c) => a + c.count, 0)}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon amber"><i class="ph-bold ph-calculator"></i></div>
          <div class="kpi-info"><span>Estimated Cost</span><h3>$${Number(totalEst).toLocaleString()}</h3></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon emerald"><i class="ph-bold ph-coins"></i></div>
          <div class="kpi-info"><span>Actual Expenditure</span><h3>$${Number(totalAct).toLocaleString()}</h3></div>
        </div>
      </div>

      <div class="content-card">
        <h4 style="margin-bottom: 14px; font-size: 1.05rem; font-weight: 700;">Maintenance Category Breakdown</h4>
        <table class="data-table">
          <thead>
            <tr><th>Category</th><th>Status</th><th>Ticket Count</th><th>Estimated Cost</th><th>Actual Cost</th></tr>
          </thead>
          <tbody>
            ${list.map(m => `
              <tr>
                <td><strong>${m.category}</strong></td>
                <td><span class="badge badge-${m.status}">${m.status.toUpperCase()}</span></td>
                <td>${m.count}</td>
                <td>$${Number(m.total_est || 0).toLocaleString()}</td>
                <td><strong style="color: var(--accent-success);">$${Number(m.total_act || 0).toLocaleString()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
};
