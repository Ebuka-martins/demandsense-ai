// routes/api/inventory.js - Inventory optimization endpoints
const express = require('express');
const router = express.Router();

const inventoryCalculator = require('../../server/inventory-calculator');
const forecastLogic = require('../../server/forecast-logic');

// In-memory inventory sessions
const inventorySessions = new Map();

/**
 * POST /api/inventory/optimize
 * Calculate inventory optimization metrics
 */
router.post('/optimize', async (req, res) => {
  const { products, salesData, forecast, sessionId } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, error: 'Products data required' });
  }

  const newSessionId = sessionId || `inv_${Date.now()}`;

  try {
    // Calculate health metrics
    const healthMetrics = inventoryCalculator.calculateHealthMetrics(
      products,
      salesData || [],
      forecast || {}
    );

    // Calculate ABC classification
    const classifiedProducts = inventoryCalculator.classifyABC(
      products.map(p => ({
        ...p,
        annualValue: (p.annual_sales || p.current_stock || 100) * (p.unit_cost || 10)
      }))
    );

    // Calculate optimal orders for each product
    const optimalOrders = products.map(product => {
      const productForecast = forecast?.forecast?.filter(f => 
        f.product_id === product.id
      ) || [];

      return {
        product_id: product.id,
        product_name: product.name,
        ...inventoryCalculator.calculateOptimalOrder(
          productForecast,
          product.current_stock || 0,
          product.reorder_point || 50,
          product.max_stock || 500
        )
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
      summary: {
        totalProducts: products.length,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        aClassItems: classifiedProducts.filter(p => p.class === 'A').length,
        urgentOrders: optimalOrders.filter(o => o.urgent).length,
        criticalOrders: optimalOrders.filter(o => o.critical).length
      }
    };

    // Store session
    inventorySessions.set(newSessionId, {
      ...result,
      products,
      salesData: salesData?.slice(-100)
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Inventory optimization error:', error);
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
  const { products, forecast } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, error: 'Products data required' });
  }

  try {
    const recommendations = products.map(product => {
      const dailyDemand = product.daily_demand || 
        (product.weekly_demand ? product.weekly_demand / 7 : 10);
      
      const leadTime = product.lead_time_days || 7;
      const safetyStock = product.safety_stock || 
        inventoryCalculator.calculateSafetyStock(dailyDemand, leadTime, 0.95, 5);
      
      const reorderPoint = inventoryCalculator.calculateReorderPoint(
        dailyDemand, 
        leadTime, 
        safetyStock
      );

      const currentStock = product.current_stock || 0;
      const daysUntilReorder = Math.max(0, (currentStock - reorderPoint) / dailyDemand);

      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: currentStock,
        reorder_point: Math.round(reorderPoint),
        safety_stock: Math.round(safetyStock),
        days_until_reorder: Math.round(daysUntilReorder * 10) / 10,
        should_reorder: currentStock <= reorderPoint,
        recommended_order: Math.max(0, Math.round(reorderPoint - currentStock + safetyStock)),
        urgent: currentStock <= reorderPoint * 0.5
      };
    });

    res.json({
      success: true,
      recommendations,
      summary: {
        total_reorder: recommendations.filter(r => r.should_reorder).length,
        urgent_reorder: recommendations.filter(r => r.urgent).length,
        total_recommended_units: recommendations.reduce((sum, r) => sum + r.recommended_order, 0)
      }
    });

  } catch (error) {
    console.error('Reorder calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate reorder recommendations'
    });
  }
});

/**
 * POST /api/inventory/stockout-risk
 * Calculate stockout risk
 */
router.post('/stockout-risk', (req, res) => {
  const { products, forecast } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, error: 'Products data required' });
  }

  try {
    const risks = products.map(product => {
      const dailyDemand = product.daily_demand || 10;
      const currentStock = product.current_stock || 0;
      const leadTime = product.lead_time_days || 7;
      const safetyStock = product.safety_stock || 20;
      
      // Calculate days until stockout
      const daysUntilStockout = currentStock / dailyDemand;
      
      // Calculate probability of stockout during lead time
      const demandDuringLeadTime = dailyDemand * leadTime;
      const stockoutProbability = Math.max(0, 
        (demandDuringLeadTime - currentStock + safetyStock) / demandDuringLeadTime
      );

      // Find forecasted demand
      const productForecast = forecast?.forecast?.filter(f => 
        f.product_id === product.id
      ) || [];

      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: currentStock,
        daily_demand: dailyDemand,
        days_until_stockout: Math.round(daysUntilStockout * 10) / 10,
        stockout_probability: Math.min(1, Math.max(0, Math.round(stockoutProbability * 100) / 100)),
        risk_level: stockoutProbability > 0.7 ? 'high' : stockoutProbability > 0.3 ? 'medium' : 'low',
        forecast_demand_7day: productForecast.slice(0, 7).reduce((sum, f) => sum + (f.predicted || 0), 0),
        needs_attention: stockoutProbability > 0.5
      };
    });

    res.json({
      success: true,
      risks,
      summary: {
        high_risk: risks.filter(r => r.risk_level === 'high').length,
        medium_risk: risks.filter(r => r.risk_level === 'medium').length,
        low_risk: risks.filter(r => r.risk_level === 'low').length,
        needs_attention: risks.filter(r => r.needs_attention).length
      }
    });

  } catch (error) {
    console.error('Stockout risk calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate stockout risk'
    });
  }
});

/**
 * GET /api/inventory/session/:sessionId
 * Get inventory session
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = inventorySessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  res.json({
    success: true,
    session
  });
});

module.exports = router;