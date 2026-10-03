"""
Database initialization and data access layer for Property & Tenant Management System.
Uses SQLite for zero-dependency, robust relational storage.
"""

import sqlite3
import os
import hashlib
from datetime import datetime, date, timedelta
from dotenv import load_dotenv

# Load .env config
load_dotenv()

DB_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    os.environ.get("DATABASE_FILE", "property_management.db")
)

def get_db():
    """Get a database connection with dictionary-like row access."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def hash_password(password: str) -> str:
    """Hash password with sha256."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def init_db():
    """Create all required tables for the 8 core modules."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users Table (Authentication & Role Management)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'manager', 'tenant', 'customer'
        phone TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Properties Table (Rentals, House Sales, Plot Sales)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        property_type TEXT NOT NULL, -- 'house_rent', 'house_sale', 'plot_sale'
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT,
        zip_code TEXT,
        price REAL NOT NULL, -- Rent per month OR total selling price
        deposit REAL DEFAULT 0, -- Security deposit for rental or booking min
        bedrooms INTEGER DEFAULT 0,
        bathrooms INTEGER DEFAULT 0,
        area_sqft REAL NOT NULL,
        plot_no TEXT, -- for plots
        survey_no TEXT, -- for plots
        status TEXT NOT NULL DEFAULT 'available', -- 'available', 'rented', 'sold', 'reserved', 'maintenance'
        description TEXT,
        features TEXT, -- JSON string or comma-separated
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 3. Tenants & Customers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'tenant', 'customer'
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT NOT NULL,
        id_proof_type TEXT, -- 'Passport', 'Driving License', 'Aadhaar / National ID'
        id_proof_number TEXT,
        address TEXT,
        occupation TEXT,
        emergency_contact TEXT,
        status TEXT DEFAULT 'active', -- 'active', 'inactive', 'prospective'
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 4. Rent Agreements & Allocation Module
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rent_agreements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_no TEXT UNIQUE NOT NULL,
        property_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        monthly_rent REAL NOT NULL,
        security_deposit REAL NOT NULL,
        due_day INTEGER DEFAULT 5,
        terms TEXT,
        status TEXT DEFAULT 'active', -- 'active', 'expired', 'terminated'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES people (id) ON DELETE CASCADE
    )
    """)

    # 5. House Sale Agreements & Records
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS house_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_no TEXT UNIQUE NOT NULL,
        property_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        sale_date DATE NOT NULL,
        agreed_price REAL NOT NULL,
        booking_amount REAL NOT NULL,
        payment_status TEXT DEFAULT 'booking_paid', -- 'booking_paid', 'partially_paid', 'fully_paid'
        terms TEXT,
        status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES people (id) ON DELETE CASCADE
    )
    """)

    # 6. Plot Sale Agreements & Records
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS plot_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_no TEXT UNIQUE NOT NULL,
        property_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        plot_no TEXT NOT NULL,
        survey_no TEXT,
        sale_date DATE NOT NULL,
        agreed_price REAL NOT NULL,
        booking_amount REAL NOT NULL,
        payment_status TEXT DEFAULT 'booking_paid', -- 'booking_paid', 'partially_paid', 'fully_paid'
        terms TEXT,
        status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES people (id) ON DELETE CASCADE
    )
    """)

    # 7. Payment & Billing Module
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no TEXT UNIQUE NOT NULL,
        payment_type TEXT NOT NULL, -- 'rent', 'house_sale', 'plot_sale', 'maintenance', 'deposit'
        related_id INTEGER, -- rent_agreements.id, house_sales.id, plot_sales.id, or maintenance_requests.id
        property_id INTEGER,
        payer_id INTEGER,
        payer_name TEXT NOT NULL,
        payer_phone TEXT,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL, -- 'Bank Transfer', 'UPI / Card', 'Cash', 'Cheque'
        payment_status TEXT NOT NULL DEFAULT 'paid', -- 'paid', 'pending', 'overdue'
        due_date DATE,
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL,
        FOREIGN KEY (payer_id) REFERENCES people (id) ON DELETE SET NULL
    )
    """)

    # 8. Maintenance Management Module
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_no TEXT UNIQUE NOT NULL,
        property_id INTEGER NOT NULL,
        tenant_id INTEGER,
        tenant_name TEXT NOT NULL,
        category TEXT NOT NULL, -- 'Plumbing', 'Electrical', 'Carpentry', 'HVAC', 'Painting', 'General'
        priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'assigned', 'in_progress', 'resolved', 'closed'
        assigned_service_provider TEXT,
        service_contact TEXT,
        scheduled_date DATE,
        estimated_cost REAL DEFAULT 0,
        actual_cost REAL DEFAULT 0,
        complaint_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES people (id) ON DELETE SET NULL
    )
    """)

    # 9. Notifications Module
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general', -- 'rent_due', 'maintenance', 'sale', 'general'
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

def seed_sample_data():
    """Populate rich, realistic initial demo data if database is empty."""
    conn = get_db()
    cursor = conn.cursor()

    # Check if data already exists
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()["count"] > 0:
        conn.close()
        return

    # Read admin/manager credentials from .env
    admin_name     = os.environ.get("ADMIN_NAME",     "Administrator")
    admin_email    = os.environ.get("ADMIN_EMAIL",    "admin@property.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    mgr_name     = os.environ.get("MANAGER_NAME",     "Property Manager")
    mgr_email    = os.environ.get("MANAGER_EMAIL",    "manager@property.com")
    mgr_password = os.environ.get("MANAGER_PASSWORD", "manager123")

    # Seed Admin and Users
    users_data = [
        (admin_name, admin_email, hash_password(admin_password), "admin", "+1 555-0199",
         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"),
        (mgr_name, mgr_email, hash_password(mgr_password), "manager", "+1 555-0144",
         "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"),
        ("Marcus Vance", "tenant@property.com", hash_password("tenant123"), "tenant", "+1 555-0182",
         "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80")
    ]
    cursor.executemany("INSERT INTO users (name, email, password_hash, role, phone, avatar) VALUES (?, ?, ?, ?, ?, ?)", users_data)

    # Seed Properties (House Rent, House Sale, Plot Sale)
    properties_data = [
        # Rental Properties
        ("The Grand Horizon Penthouse", "house_rent", "742 Evergreen Terrace, Suite 14B", "Springfield", "OR", "97477",
         3200, 6400, 3, 2, 1850, None, None, "rented",
         "Luxurious high-floor corner unit offering panoramic city views, floor-to-ceiling windows, and smart home automation.",
         "Central AC, Balcony, Swimming Pool, Gym, Parking, 24/7 Security",
         "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80"),

        ("Maplewood Family Residence", "house_rent", "128 Oakridge Blvd", "Portland", "OR", "97201",
         2400, 4800, 4, 3, 2200, None, None, "available",
         "Charming two-story suburban home with manicured backyard, updated chef kitchen, and hardwood floors throughout.",
         "Private Garden, Garage, Pet Friendly, Fireplace, Dishwasher",
         "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80"),

        ("Urban Loft in Arts District", "house_rent", "450 Broadway St, Apt 304", "Seattle", "WA", "98101",
         1850, 3700, 1, 1, 920, None, None, "available",
         "Industrial chic loft featuring exposed brick, soaring 14-foot ceilings, polished concrete floors, and designer lighting.",
         "High Ceilings, In-unit Laundry, Rooftop Deck, Bike Storage",
         "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80"),

        # House Sales
        ("Silverstone Luxury Villa", "house_sale", "890 Bel Air Crest Road", "Los Angeles", "CA", "90077",
         1250000, 100000, 5, 5, 4600, None, None, "available",
         "Ultra-modern contemporary masterpiece featuring infinity pool, wine cellar, theater room, and zero-edge spa.",
         "Infinity Pool, Home Theater, Wine Cellar, Smart Security, Solar Panels",
         "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&auto=format&fit=crop&q=80"),

        ("Coastal Haven Seaside Villa", "house_sale", "23 Oceanview Drive", "San Diego", "CA", "92109",
         890000, 75000, 4, 3, 3100, None, None, "sold",
         "Breathtaking coastal home just 300 steps from the sand. Features sun-drenched wraparound decks and private cabana.",
         "Ocean Views, Dual Master Suites, Outdoor Kitchen, Jacuzzi",
         "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80"),

        ("Aspen Modern Farmhouse", "house_sale", "512 Pinecrest Way", "Denver", "CO", "80202",
         675000, 50000, 3, 3, 2750, None, None, "available",
         "Brand new construction modern farmhouse with open-concept floor plan, quartz countertops, and three-car garage.",
         "3-Car Garage, Custom Cabinetry, Covered Patio, Energy Star Certified",
         "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80"),

        # Plot Sales
        ("Highland Greens Prime Corner Plot", "plot_sale", "Plot 42, Phase II, Highland Estates", "Austin", "TX", "78701",
         280000, 25000, 0, 0, 5400, "P-42", "SY-108/A", "available",
         "Prime east-facing corner residential plot with 60ft wide front access road. Clear title, gated community with clubhouse.",
         "Gated Community, Underground Drainage, 24/7 Water Supply, East Facing",
         "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80"),

        ("Emerald Valley Commercial Plot", "plot_sale", "Sector 9, Tech Corridor Expressway", "Dallas", "TX", "75001",
         450000, 45000, 0, 0, 10800, "EV-108", "SY-442/B", "available",
         "High-visibility commercial approved plot ideal for boutique corporate office, retail complex, or healthcare center.",
         "Commercial Zoning, 100ft Main Road, High Speed Fiber, Immediate Possession",
         "https://images.unsplash.com/photo-1524813686514-a57563d77d61?w=800&auto=format&fit=crop&q=80"),

        ("Sunset Ridge Residential Plot", "plot_sale", "Plot 15, Sunset Ridge Enclave", "Phoenix", "AZ", "85001",
         195000, 20000, 0, 0, 4000, "SR-15", "SY-77/C", "sold",
         "Scenic view residential plot nestled alongside rolling desert foothills with approved architectural plans included.",
         "Scenic Foothill View, Municipal Water, Electric Grid Ready, R-1 Zoning",
         "https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=800&auto=format&fit=crop&q=80")
    ]

    cursor.executemany("""
    INSERT INTO properties (
        title, property_type, address, city, state, zip_code, price, deposit,
        bedrooms, bathrooms, area_sqft, plot_no, survey_no, status, description, features, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, properties_data)

    # Seed People (Tenants & Customers)
    people_data = [
        ("tenant", "Marcus Vance", "marcus.vance@example.com", "+1 555-0182", "Passport", "P7829104", "742 Evergreen Terrace, Springfield", "Software Architect", "+1 555-0111 (Wife - Elena)", "active", "Reliable tenant, clean record"),
        ("tenant", "Chloe Bennett", "chloe.b@example.com", "+1 555-0147", "Driving License", "DL-908124", "128 Oakridge Blvd, Portland", "Graphic Designer", "+1 555-0119 (Brother)", "active", "Signed 12-month lease"),
        ("customer", "David Sterling", "david.s@example.com", "+1 555-0165", "Passport", "P4412903", "104 Riverfront Rd, San Diego", "Venture Partner", "+1 555-0166", "active", "Purchased Seaside Villa"),
        ("customer", "Sophia Rodriguez", "sophia.r@example.com", "+1 555-0193", "Aadhaar / National ID", "ID-5501928", "882 Skyline Ave, Phoenix", "Financial Director", "+1 555-0194", "active", "Purchased Sunset Ridge plot"),
        ("customer", "Alexander Wright", "alex.wright@example.com", "+1 555-0133", "Driving License", "DL-112349", "330 Bellevue Way, Seattle", "Civil Engineer", "+1 555-0134", "prospective", "Looking for 3BHK villa under $700k")
    ]

    cursor.executemany("""
    INSERT INTO people (type, name, email, phone, id_proof_type, id_proof_number, address, occupation, emergency_contact, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, people_data)

    # Seed Rent Agreement (Allocating Grand Horizon Penthouse to Marcus Vance)
    cursor.execute("""
    INSERT INTO rent_agreements (agreement_no, property_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, due_day, terms, status)
    VALUES ('RA-2026-001', 1, 1, '2026-01-01', '2026-12-31', 3200, 6400, 5, 'Tenant agrees to keep property in good repair and abide by HOA rules.', 'active')
    """)

    # Seed House Sale Agreement (Coastal Haven Seaside Villa to David Sterling)
    cursor.execute("""
    INSERT INTO house_sales (agreement_no, property_id, buyer_id, sale_date, agreed_price, booking_amount, payment_status, terms, status)
    VALUES ('HSA-2026-101', 5, 3, '2026-02-15', 890000, 75000, 'fully_paid', 'Ownership transferred with full warranty deed upon settlement.', 'completed')
    """)

    # Seed Plot Sale Agreement (Sunset Ridge Plot to Sophia Rodriguez)
    cursor.execute("""
    INSERT INTO plot_sales (agreement_no, property_id, buyer_id, plot_no, survey_no, sale_date, agreed_price, booking_amount, payment_status, terms, status)
    VALUES ('PSA-2026-201', 9, 4, 'SR-15', 'SY-77/C', '2026-03-01', 195000, 20000, 'fully_paid', 'Full legal possession granted. Clear title deeds registered.', 'completed')
    """)

    # Seed Payments & Billing
    today_str = date.today().isoformat()
    last_month_str = (date.today() - timedelta(days=30)).isoformat()
    next_due_str = (date.today() + timedelta(days=5)).isoformat()

    payments_data = [
        ("REC-2026-001", "rent", 1, 1, 1, "Marcus Vance", "+1 555-0182", 3200, "Bank Transfer", "paid", last_month_str, f"{last_month_str} 10:30:00", "Monthly rent for last month - paid on time"),
        ("REC-2026-002", "deposit", 1, 1, 1, "Marcus Vance", "+1 555-0182", 6400, "Bank Transfer", "paid", "2026-01-01", "2026-01-01 14:15:00", "Initial 2-month security deposit holding"),
        ("REC-2026-003", "house_sale", 1, 5, 3, "David Sterling", "+1 555-0165", 890000, "Bank Transfer", "paid", "2026-02-15", "2026-02-15 11:00:00", "Full acquisition settlement for Seaside Villa"),
        ("REC-2026-004", "plot_sale", 1, 9, 4, "Sophia Rodriguez", "+1 555-0193", 195000, "Cheque", "paid", "2026-03-01", "2026-03-01 16:45:00", "Full title transfer payment for Plot SR-15"),
        ("REC-2026-005", "rent", 1, 1, 1, "Marcus Vance", "+1 555-0182", 3200, "Bank Transfer", "pending", next_due_str, None, "Upcoming monthly rent cycle for current month"),
        ("REC-2026-006", "rent", 2, 2, 2, "Chloe Bennett", "+1 555-0147", 2400, "UPI / Card", "overdue", (date.today() - timedelta(days=5)).isoformat(), None, "Overdue monthly rent - automated alert dispatched")
    ]

    cursor.executemany("""
    INSERT INTO payments (receipt_no, payment_type, related_id, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, payments_data)

    # Seed Maintenance Requests
    maintenance_data = [
        ("MNT-2026-001", 1, 1, "Marcus Vance", "Plumbing", "medium", "Master Bathroom Low Water Pressure", "Low water pressure in the master bathroom rain showerhead since Tuesday morning.", "resolved", "Apex Plumbing Solutions", "+1 555-0992", "2026-02-10", 180, 165, "Replaced valve cartridge and cleaned mineral deposit buildup.", "2026-02-09 09:30:00", "2026-02-10 14:00:00"),
        ("MNT-2026-002", 1, 1, "Marcus Vance", "HVAC", "high", "Smart Thermostat Communication Fault", "HVAC thermostat unit intermittently disconnects from the central damper control unit.", "in_progress", "ChillTech Climate Systems", "+1 555-0814", "2026-10-04", 250, 0, "Technician dispatched for motherboard diagnostic.", "2026-10-01 11:20:00", None),
        ("MNT-2026-003", 2, 2, "Chloe Bennett", "Electrical", "urgent", "Kitchen Main Circuit Breaker Tripping", "Trips when dishwasher and convection oven run simultaneously. Needs load inspection.", "pending", "VoltGuard Master Electricians", "+1 555-0442", "2026-10-03", 320, 0, "Awaiting approval for dedicated 20A breaker run.", "2026-10-02 08:15:00", None)
    ]

    cursor.executemany("""
    INSERT INTO maintenance_requests (ticket_no, property_id, tenant_id, tenant_name, category, priority, title, description, status, assigned_service_provider, service_contact, scheduled_date, estimated_cost, actual_cost, complaint_notes, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, maintenance_data)

    # Seed Live System Notifications
    notifications_data = [
        ("Rent Overdue Notice", "Chloe Bennett has an overdue rental balance of $2,400 for Maplewood Family Residence.", "rent_due", 0),
        ("Urgent Maintenance Raised", "Ticket MNT-2026-003 (Kitchen Circuit Breaker) requires technician dispatch.", "maintenance", 0),
        ("Plot Sale Finalized", "Plot SR-15 deed registration completed for Sophia Rodriguez.", "sale", 1),
        ("System Backup", "All database tables and agreement ledger automatically backed up.", "general", 1)
    ]

    cursor.executemany("""
    INSERT INTO notifications (title, message, category, is_read)
    VALUES (?, ?, ?, ?)
    """, notifications_data)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_sample_data()
    print("Database initialized and sample data seeded successfully!")
