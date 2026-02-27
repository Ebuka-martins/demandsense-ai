// routes/api/products.js - Product management endpoints
const express = require('express');
const router = express.Router();

// In-memory product database (replace with real DB in production)
let products = [
  { 
    id: 'P001', 
    name: 'Wireless Headphones', 
    category: 'Electronics', 
    unit_cost: 65.50, 
    unit_price: 99.90, 
    current_stock: 45,
    lead_time_days: 7, 
    reorder_point: 20, 
    safety_stock: 15,
    max_stock: 200,
    supplier: 'TechSupply Co.',
    sku: 'WH-001-BLK'
  },
  { 
    id: 'P002', 
    name: 'Smart Watch', 
    category: 'Electronics', 
    unit_cost: 120.00, 
    unit_price: 199.90, 
    current_stock: 18,
    lead_time_days: 10, 
    reorder_point: 15, 
    safety_stock: 10,
    max_stock: 100,
    supplier: 'WearableTech Inc.',
    sku: 'SW-002-SLV'
  },
  { 
    id: 'P003', 
    name: 'Bluetooth Speaker', 
    category: 'Electronics', 
    unit_cost: 45.00, 
    unit_price: 79.90, 
    current_stock: 32,
    lead_time_days: 5, 
    reorder_point: 25, 
    safety_stock: 20,
    max_stock: 150,
    supplier: 'AudioGear Ltd.',
    sku: 'BS-003-RED'
  },
  { 
    id: 'P004', 
    name: 'Laptop Backpack', 
    category: 'Accessories', 
    unit_cost: 25.00, 
    unit_price: 49.90, 
    current_stock: 55,
    lead_time_days: 6, 
    reorder_point: 30, 
    safety_stock: 25,
    max_stock: 200,
    supplier: 'CarryAll Inc.',
    sku: 'BP-004-GRY'
  },
  { 
    id: 'P005', 
    name: 'Phone Case', 
    category: 'Accessories', 
    unit_cost: 8.00, 
    unit_price: 19.90, 
    current_stock: 120,
    lead_time_days: 4, 
    reorder_point: 50, 
    safety_stock: 40,
    max_stock: 500,
    supplier: 'CaseMaster',
    sku: 'PC-005-BLK'
  }
];

/**
 * GET /api/products
 * Get all products
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    products,
    count: products.length
  });
});

/**
 * GET /api/products/:id
 * Get single product
 */
router.get('/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  res.json({
    success: true,
    product
  });
});

/**
 * POST /api/products
 * Create new product
 */
router.post('/', (req, res) => {
  const { name, category, unit_cost, unit_price, current_stock, lead_time_days, supplier, sku } = req.body;

  if (!name || !category || !unit_cost || !unit_price) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: name, category, unit_cost, unit_price' 
    });
  }

  // Generate new ID
  const newId = `P${String(products.length + 1).padStart(3, '0')}`;

  const newProduct = {
    id: newId,
    name,
    category,
    unit_cost: parseFloat(unit_cost),
    unit_price: parseFloat(unit_price),
    current_stock: parseInt(current_stock) || 0,
    lead_time_days: parseInt(lead_time_days) || 7,
    reorder_point: Math.floor(parseFloat(unit_cost) * 0.3), // Simple calculation
    safety_stock: Math.floor(parseFloat(unit_cost) * 0.2),
    max_stock: Math.floor(parseFloat(unit_cost) * 2),
    supplier: supplier || 'Unknown',
    sku: sku || `SKU-${newId}`
  };

  products.push(newProduct);

  res.status(201).json({
    success: true,
    product: newProduct,
    message: 'Product created successfully'
  });
});

/**
 * PUT /api/products/:id
 * Update product
 */
router.put('/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  // Update fields
  products[index] = {
    ...products[index],
    ...req.body,
    id: req.params.id // Ensure ID doesn't change
  };

  res.json({
    success: true,
    product: products[index],
    message: 'Product updated successfully'
  });
});

/**
 * DELETE /api/products/:id
 * Delete product
 */
router.delete('/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const deleted = products.splice(index, 1)[0];

  res.json({
    success: true,
    product: deleted,
    message: 'Product deleted successfully'
  });
});

/**
 * GET /api/products/category/:category
 * Get products by category
 */
router.get('/category/:category', (req, res) => {
  const categoryProducts = products.filter(p => 
    p.category.toLowerCase() === req.params.category.toLowerCase()
  );

  res.json({
    success: true,
    products: categoryProducts,
    count: categoryProducts.length,
    category: req.params.category
  });
});

/**
 * POST /api/products/bulk
 * Bulk import products
 */
router.post('/bulk', (req, res) => {
  const { products: newProducts } = req.body;

  if (!Array.isArray(newProducts)) {
    return res.status(400).json({ success: false, error: 'Products must be an array' });
  }

  const imported = [];
  const errors = [];

  newProducts.forEach((p, index) => {
    try {
      if (!p.name || !p.category) {
        throw new Error('Missing name or category');
      }

      const newId = `P${String(products.length + imported.length + 1).padStart(3, '0')}`;
      
      const product = {
        id: newId,
        name: p.name,
        category: p.category,
        unit_cost: parseFloat(p.unit_cost) || 0,
        unit_price: parseFloat(p.unit_price) || 0,
        current_stock: parseInt(p.current_stock) || 0,
        lead_time_days: parseInt(p.lead_time_days) || 7,
        reorder_point: parseInt(p.reorder_point) || 20,
        safety_stock: parseInt(p.safety_stock) || 15,
        max_stock: parseInt(p.max_stock) || 200,
        supplier: p.supplier || 'Unknown',
        sku: p.sku || `SKU-${newId}`
      };

      imported.push(product);
    } catch (error) {
      errors.push({ index, error: error.message });
    }
  });

  // Add all imported products
  products = [...products, ...imported];

  res.json({
    success: true,
    imported: imported.length,
    errors: errors.length > 0 ? errors : undefined,
    products: imported
  });
});

module.exports = router;