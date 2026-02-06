from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import bcrypt
import jwt
import os
import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DB_NAME = "school.db"
JWT_SECRET = os.getenv("JWT_SECRET", "school")
PORT = int(os.getenv("PORT", 3000))

# --- Database Helper ---
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, args)
        rv = cur.fetchall()
        
        # Determine if it was an INSERT/UPDATE/DELETE
        if query.strip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            conn.commit()
            last_id = cur.lastrowid
            changes = conn.total_changes
            conn.close()
            return {'insertId': last_id, 'affectedRows': changes}
        
        conn.close()
        return (rv[0] if rv else None) if one else rv
    except Exception as e:
        conn.close()
        raise e

# --- Middleware ---
from functools import wraps

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            # We can attach current_user to request context if needed, 
            # but for simple porting, we just pass.
            # Ideally verify user exists in DB too, but JWT valid is enough for now.
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 403
        
        return f(*args, **kwargs)
    return decorated

# Helper to get current user from token manually (e.g. for role check)
def get_current_user():
    token = request.headers.get('Authorization').split(" ")[1]
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

# --- Routes ---

# Serves static files (Frontend)
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Auth Login
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    table = 'admins'
    query_col = 'username'
    query_params = [username]
    query_sql = "SELECT * FROM admins WHERE LOWER(username) = LOWER(?)"

    if role == 'teacher':
        table = 'teachers'
        query_sql = "SELECT * FROM teachers WHERE LOWER(email) = LOWER(?)"
        query_params = [username]
    elif role == 'student':
        table = 'students'
        # Try parse ID
        try:
            db_id = int(username)
            if db_id > 2500000:
                db_id -= 2500000
            query_sql = "SELECT * FROM students WHERE id = ?"
            query_params = [db_id]
        except ValueError:
            query_sql = "SELECT * FROM students WHERE LOWER(name) = LOWER(?)"
            query_params = [username]

    try:
        user = query_db(query_sql, query_params, one=True)
        
        if not user:
            print(f"Login failed: User {username} not found in {table}")
            return jsonify({'message': 'Invalid credentials. User not found.'}), 401

        # Check password
        db_pass = user['password']
        if not db_pass:
             print("Login failed: User has no password set")
             return jsonify({'message': 'Access denied. Account not set up.'}), 401

        is_match = False
        if db_pass.startswith('$2b$'):
            # Bcrypt check
            # bcrypt.checkpw requires bytes
            is_match = bcrypt.checkpw(password.encode('utf-8'), db_pass.encode('utf-8'))
        else:
            # Plain text
            is_match = (password == db_pass)

        if not is_match:
             print("Login failed: Password mismatch")
             return jsonify({'message': 'Invalid credentials'}), 401

        # Token
        user_id = user['id']
        # Handle varying name fields
        name_field = user['username'] if 'username' in user.keys() else (user['name'] if 'name' in user.keys() else user['email'] if 'email' in user.keys() else 'User')
        
        token = jwt.encode({
            'id': user_id,
            'username': name_field,
            'role': role,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        }, JWT_SECRET, algorithm="HS256")

        return jsonify({
            'token': token,
            'user': {
                'id': user_id,
                'role': role,
                'name': user['name'] if 'name' in user.keys() else name_field,
                'username': name_field
            }
        })

    except Exception as e:
        print(f"Login Error: {e}")
        return jsonify({'error': str(e)}), 500


# Teachers API
@app.route('/api/teachers', methods=['GET'])
@token_required
def get_teachers():
    query = """
        SELECT t.*, c.name as class_name, s.name as subject_name 
        FROM teachers t
        LEFT JOIN teacher_assignments ta ON t.id = ta.teacher_id
        LEFT JOIN classes c ON ta.class_id = c.id
        LEFT JOIN subjects s ON ta.subject_id = s.id
    """
    rows = query_db(query)
    # Convert Row objects to dicts
    result = [dict(row) for row in rows]
    return jsonify(result)

@app.route('/api/teachers', methods=['POST'])
@token_required
def add_teacher():
    data = request.json
    try:
        hashed = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Transaction wrapper roughly
        res = query_db(
            "INSERT INTO teachers (name, email, password, phone, status) VALUES (?, ?, ?, ?, ?)",
            (data['name'], data['email'], hashed, data['phone'], data['status'])
        )
        teacher_id = res['insertId']
        
        if data.get('class_id') and data.get('subject_id'):
            query_db(
                "INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)",
                (teacher_id, data['class_id'], data['subject_id'])
            )
            
        return jsonify({'message': 'Teacher added successfully', 'id': teacher_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teachers/<int:id>', methods=['PUT'])
@token_required
def update_teacher(id):
    data = request.json
    try:
        query_db(
            "UPDATE teachers SET name = ?, email = ?, phone = ?, status = ? WHERE id = ?",
            (data['name'], data['email'], data['phone'], data['status'], id)
        )
        
        query_db("DELETE FROM teacher_assignments WHERE teacher_id = ?", (id,))
        
        if data.get('class_id') and data.get('subject_id'):
             query_db(
                "INSERT INTO teacher_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)",
                (id, data['class_id'], data['subject_id'])
            )
        return jsonify({'message': 'Teacher updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teachers/<int:id>', methods=['DELETE'])
@token_required
def delete_teacher(id):
    try:
        query_db("DELETE FROM teachers WHERE id = ?", (id,))
        return jsonify({'message': 'Teacher deleted successfully'})
    except Exception as e:
         return jsonify({'error': str(e)}), 500

# Students API
@app.route('/api/students', methods=['GET'])
@token_required
def get_students():
    query = "SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id"
    rows = query_db(query)
    return jsonify([dict(row) for row in rows])

@app.route('/api/students', methods=['POST'])
@token_required
def add_student():
    data = request.json
    try:
        res = query_db(
            "INSERT INTO students (name, age, gender, class_id, status, password) VALUES (?, ?, ?, ?, ?, ?)",
            (data['name'], data['age'], data['gender'], data['class_id'], data.get('status', 'Enrolled'), 'password')
        )
        return jsonify({'message': 'Student added successfully', 'id': res['insertId']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/students/<int:id>', methods=['PUT'])
@token_required
def update_student(id):
    data = request.json
    try:
        query_db(
            "UPDATE students SET name = ?, age = ?, gender = ?, class_id = ?, status = ? WHERE id = ?",
            (data['name'], data['age'], data['gender'], data['class_id'], data['status'], id)
        )
        return jsonify({'message': 'Student updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/students/<int:id>', methods=['DELETE'])
@token_required
def delete_student(id):
    try:
        query_db("DELETE FROM students WHERE id = ?", (id,))
        return jsonify({'message': 'Student deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admissions API
@app.route('/api/admissions', methods=['GET'])
@token_required
def get_admissions():
    query = "SELECT a.*, c.name as class_name FROM admissions a LEFT JOIN classes c ON a.class_applied_id = c.id"
    rows = query_db(query)
    return jsonify([dict(row) for row in rows])

@app.route('/api/admissions', methods=['POST'])
def public_admissions():
    data = request.json
    try:
        res = query_db(
            "INSERT INTO admissions (student_name, age, class_applied_id, parent_name, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
            (data['student_name'], data['age'], data['class_applied_id'], data['parent_name'], data['phone'], 'Pending')
        )
        return jsonify({'message': 'Application submitted', 'id': res['insertId']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admissions/<int:id>', methods=['PATCH'])
@token_required
def update_admission(id):
    data = request.json
    status = data['status']
    try:
        query_db("UPDATE admissions SET status = ? WHERE id = ?", (status, id))
        
        if status == 'Approved':
            admission = query_db("SELECT * FROM admissions WHERE id = ?", (id,), one=True)
            if admission:
                query_db(
                    "INSERT INTO students (name, age, class_id, status, password) VALUES (?, ?, ?, ?, ?)",
                    (admission['student_name'], admission['age'], admission['class_applied_id'], 'Enrolled', 'password')
                )
                return jsonify({'message': 'Admission approved and student enrolled'})
        
        return jsonify({'message': f'Admission {status.lower()}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Announcements
@app.route('/api/announcements', methods=['GET'])
def get_announcements():
    rows = query_db("SELECT * FROM announcements ORDER BY created_at DESC")
    return jsonify([dict(row) for row in rows])

@app.route('/api/announcements', methods=['POST'])
@token_required
def add_announcement():
    data = request.json
    try:
        res = query_db(
            "INSERT INTO announcements (title, content, audience) VALUES (?, ?, ?)",
            (data['title'], data['content'], data['audience'])
        )
        return jsonify({'message': 'Announcement posted', 'id': res['insertId']}), 201
    except Exception as e:
         return jsonify({'error': str(e)}), 500

@app.route('/api/announcements/<int:id>', methods=['DELETE'])
@token_required
def delete_announcement(id):
    try:
        query_db("DELETE FROM announcements WHERE id = ?", (id,))
        return jsonify({'message': 'Announcement deleted'})
    except Exception as e:
         return jsonify({'error': str(e)}), 500

# Helpers
@app.route('/api/classes', methods=['GET'])
def get_classes():
    rows = query_db("SELECT * FROM classes")
    return jsonify([dict(row) for row in rows])

@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    rows = query_db("SELECT * FROM subjects")
    return jsonify([dict(row) for row in rows])

@app.route('/api/stats', methods=['GET'])
@token_required
def get_stats():
    # Helper to count
    def count(table, where=None):
        q = f"SELECT COUNT(*) as count FROM {table}"
        if where: q += f" WHERE {where}"
        return query_db(q, one=True)['count']
    
    stats = {
        'totalStudents': count('students'),
        'totalTeachers': count('teachers'),
        'newAdmissions': count('admissions', 'status = "Pending"'),
        'pendingMessages': count('messages')
    }
    return jsonify(stats)

# Teacher Dashboard Specific
@app.route('/api/teacher/stats', methods=['GET'])
@token_required
def teacher_stats():
    user = get_current_user()
    if user['role'] != 'teacher': return jsonify({'message': 'Forbidden'}), 403
    
    teacher_id = user['id']
    
    q_studs = """
        SELECT COUNT(DISTINCT s.id) as count 
        FROM students s
        JOIN teacher_assignments ta ON s.class_id = ta.class_id
        WHERE ta.teacher_id = ?
    """
    students_count = query_db(q_studs, (teacher_id,), one=True)['count']
    
    q_msgs = "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND receiver_type = 'Teacher'"
    msgs_count = query_db(q_msgs, (teacher_id,), one=True)['count']
    
    return jsonify({'students': students_count, 'messages': msgs_count, 'pendingResults': 0})

@app.route('/api/teacher/pupils', methods=['GET'])
@token_required
def teacher_pupils():
    user = get_current_user()
    if user['role'] != 'teacher': return jsonify({'message': 'Forbidden'}), 403
    
    query = """
        SELECT s.*, c.name as class_name 
        FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN teacher_assignments ta ON c.id = ta.class_id
        WHERE ta.teacher_id = ?
    """
    rows = query_db(query, (user['id'],))
    return jsonify([dict(row) for row in rows])

# Results
@app.route('/api/results', methods=['POST'])
@token_required
def save_results():
    user = get_current_user()
    if user['role'] != 'teacher': return jsonify({'message': 'Forbidden'}), 403
    
    data = request.json
    term = 'Term 1'
    year = 2026
    
    exist = query_db(
        "SELECT id FROM results WHERE student_id = ? AND subject_id = ? AND term = ? AND year = ?",
        (data['student_id'], data['subject_id'], term, year), one=True
    )
    
    if exist:
        query_db("UPDATE results SET marks = ?, comments = ? WHERE id = ?", (data['marks'], data['comments'], exist['id']))
        return jsonify({'message': 'Result updated successfully'})
    else:
        query_db(
             "INSERT INTO results (student_id, subject_id, marks, comments, term, year) VALUES (?, ?, ?, ?, ?, ?)",
             (data['student_id'], data['subject_id'], data['marks'], data['comments'], term, year)
        )
        return jsonify({'message': 'Result saved successfully'}), 201

@app.route('/api/results', methods=['GET'])
@token_required
def get_teacher_results():
    user = get_current_user()
    if user['role'] != 'teacher': return jsonify({'message': 'Forbidden'}), 403
    
    query = """
        SELECT r.*, s.name as student_name, sub.name as subject_name
        FROM results r
        JOIN students s ON r.student_id = s.id
        JOIN subjects sub ON r.subject_id = sub.id
        JOIN teacher_assignments ta ON s.class_id = ta.class_id
        WHERE ta.teacher_id = ?
    """
    rows = query_db(query, (user['id'],))
    return jsonify([dict(row) for row in rows])

@app.route('/api/public/results', methods=['GET'])
def public_results():
    sid = request.args.get('student_id')
    name = request.args.get('name')
    term = request.args.get('term')
    
    if not (sid and name and term):
        return jsonify({'error': 'Missing required fields'}), 400
        
    try:
        db_id = int(sid)
        if db_id > 2500000: db_id -= 2500000
        
        query = """
            SELECT r.*, s.name as student_name, sub.name as subject_name 
            FROM results r
            JOIN students s ON r.student_id = s.id
            JOIN subjects sub ON r.subject_id = sub.id
            WHERE s.id = ? AND LOWER(TRIM(s.name)) = LOWER(TRIM(?)) AND r.term = ?
        """
        rows = query_db(query, (db_id, name, term))
        
        # Dedupe by subject (keep latest? SQL returns all rows. We just return all.)
        return jsonify([dict(row) for row in rows])
    except ValueError:
        return jsonify({'error': 'Invalid ID'}), 400


# Payments
@app.route('/api/payments', methods=['GET'])
@token_required
def get_payment_summary():
    # Only summary (per server.js implementation)
    query = """
        SELECT 
            s.id, s.name, 
            c.name as class_name, c.term_fee,
            COALESCE(SUM(p.amount), 0) as total_paid
        FROM students s
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN payments p ON s.id = p.student_id
        GROUP BY s.id
    """
    rows = query_db(query)
    summary = []
    for row in rows:
        r = dict(row)
        r['roll_no'] = (r['id'] or 0) + 2500000
        r['total_fees'] = r['term_fee']
        r['paid'] = r['total_paid']
        r['balance'] = r['term_fee'] - r['total_paid']
        r['status'] = 'Paid' if r['balance'] <= 0 else ('Partial' if r['total_paid'] > 0 else 'Unpaid')
        summary.append(r)
    return jsonify(summary)

@app.route('/api/payments/transactions', methods=['GET'])
@token_required
def get_payment_transactions():
    # Full transaction history
    query = """
        SELECT p.*, s.name as student_name, c.name as class_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        ORDER BY p.date DESC
    """
    rows = query_db(query)
    return jsonify([dict(row) for row in rows])

@app.route('/api/payments/<int:payment_id>', methods=['DELETE'])
@token_required
def delete_payment(payment_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('DELETE FROM payments WHERE id = ?', (payment_id,))
    db.commit()
    return jsonify({'message': 'Payment deleted successfully'})


@app.route('/api/payments/<int:student_id>', methods=['GET'])
@token_required
def get_student_payments(student_id):
    query = """
        SELECT * FROM payments WHERE student_id = ? ORDER BY date DESC
    """
    rows = query_db(query, [student_id])
    return jsonify([dict(row) for row in rows])

@app.route('/api/payments', methods=['POST'])
@token_required
def add_payment():
    data = request.json
    try:
        res = query_db(
            "INSERT INTO payments (student_id, amount, date, term, year, method) VALUES (?, ?, ?, ?, ?, ?)",
            [
                data.get('student_id'),
                data.get('amount'),
                data.get('date'),
                data.get('term'),
                data.get('year'),
                data.get('method')
            ]
        )
        return jsonify({'message': 'Payment added successfully', 'id': res['insertId']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print(f"Starting Python Flask Server on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
