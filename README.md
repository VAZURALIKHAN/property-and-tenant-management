# 🏢 Property and Tenant Management System

A fullstack enterprise web application for real estate portfolio tracking, tenant leases, house sales, land plot agreements, billing, maintenance ticketing, and analytics.

---

## 🏗️ Architecture & Modules

The application is structured precisely according to the system specification:

```
                          [ USER / ADMIN ]
                                 │
                   [ LOGIN & AUTHENTICATION MODULE ]
                                 │
  ┌──────────────┬───────────────┼───────────────┬──────────────┐
  │              │               │               │              │
[PROPERTY]   [TENANT &       [HOUSE RENT]    [HOUSE SALE]   [PLOT SALE]
MODULE       CUSTOMER]       MODULE          MODULE         MODULE
             MODULE
  │              │               │               │              │
  └──────────────┴───────────────┼───────────────┴──────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
   [PAYMENT &              [MAINTENANCE]           [REPORT &
     BILLING]                MODULE                ANALYTICS]
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                           [ DATABASE ]
                    (SQLite Relational Store)
                                 │
                                 ▼
                            [ OUTPUT ]
                 • Reports  • Receipts  • Notifications
```

---

## 🚀 Key Modules & Capabilities

1. **Login & Authentication Module**:
   - Role-based accounts: Administrator, Property Manager, Tenant.
   - Demo credentials available directly in the switch-user dialog.

2. **Module 1: Property Management Module**:
   - Add, edit, delete, and search properties.
   - Filters by type (`Rental House`, `House For Sale`, `Plot Sale`) and status (`Available`, `Rented`, `Sold`, `Reserved`).
   - Detailed property inspector modal with amenities, specs, photos, active leases, and maintenance logs.

3. **Module 2: Tenant & Customer Management Module**:
   - Manage tenants and prospective customers/buyers.
   - Full KYC identification tracking (Passport, Driving License, National ID).
   - Profile inspector displaying active leases, purchase contracts, and payment history.

4. **Module 3: House Rent Management Module**:
   - Vacancy status tracker (Vacant vs Occupied).
   - Allocate tenants with custom lease dates, security deposit holding, and monthly due dates.
   - Lease agreement document viewer and termination workflow.

5. **Module 4: House Sale Management Module**:
   - Residential house sale contracts.
   - Track agreed price, booking advance, settlement status, and terms.
   - Automatic property status update to `Sold`.

6. **Module 5: Plot Sale Management Module**:
   - Land and plot sale deed registries.
   - Track plot numbers, survey numbers, dimensions, and buyer details.
   - Official deed agreement viewer.

7. **Module 6: Payment & Billing Module**:
   - Record payments across rent, house sales, plot sales, and deposits.
   - Overdue and pending payment alerts with instant collection action.
   - **Official Printable Receipts** with company header, breakdown, verified seal, and QR code verification.

8. **Module 7: Maintenance Management Module**:
   - Service ticket logging across Plumbing, Electrical, HVAC, Carpentry, Painting, and General.
   - Priority levels: Low, Medium, High, Urgent.
   - Contractor dispatching, scheduled repair dates, estimated vs actual cost tracking.

9. **Module 8: Report & Analytics Module**:
   - 7 Dedicated reports with visual Chart.js dashboards:
     1. Property Report
     2. Tenant Report
     3. Rent Collection Report
     4. House Sale Report
     5. Plot Sale Report
     6. Payment Report
     7. Maintenance Report
   - Direct CSV spreadsheet export for tabular data.
   - Print-ready reporting layout.

---

## 💻 Tech Stack

- **Backend**: Python 3, Flask, SQLite3
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism & responsive design system), JavaScript (ES6+ modular architecture)
- **Visuals & Icons**: Phosphor Icons, Chart.js

---

## ⚡ Running Locally

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Initialize Database** (pre-populated with realistic sample data):
   ```bash
   python database.py
   ```

3. **Start the Web Server**:
   ```bash
   python app.py
   ```

4. **Access the application**:
   Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.

### Default Demo Accounts:
- **Admin**: `admin@property.com` / `admin123`
- **Manager**: `manager@property.com` / `manager123`
- **Tenant**: `tenant@property.com` / `tenant123`
