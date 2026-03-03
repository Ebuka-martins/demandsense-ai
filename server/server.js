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

// ==========================
// Enhanced Environment Variable Loading
// ==========================

// Determine which env file to use based on NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = NODE_ENV === 'production' ? '.env' : '.env.local';
const envPath = path.join(__dirname, '..', envFile);

// Try to load from the environment-specific file first
if (fs.existsSync(envPath)) {
    console.log(`📝 Loading environment from ${envFile}`);
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.warn(`⚠️  Error loading ${envFile}:`, result.error.message);
    }
} else {
    console.log(`ℹ️  No ${envFile} found, falling back to environment variables`);
    // Fall back to default .env or system environment
    dotenv.config();
}

// Validate required environment variables
const requiredEnvVars = ['GROQ_API_KEY', 'DEEPSEEK_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    if (NODE_ENV === 'production') {
        console.error('❌ Missing required environment variables in production:', missingEnvVars.join(', '));
        process.exit(1);
    } else {
        console.warn('\x1b[33m%s\x1b[0m', `⚠️  Missing API keys: ${missingEnvVars.join(', ')}`);
        console.warn('\x1b[33m%s\x1b[0m', '   The app will use mock data for development.');
        console.warn('\x1b[33m%s\x1b[0m', '   Create a .env.local file with your API keys to enable AI features.');
    }
}

// Import route modules
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
// Static file serving with proper MIME types
// ==========================

// Serve static files with proper caching headers
app.use(express.static(path.join(__dirname, '../assets'), {
    index: false, // Don't serve index.html automatically
    setHeaders: (res, filePath) => {
        // Set proper MIME types
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
        
        // Cache static assets for 1 year
        if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            // Don't cache HTML files
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Serve JavaScript files from src directory with proper MIME types
app.use('/src', express.static(path.join(__dirname, '../assets', 'src'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

// Serve icon files
app.use('/icons', express.static(path.join(__dirname, '../assets', 'icons'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use('/favicon', express.static(path.join(__dirname, '../assets', 'favicon'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
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
// Request logging middleware (development only)
// ==========================
if (NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
  });
}

// ==========================
// API Routes - These must come BEFORE page routes
// ==========================
app.use('/api/forecast', forecastRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.1',
    features: {
      ai: !!(process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY)
    }
  });
});

// Sample data endpoints
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
// Page Routes - these come AFTER API routes
// ==========================

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'login.html'), (err) => {
    if (err) {
      console.error('Error serving login.html:', err);
      res.status(500).send('Server Error');
    }
  });
});

// Main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../assets', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Server Error');
    }
  });
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
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
});

// ==========================
// SPA Catch-all route - This must be AFTER all other routes
// ==========================
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.url.startsWith('/api/')) {
    return next();
  }
  
  // Skip static assets that might have been missed
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  // For any other GET request, serve index.html (SPA support)
  console.log('🔄 SPA fallback:', req.url);
  res.sendFile(path.join(__dirname, '../assets', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html for SPA route:', err);
      res.status(500).send('Server Error');
    }
  });
});

// ==========================
// Error handling middleware
// ==========================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==========================
// 404 handler for API routes
// ==========================
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found'
  });
});

// ==========================
// Start server
// ==========================
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 DemandSense AI v1.0.1`);
  console.log('='.repeat(50));
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
  console.log(`📱 PWA: http://localhost:${PORT}/manifest.json`);
  console.log('-'.repeat(50));
  console.log(`🤖 AI Features: ${process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY ? '✅ Enabled' : '⚠️  Disabled (mock mode)'}`);
  console.log(`🎨 Theme: Neon Pink/Red`);
  console.log('='.repeat(50) + '\n');
});