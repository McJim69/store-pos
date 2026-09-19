from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import sys

# PyInstaller compatibility
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = sys._MEIPASS
    db_path = os.path.join(os.path.dirname(sys.executable), 'pos.db')
else:
    # Running as normal python script
    application_path = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(application_path, 'pos.db')

app = Flask(__name__, static_folder=application_path, static_url_path='')
CORS(app)

DATABASE = db_path

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, password)).fetchone()
    conn.close()
    
    if user is None:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'displayName': user['display_name']
    })

@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db_connection()
    products = conn.execute('SELECT * FROM products').fetchall()
    conn.close()
    
    return jsonify([dict(p) for p in products])

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.json
    barcode = data.get('barcode')
    name = data.get('name')
    price = data.get('price')
    category = data.get('category')
    emoji = data.get('emoji')
    stock = data.get('stock')
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO products (barcode, name, price, category, emoji, stock) VALUES (?, ?, ?, ?, ?, ?)',
            (barcode, name, price, category, emoji, stock)
        )
        conn.commit()
        new_id = cur.lastrowid
        
        product = conn.execute('SELECT * FROM products WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict(product)), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Product with this barcode already exists'}), 400

@app.route('/api/products/<int:id>', methods=['PUT'])
def update_product(id):
    data = request.json
    try:
        conn = get_db_connection()
        conn.execute(
            'UPDATE products SET barcode=?, name=?, price=?, category=?, stock=?, emoji=? WHERE id=?',
            (data['barcode'], data['name'], data['price'], data['category'], data['stock'], data['emoji'], id)
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'Updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/<int:id>', methods=['DELETE'])
def delete_product(id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM products WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/reports', methods=['GET'])
def get_reports():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Daily
        cur.execute("SELECT SUM(total) as revenue, COUNT(id) as count FROM transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime')")
        daily = cur.fetchone()
        
        # Monthly
        cur.execute("SELECT SUM(total) as revenue, COUNT(id) as count FROM transactions WHERE strftime('%Y-%m', timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')")
        monthly = cur.fetchone()
        
        # All-Time
        cur.execute("SELECT SUM(total) as revenue, COUNT(id) as count FROM transactions")
        all_time = cur.fetchone()
        
        # Top Products
        cur.execute("""
            SELECT p.name, p.emoji, SUM(ti.quantity) as sold 
            FROM transaction_items ti
            JOIN products p ON ti.product_id = p.id
            GROUP BY ti.product_id
            ORDER BY sold DESC
            LIMIT 5
        """)
        top_products = [dict(row) for row in cur.fetchall()]
        
        # Payment Methods
        cur.execute("""
            SELECT method, COUNT(id) as count 
            FROM transactions
            GROUP BY method
        """)
        payment_methods = [dict(row) for row in cur.fetchall()]
        
        conn.close()
        return jsonify({
            'daily': {'revenue': daily['revenue'] or 0, 'count': daily['count']},
            'monthly': {'revenue': monthly['revenue'] or 0, 'count': monthly['count']},
            'all_time': {'revenue': all_time['revenue'] or 0, 'count': all_time['count']},
            'top_products': top_products,
            'payment_methods': payment_methods
        }), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/checkout', methods=['POST'])
def checkout():
    data = request.json
    cart = data.get('cart', [])
    total = data.get('total', 0)
    method = data.get('method', 'cash')
    terminal_id = data.get('terminalId', 'Unknown')
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Record transaction
        cur.execute(
            'INSERT INTO transactions (total, method, terminal_id) VALUES (?, ?, ?)',
            (total, method, terminal_id)
        )
        order_id = cur.lastrowid
        
        # Insert line items and update stock
        for item in cart:
            cur.execute(
                'INSERT INTO transaction_items (transaction_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                (order_id, item['id'], item['quantity'], item['price'])
            )
            cur.execute(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                (item['quantity'], item['id'])
            )
            
        conn.commit()
        conn.close()
        return jsonify({'message': 'Checkout successful', 'order_id': order_id}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run production server
    app.run(host='0.0.0.0', port=5000, debug=False)
