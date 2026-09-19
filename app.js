class POSApp {
    constructor() {
        this.products = [];
        this.cart = [];
        this.taxRate = 0.08;
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.terminalId = 'Terminal 1';
        this.orderNumber = 1;
        this.currentUser = null;
        this.barcodeBuffer = '';
        this.lastKeystrokeTime = 0;

        this.initElements();
        this.bindEvents();
        this.fetchProducts();
        this.initTheme();
        
        // Show login on load
        this.openModal('login-modal');

        // Polling
        setInterval(() => {
            if (this.currentUser) this.fetchProducts(true);
        }, 5000);
    }

    async fetchProducts(silent = false) {
        try {
            const response = await fetch('/api/products');
            this.products = await response.json();
            
            if (!silent) {
                this.renderCategories();
            }
            this.renderProducts();
        } catch (e) {
            console.error('Failed to fetch products', e);
            if (!silent) this.showToast('Failed to load products from server', 'error');
        }
    }

    initElements() {
        this.productGrid = document.getElementById('product-grid');
        this.cartItemsContainer = document.getElementById('cart-items');
        this.subtotalEl = document.getElementById('subtotal');
        this.taxEl = document.getElementById('tax');
        this.totalEl = document.getElementById('total');
        this.checkoutBtn = document.getElementById('checkout-btn');
        this.searchInput = document.getElementById('search-input');
        this.categoryContainer = document.getElementById('category-container');
        this.adminBtn = document.getElementById('admin-panel-btn');
        this.userNameEl = document.getElementById('current-user-name');
        this.terminalInput = document.getElementById('terminal-input');
        this.usernameInput = document.getElementById('username-input');
        this.passwordInput = document.getElementById('password-input');
        this.loginError = document.getElementById('login-error');
        this.cartSection = document.getElementById('cart-section');
        this.mobileCartBtn = document.getElementById('mobile-cart-btn');
        this.themeBtn = document.getElementById('theme-btn');
    }

    bindEvents() {
        this.passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });

        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderProducts();
        });

        this.checkoutBtn.addEventListener('click', () => {
            this.openModal('checkout-modal');
            document.getElementById('modal-total').innerText = this.formatPrice(this.calculateTotal().total);
        });

        // Global Scanner Listener
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            const currentTime = new Date().getTime();
            
            if (currentTime - this.lastKeystrokeTime > 50) {
                this.barcodeBuffer = '';
            }
            this.lastKeystrokeTime = currentTime;

            if (e.key === 'Enter' && this.barcodeBuffer.length > 0) {
                this.handleBarcodeScan(this.barcodeBuffer);
                this.barcodeBuffer = '';
            } else if (e.key.length === 1) {
                this.barcodeBuffer += e.key;
            }
        });
    }

    formatPrice(num) {
        return `₱${num.toFixed(2)}`;
    }

    updateOrderNumber() {
        // Obsolete, order number is returned from backend
    }

    initTheme() {
        const savedTheme = localStorage.getItem('pos-theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.themeBtn.innerText = '☀️';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('pos-theme', 'light');
            this.themeBtn.innerText = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('pos-theme', 'dark');
            this.themeBtn.innerText = '☀️';
        }
    }

    toggleMobileCart() {
        this.cartSection.classList.toggle('open');
    }

    renderCategories() {
        this.categoryContainer.innerHTML = '';
        
        // Extract unique categories
        const categories = ['all', ...new Set(this.products.map(p => p.category))];
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${this.currentCategory === cat ? 'active' : ''}`;
            btn.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);
            btn.dataset.category = cat;
            
            btn.addEventListener('click', (e) => {
                const allBtns = this.categoryContainer.querySelectorAll('.category-btn');
                allBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.renderProducts();
            });
            
            this.categoryContainer.appendChild(btn);
        });
    }

    renderProducts() {
        this.productGrid.innerHTML = '';
        
        const filteredProducts = this.products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(this.searchQuery);
            const matchesCategory = this.currentCategory === 'all' || p.category === this.currentCategory;
            return matchesSearch && matchesCategory;
        });

        filteredProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => this.addToCart(product);
            
            card.innerHTML = `
                <div class="product-emoji">${product.emoji}</div>
                <div class="product-name">${product.name}</div>
                <div class="product-price">${this.formatPrice(product.price)}</div>
                <div class="product-stock" style="margin-bottom: 4px;">Stock: ${product.stock}</div>
                <div class="product-stock" style="font-family: monospace;">#${product.barcode}</div>
            `;
            this.productGrid.appendChild(card);
        });
    }

    addToCart(product) {
        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }
        
        this.renderCart();
    }

    updateQuantity(id, delta) {
        const item = this.cart.find(i => i.id === id);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.cart = this.cart.filter(i => i.id !== id);
            }
            this.renderCart();
        }
    }

    calculateTotal() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + tax;
        return { subtotal, tax, total };
    }

    renderCart() {
        this.cartItemsContainer.innerHTML = '';

        if (this.cart.length === 0) {
            this.cartItemsContainer.innerHTML = '<div class="empty-cart-msg">Your cart is empty</div>';
            this.checkoutBtn.disabled = true;
        } else {
            this.checkoutBtn.disabled = false;
            this.cart.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                itemEl.innerHTML = `
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-price">${this.formatPrice(item.price)}</div>
                    </div>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="app.updateQuantity(${item.id}, -1)">-</button>
                        <span class="item-qty">${item.quantity}</span>
                        <button class="qty-btn" onclick="app.updateQuantity(${item.id}, 1)">+</button>
                    </div>
                `;
                this.cartItemsContainer.appendChild(itemEl);
            });
        }

        const totals = this.calculateTotal();
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        this.subtotalEl.innerText = this.formatPrice(totals.subtotal);
        this.taxEl.innerText = this.formatPrice(totals.tax);
        this.totalEl.innerText = this.formatPrice(totals.total);
        this.mobileCartBtn.innerText = `🛒 Cart (${totalItems}) - ${this.formatPrice(totals.total)}`;
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    async processPayment(method) {
        if (this.cart.length === 0) return;
        
        const totals = this.calculateTotal();
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart: this.cart,
                    total: totals.total,
                    method: method,
                    terminalId: this.terminalId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.orderNumber = data.order_id; // Set correct order ID
                this.closeModal('checkout-modal');
                this.generateReceipt(method);
                this.openModal('receipt-modal');
                this.fetchProducts(true); // refresh stock
            } else {
                this.showToast('Checkout failed on server', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Checkout error', 'error');
        }
    }

    generateReceipt(method) {
        const receiptContainer = document.getElementById('receipt-details');
        const totals = this.calculateTotal();
        const date = new Date().toLocaleString();
        
        let html = `
            <div class="receipt-row"><span>Order:</span><span>#ORD-${this.orderNumber.toString().padStart(3, '0')}</span></div>
            <div class="receipt-row"><span>Terminal:</span><span>${this.terminalId}</span></div>
            <div class="receipt-row"><span>Date:</span><span>${date}</span></div>
            <div class="receipt-row"><span>Payment:</span><span>${method.toUpperCase()}</span></div>
            <div class="receipt-divider"></div>
        `;

        this.cart.forEach(item => {
            html += `
                <div class="receipt-row">
                    <span>${item.quantity}x ${item.name}</span>
                    <span>${this.formatPrice(item.price * item.quantity)}</span>
                </div>
            `;
        });

        html += `
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>Subtotal:</span><span>${this.formatPrice(totals.subtotal)}</span></div>
            <div class="receipt-row"><span>Tax (8%):</span><span>${this.formatPrice(totals.tax)}</span></div>
            <div class="receipt-row" style="font-weight:bold; font-size:16px;"><span>Total:</span><span>${this.formatPrice(totals.total)}</span></div>
        `;

        receiptContainer.innerHTML = html;
    }

    newOrder() {
        this.closeModal('receipt-modal');
        this.cart = [];
        this.renderCart();
    }

    async login() {
        const username = this.usernameInput.value.toLowerCase();
        const password = this.passwordInput.value;
        const terminal = this.terminalInput.value || 'Terminal 1';
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                this.terminalId = terminal;
                this.loginError.classList.add('hidden');
                this.closeModal('login-modal');
                this.updateAuthUI();
                this.usernameInput.value = '';
                this.passwordInput.value = '';
            } else {
                this.loginError.classList.remove('hidden');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Cannot connect to server', 'error');
        }
    }

    logout() {
        this.currentUser = null;
        this.cart = [];
        this.renderCart();
        this.openModal('login-modal');
        this.updateAuthUI();
    }

    updateAuthUI() {
        if (!this.currentUser) return;
        
        this.userNameEl.innerText = `👤 ${this.currentUser.displayName}`;
        
        if (this.currentUser.role === 'admin') {
            this.adminBtn.classList.remove('hidden');
        } else {
            this.adminBtn.classList.add('hidden');
        }
    }

    openAdminPanel() {
        if (this.currentUser && this.currentUser.role === 'admin') {
            this.openModal('admin-menu-modal');
        } else {
            alert('Access Denied');
        }
    }

    openInventoryPanel() {
        this.closeModal('admin-menu-modal');
        this.renderInventory();
        this.openModal('inventory-modal');
    }

    async openReportsPanel() {
        this.closeModal('admin-menu-modal');
        try {
            const res = await fetch('/api/reports');
            if (res.ok) {
                const data = await res.json();
                
                document.getElementById('report-daily-rev').innerText = this.formatPrice(data.daily.revenue);
                document.getElementById('report-daily-ord').innerText = `${data.daily.count} Orders`;
                
                document.getElementById('report-monthly-rev').innerText = this.formatPrice(data.monthly.revenue);
                document.getElementById('report-monthly-ord').innerText = `${data.monthly.count} Orders`;
                
                document.getElementById('report-alltime-rev').innerText = this.formatPrice(data.all_time.revenue);
                document.getElementById('report-alltime-ord').innerText = `${data.all_time.count} Orders`;
                
                // Best Sellers
                const bsList = document.getElementById('best-sellers-list');
                bsList.innerHTML = '';
                if (data.top_products && data.top_products.length > 0) {
                    data.top_products.forEach(p => {
                        bsList.innerHTML += `<li>
                            <span>${p.emoji} ${p.name}</span>
                            <strong>${p.sold} sold</strong>
                        </li>`;
                    });
                } else {
                    bsList.innerHTML = '<li><span style="color:var(--text-muted)">No sales data yet</span></li>';
                }

                // Payment Methods
                const payStats = document.getElementById('payment-stats');
                payStats.innerHTML = '';
                if (data.payment_methods && data.payment_methods.length > 0) {
                    data.payment_methods.forEach(m => {
                        payStats.innerHTML += `<div class="payment-bar">
                            <span style="text-transform: capitalize;">${m.method}</span>
                            <strong>${m.count} Orders</strong>
                        </div>`;
                    });
                } else {
                    payStats.innerHTML = '<div class="payment-bar" style="color:var(--text-muted)">No transactions yet</div>';
                }

                this.openModal('reports-modal');
            } else {
                this.showToast('Failed to load reports', 'error');
            }
        } catch (e) {
            this.showToast('Network error loading reports', 'error');
        }
    }

    renderInventory() {
        const tbody = document.getElementById('inventory-tbody');
        tbody.innerHTML = '';
        this.products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.emoji}</td>
                <td>${p.name}</td>
                <td>${p.barcode}</td>
                <td>${p.category}</td>
                <td>${this.formatPrice(p.price)}</td>
                <td>${p.stock}</td>
                <td class="inventory-actions">
                    <button class="done-btn" onclick="app.editProduct(${p.id})">Edit</button>
                    <button class="cancel-btn" onclick="app.deleteProduct(${p.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    editProduct(id) {
        const p = this.products.find(x => x.id === id);
        if (!p) return;
        document.getElementById('edit-id').value = p.id;
        document.getElementById('edit-barcode').value = p.barcode;
        document.getElementById('edit-name').value = p.name;
        document.getElementById('edit-category').value = p.category;
        document.getElementById('edit-price').value = p.price;
        document.getElementById('edit-stock').value = p.stock;
        document.getElementById('edit-emoji').value = p.emoji;
        this.openModal('edit-product-modal');
    }

    async saveProductEdit() {
        const id = document.getElementById('edit-id').value;
        const payload = {
            barcode: document.getElementById('edit-barcode').value,
            name: document.getElementById('edit-name').value,
            category: document.getElementById('edit-category').value.toLowerCase().trim(),
            price: parseFloat(document.getElementById('edit-price').value),
            stock: parseInt(document.getElementById('edit-stock').value, 10),
            emoji: document.getElementById('edit-emoji').value
        };
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                this.closeModal('edit-product-modal');
                this.showToast('Product updated', 'success');
                await this.fetchProducts(true);
                this.renderInventory();
            } else {
                this.showToast('Failed to update product', 'error');
            }
        } catch(e) {
            this.showToast('Network error', 'error');
        }
    }

    async deleteProduct(id) {
        if (!confirm("Are you sure you want to delete this product?")) return;
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Product deleted', 'success');
                await this.fetchProducts(true);
                this.renderInventory();
            } else {
                this.showToast('Failed to delete product', 'error');
            }
        } catch(e) {
            this.showToast('Network error', 'error');
        }
    }

    handleBarcodeScan(barcode) {
        if (!this.currentUser) return; // Prevent scanning if not logged in

        const product = this.products.find(p => p.barcode === barcode);
        if (product) {
            this.addToCart(product);
            this.showToast(`Scanned: ${product.name}`, 'success');
        } else {
            if (this.currentUser.role === 'admin') {
                this.showToast(`New barcode detected`, 'success');
                document.getElementById('new-barcode').value = barcode;
                document.getElementById('new-name').value = '';
                document.getElementById('new-price').value = '';
                document.getElementById('new-category').value = '';
                document.getElementById('new-stock').value = '';
                document.getElementById('new-emoji').value = '';
                this.openModal('add-product-modal');
            } else {
                this.showToast(`Item not found: ${barcode}`, 'error');
            }
        }
    }

    async saveNewProduct() {
        const barcode = document.getElementById('new-barcode').value;
        const name = document.getElementById('new-name').value;
        const price = parseFloat(document.getElementById('new-price').value);
        const category = document.getElementById('new-category').value.toLowerCase().trim();
        const stock = parseInt(document.getElementById('new-stock').value, 10);
        const emoji = document.getElementById('new-emoji').value || '📦';
        
        if (!name || isNaN(price) || !category) {
            this.showToast('Please fill required fields', 'error');
            return;
        }

        const newProduct = {
            barcode,
            name,
            price,
            category,
            stock: isNaN(stock) ? 0 : stock,
            emoji
        };

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });

            if (response.ok) {
                const savedProduct = await response.json();
                this.products.push(savedProduct);
                this.renderCategories();
                this.renderProducts();
                
                this.closeModal('add-product-modal');
                this.showToast(`Added ${name} to catalog`, 'success');
                this.addToCart(savedProduct);
            } else {
                const err = await response.json();
                this.showToast(err.error || 'Failed to save product', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Cannot connect to server', 'error');
        }
    }

    showToast(message, type) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize app globally so inline onclick handlers work
const app = new POSApp();
