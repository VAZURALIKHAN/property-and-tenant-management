"""
Fullstack Property and Tenant Management System - Flask Backend API Server
Serves static frontend and delivers complete RESTful endpoints for all 8 modules.
Production-ready with Waitress WSGI server and environment-based configuration.
"""

from flask import Flask, request, jsonify, send_from_directory, make_response
import os
import json
import sqlite3
from datetime import datetime, date
import csv
import io
from dotenv import load_dotenv
from database import get_db, init_db, seed_sample_data, hash_password

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "fallback-dev-key-change-in-production")
app.config["ENV"] = os.environ.get("FLASK_ENV", "production")

# Ensure DB is created on startup
init_db()
seed_sample_data()

def dict_from_row(row):
    """Convert sqlite3.Row to python dict."""
    if row is None:
        return None
    return dict(row)

def rows_to_dict_list(rows):
    """Convert list of sqlite3.Row to list of dicts."""
    return [dict(r) for r in rows]

# ============================================================================
# 1. FRONTEND STATIC SERVING
# ============================================================================

@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")

# ============================================================================
# 2. AUTHENTICATION MODULE
# ============================================================================

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or user["password_hash"] != hash_password(password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    user_dict = dict_from_row(user)
    del user_dict["password_hash"]
    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": user_dict,
        "token": f"token-{user['id']}-{hash_password(user['email'])[:12]}"
    })

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "tenant")
    phone = data.get("phone", "")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "User with this email already exists"}), 409

    pwd_hash = hash_password(password)
    avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={name}"
    cursor.execute(
        "INSERT INTO users (name, email, password_hash, role, phone, avatar) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, pwd_hash, role, phone, avatar)
    )
    user_id = cursor.lastrowid

    # If registering as tenant or customer, also create a record in people table
    if role in ("tenant", "customer"):
        cursor.execute(
            "INSERT INTO people (type, name, email, phone, status) VALUES (?, ?, ?, ?, 'active')",
            (role, name, email, phone)
        )

    conn.commit()
    cursor.execute("SELECT id, name, email, role, phone, avatar, created_at FROM users WHERE id = ?", (user_id,))
    new_user = dict_from_row(cursor.fetchone())
    conn.close()

    return jsonify({"success": True, "message": "Registration successful", "user": new_user}), 201

# ============================================================================
# 3. DASHBOARD METRICS & RECENT ACTIVITY
# ============================================================================

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    # Property stats
    cursor.execute("SELECT COUNT(*) as total FROM properties")
    total_properties = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE property_type = 'house_rent'")
    rental_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE property_type = 'house_sale'")
    house_sale_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE property_type = 'plot_sale'")
    plot_sale_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE status = 'available'")
    available_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE status = 'rented'")
    rented_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM properties WHERE status = 'sold'")
    sold_count = cursor.fetchone()["count"]

    # People stats
    cursor.execute("SELECT COUNT(*) as count FROM people WHERE type = 'tenant'")
    tenant_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM people WHERE type = 'customer'")
    customer_count = cursor.fetchone()["count"]

    # Financial stats
    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_status = 'paid'")
    total_revenue = cursor.fetchone()["total"]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'rent' AND payment_status = 'paid'")
    rent_collected = cursor.fetchone()["total"]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_status IN ('pending', 'overdue')")
    pending_payments_total = cursor.fetchone()["total"]

    # Maintenance stats
    cursor.execute("SELECT COUNT(*) as count FROM maintenance_requests WHERE status IN ('pending', 'assigned', 'in_progress')")
    open_maintenance_count = cursor.fetchone()["count"]

    # Recent activities (recent payments, maintenance, and agreements)
    cursor.execute("""
    SELECT 'payment' as act_type, receipt_no as ref_code, payer_name as person, amount, payment_type as subtype, payment_status as status, created_at
    FROM payments
    ORDER BY id DESC LIMIT 5
    """)
    recent_payments = rows_to_dict_list(cursor.fetchall())

    cursor.execute("""
    SELECT 'maintenance' as act_type, ticket_no as ref_code, tenant_name as person, estimated_cost as amount, category as subtype, status, created_at
    FROM maintenance_requests
    ORDER BY id DESC LIMIT 4
    """)
    recent_maintenance = rows_to_dict_list(cursor.fetchall())

    conn.close()

    return jsonify({
        "success": True,
        "stats": {
            "total_properties": total_properties,
            "rental_count": rental_count,
            "house_sale_count": house_sale_count,
            "plot_sale_count": plot_sale_count,
            "available_count": available_count,
            "rented_count": rented_count,
            "sold_count": sold_count,
            "tenant_count": tenant_count,
            "customer_count": customer_count,
            "total_revenue": total_revenue,
            "rent_collected": rent_collected,
            "pending_payments_total": pending_payments_total,
            "open_maintenance_count": open_maintenance_count
        },
        "recent_activities": sorted(recent_payments + recent_maintenance, key=lambda x: str(x.get("created_at", "")), reverse=True)[:6]
    })

# ============================================================================
# 4. MODULE 1: PROPERTY MANAGEMENT MODULE
# ============================================================================

@app.route("/api/properties", methods=["GET"])
def get_properties():
    conn = get_db()
    cursor = conn.cursor()

    property_type = request.args.get("type")
    status = request.args.get("status")
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM properties WHERE 1=1"
    params = []

    if property_type and property_type != "all":
        query += " AND property_type = ?"
        params.append(property_type)

    if status and status != "all":
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND (title LIKE ? OR address LIKE ? OR city LIKE ? OR plot_no LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s, s])

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    properties = rows_to_dict_list(cursor.fetchall())
    conn.close()

    return jsonify({"success": True, "properties": properties})

@app.route("/api/properties/<int:prop_id>", methods=["GET"])
def get_property_details(prop_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM properties WHERE id = ?", (prop_id,))
    prop = cursor.fetchone()

    if not prop:
        conn.close()
        return jsonify({"success": False, "message": "Property not found"}), 404

    prop_dict = dict_from_row(prop)

    # Associated rent agreement if rented
    cursor.execute("""
    SELECT ra.*, p.name as tenant_name, p.phone as tenant_phone, p.email as tenant_email
    FROM rent_agreements ra
    JOIN people p ON ra.tenant_id = p.id
    WHERE ra.property_id = ? AND ra.status = 'active'
    ORDER BY ra.id DESC LIMIT 1
    """, (prop_id,))
    prop_dict["active_agreement"] = dict_from_row(cursor.fetchone())

    # Associated sale agreement if sold or under sale
    cursor.execute("""
    SELECT hs.*, p.name as buyer_name, p.phone as buyer_phone, p.email as buyer_email
    FROM house_sales hs
    JOIN people p ON hs.buyer_id = p.id
    WHERE hs.property_id = ?
    ORDER BY hs.id DESC LIMIT 1
    """, (prop_id,))
    prop_dict["house_sale_record"] = dict_from_row(cursor.fetchone())

    cursor.execute("""
    SELECT ps.*, p.name as buyer_name, p.phone as buyer_phone, p.email as buyer_email
    FROM plot_sales ps
    JOIN people p ON ps.buyer_id = p.id
    WHERE ps.property_id = ?
    ORDER BY ps.id DESC LIMIT 1
    """, (prop_id,))
    prop_dict["plot_sale_record"] = dict_from_row(cursor.fetchone())

    # Maintenance history
    cursor.execute("SELECT * FROM maintenance_requests WHERE property_id = ? ORDER BY id DESC", (prop_id,))
    prop_dict["maintenance_records"] = rows_to_dict_list(cursor.fetchall())

    conn.close()
    return jsonify({"success": True, "property": prop_dict})

@app.route("/api/properties", methods=["POST"])
def add_property():
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    property_type = data.get("property_type", "house_rent")
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()
    state = data.get("state", "").strip()
    zip_code = data.get("zip_code", "").strip()
    price = float(data.get("price") or 0)
    deposit = float(data.get("deposit") or 0)
    bedrooms = int(data.get("bedrooms") or 0)
    bathrooms = int(data.get("bathrooms") or 0)
    area_sqft = float(data.get("area_sqft") or 0)
    plot_no = data.get("plot_no", "").strip() or None
    survey_no = data.get("survey_no", "").strip() or None
    status = data.get("status", "available")
    description = data.get("description", "").strip()
    features = data.get("features", "").strip()
    image_url = data.get("image_url", "").strip()

    if not title or not address or not city or price <= 0:
        return jsonify({"success": False, "message": "Title, address, city, and a valid price are required"}), 400

    if not image_url:
        if property_type == "plot_sale":
            image_url = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80"
        elif property_type == "house_sale":
            image_url = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80"
        else:
            image_url = "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO properties (
        title, property_type, address, city, state, zip_code, price, deposit,
        bedrooms, bathrooms, area_sqft, plot_no, survey_no, status, description, features, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, property_type, address, city, state, zip_code, price, deposit,
          bedrooms, bathrooms, area_sqft, plot_no, survey_no, status, description, features, image_url))
    prop_id = cursor.lastrowid

    # Create notification
    cursor.execute(
        "INSERT INTO notifications (title, message, category) VALUES (?, ?, 'general')",
        ("New Property Listed", f"Property '{title}' ({property_type.replace('_', ' ').title()}) has been added.")
    )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Property added successfully", "property_id": prop_id}), 201

@app.route("/api/properties/<int:prop_id>", methods=["PUT"])
def update_property(prop_id):
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM properties WHERE id = ?", (prop_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({"success": False, "message": "Property not found"}), 404

    title = data.get("title", existing["title"])
    property_type = data.get("property_type", existing["property_type"])
    address = data.get("address", existing["address"])
    city = data.get("city", existing["city"])
    state = data.get("state", existing["state"])
    zip_code = data.get("zip_code", existing["zip_code"])
    price = float(data.get("price") if data.get("price") is not None else existing["price"])
    deposit = float(data.get("deposit") if data.get("deposit") is not None else existing["deposit"])
    bedrooms = int(data.get("bedrooms") if data.get("bedrooms") is not None else existing["bedrooms"])
    bathrooms = int(data.get("bathrooms") if data.get("bathrooms") is not None else existing["bathrooms"])
    area_sqft = float(data.get("area_sqft") if data.get("area_sqft") is not None else existing["area_sqft"])
    plot_no = data.get("plot_no", existing["plot_no"])
    survey_no = data.get("survey_no", existing["survey_no"])
    status = data.get("status", existing["status"])
    description = data.get("description", existing["description"])
    features = data.get("features", existing["features"])
    image_url = data.get("image_url", existing["image_url"])

    cursor.execute("""
    UPDATE properties SET
        title = ?, property_type = ?, address = ?, city = ?, state = ?, zip_code = ?,
        price = ?, deposit = ?, bedrooms = ?, bathrooms = ?, area_sqft = ?,
        plot_no = ?, survey_no = ?, status = ?, description = ?, features = ?, image_url = ?
    WHERE id = ?
    """, (title, property_type, address, city, state, zip_code, price, deposit,
          bedrooms, bathrooms, area_sqft, plot_no, survey_no, status, description, features, image_url, prop_id))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Property updated successfully"})

@app.route("/api/properties/<int:prop_id>", methods=["DELETE"])
def delete_property(prop_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT title FROM properties WHERE id = ?", (prop_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Property not found"}), 404

    cursor.execute("DELETE FROM properties WHERE id = ?", (prop_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Property '{row['title']}' deleted successfully"})

# ============================================================================
# 5. MODULE 2: TENANT & CUSTOMER MANAGEMENT MODULE
# ============================================================================

@app.route("/api/people", methods=["GET"])
def get_people():
    conn = get_db()
    cursor = conn.cursor()
    person_type = request.args.get("type")
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM people WHERE 1=1"
    params = []

    if person_type and person_type != "all":
        query += " AND type = ?"
        params.append(person_type)

    if search:
        query += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR id_proof_number LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s, s])

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    people = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "people": people})

@app.route("/api/people/<int:person_id>", methods=["GET"])
def get_person_details(person_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
    person = cursor.fetchone()
    if not person:
        conn.close()
        return jsonify({"success": False, "message": "Record not found"}), 404

    person_dict = dict_from_row(person)

    # If tenant: get active lease & rented property
    cursor.execute("""
    SELECT ra.*, pr.title as property_title, pr.address as property_address, pr.image_url as property_image
    FROM rent_agreements ra
    JOIN properties pr ON ra.property_id = pr.id
    WHERE ra.tenant_id = ?
    ORDER BY ra.id DESC
    """, (person_id,))
    person_dict["rent_agreements"] = rows_to_dict_list(cursor.fetchall())

    # If customer / buyer: get sales agreements
    cursor.execute("""
    SELECT hs.*, pr.title as property_title, pr.address as property_address
    FROM house_sales hs
    JOIN properties pr ON hs.property_id = pr.id
    WHERE hs.buyer_id = ?
    ORDER BY hs.id DESC
    """, (person_id,))
    person_dict["house_purchases"] = rows_to_dict_list(cursor.fetchall())

    cursor.execute("""
    SELECT ps.*, pr.title as property_title, pr.address as property_address
    FROM plot_sales ps
    JOIN properties pr ON ps.property_id = pr.id
    WHERE ps.buyer_id = ?
    ORDER BY ps.id DESC
    """, (person_id,))
    person_dict["plot_purchases"] = rows_to_dict_list(cursor.fetchall())

    # Payments ledger
    cursor.execute("SELECT * FROM payments WHERE payer_id = ? ORDER BY id DESC", (person_id,))
    person_dict["payments"] = rows_to_dict_list(cursor.fetchall())

    # Maintenance requests
    cursor.execute("SELECT * FROM maintenance_requests WHERE tenant_id = ? ORDER BY id DESC", (person_id,))
    person_dict["maintenance_requests"] = rows_to_dict_list(cursor.fetchall())

    conn.close()
    return jsonify({"success": True, "person": person_dict})

@app.route("/api/people", methods=["POST"])
def add_person():
    data = request.get_json() or {}
    person_type = data.get("type", "tenant")
    name = data.get("name", "").strip()
    email = data.get("email", "").strip() or None
    phone = data.get("phone", "").strip()
    id_proof_type = data.get("id_proof_type", "Passport")
    id_proof_number = data.get("id_proof_number", "").strip()
    address = data.get("address", "").strip()
    occupation = data.get("occupation", "").strip()
    emergency_contact = data.get("emergency_contact", "").strip()
    status = data.get("status", "active")
    notes = data.get("notes", "").strip()

    if not name or not phone:
        return jsonify({"success": False, "message": "Name and phone number are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO people (type, name, email, phone, id_proof_type, id_proof_number, address, occupation, emergency_contact, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (person_type, name, email, phone, id_proof_type, id_proof_number, address, occupation, emergency_contact, status, notes))
    person_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"{person_type.capitalize()} added successfully", "person_id": person_id}), 201

@app.route("/api/people/<int:person_id>", methods=["PUT"])
def update_person(person_id):
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({"success": False, "message": "Record not found"}), 404

    person_type = data.get("type", existing["type"])
    name = data.get("name", existing["name"])
    email = data.get("email", existing["email"])
    phone = data.get("phone", existing["phone"])
    id_proof_type = data.get("id_proof_type", existing["id_proof_type"])
    id_proof_number = data.get("id_proof_number", existing["id_proof_number"])
    address = data.get("address", existing["address"])
    occupation = data.get("occupation", existing["occupation"])
    emergency_contact = data.get("emergency_contact", existing["emergency_contact"])
    status = data.get("status", existing["status"])
    notes = data.get("notes", existing["notes"])

    cursor.execute("""
    UPDATE people SET
        type = ?, name = ?, email = ?, phone = ?, id_proof_type = ?, id_proof_number = ?,
        address = ?, occupation = ?, emergency_contact = ?, status = ?, notes = ?
    WHERE id = ?
    """, (person_type, name, email, phone, id_proof_type, id_proof_number, address, occupation, emergency_contact, status, notes, person_id))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Details updated successfully"})

@app.route("/api/people/<int:person_id>", methods=["DELETE"])
def delete_person(person_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM people WHERE id = ?", (person_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Record not found"}), 404

    cursor.execute("DELETE FROM people WHERE id = ?", (person_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"{row['name']} deleted successfully"})

# ============================================================================
# 6. MODULE 3: HOUSE RENT MANAGEMENT MODULE
# ============================================================================

@app.route("/api/rentals", methods=["GET"])
def get_rentals():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT pr.*,
           ra.id as agreement_id, ra.agreement_no, ra.start_date, ra.end_date, ra.monthly_rent, ra.security_deposit,
           p.name as tenant_name, p.phone as tenant_phone, p.email as tenant_email
    FROM properties pr
    LEFT JOIN rent_agreements ra ON pr.id = ra.property_id AND ra.status = 'active'
    LEFT JOIN people p ON ra.tenant_id = p.id
    WHERE pr.property_type = 'house_rent'
    ORDER BY pr.id DESC
    """)
    rentals = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "rentals": rentals})

@app.route("/api/rentals/agreements", methods=["GET"])
def get_rent_agreements():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT ra.*, pr.title as property_title, pr.address as property_address, pr.image_url,
           p.name as tenant_name, p.phone as tenant_phone, p.email as tenant_email
    FROM rent_agreements ra
    JOIN properties pr ON ra.property_id = pr.id
    JOIN people p ON ra.tenant_id = p.id
    ORDER BY ra.id DESC
    """)
    agreements = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "agreements": agreements})

@app.route("/api/rentals/allocate", methods=["POST"])
def allocate_tenant():
    data = request.get_json() or {}
    property_id = data.get("property_id")
    tenant_id = data.get("tenant_id")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    monthly_rent = float(data.get("monthly_rent") or 0)
    security_deposit = float(data.get("security_deposit") or 0)
    due_day = int(data.get("due_day") or 5)
    terms = data.get("terms", "Standard Residential Lease Agreement.")

    if not property_id or not tenant_id or not start_date or not end_date or monthly_rent <= 0:
        return jsonify({"success": False, "message": "Property, tenant, lease dates, and monthly rent are required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Verify property is available
    cursor.execute("SELECT title, status FROM properties WHERE id = ?", (property_id,))
    prop = cursor.fetchone()
    if not prop:
        conn.close()
        return jsonify({"success": False, "message": "Property not found"}), 404

    # Generate agreement code
    agr_code = f"RA-{datetime.now().strftime('%Y%m')}-{property_id}{tenant_id}"

    # Insert agreement
    cursor.execute("""
    INSERT INTO rent_agreements (agreement_no, property_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, due_day, terms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    """, (agr_code, property_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, due_day, terms))
    agr_id = cursor.lastrowid

    # Update property status to 'rented'
    cursor.execute("UPDATE properties SET status = 'rented' WHERE id = ?", (property_id,))

    # Create Initial Deposit Payment record
    cursor.execute("SELECT name, phone FROM people WHERE id = ?", (tenant_id,))
    tenant = cursor.fetchone()
    rec_code = f"REC-{datetime.now().strftime('%Y')}-DEP{agr_id}"
    cursor.execute("""
    INSERT INTO payments (receipt_no, payment_type, related_id, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes)
    VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?, 'Bank Transfer', 'paid', ?, CURRENT_TIMESTAMP, 'Security deposit held in escrow')
    """, (rec_code, agr_id, property_id, tenant_id, tenant["name"], tenant["phone"], security_deposit, start_date))

    # Add notification
    cursor.execute(
        "INSERT INTO notifications (title, message, category) VALUES (?, ?, 'general')",
        ("Tenant Allocated", f"Tenant '{tenant['name']}' allocated to '{prop['title']}'. Agreement {agr_code} created.")
    )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Tenant allocated and agreement generated successfully", "agreement_no": agr_code}), 201

@app.route("/api/rentals/agreement/<int:agr_id>/terminate", methods=["POST"])
def terminate_rent_agreement(agr_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT property_id FROM rent_agreements WHERE id = ?", (agr_id,))
    agr = cursor.fetchone()
    if not agr:
        conn.close()
        return jsonify({"success": False, "message": "Agreement not found"}), 404

    cursor.execute("UPDATE rent_agreements SET status = 'terminated' WHERE id = ?", (agr_id,))
    cursor.execute("UPDATE properties SET status = 'available' WHERE id = ?", (agr["property_id"],))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Agreement terminated. Property is now vacant/available."})

# ============================================================================
# 7. MODULE 4: HOUSE SALE MANAGEMENT MODULE
# ============================================================================

@app.route("/api/house-sales", methods=["GET"])
def get_house_sales():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT hs.*, pr.title as property_title, pr.address as property_address, pr.price as listed_price,
           pr.image_url, pr.bedrooms, pr.bathrooms, pr.area_sqft,
           p.name as buyer_name, p.phone as buyer_phone, p.email as buyer_email
    FROM house_sales hs
    JOIN properties pr ON hs.property_id = pr.id
    JOIN people p ON hs.buyer_id = p.id
    ORDER BY hs.id DESC
    """)
    sales = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "sales": sales})

@app.route("/api/house-sales/agreement", methods=["POST"])
def create_house_sale():
    data = request.get_json() or {}
    property_id = data.get("property_id")
    buyer_id = data.get("buyer_id")
    sale_date = data.get("sale_date", date.today().isoformat())
    agreed_price = float(data.get("agreed_price") or 0)
    booking_amount = float(data.get("booking_amount") or 0)
    payment_status = data.get("payment_status", "booking_paid")
    terms = data.get("terms", "Standard Residential House Sale Contract.")
    status = data.get("status", "completed" if payment_status == "fully_paid" else "in_progress")

    if not property_id or not buyer_id or agreed_price <= 0:
        return jsonify({"success": False, "message": "Property, buyer, and agreed price are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT title FROM properties WHERE id = ?", (property_id,))
    prop = cursor.fetchone()
    if not prop:
        conn.close()
        return jsonify({"success": False, "message": "Property not found"}), 404

    agr_code = f"HSA-{datetime.now().strftime('%Y%m')}-{property_id}{buyer_id}"
    cursor.execute("""
    INSERT INTO house_sales (agreement_no, property_id, buyer_id, sale_date, agreed_price, booking_amount, payment_status, terms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (agr_code, property_id, buyer_id, sale_date, agreed_price, booking_amount, payment_status, terms, status))
    sale_id = cursor.lastrowid

    # Update property status
    new_prop_status = "sold" if status == "completed" else "reserved"
    cursor.execute("UPDATE properties SET status = ? WHERE id = ?", (new_prop_status, property_id))

    # Record receipt payment
    cursor.execute("SELECT name, phone FROM people WHERE id = ?", (buyer_id,))
    buyer = cursor.fetchone()
    rec_code = f"REC-{datetime.now().strftime('%Y')}-HS{sale_id}"
    amount_paid = agreed_price if payment_status == "fully_paid" else booking_amount
    cursor.execute("""
    INSERT INTO payments (receipt_no, payment_type, related_id, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes)
    VALUES (?, 'house_sale', ?, ?, ?, ?, ?, ?, 'Bank Transfer', 'paid', ?, CURRENT_TIMESTAMP, ?)
    """, (rec_code, sale_id, property_id, buyer_id, buyer["name"], buyer["phone"], amount_paid, sale_date, f"House Sale settlement: {agr_code}"))

    # Add notification
    cursor.execute(
        "INSERT INTO notifications (title, message, category) VALUES (?, ?, 'sale')",
        ("House Sale Agreement Executed", f"Sale agreement {agr_code} generated for '{prop['title']}' to {buyer['name']}.")
    )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "House sale agreement created and payment booked successfully", "agreement_no": agr_code}), 201

# ============================================================================
# 8. MODULE 5: PLOT SALE MANAGEMENT MODULE
# ============================================================================

@app.route("/api/plot-sales", methods=["GET"])
def get_plot_sales():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT ps.*, pr.title as property_title, pr.address as property_address, pr.price as listed_price,
           pr.image_url, pr.area_sqft,
           p.name as buyer_name, p.phone as buyer_phone, p.email as buyer_email
    FROM plot_sales ps
    JOIN properties pr ON ps.property_id = pr.id
    JOIN people p ON ps.buyer_id = p.id
    ORDER BY ps.id DESC
    """)
    plot_sales = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "plot_sales": plot_sales})

@app.route("/api/plot-sales/agreement", methods=["POST"])
def create_plot_sale():
    data = request.get_json() or {}
    property_id = data.get("property_id")
    buyer_id = data.get("buyer_id")
    plot_no = data.get("plot_no", "").strip()
    survey_no = data.get("survey_no", "").strip()
    sale_date = data.get("sale_date", date.today().isoformat())
    agreed_price = float(data.get("agreed_price") or 0)
    booking_amount = float(data.get("booking_amount") or 0)
    payment_status = data.get("payment_status", "booking_paid")
    terms = data.get("terms", "Standard Plot Land Sale and Deed Transfer Contract.")
    status = data.get("status", "completed" if payment_status == "fully_paid" else "in_progress")

    if not property_id or not buyer_id or agreed_price <= 0:
        return jsonify({"success": False, "message": "Plot property, buyer, and agreed price are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT title, plot_no as p_no, survey_no as s_no FROM properties WHERE id = ?", (property_id,))
    prop = cursor.fetchone()
    if not prop:
        conn.close()
        return jsonify({"success": False, "message": "Plot not found"}), 404

    plot_num = plot_no or prop["p_no"] or "PLOT-UNKNOWN"
    survey_num = survey_no or prop["s_no"] or "SY-DEFAULT"

    agr_code = f"PSA-{datetime.now().strftime('%Y%m')}-{property_id}{buyer_id}"
    cursor.execute("""
    INSERT INTO plot_sales (agreement_no, property_id, buyer_id, plot_no, survey_no, sale_date, agreed_price, booking_amount, payment_status, terms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (agr_code, property_id, buyer_id, plot_num, survey_num, sale_date, agreed_price, booking_amount, payment_status, terms, status))
    sale_id = cursor.lastrowid

    # Update property status
    new_prop_status = "sold" if status == "completed" else "reserved"
    cursor.execute("UPDATE properties SET status = ? WHERE id = ?", (new_prop_status, property_id))

    # Record receipt payment
    cursor.execute("SELECT name, phone FROM people WHERE id = ?", (buyer_id,))
    buyer = cursor.fetchone()
    rec_code = f"REC-{datetime.now().strftime('%Y')}-PS{sale_id}"
    amount_paid = agreed_price if payment_status == "fully_paid" else booking_amount
    cursor.execute("""
    INSERT INTO payments (receipt_no, payment_type, related_id, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes)
    VALUES (?, 'plot_sale', ?, ?, ?, ?, ?, ?, 'Bank Transfer', 'paid', ?, CURRENT_TIMESTAMP, ?)
    """, (rec_code, sale_id, property_id, buyer_id, buyer["name"], buyer["phone"], amount_paid, sale_date, f"Plot Sale settlement: {agr_code}"))

    # Add notification
    cursor.execute(
        "INSERT INTO notifications (title, message, category) VALUES (?, ?, 'sale')",
        ("Plot Sale Agreement Executed", f"Plot {plot_num} sold to {buyer['name']}. Agreement {agr_code} logged.")
    )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Plot sale agreement created successfully", "agreement_no": agr_code}), 201

# ============================================================================
# 9. MODULE 6: PAYMENT & BILLING MODULE
# ============================================================================

@app.route("/api/payments", methods=["GET"])
def get_payments():
    conn = get_db()
    cursor = conn.cursor()
    payment_type = request.args.get("type")
    status = request.args.get("status")
    search = request.args.get("search", "").strip()

    query = """
    SELECT py.*, pr.title as property_title, pr.address as property_address
    FROM payments py
    LEFT JOIN properties pr ON py.property_id = pr.id
    WHERE 1=1
    """
    params = []

    if payment_type and payment_type != "all":
        query += " AND py.payment_type = ?"
        params.append(payment_type)

    if status and status != "all":
        query += " AND py.payment_status = ?"
        params.append(status)

    if search:
        query += " AND (py.receipt_no LIKE ? OR py.payer_name LIKE ? OR pr.title LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])

    query += " ORDER BY py.id DESC"
    cursor.execute(query, params)
    payments = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "payments": payments})

@app.route("/api/payments", methods=["POST"])
def create_payment():
    data = request.get_json() or {}
    payment_type = data.get("payment_type", "rent")
    property_id = data.get("property_id")
    payer_id = data.get("payer_id")
    payer_name = data.get("payer_name", "").strip()
    payer_phone = data.get("payer_phone", "").strip()
    amount = float(data.get("amount") or 0)
    payment_method = data.get("payment_method", "Bank Transfer")
    payment_status = data.get("payment_status", "paid")
    due_date = data.get("due_date", date.today().isoformat())
    notes = data.get("notes", "")

    if not payer_name or amount <= 0:
        return jsonify({"success": False, "message": "Payer name and valid amount are required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    rec_code = f"REC-{datetime.now().strftime('%Y%m')}-{int(datetime.now().timestamp()) % 10000}"
    paid_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if payment_status == "paid" else None

    cursor.execute("""
    INSERT INTO payments (receipt_no, payment_type, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (rec_code, payment_type, property_id, payer_id, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at, notes))
    payment_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Payment recorded successfully", "receipt_no": rec_code, "payment_id": payment_id}), 201

@app.route("/api/payments/<int:payment_id>/status", methods=["PUT"])
def update_payment_status(payment_id):
    data = request.get_json() or {}
    new_status = data.get("status", "paid")
    conn = get_db()
    cursor = conn.cursor()

    paid_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if new_status == "paid" else None
    cursor.execute("UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?", (new_status, paid_at, payment_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Payment status updated to {new_status}"})

@app.route("/api/payments/<int:payment_id>/receipt", methods=["GET"])
def get_payment_receipt(payment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT py.*, pr.title as property_title, pr.address as property_address, pr.city as property_city,
           pr.property_type, p.email as payer_email, p.address as payer_address
    FROM payments py
    LEFT JOIN properties pr ON py.property_id = pr.id
    LEFT JOIN people p ON py.payer_id = p.id
    WHERE py.id = ?
    """, (payment_id,))
    receipt = cursor.fetchone()
    conn.close()

    if not receipt:
        return jsonify({"success": False, "message": "Receipt not found"}), 404

    return jsonify({"success": True, "receipt": dict_from_row(receipt)})

@app.route("/api/payments/pending", methods=["GET"])
def get_pending_payments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT py.*, pr.title as property_title
    FROM payments py
    LEFT JOIN properties pr ON py.property_id = pr.id
    WHERE py.payment_status IN ('pending', 'overdue')
    ORDER BY py.due_date ASC
    """)
    pending = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "pending_payments": pending})

# ============================================================================
# 10. MODULE 7: MAINTENANCE MANAGEMENT MODULE
# ============================================================================

@app.route("/api/maintenance", methods=["GET"])
def get_maintenance_requests():
    conn = get_db()
    cursor = conn.cursor()
    status = request.args.get("status")
    priority = request.args.get("priority")
    search = request.args.get("search", "").strip()

    query = """
    SELECT mr.*, pr.title as property_title, pr.address as property_address
    FROM maintenance_requests mr
    JOIN properties pr ON mr.property_id = pr.id
    WHERE 1=1
    """
    params = []

    if status and status != "all":
        query += " AND mr.status = ?"
        params.append(status)

    if priority and priority != "all":
        query += " AND mr.priority = ?"
        params.append(priority)

    if search:
        query += " AND (mr.ticket_no LIKE ? OR mr.title LIKE ? OR mr.tenant_name LIKE ? OR pr.title LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s, s])

    query += " ORDER BY mr.id DESC"
    cursor.execute(query, params)
    tickets = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "requests": tickets})

@app.route("/api/maintenance", methods=["POST"])
def raise_maintenance_request():
    data = request.get_json() or {}
    property_id = data.get("property_id")
    tenant_id = data.get("tenant_id")
    tenant_name = data.get("tenant_name", "").strip()
    category = data.get("category", "General")
    priority = data.get("priority", "medium")
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    estimated_cost = float(data.get("estimated_cost") or 0)

    if not property_id or not tenant_name or not title or not description:
        return jsonify({"success": False, "message": "Property, tenant name, title, and description are required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    ticket_code = f"MNT-{datetime.now().strftime('%Y%m')}-{int(datetime.now().timestamp()) % 1000}"
    cursor.execute("""
    INSERT INTO maintenance_requests (ticket_no, property_id, tenant_id, tenant_name, category, priority, title, description, status, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (ticket_code, property_id, tenant_id, tenant_name, category, priority, title, description, estimated_cost))
    ticket_id = cursor.lastrowid

    # Create alert notification
    cursor.execute(
        "INSERT INTO notifications (title, message, category) VALUES (?, ?, 'maintenance')",
        (f"Maintenance Request {ticket_code}", f"{priority.upper()} priority '{title}' logged by {tenant_name}.")
    )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Maintenance request raised successfully", "ticket_no": ticket_code, "id": ticket_id}), 201

@app.route("/api/maintenance/<int:ticket_id>", methods=["PUT"])
def update_maintenance_request(ticket_id):
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM maintenance_requests WHERE id = ?", (ticket_id,))
    ticket = cursor.fetchone()
    if not ticket:
        conn.close()
        return jsonify({"success": False, "message": "Ticket not found"}), 404

    status = data.get("status", ticket["status"])
    assigned_service_provider = data.get("assigned_service_provider", ticket["assigned_service_provider"])
    service_contact = data.get("service_contact", ticket["service_contact"])
    scheduled_date = data.get("scheduled_date", ticket["scheduled_date"])
    estimated_cost = float(data.get("estimated_cost") if data.get("estimated_cost") is not None else ticket["estimated_cost"])
    actual_cost = float(data.get("actual_cost") if data.get("actual_cost") is not None else ticket["actual_cost"])
    complaint_notes = data.get("complaint_notes", ticket["complaint_notes"])

    resolved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if status in ("resolved", "closed") else ticket["resolved_at"]

    cursor.execute("""
    UPDATE maintenance_requests SET
        status = ?, assigned_service_provider = ?, service_contact = ?, scheduled_date = ?,
        estimated_cost = ?, actual_cost = ?, complaint_notes = ?, resolved_at = ?
    WHERE id = ?
    """, (status, assigned_service_provider, service_contact, scheduled_date, estimated_cost, actual_cost, complaint_notes, resolved_at, ticket_id))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Maintenance ticket updated successfully"})

# ============================================================================
# 11. MODULE 8: REPORT & ANALYTICS MODULE
# ============================================================================

@app.route("/api/reports", methods=["GET"])
def get_reports_data():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Property Report
    cursor.execute("""
    SELECT property_type, status, COUNT(*) as count, SUM(price) as total_val, AVG(price) as avg_val
    FROM properties
    GROUP BY property_type, status
    """)
    property_summary = rows_to_dict_list(cursor.fetchall())

    # 2. Tenant Report
    cursor.execute("""
    SELECT p.id, p.name, p.phone, p.email, p.status,
           ra.agreement_no, ra.start_date, ra.end_date, ra.monthly_rent,
           pr.title as property_title
    FROM people p
    LEFT JOIN rent_agreements ra ON p.id = ra.tenant_id AND ra.status = 'active'
    LEFT JOIN properties pr ON ra.property_id = pr.id
    WHERE p.type = 'tenant'
    ORDER BY p.id DESC
    """)
    tenant_report = rows_to_dict_list(cursor.fetchall())

    # 3. Rent Collection Report
    cursor.execute("""
    SELECT py.id, py.receipt_no, py.payer_name, py.amount, py.payment_method, py.payment_status, py.due_date, py.paid_at,
           pr.title as property_title
    FROM payments py
    LEFT JOIN properties pr ON py.property_id = pr.id
    WHERE py.payment_type = 'rent'
    ORDER BY py.id DESC
    """)
    rent_collection_report = rows_to_dict_list(cursor.fetchall())

    # 4. House Sale Report
    cursor.execute("""
    SELECT hs.*, pr.title as property_title, pr.address, p.name as buyer_name, p.phone as buyer_phone
    FROM house_sales hs
    JOIN properties pr ON hs.property_id = pr.id
    JOIN people p ON hs.buyer_id = p.id
    ORDER BY hs.id DESC
    """)
    house_sale_report = rows_to_dict_list(cursor.fetchall())

    # 5. Plot Sale Report
    cursor.execute("""
    SELECT ps.*, pr.title as property_title, pr.area_sqft, p.name as buyer_name, p.phone as buyer_phone
    FROM plot_sales ps
    JOIN properties pr ON ps.property_id = pr.id
    JOIN people p ON ps.buyer_id = p.id
    ORDER BY ps.id DESC
    """)
    plot_sale_report = rows_to_dict_list(cursor.fetchall())

    # 6. Payment & Billing Report
    cursor.execute("""
    SELECT payment_type, payment_status, COUNT(*) as txn_count, SUM(amount) as total_amount
    FROM payments
    GROUP BY payment_type, payment_status
    """)
    payment_report = rows_to_dict_list(cursor.fetchall())

    # 7. Maintenance Report
    cursor.execute("""
    SELECT category, status, COUNT(*) as count, SUM(estimated_cost) as total_est, SUM(actual_cost) as total_act
    FROM maintenance_requests
    GROUP BY category, status
    """)
    maintenance_report = rows_to_dict_list(cursor.fetchall())

    conn.close()

    return jsonify({
        "success": True,
        "reports": {
            "property_summary": property_summary,
            "tenant_report": tenant_report,
            "rent_collection_report": rent_collection_report,
            "house_sale_report": house_sale_report,
            "plot_sale_report": plot_sale_report,
            "payment_report": payment_report,
            "maintenance_report": maintenance_report
        }
    })

@app.route("/api/reports/export/<report_type>", methods=["GET"])
def export_report_csv(report_type):
    """Export tabular reports directly to CSV for spreadsheet download."""
    conn = get_db()
    cursor = conn.cursor()
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "properties":
        cursor.execute("SELECT id, title, property_type, address, city, price, deposit, status, bedrooms, bathrooms, area_sqft FROM properties")
        rows = cursor.fetchall()
        writer.writerow(["ID", "Title", "Type", "Address", "City", "Price ($)", "Deposit ($)", "Status", "Beds", "Baths", "Area (sqft)"])
        for r in rows:
            writer.writerow(list(r))
    elif report_type == "tenants":
        cursor.execute("SELECT id, name, email, phone, id_proof_type, id_proof_number, occupation, status FROM people WHERE type = 'tenant'")
        rows = cursor.fetchall()
        writer.writerow(["ID", "Name", "Email", "Phone", "ID Type", "ID Number", "Occupation", "Status"])
        for r in rows:
            writer.writerow(list(r))
    elif report_type == "payments":
        cursor.execute("SELECT receipt_no, payment_type, payer_name, payer_phone, amount, payment_method, payment_status, due_date, paid_at FROM payments")
        rows = cursor.fetchall()
        writer.writerow(["Receipt No", "Payment Type", "Payer Name", "Phone", "Amount ($)", "Method", "Status", "Due Date", "Paid At"])
        for r in rows:
            writer.writerow(list(r))
    elif report_type == "maintenance":
        cursor.execute("SELECT ticket_no, tenant_name, category, priority, title, status, assigned_service_provider, estimated_cost, actual_cost FROM maintenance_requests")
        rows = cursor.fetchall()
        writer.writerow(["Ticket No", "Tenant", "Category", "Priority", "Title", "Status", "Service Provider", "Estimated Cost", "Actual Cost"])
        for r in rows:
            writer.writerow(list(r))
    else:
        conn.close()
        return jsonify({"success": False, "message": "Unknown export type"}), 400

    conn.close()
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename={report_type}_report_{date.today().isoformat()}.csv"
    response.headers["Content-type"] = "text/csv"
    return response

# ============================================================================
# 12. NOTIFICATIONS MODULE
# ============================================================================

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT 15")
    notifications = rows_to_dict_list(cursor.fetchall())
    conn.close()
    return jsonify({"success": True, "notifications": notifications})

@app.route("/api/notifications/<int:notif_id>/read", methods=["POST"])
def mark_notification_read(notif_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/notifications/clear", methods=["POST"])
def clear_all_notifications():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1")
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    flask_env = os.environ.get("FLASK_ENV", "production")

    if flask_env == "development":
        print(f"[DEV] Flask development server running at http://127.0.0.1:{port}")
        app.run(host="0.0.0.0", port=port, debug=True)
    else:
        # Production: use Waitress (Windows-compatible, high-performance WSGI server)
        from waitress import serve
        print(f"[PRODUCTION] Waitress server running at http://127.0.0.1:{port}")
        print(f"[PRODUCTION] Access the app at: http://127.0.0.1:{port}")
        serve(app, host="0.0.0.0", port=port, threads=6)
