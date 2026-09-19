import sqlite3

def init_db():
    connection = sqlite3.connect('pos.db')

    with open('schema.sql') as f:
        connection.executescript(f.read())

    cur = connection.cursor()

    # Insert mock users
    cur.execute("INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)",
                ('admin', '123', 'admin', 'Admin'))
    cur.execute("INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)",
                ('cashier', '123', 'cashier', 'Cashier'))

    # Insert mock products
    products = [
        ('100001', 'Potato Chips', 2.50, 'snacks', '🥔', 45),
        ('100002', 'Chocolate Bar', 1.75, 'snacks', '🍫', 30),
        ('100003', 'Energy Drink', 3.00, 'drinks', '⚡', 25),
        ('100004', 'Bottled Water', 1.00, 'drinks', '💧', 100),
        ('100005', 'Cola Soda', 1.50, 'drinks', '🥤', 60),
        ('100006', 'Gum', 0.99, 'snacks', '🍬', 80),
        ('100007', 'Toothpaste', 4.50, 'essentials', '🪥', 15),
        ('100008', 'Tissues', 2.00, 'essentials', '🧻', 40),
        ('100009', 'Iced Coffee', 3.50, 'drinks', '☕', 20),
        ('100010', 'Pretzels', 2.25, 'snacks', '🥨', 35),
    ]

    cur.executemany("INSERT INTO products (barcode, name, price, category, emoji, stock) VALUES (?, ?, ?, ?, ?, ?)", products)

    connection.commit()
    connection.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized.")
