/**
 * Module 6: Payment & Billing Module
 * Handles Rent, House & Plot Sale Payments, Pending Alert Cards, and Official Printable Receipts
 */

const PaymentsModule = {
  currentFilter: {
    type: "all",
    status: "all",
    search: ""
  },

  init() {
    this.bindEvents();
    this.loadPayments();
    this.loadPendingAlerts();
  },

  bindEvents() {
    const searchInput = document.getElementById("payment-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.currentFilter.search = e.target.value;
        this.loadPayments();
      });
    }

    const typeFilter = document.getElementById("payment-type-filter");
    if (typeFilter) {
      typeFilter.addEventListener("change", (e) => {
        this.currentFilter.type = e.target.value;
        this.loadPayments();
      });
    }

    const statusFilter = document.getElementById("payment-status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.currentFilter.status = e.target.value;
        this.loadPayments();
      });
    }

    const newPaymentBtn = document.getElementById("btn-record-payment");
    if (newPaymentBtn) {
      newPaymentBtn.addEventListener("click", () => this.openPaymentModal());
    }

    const paymentForm = document.getElementById("payment-form");
    if (paymentForm) {
      paymentForm.addEventListener("submit", (e) => this.handlePaymentSubmit(e));
    }
  },

  async loadPayments() {
    const tbody = document.getElementById("payments-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 25px;"><i class="ph-bold ph-spinner" style="font-size: 1.5rem; animation: spin 1s infinite linear;"></i> Loading payment ledger...</td></tr>`;

    try {
      const res = await API.payments.getAll(this.currentFilter);
      const list = res.payments || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No payment records match criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(p => `
        <tr>
          <td><code style="color: var(--secondary); font-weight: 700;">${p.receipt_no}</code></td>
          <td>
            <strong>${p.payer_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.payer_phone || ''}</div>
          </td>
          <td>
            <span class="badge" style="background: rgba(79, 70, 229, 0.15); color: #818cf8;">
              ${p.payment_type.replace('_', ' ').toUpperCase()}
            </span>
          </td>
          <td>
            <strong>${p.property_title || 'N/A'}</strong>
          </td>
          <td>
            <strong style="color: var(--accent-success); font-size: 0.95rem;">$${Number(p.amount).toLocaleString()}</strong>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: var(--text-dim);"><i class="ph-bold ph-credit-card"></i> ${p.payment_method}</span>
          </td>
          <td>
            <span class="badge badge-${p.payment_status}">${p.payment_status.toUpperCase()}</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="PaymentsModule.viewReceipt(${p.id})" title="Printable Official Receipt">
                <i class="ph-bold ph-receipt"></i> Receipt
              </button>
              ${p.payment_status !== 'paid' ? `
                <button class="btn btn-success btn-sm" onclick="PaymentsModule.markAsPaid(${p.id})" title="Mark As Paid">
                  <i class="ph-bold ph-check"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--accent-danger);">${err.message}</td></tr>`;
    }
  },

  async loadPendingAlerts() {
    const alertBox = document.getElementById("pending-payments-alerts");
    if (!alertBox) return;

    try {
      const res = await API.payments.getPending();
      const list = res.pending_payments || [];

      if (list.length === 0) {
        alertBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md);">
            <i class="ph-bold ph-check-circle" style="color: var(--accent-success); font-size: 1.4rem;"></i>
            <div>
              <strong style="color: var(--accent-success); font-size: 0.9rem;">All accounts up to date!</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted);">No pending or overdue payments require collection today.</div>
            </div>
          </div>
        `;
        return;
      }

      alertBox.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
          ${list.map(p => `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge badge-overdue" style="margin-bottom: 4px;">DUE: ${p.due_date || 'Immediate'}</span>
                <div style="font-weight: 700; font-size: 0.92rem; color: #fff;">${p.payer_name}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${p.property_title || 'Rental Unit'} &bull; ${p.payment_type.toUpperCase()}</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #f87171; margin-top: 4px;">$${Number(p.amount).toLocaleString()}</div>
              </div>
              <button class="btn btn-success btn-sm" onclick="PaymentsModule.markAsPaid(${p.id})">
                <i class="ph-bold ph-check"></i> Collect
              </button>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      console.error("Pending alerts error:", err);
    }
  },

  async openPaymentModal() {
    const form = document.getElementById("payment-form");
    if (form) form.reset();

    const propSelect = document.getElementById("pay-property-select");
    const payerSelect = document.getElementById("pay-payer-select");

    try {
      const [propsRes, peopleRes] = await Promise.all([
        API.properties.getAll(),
        API.people.getAll()
      ]);

      if (propSelect) {
        propSelect.innerHTML = `<option value="">Select Associated Property</option>` +
          propsRes.properties.map(p => `<option value="${p.id}">${p.title} (${p.property_type.replace('_', ' ')})</option>`).join("");
      }

      if (payerSelect) {
        payerSelect.innerHTML = `<option value="">Select Payer / Tenant / Buyer</option>` +
          peopleRes.people.map(p => `<option value="${p.id}" data-name="${p.name}" data-phone="${p.phone}">${p.name} (${p.type} - ${p.phone})</option>`).join("");

        payerSelect.onchange = (e) => {
          const opt = e.target.selectedOptions[0];
          if (opt && opt.value) {
            document.getElementById("pay-payer-name").value = opt.dataset.name || "";
            document.getElementById("pay-payer-phone").value = opt.dataset.phone || "";
          }
        };
      }

      document.getElementById("pay-due-date").value = new Date().toISOString().split("T")[0];
      App.openModal("payment-modal");
    } catch (err) {
      App.showToast("Failed to prepare payment form: " + err.message, "error");
    }
  },

  async handlePaymentSubmit(e) {
    e.preventDefault();
    const payload = {
      payment_type: document.getElementById("pay-type").value,
      property_id: parseInt(document.getElementById("pay-property-select").value) || null,
      payer_id: parseInt(document.getElementById("pay-payer-select").value) || null,
      payer_name: document.getElementById("pay-payer-name").value.trim(),
      payer_phone: document.getElementById("pay-payer-phone").value.trim(),
      amount: parseFloat(document.getElementById("pay-amount").value) || 0,
      payment_method: document.getElementById("pay-method").value,
      payment_status: document.getElementById("pay-status").value,
      due_date: document.getElementById("pay-due-date").value,
      notes: document.getElementById("pay-notes").value.trim()
    };

    try {
      const res = await API.payments.create(payload);
      App.showToast(`Payment saved! Receipt #${res.receipt_no}`, "success");
      App.closeModal("payment-modal");
      this.loadPayments();
      this.loadPendingAlerts();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async markAsPaid(id) {
    try {
      await API.payments.updateStatus(id, "paid");
      App.showToast("Payment marked as PAID successfully!", "success");
      this.loadPayments();
      this.loadPendingAlerts();
      App.refreshDashboardStats();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async viewReceipt(id) {
    try {
      const res = await API.payments.getReceipt(id);
      const r = res.receipt;
      const modalBody = document.getElementById("receipt-modal-body");
      if (!modalBody) return;

      const formattedAmount = Number(r.amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
      const payDate = r.paid_at || r.created_at || new Date().toISOString();

      modalBody.innerHTML = `
        <div class="receipt-wrapper" id="printable-receipt">
          <div class="receipt-header-row">
            <div class="receipt-company">
              <h2>PROPMANAGE ENTERPRISE</h2>
              <p>Property & Asset Management Corporation</p>
              <p>500 Financial Plaza, Suite 2200 &bull; Tel: +1 (800) 555-REAL</p>
            </div>
            <div class="receipt-meta">
              <h3>OFFICIAL RECEIPT</h3>
              <p><strong>Receipt #:</strong> ${r.receipt_no}</p>
              <p><strong>Date:</strong> ${payDate.substring(0, 10)}</p>
              <p><strong>Status:</strong> <span style="color: #059669; font-weight: 700;">${r.payment_status.toUpperCase()}</span></p>
            </div>
          </div>

          <div class="receipt-parties">
            <div class="party-box">
              <h4>Received From</h4>
              <p>${r.payer_name}</p>
              <span>Phone: ${r.payer_phone || 'N/A'}</span>
              <span>Email: ${r.payer_email || 'On Record'}</span>
            </div>
            <div class="party-box">
              <h4>Property Details</h4>
              <p>${r.property_title || 'General Account'}</p>
              <span>${r.property_address || 'Management Office'}</span>
              <span>Category: ${(r.property_type || r.payment_type).replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>

          <table class="receipt-breakdown">
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Payment Mode</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${r.notes || `Settlement for ${r.payment_type.replace('_', ' ').toUpperCase()} Account`}</td>
                <td>${r.payment_type.toUpperCase()}</td>
                <td>${r.payment_method}</td>
                <td style="text-align: right; font-weight: 700;">${formattedAmount}</td>
              </tr>
            </tbody>
          </table>

          <div class="receipt-total-row">
            <div class="receipt-total-box">
              <div class="total-line"><span>Subtotal:</span> <span>${formattedAmount}</span></div>
              <div class="total-line"><span>Tax (0% Residential):</span> <span>$0.00</span></div>
              <div class="total-line grand"><span>Total Paid:</span> <span>${formattedAmount}</span></div>
            </div>
          </div>

          <div class="receipt-footer-sign">
            <div class="qr-placeholder">
              <i class="ph-bold ph-qr-code" style="font-size: 2.2rem; color: #1e293b;"></i>
              <span>VERIFIED SECURE</span>
            </div>
            <div class="seal-stamp">
              VERIFIED & PAID &bull; 2026
            </div>
            <div style="text-align: right; font-size: 0.8rem; color: #64748b;">
              <p style="margin-bottom: 24px;">Electronically Generated System Receipt</p>
              <p>Authorized Signature: <i>P. Management Corp</i></p>
            </div>
          </div>
        </div>
      `;

      App.openModal("receipt-modal");
    } catch (err) {
      App.showToast("Failed to fetch receipt: " + err.message, "error");
    }
  },

  printCurrentReceipt() {
    window.print();
  }
};
