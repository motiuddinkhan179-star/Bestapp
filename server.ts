import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("aliflaila.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer', -- 'customer', 'seller', 'admin'
    lat REAL,
    lng REAL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shop_name TEXT NOT NULL,
    bank_details TEXT,
    upi_id TEXT,
    lat REAL,
    lng REAL,
    approved INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  // Ensure sellers table has lat/lng if it already existed
  try { db.prepare("ALTER TABLE sellers ADD COLUMN lat REAL").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE sellers ADD COLUMN lng REAL").run(); } catch(e) {}

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    FOREIGN KEY (seller_id) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    platform_fee REAL DEFAULT 5.0,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'out_for_delivery', 'delivered', 'rejected'
    lat REAL,
    lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    balance REAL DEFAULT 0.0,
    pending_balance REAL DEFAULT 0.0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payout_date DATETIME,
    FOREIGN KEY (seller_id) REFERENCES sellers(id)
  );
`);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  app.use(express.json());

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
    });
    socket.on("join_seller", (sellerId) => {
      socket.join(`seller_${sellerId}`);
    });
  });

  // --- API ROUTES ---

  // Auth
  app.post("/api/auth/signup", (req, res) => {
    const { name, mobile, email, password, role, shopName, lat, lng } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (name, mobile, email, password, role, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const info = stmt.run(name, mobile, email, password, role || 'customer', lat, lng);
      const userId = info.lastInsertRowid;

      if (role === 'seller') {
        const sellerStmt = db.prepare("INSERT INTO sellers (user_id, shop_name, lat, lng) VALUES (?, ?, ?, ?)");
        sellerStmt.run(userId, shopName, lat, lng);
      }

      // Initialize wallet
      const walletStmt = db.prepare("INSERT INTO wallets (user_id) VALUES (?)");
      walletStmt.run(userId);

      res.json({ success: true, userId });
    } catch (error: any) {
      console.error("Signup Error:", error);
      res.status(400).json({ 
        error: error.message || "Signup failed",
        details: "If you are on Vercel, SQLite will not work because the file system is read-only. Please use a cloud database like Supabase, MongoDB, or Vercel Postgres."
      });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { mobile, password } = req.body;
      const user = db.prepare("SELECT * FROM users WHERE mobile = ? AND password = ?").get(mobile, password) as any;
      if (user) {
        let sellerInfo = null;
        if (user.role === 'seller') {
          sellerInfo = db.prepare("SELECT * FROM sellers WHERE user_id = ?").get(user.id);
        }
        res.json({ success: true, user: { ...user, sellerInfo } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Database error. If you are on Vercel, please use a cloud database like Supabase or MongoDB instead of SQLite." });
    }
  });

  app.patch("/api/users/:id/location", (req, res) => {
    const { lat, lng } = req.body;
    db.prepare("UPDATE users SET lat = ?, lng = ? WHERE id = ?").run(lat, lng, req.params.id);
    // If user is a seller, update seller location too
    db.prepare("UPDATE sellers SET lat = ?, lng = ? WHERE user_id = ?").run(lat, lng, req.params.id);
    res.json({ success: true });
  });

  // Products
  app.get("/api/products/nearby", (req, res) => {
    const { lat, lng, radius = 0.05 } = req.query; // 0.05 is roughly 5km
    
    let products;
    if (lat && lng) {
      products = db.prepare(`
        SELECT p.*, s.shop_name 
        FROM products p 
        JOIN sellers s ON p.seller_id = s.id 
        WHERE s.approved = 1 
        AND p.status = 'available'
        AND ABS(s.lat - ?) < ? 
        AND ABS(s.lng - ?) < ?
      `).all(lat, radius, lng, radius);
    } else {
      products = db.prepare(`
        SELECT p.*, s.shop_name 
        FROM products p 
        JOIN sellers s ON p.seller_id = s.id 
        WHERE s.approved = 1 AND p.status = 'available'
      `).all();
    }
    res.json(products);
  });

  app.get("/api/products/seller/:id", (req, res) => {
    const products = db.prepare("SELECT * FROM products WHERE seller_id = ?").all(req.params.id);
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { seller_id, name, description, price, image_url, category } = req.body;
    const stmt = db.prepare("INSERT INTO products (seller_id, name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(seller_id, name, description, price, image_url, category);
    res.json({ success: true });
  });

  app.patch("/api/products/:id/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE products SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Orders
  app.post("/api/orders", (req, res) => {
    const { customer_id, items, lat, lng } = req.body;
    // items: [{ product_id, quantity, price, seller_id }]
    // For simplicity, we assume one order per checkout, but in reality, 
    // if items are from different sellers, we should split them.
    // Here we'll just handle the first seller for the demo.
    const firstItem = items[0];
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    const stmt = db.prepare("INSERT INTO orders (customer_id, seller_id, total_amount, lat, lng) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(customer_id, firstItem.seller_id, totalAmount, lat, lng);
    const orderId = info.lastInsertRowid;

    const itemStmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
    for (const item of items) {
      itemStmt.run(orderId, item.product_id, item.quantity, item.price);
    }

    // Notify seller
    io.to(`seller_${firstItem.seller_id}`).emit("new_order", { orderId, totalAmount });

    res.json({ success: true, orderId });
  });

  app.get("/api/orders/customer/:id", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(req.params.id);
    res.json(orders);
  });

  app.get("/api/orders/seller/:id", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC").all(req.params.id);
    res.json(orders);
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);

    if (status === 'delivered') {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
      const amountToSeller = order.total_amount - order.platform_fee;
      
      // Update seller wallet
      db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = (SELECT user_id FROM sellers WHERE id = ?)").run(amountToSeller, order.seller_id);
    }

    // Notify customer
    const order = db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(orderId) as any;
    if (order) {
      io.to(`user_${order.customer_id}`).emit("order_status_update", { orderId, status });
    }

    res.json({ success: true });
  });

  // Wallet
  app.get("/api/wallet/:userId", (req, res) => {
    const wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(req.params.userId);
    res.json(wallet);
  });

  // Admin
  app.get("/api/admin/stats", (req, res) => {
    const users = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    const sellers = db.prepare("SELECT COUNT(*) as count FROM sellers").get() as any;
    const orders = db.prepare("SELECT COUNT(*) as count FROM orders").get() as any;
    const earnings = db.prepare("SELECT SUM(platform_fee) as total FROM orders WHERE status = 'delivered'").get() as any;
    res.json({ users: users.count, sellers: sellers.count, orders: orders.count, earnings: earnings.total || 0 });
  });

  app.get("/api/admin/sellers", (req, res) => {
    const sellers = db.prepare(`
      SELECT s.*, u.name, u.mobile, u.status 
      FROM sellers s 
      JOIN users u ON s.user_id = u.id
    `).all();
    res.json(sellers);
  });

  app.patch("/api/admin/sellers/:id/approve", (req, res) => {
    const { approved } = req.body;
    db.prepare("UPDATE sellers SET approved = ? WHERE id = ?").run(approved ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
