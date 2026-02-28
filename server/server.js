// server/server.js - Main Express server with neon pink/red aesthetics support
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Import route modules - FIXED PATHS (going up one level to root routes folder)
const forecastRoutes = require('../routes/api/forecast');
const inventoryRoutes = require('../routes/api/inventory');
const productRoutes = require('../routes/api/products');
const scenarioRoutes = require('../routes/api/scenarios');
const reportRoutes = require('../routes/api/reports');
const authRoutes = require('../routes/api/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================
// Security & Performance - UPDATED CSP for neon theme
// ==========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 
                    'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        scriptSrcElem: ["'self'", "'unsafe-inline'", 
                        'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrcElem: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://api.groq.com', 'https://api.deepseek.com'],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'"],
        manifestSrc: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================
// Static file serving
// ==========================
app.use(express.static(path.join(__dirname, '../assets'), {
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') || path.endsWith('.jpg')) {
      res.set('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Serve JavaScript files from src directory
app.use('/src', express.static(path.join(__dirname, '../assets', 'src'), {
  maxAge: '1y'
}));

// Serve icon files
app.use('/icons', express.static(path.join(__dirname, '../assets', 'icons'), {
  maxAge: '1y'
}));

app.use('/favicon', express.static(path.join(__dirname, '../assets', 'favicon'), {
  maxAge: '1y'
}));

// ==========================
// Ensure uploads directory exists
// ==========================
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==========================
// Multer setup for file uploads
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.xlsx', '.xls', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Unsupported file type. Please upload CSV, Excel, or JSON.'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

// Make upload available to routes
app.locals.upload = upload;

// ==========================
// Page Routes
// ==========================

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'login.html'));
});

// Main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'index.html'));
});

// Serve manifest and service worker
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'manifest.json'), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
});

app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'service-worker.js'), {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache'
    }
  });
});

// ==========================
// API Routes
// ==========================
app.use('/api/forecast', forecastRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);

// ==========================
// Health check
// ==========================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==========================
// Sample data endpoints
// ==========================
app.get('/api/sample/sales', (req, res) => {
  const sampleData = [
    { date: '2024-01-01', product_id: 'P001', product_name: 'Wireless Headphones', sales: 45, revenue: 4495.50, region: 'North' },
    { date: '2024-01-01', product_id: 'P002', product_name: 'Smart Watch', sales: 32, revenue: 6396.80, region: 'North' },
    { date: '2024-01-01', product_id: 'P003', product_name: 'Bluetooth Speaker', sales: 28, revenue: 2797.20, region: 'North' },
    { date: '2024-01-02', product_id: 'P001', product_name: 'Wireless Headphones', sales: 52, revenue: 5194.80, region: 'South' },
    { date: '2024-01-02', product_id: 'P002', product_name: 'Smart Watch', sales: 41, revenue: 8195.90, region: 'South' },
    { date: '2024-01-02', product_id: 'P003', product_name: 'Bluetooth Speaker', sales: 35, revenue: 3496.50, region: 'South' }
  ];
  res.json({ success: true, data: sampleData });
});

app.get('/api/sample/products', (req, res) => {
  const products = [
    { id: 'P001', name: 'Wireless Headphones', category: 'Electronics', unit_cost: 65.50, unit_price: 99.90, lead_time_days: 7, reorder_point: 20, safety_stock: 15 },
    { id: 'P002', name: 'Smart Watch', category: 'Electronics', unit_cost: 120.00, unit_price: 199.90, lead_time_days: 10, reorder_point: 15, safety_stock: 10 },
    { id: 'P003', name: 'Bluetooth Speaker', category: 'Electronics', unit_cost: 45.00, unit_price: 79.90, lead_time_days: 5, reorder_point: 25, safety_stock: 20 },
    { id: 'P004', name: 'Laptop Backpack', category: 'Accessories', unit_cost: 25.00, unit_price: 49.90, lead_time_days: 6, reorder_point: 30, safety_stock: 25 },
    { id: 'P005', name: 'Phone Case', category: 'Accessories', unit_cost: 8.00, unit_price: 19.90, lead_time_days: 4, reorder_point: 50, safety_stock: 40 }
  ];
  res.json({ success: true, data: products });
});

// ==========================
// Error handling middleware
// ==========================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ==========================
// Start server
// ==========================
app.listen(PORT, () => {
  console.log(`\n🚀 DemandSense AI running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}/`);
  console.log(`🔐 Login page: http://localhost:${PORT}/login`);
  console.log(`📱 PWA ready: http://localhost:${PORT}/manifest.json`);
  console.log(`\n🎨 Neon Pink/Red theme active\n`);
});