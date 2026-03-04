import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Supabase Connection ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xoliigbbygwnjuavmjxe.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbGlpZ2JieWd3bmp1YXZtanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjQwMjQsImV4cCI6MjA4Nzg0MDAyNH0.u1B36D3OJlsTHGfg4--FMHGQ5e3mhFuq6AEs1L8KlPo";

if (!SUPABASE_URL) {
  console.error("CRITICAL: Supabase URL is missing!");
}

if (!SUPABASE_KEY) {
  console.warn("WARNING: Supabase API Key is missing. Please set VITE_SUPABASE_ANON_KEY in environment variables.");
}

// Check if the key looks like a Supabase key (JWT starts with eyJ)
if (SUPABASE_KEY && !SUPABASE_KEY.startsWith('eyJ')) {
  console.warn("WARNING: The SUPABASE_KEY provided starts with '" + SUPABASE_KEY.substring(0, 10) + "...'. A real Supabase key MUST start with 'eyJ'.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  // Health Check
  app.get("/api/health", async (req, res) => {
    const config = {
      url: SUPABASE_URL ? "Set" : "Missing",
      key: SUPABASE_KEY ? "Set" : "Missing",
      keyFormat: SUPABASE_KEY?.startsWith('eyJ') ? "Valid (JWT)" : "Invalid (Doesn't start with eyJ)"
    };

    if (!SUPABASE_KEY) {
      return res.status(500).json({ 
        status: "error", 
        supabase: "missing_key", 
        config,
        message: "Supabase API Key is missing.",
        hint: "Please add VITE_SUPABASE_ANON_KEY to your environment variables in AI Studio."
      });
    }

    if (SUPABASE_KEY && !SUPABASE_KEY.startsWith('eyJ')) {
      return res.status(500).json({ 
        status: "error", 
        supabase: "invalid_key", 
        config,
        message: "The API Key you provided is NOT a Supabase key.",
        hint: "Your key starts with 'sb_publishable_', which is for Stripe. Supabase keys MUST start with 'eyJ'. Please get the 'anon public' key from Supabase Settings -> API."
      });
    }

    try {
      // Check users table
      const { error: userTableError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      // Check sellers table
      const { error: sellerTableError } = await supabase
        .from('sellers')
        .select('*', { count: 'exact', head: true });
      
      if (userTableError || sellerTableError) {
        const missingTable = userTableError ? 'users' : 'sellers';
        console.error(`Supabase Table Missing (${missingTable}):`, userTableError || sellerTableError);
        return res.status(500).json({ 
          status: "error", 
          supabase: "failed", 
          config,
          errorType: "TABLE_MISSING",
          message: `Database table '${missingTable}' is missing. You need to run the setup script in Supabase.`,
          hint: "Copy the content of 'supabase_schema.sql' and run it in the Supabase SQL Editor."
        });
      }
      
      res.json({ 
        status: "ok", 
        supabase: "connected", 
        config,
        message: "Successfully connected to Supabase and verified all tables exist."
      });
    } catch (error: any) {
      console.error("Health Check Error:", error);
      res.status(500).json({ 
        status: "error", 
        supabase: "failed", 
        config,
        message: error.message,
        hint: "Check your Supabase URL and API Key in environment variables."
      });
    }
  });

  // Auth
  app.post("/api/auth/signup", async (req, res) => {
    const { name, mobile, email, password, role, shopName, lat, lng } = req.body;
    
    if (!name || !mobile || !password) {
      return res.status(400).json({ error: "Name, mobile, and password are required" });
    }

    try {
      // 1. Create User
      const latVal = (lat !== null && lat !== undefined && lat !== "") ? parseFloat(lat.toString()) : null;
      const lngVal = (lng !== null && lng !== undefined && lng !== "") ? parseFloat(lng.toString()) : null;

      const userData = { 
        name, 
        mobile, 
        email: email && email.trim() !== "" ? email : null,
        password, 
        role: mobile === '7709444275' ? 'admin' : (role === 'customer' ? 'user' : (role || 'user')),
        lat: isNaN(latVal as number) ? null : latVal,
        lng: isNaN(lngVal as number) ? null : lngVal,
        status: 'active'
      };

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (userError) {
        console.error("Supabase User Insert Error:", JSON.stringify(userError, null, 2));
        
        return res.status(400).json({ 
          error: userError.message || "Signup failed at User creation", 
          details: userError.details || JSON.stringify(userError),
          code: userError.code,
          hint: userError.hint || "Check if the 'users' table exists and has the correct columns."
        });
      }

      if (!user) {
        throw new Error("Failed to create user record");
      }

      // 2. Create Seller Record if applicable
      if (role === 'seller') {
        const { error: sellerError } = await supabase
          .from('sellers')
          .insert([{ 
            user_id: user.id, 
            shop_name: shopName || `${name}'s Shop`, 
            lat: userData.lat, 
            lng: userData.lng,
            approved: false,
            category: 'General',
            address: 'Not provided'
          }]);
        
        if (sellerError) {
          console.error("Supabase Seller Insert Error:", JSON.stringify(sellerError, null, 2));
          return res.status(400).json({ 
            error: "User created but seller profile failed", 
            details: sellerError.message,
            code: sellerError.code,
            hint: "Ensure the 'sellers' table exists in Supabase."
          });
        }
      }

      // 3. Create Wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .insert([{ user_id: user.id, balance: 0, pending_balance: 0 }]);
      
      if (walletError) {
        console.error("Supabase Wallet Insert Error:", JSON.stringify(walletError, null, 2));
        // Not fatal, but good to know
      }

      res.json({ success: true, userId: user.id });
    } catch (error: any) {
      console.error("Signup Error Details:", JSON.stringify(error, null, 2));
      res.status(400).json({ 
        error: error.message || "Signup failed",
        details: error.details || "Check if mobile/email already exists or if tables are missing."
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      const { data: user, error: loginError } = await supabase
        .from('users')
        .select('*')
        .eq('mobile', mobile)
        .eq('password', password)
        .single();

      if (loginError && loginError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Supabase Login Query Error:", JSON.stringify(loginError, null, 2));
        
        if (loginError.code === '42P01') {
          return res.status(500).json({ 
            error: "Database tables missing", 
            details: "The 'users' table does not exist. Please run the SQL schema in your Supabase dashboard."
          });
        }

        return res.status(500).json({ error: "Database error", details: loginError.message });
      }

      if (user) {
        // Auto-upgrade to admin if mobile matches
        if (mobile === '7709444275' && user.role !== 'admin') {
          const { data: updatedUser } = await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', user.id)
            .select()
            .single();
          if (updatedUser) {
            user.role = 'admin';
          }
        }

        let sellerInfo = null;
        if (user.role === 'seller') {
          const { data: seller } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', user.id)
            .single();
          sellerInfo = seller;
        }
        res.json({ success: true, user: { ...user, sellerInfo } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Database error. Check Supabase connection." });
    }
  });

  app.patch("/api/users/:id/location", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      await supabase.from('users').update({ lat, lng }).eq('id', req.params.id);
      await supabase.from('sellers').update({ lat, lng }).eq('user_id', req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { name, email } = req.body;
      const { data, error } = await supabase
        .from('users')
        .update({ name, email })
        .eq('id', req.params.id)
        .select()
        .single();
      
      if (error) throw error;
      res.json({ success: true, user: data });
    } catch (err) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Products
  app.get("/api/products/nearby", async (req, res) => {
    try {
      const { lat, lng, radius = 0.5 } = req.query; // Default to 0.5 (~55km)
      const latNum = lat ? parseFloat(lat as string) : NaN;
      const lngNum = lng ? parseFloat(lng as string) : NaN;
      const radNum = parseFloat(radius as string);

      let sellersQuery = supabase.from('sellers').select('*').eq('approved', true);
      
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        sellersQuery = sellersQuery
          .gt('lat', latNum - radNum)
          .lt('lat', latNum + radNum)
          .gt('lng', lngNum - radNum)
          .lt('lng', lngNum + radNum);
      }

      let { data: sellers, error: sellerError } = await sellersQuery;
      
      console.log(`[DEBUG] Nearby sellers found: ${sellers?.length || 0}`);

      if (!sellers || sellers.length === 0) {
        console.log("[DEBUG] No nearby sellers, falling back to all approved sellers");
        const { data: allSellers, error: allError } = await supabase
          .from('sellers')
          .select('*')
          .eq('approved', true);
        sellers = allSellers;
        sellerError = allError;
        console.log(`[DEBUG] All approved sellers found: ${sellers?.length || 0}`);
      }

      if (sellerError) {
        console.error("[DEBUG] Seller Query Error:", sellerError);
        throw sellerError;
      }

      if (!sellers || sellers.length === 0) {
        console.log("[DEBUG] No approved sellers found at all in the database.");
        // Check if there are ANY sellers at all (unapproved)
        const { count: totalSellers } = await supabase.from('sellers').select('*', { count: 'exact', head: true });
        console.log(`[DEBUG] Total sellers in DB (including unapproved): ${totalSellers || 0}`);
        res.json([]);
        return;
      }

      const sellerIds = sellers.map(s => s.id);
      console.log(`[DEBUG] Fetching products for seller IDs: ${sellerIds.join(', ')}`);
      
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .in('seller_id', sellerIds)
        .eq('status', 'available');

      if (productError) {
        console.error("[DEBUG] Product Query Error:", productError);
        throw productError;
      }

      console.log(`[DEBUG] Products found for these sellers: ${products?.length || 0}`);

      if (!products || products.length === 0) {
        // Check if these sellers have ANY products (even out of stock)
        const { data: anyProducts } = await supabase.from('products').select('id').in('seller_id', sellerIds);
        console.log(`[DEBUG] Total products (any status) for these sellers: ${anyProducts?.length || 0}`);
        
        // Check total products in DB
        const { count: totalProductsInDb } = await supabase.from('products').select('*', { count: 'exact', head: true });
        console.log(`[DEBUG] Total products in entire DB: ${totalProductsInDb || 0}`);
      }

      if (productError) throw productError;

      if (!products) {
        res.json([]);
        return;
      }

      // Map shop name
      const results = products.map(p => {
        const seller = sellers.find(s => s.id === p.seller_id);
        return {
          ...p,
          shop_name: seller?.shop_name || 'Unknown Shop'
        };
      });

      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/seller/:id", async (req, res) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', req.params.id);
    res.json(data || []);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { seller_id, name, description, price, image_url, category } = req.body;
      const { error } = await supabase
        .from('products')
        .insert([{ 
          seller_id, 
          name, 
          description, 
          price, 
          image_url, 
          category 
        }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to add product" });
    }
  });

  app.patch("/api/products/:id/status", async (req, res) => {
    const { status } = req.body;
    await supabase.from('products').update({ status }).eq('id', req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", async (req, res) => {
    await supabase.from('products').delete().eq('id', req.params.id);
    res.json({ success: true });
  });

  // Orders
  app.post("/api/orders", async (req, res) => {
    try {
      const { customer_id, items, lat, lng } = req.body;
      const firstItem = items[0];
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      
      const platformFee = totalAmount * 0.05; // 5% fee
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id,
          seller_id: firstItem.seller_id,
          total_amount: totalAmount,
          platform_fee: platformFee,
          delivery_lat: lat,
          delivery_lng: lng
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((i: any) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price: i.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      io.to(`seller_${firstItem.seller_id}`).emit("new_order", { orderId: order.id, totalAmount });
      res.json({ success: true, orderId: order.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders/customer/:id", async (req, res) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('customer_id', req.params.id)
      .order('created_at', { ascending: false });
    
    // Map to match frontend expectation if needed
    const results = (data || []).map(order => ({
      ...order,
      items: order.order_items.map((item: any) => ({
        ...item,
        name: item.products?.name,
        image_url: item.products?.image_url
      }))
    }));
    res.json(results);
  });

  app.get("/api/orders/seller/:id", async (req, res) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('seller_id', req.params.id)
      .order('created_at', { ascending: false });

    const results = (data || []).map(order => ({
      ...order,
      items: order.order_items.map((item: any) => ({
        ...item,
        name: item.products?.name,
        image_url: item.products?.image_url
      }))
    }));
    res.json(results);
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const orderId = req.params.id;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

      if (orderError) throw orderError;

      if (status === 'delivered' && order) {
        const amountToSeller = order.total_amount - order.platform_fee;
        const { data: seller } = await supabase.from('sellers').select('user_id').eq('id', order.seller_id).single();
        if (seller) {
          const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', seller.user_id).single();
          if (wallet) {
            await supabase.from('wallets').update({ balance: wallet.balance + amountToSeller }).eq('user_id', seller.user_id);
          }
        }
      }

      if (order) {
        io.to(`user_${order.customer_id}`).emit("order_status_update", { orderId, status });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Wallet
  app.get("/api/wallet/:userId", async (req, res) => {
    const { data } = await supabase.from('wallets').select('*').eq('user_id', req.params.userId).single();
    res.json(data);
  });

  // Admin
  app.get("/api/admin/stats", async (req, res) => {
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: sellerCount } = await supabase.from('sellers').select('*', { count: 'exact', head: true });
    const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { data: deliveredOrders } = await supabase.from('orders').select('platform_fee').eq('status', 'delivered');
    
    const totalEarnings = (deliveredOrders || []).reduce((sum, o) => sum + (o.platform_fee || 0), 0);
    
    res.json({ users: userCount || 0, sellers: sellerCount || 0, orders: orderCount || 0, earnings: totalEarnings });
  });

  app.get("/api/admin/sellers", async (req, res) => {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('*, users(*)');
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const results = (sellers || []).map((s: any) => ({
      ...s,
      name: s.users?.name,
      mobile: s.users?.mobile,
      status: s.users?.status
    }));
    res.json(results);
  });

  app.patch("/api/admin/sellers/:id/approve", async (req, res) => {
    const { approved } = req.body;
    await supabase.from('sellers').update({ approved: !!approved }).eq('id', req.params.id);
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
