// routes/api/reports.js - Report generation endpoints
const express = require('express');
const router = express.Router();

/**
 * POST /api/reports/generate
 * Generate comprehensive report
 */
router.post('/generate', (req, res) => {
  const { forecast, inventory, products, scenarios, format = 'json' } = req.body;

  try {
    const report = {
      generatedAt: new Date().toISOString(),
      reportId: `RPT-${Date.now()}`,
      summary: generateExecutiveSummary(forecast, inventory, products),
      forecast: forecast ? {
        periods: forecast.forecast?.length || 0,
        confidence: forecast.confidence || 0,
        totalPredicted: forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0,
        insights: forecast.insights || []
      } : null,
      inventory: inventory ? {
        totalProducts: inventory.healthMetrics?.length || 0,
        totalStock: inventory.summary?.totalStock || 0,
        totalValue: inventory.summary?.totalValue || 0,
        urgentOrders: inventory.urgentOrders || [],
        recommendations: inventory.optimalOrders || []
      } : null,
      scenarios: scenarios ? {
        analyzed: scenarios.length,
        risks: scenarios.filter(s => s.impact?.severity === 'high').length
      } : null,
      recommendations: generateRecommendations(forecast, inventory, products)
    };

    // Handle different formats
    if (format === 'pdf') {
      // Would generate PDF here
      res.json({
        success: true,
        message: 'PDF generation not implemented yet',
        report
      });
    } else {
      res.json({
        success: true,
        report
      });
    }

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate report'
    });
  }
});

/**
 * GET /api/reports/export
 * Export data in various formats
 */
router.get('/export', (req, res) => {
  const { type, format = 'csv' } = req.query;

  let data = [];
  let filename = `export-${Date.now()}`;

  // Generate sample data based on type
  if (type === 'forecast') {
    data = generateSampleForecast();
    filename += '-forecast';
  } else if (type === 'inventory') {
    data = generateSampleInventory();
    filename += '-inventory';
  } else if (type === 'products') {
    data = generateSampleProducts();
    filename += '-products';
  }

  if (format === 'csv') {
    // Convert to CSV
    const csv = convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    res.send(csv);
  } else if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
    res.json(data);
  } else {
    res.status(400).json({ success: false, error: 'Unsupported format' });
  }
});

/**
 * Helper: Generate executive summary
 */
function generateExecutiveSummary(forecast, inventory, products) {
  const summary = [];

  if (forecast) {
    const totalDemand = forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
    summary.push(`📊 Forecast: Expected demand of ${Math.round(totalDemand)} units over next ${forecast.forecast?.length || 30} days`);
  }

  if (inventory) {
    summary.push(`📦 Inventory: ${inventory.summary?.totalProducts || 0} products, ${inventory.summary?.totalStock || 0} units total stock`);
    if (inventory.urgentOrders?.length > 0) {
      summary.push(`⚠️ Urgent: ${inventory.urgentOrders.length} products need immediate reorder`);
    }
  }

  if (products) {
    summary.push(`🛍️ Products: ${products.length} active products in catalog`);
  }

  return summary;
}

/**
 * Helper: Generate recommendations
 */
function generateRecommendations(forecast, inventory, products) {
  const recs = [];

  if (inventory?.urgentOrders?.length > 0) {
    recs.push({
      priority: 'high',
      action: 'Place urgent orders for products with critically low stock',
      products: inventory.urgentOrders.slice(0, 3)
    });
  }

  if (forecast?.insights?.length > 0) {
    recs.push({
      priority: 'medium',
      action: forecast.insights[0],
      details: 'Based on forecast analysis'
    });
  }

  if (products?.length > 10) {
    recs.push({
      priority: 'low',
      action: 'Review ABC classification and adjust safety stock levels',
      details: 'Consider optimizing inventory for A-class items'
    });
  }

  return recs;
}

/**
 * Helper: Generate sample forecast data
 */
function generateSampleForecast() {
  const data = [];
  const startDate = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.round(100 + Math.random() * 50),
      upper_bound: Math.round(120 + Math.random() * 60),
      lower_bound: Math.round(80 + Math.random() * 40)
    });
  }
  
  return data;
}

/**
 * Helper: Generate sample inventory data
 */
function generateSampleInventory() {
  const products = ['Wireless Headphones', 'Smart Watch', 'Bluetooth Speaker', 'Laptop Backpack', 'Phone Case'];
  
  return products.map((name, i) => ({
    product: name,
    current_stock: Math.round(20 + Math.random() * 100),
    reorder_point: 30,
    safety_stock: 15,
    days_until_reorder: Math.round(Math.random() * 10),
    status: Math.random() > 0.7 ? 'Reorder' : 'OK'
  }));
}

/**
 * Helper: Generate sample products
 */
function generateSampleProducts() {
  return [
    { id: 'P001', name: 'Wireless Headphones', category: 'Electronics', price: 99.99, stock: 45 },
    { id: 'P002', name: 'Smart Watch', category: 'Electronics', price: 199.99, stock: 18 },
    { id: 'P003', name: 'Bluetooth Speaker', category: 'Electronics', price: 79.99, stock: 32 },
    { id: 'P004', name: 'Laptop Backpack', category: 'Accessories', price: 49.99, stock: 55 },
    { id: 'P005', name: 'Phone Case', category: 'Accessories', price: 19.99, stock: 120 }
  ];
}

/**
 * Helper: Convert to CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] || '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

module.exports = router;