// routes/api/inventory.js - Inventory optimization endpoints
const express = require('express');
const router = express.Router();

const inventoryCalculator = require('../../server/inventory-calculator');

// In-memory inventory sessions
const inventorySessions = new Map();

/**
 * POST /api/inventory/optimize
 * Calculate inventory optimization metrics using actual forecast data
 */
router.post('/optimize', async (req, res) => {
  const { products, salesData, forecast, sessionId } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, error: 'Products data required' });
  }

  const newSessionId = sessionId || `inv_${Date.now()}`;

  try {
    console.log('📊 Calculating inventory metrics with forecast data...');
    console.log(`Products: ${products.length}, Sales records: ${salesData?.length || 0}`);
    
    // Calculate health metrics using actual sales data and forecast
    const healthMetrics = inventoryCalculator.calculateHealthMetrics(
      products,
      salesData || [],
      forecast || {}
    );

    // Calculate ABC classification based on actual sales data
    // Calculate annual value from sales data if available
    let productsWithValue = products;
    if (salesData && salesData.length > 0) {
      // Calculate actual sales value from historical data
      const productSales = {};
      
      salesData.forEach(sale => {
        // Try multiple possible field names for product identification
        const productId = sale.product_id || sale.productId || sale.ProductID;
        const productName = sale.product_name || sale.productName || sale.product || sale.Product;
        const salesValue = parseFloat(sale.sales || sale.Sales || sale.quantity || sale.Quantity || 0);
        const revenue = parseFloat(sale.revenue || sale.Revenue || 0);
        
        if (isNaN(salesValue)) return;
        
        // Try to match by name first (since your sales data uses names)
        let matchedProduct = null;
        if (productName) {
          matchedProduct = products.find(p => 
            p.name && p.name.toLowerCase() === productName.toLowerCase()
          );
        }
        
        // If not found by name, try by ID
        if (!matchedProduct && productId) {
          matchedProduct = products.find(p => 
            p.id === productId || p.productId === productId
          );
        }
        
        if (matchedProduct) {
          const key = matchedProduct.id;
          if (!productSales[key]) {
            productSales[key] = { totalUnits: 0, totalRevenue: 0 };
          }
          productSales[key].totalUnits += salesValue;
          productSales[key].totalRevenue += revenue || (salesValue * (matchedProduct.unit_price || 0));
        }
      });

      console.log('Product sales calculated:', Object.keys(productSales).length, 'products matched');

      productsWithValue = products.map(p => ({
        ...p,
        annualValue: productSales[p.id] ? 
          (productSales[p.id].totalRevenue * 12) : // Extrapolate to annual
          (p.current_stock || 0) * (p.unit_cost || 0) * 12 // Fallback calculation
      }));
    } else {
      // Fallback: calculate from current stock
      productsWithValue = products.map(p => ({
        ...p,
        annualValue: (p.current_stock || 100) * (p.unit_cost || 10) * 12
      }));
    }

    const classifiedProducts = inventoryCalculator.classifyABC(productsWithValue);

    // Calculate optimal orders for each product using forecast data
    const optimalOrders = products.map(product => {
      // Try to match forecast by product name or ID
      const productForecast = forecast?.forecast?.filter(f => {
        const forecastProduct = f.product_id || f.product || f.Product || f.product_name;
        return forecastProduct === product.id || 
               forecastProduct === product.name ||
               (product.name && forecastProduct && 
                product.name.toLowerCase() === forecastProduct.toLowerCase());
      }) || [];

      // If no specific forecast for this product, use overall forecast distributed
      const forecastToUse = productForecast.length > 0 ? productForecast : 
        (forecast?.forecast?.slice(0, 30) || []).map(f => ({
          ...f,
          predicted: (f.predicted || 0) / Math.max(1, products.length)
        }));

      // Find health metric for this product
      const metric = healthMetrics.find(m => m.product_id === product.id);

      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: product.current_stock || 0,
        daily_demand: metric?.daily_demand || 10,
        reorder_point: metric?.reorder_point || 50,
        safety_stock: metric?.safety_stock || 20,
        max_stock: product.max_stock || 500,
        ...inventoryCalculator.calculateOptimalOrder(
          forecastToUse,
          product.current_stock || 0,
          metric?.reorder_point || 50,
          product.max_stock || 500
        )
      };
    });

    // Calculate stockout risks
    const stockoutRisks = products.map(product => {
      const metric = healthMetrics.find(m => m.product_id === product.id);
      const stockoutProb = metric?.stockout_probability || 0;
      
      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: product.current_stock || 0,
        daily_demand: metric?.daily_demand || 10,
        stockout_probability: stockoutProb,
        risk_level: stockoutProb > 0.7 ? 'high' : stockoutProb > 0.3 ? 'medium' : 'low',
        needs_attention: stockoutProb > 0.5,
        days_of_inventory: metric?.days_of_inventory || 0
      };
    });

    // Calculate overall metrics
    const totalStock = products.reduce((sum, p) => sum + (p.current_stock || 0), 0);
    const totalValue = products.reduce((sum, p) => 
      sum + ((p.current_stock || 0) * (p.unit_cost || 0)), 0
    );

    const result = {
      sessionId: newSessionId,
      timestamp: new Date().toISOString(),
      healthMetrics,
      classifiedProducts,
      optimalOrders,
      stockoutRisks,
      summary: {
        totalProducts: products.length,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        aClassItems: classifiedProducts.filter(p => p.class === 'A').length,
        bClassItems: classifiedProducts.filter(p => p.class === 'B').length,
        cClassItems: classifiedProducts.filter(p => p.class === 'C').length,
        urgentOrders: optimalOrders.filter(o => o.urgent).length,
        criticalOrders: optimalOrders.filter(o => o.critical).length,
        highRiskItems: stockoutRisks.filter(r => r.risk_level === 'high').length,
        mediumRiskItems: stockoutRisks.filter(r => r.risk_level === 'medium').length,
        lowRiskItems: stockoutRisks.filter(r => r.risk_level === 'low').length
      }
    };

    // Store session
    inventorySessions.set(newSessionId, {
      ...result,
      products,
      salesData: salesData?.slice(-100),
      forecast
    });

    console.log('✅ Inventory optimization complete');
    console.log('Health metrics calculated:', healthMetrics.length);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Inventory optimization error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize inventory'
    });
  }
});

/**
 * POST /api/inventory/reorder
 * Calculate reorder recommendations
 */
router.post('/reorder', (req, res) => {
  const { products, forecast, salesData } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, error: 'Products data required' });
  }

  try {
    const recommendations = inventoryCalculator.calculateReorderRecommendations(
      products,
      salesData || [],
      forecast || {}
    );

    res.json({
      success: true,
      recommendations,
      summary: {
        total_reorder: recommendations.filter(r => r.should_reorder).length,
        urgent_reorder: recommendations.filter(r => r.urgent).length,
        critical_reorder: recommendations.filter(r => r.critical).length,
        total_recommended_units: recommendations.reduce((sum, r) => sum + r.recommended_order, 0)
      }
    });

  } catch (error) {
    console.error('❌ Reorder calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate reorder recommendations'
    });
  }
});

/**
 * GET /api/inventory/health/:productId
 * Get health metrics for a specific product
 */
router.get('/health/:productId', (req, res) => {
  const { productId } = req.params;
  
  // Find in any active session
  let productMetrics = null;
  
  for (const [_, session] of inventorySessions) {
    const metric = session.healthMetrics?.find(m => m.product_id === productId);
    if (metric) {
      productMetrics = metric;
      break;
    }
  }

  if (!productMetrics) {
    return res.status(404).json({ 
      success: false, 
      error: 'Product not found in any inventory session' 
    });
  }

  res.json({
    success: true,
    metrics: productMetrics
  });
});

/**
 * GET /api/inventory/session/:sessionId
 * Get inventory session
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = inventorySessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ 
      success: false, 
      error: 'Session not found' 
    });
  }

  res.json({
    success: true,
    session
  });
});

/**
 * DELETE /api/inventory/session/:sessionId
 * Clear inventory session
 */
router.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (inventorySessions.delete(sessionId)) {
    res.json({ 
      success: true, 
      message: 'Session cleared' 
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Session not found' 
    });
  }
});

module.exports = router;