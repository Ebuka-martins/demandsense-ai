// routes/api/scenarios.js - What-if scenario analysis endpoints
const express = require('express');
const router = express.Router();

const forecastLogic = require('../../server/forecast-logic');
const promptTemplates = require('../../server/prompt-templates');

// Store scenarios
const scenarioSessions = new Map();

/**
 * POST /api/scenarios/analyze
 * Analyze a what-if scenario
 */
router.post('/analyze', async (req, res) => {
  const { baseForecast, scenario, products, sessionId } = req.body;

  if (!baseForecast || !scenario) {
    return res.status(400).json({ 
      success: false, 
      error: 'Base forecast and scenario are required' 
    });
  }

  const newSessionId = sessionId || `scenario_${Date.now()}`;

  try {
    // Build scenario prompt
    const prompt = promptTemplates.buildScenarioPrompt(baseForecast, scenario);

    // Call AI for scenario analysis
    const response = await forecastLogic.callAI(prompt);

    // Parse the response
    const analysis = parseScenarioResponse(response, baseForecast, scenario);

    // Calculate numerical impact
    const impact = calculateScenarioImpact(baseForecast, scenario, products);

    const result = {
      sessionId: newSessionId,
      timestamp: new Date().toISOString(),
      scenario,
      analysis,
      impact,
      recommendations: extractRecommendations(response)
    };

    // Store scenario
    scenarioSessions.set(newSessionId, result);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Scenario analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze scenario'
    });
  }
});

/**
 * POST /api/scenarios/demand-shock
 * Quick demand shock scenario
 */
router.post('/demand-shock', (req, res) => {
  const { baseForecast, multiplier = 1.5, duration = 7, products } = req.body;

  if (!baseForecast) {
    return res.status(400).json({ success: false, error: 'Base forecast required' });
  }

  const scenario = {
    type: 'demand_shock',
    parameters: {
      multiplier,
      duration
    }
  };

  // Calculate impact
  const impactedForecast = baseForecast.forecast.map((item, index) => {
    if (index < duration) {
      return {
        ...item,
        predicted: item.predicted * multiplier,
        upper_bound: item.upper_bound * multiplier,
        lower_bound: item.lower_bound * multiplier,
        scenario_impact: `${multiplier}x demand`
      };
    }
    return item;
  });

  // Calculate stock impact
  const stockImpact = products?.map(product => {
    const demandIncrease = multiplier - 1;
    const currentStock = product.current_stock || 0;
    const dailyDemand = product.daily_demand || 10;
    
    const newDailyDemand = dailyDemand * multiplier;
    const daysUntilStockout = currentStock / newDailyDemand;
    const originalDays = currentStock / dailyDemand;

    return {
      product_id: product.id,
      product_name: product.name,
      original_days_until_stockout: Math.round(originalDays * 10) / 10,
      new_days_until_stockout: Math.round(daysUntilStockout * 10) / 10,
      additional_units_needed: Math.round(dailyDemand * (multiplier - 1) * duration),
      recommendation: daysUntilStockout < 3 ? 'URGENT: Order immediately' : 'Monitor closely'
    };
  });

  res.json({
    success: true,
    scenario,
    impactedForecast,
    stockImpact,
    summary: {
      demandIncrease: `${Math.round((multiplier - 1) * 100)}%`,
      duration: `${duration} days`,
      totalAdditionalUnits: stockImpact?.reduce((sum, p) => sum + p.additional_units_needed, 0) || 0
    }
  });
});

/**
 * POST /api/scenarios/supply-disruption
 * Quick supply disruption scenario
 */
router.post('/supply-disruption', (req, res) => {
  const { baseForecast, delayDays = 14, capacityReduction = 0.3, products } = req.body;

  if (!baseForecast) {
    return res.status(400).json({ success: false, error: 'Base forecast required' });
  }

  const scenario = {
    type: 'supply_disruption',
    parameters: {
      delayDays,
      capacityReduction
    }
  };

  // Calculate impact
  const stockImpact = products?.map(product => {
    const currentStock = product.current_stock || 0;
    const dailyDemand = product.daily_demand || 10;
    const leadTime = product.lead_time_days || 7;
    
    const totalDemandDuringDisruption = dailyDemand * (delayDays + leadTime);
    const stockoutRisk = Math.max(0, totalDemandDuringDisruption - currentStock);
    
    return {
      product_id: product.id,
      product_name: product.name,
      current_stock: currentStock,
      demand_during_disruption: Math.round(totalDemandDuringDisruption),
      stockout_risk: Math.round(stockoutRisk),
      risk_level: stockoutRisk > 0 ? 'high' : 'low',
      recommendation: stockoutRisk > 0 
        ? `Order ${Math.round(stockoutRisk * 1.2)} units immediately` 
        : 'Sufficient stock'
    };
  });

  res.json({
    success: true,
    scenario,
    stockImpact,
    summary: {
      delayDays,
      capacityReduction: `${Math.round(capacityReduction * 100)}%`,
      productsAtRisk: stockImpact?.filter(p => p.risk_level === 'high').length || 0,
      totalUnitsNeeded: stockImpact?.reduce((sum, p) => sum + p.stockout_risk, 0) || 0
    }
  });
});

/**
 * POST /api/scenarios/promotion
 * Quick promotion scenario
 */
router.post('/promotion', (req, res) => {
  const { baseForecast, lift = 2.0, duration = 3, products } = req.body;

  if (!baseForecast) {
    return res.status(400).json({ success: false, error: 'Base forecast required' });
  }

  const scenario = {
    type: 'promotion',
    parameters: {
      multiplier: lift,
      duration
    }
  };

  // Calculate impact
  const promotionImpact = baseForecast.forecast.map((item, index) => {
    if (index < duration) {
      return {
        ...item,
        predicted: item.predicted * lift,
        upper_bound: item.upper_bound * lift,
        lower_bound: item.lower_bound * lift,
        promotion_lift: `${lift}x`
      };
    }
    return item;
  });

  // Calculate stock needed
  const stockNeeded = products?.map(product => {
    const dailyDemand = product.daily_demand || 10;
    const currentStock = product.current_stock || 0;
    
    const extraDemand = dailyDemand * (lift - 1) * duration;
    const stockAfterPromo = currentStock - (dailyDemand * lift * duration);
    
    return {
      product_id: product.id,
      product_name: product.name,
      current_stock: currentStock,
      expected_demand_during_promo: Math.round(dailyDemand * lift * duration),
      extra_units_needed: Math.round(extraDemand),
      stock_after_promo: Math.round(stockAfterPromo),
      recommendation: stockAfterPromo < 0 
        ? `ORDER ${Math.round(-stockAfterPromo * 1.2)} units` 
        : 'Stock adequate'
    };
  });

  res.json({
    success: true,
    scenario,
    promotionImpact,
    stockNeeded,
    summary: {
      lift: `${Math.round((lift - 1) * 100)}% increase`,
      duration: `${duration} days`,
      totalExtraUnits: stockNeeded?.reduce((sum, p) => sum + p.extra_units_needed, 0) || 0,
      productsNeedingReorder: stockNeeded?.filter(p => p.stock_after_promo < 0).length || 0
    }
  });
});

/**
 * GET /api/scenarios/session/:sessionId
 * Get scenario session
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = scenarioSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  res.json({
    success: true,
    session
  });
});

/**
 * Helper: Parse scenario response
 */
function parseScenarioResponse(response, baseForecast, scenario) {
  // Extract key points from response
  const insights = [];
  const lines = response.split('\n');
  
  let inInsights = false;
  for (const line of lines) {
    if (line.toLowerCase().includes('insight') || line.includes('-')) {
      inInsights = true;
      const cleanLine = line.replace(/^-\s*/, '').trim();
      if (cleanLine && cleanLine.length > 10) {
        insights.push(cleanLine);
      }
    }
    if (insights.length >= 5) break;
  }

  return {
    summary: lines.slice(0, 3).join(' ').substring(0, 200),
    insights: insights.length > 0 ? insights : ['Scenario analyzed successfully'],
    riskLevel: calculateRiskLevel(scenario)
  };
}

/**
 * Helper: Calculate scenario impact numerically
 */
function calculateScenarioImpact(baseForecast, scenario, products) {
  const totalDemand = baseForecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
  
  let impactMultiplier = 1;
  if (scenario.type === 'demand_shock') {
    impactMultiplier = scenario.parameters.multiplier || 1.5;
  } else if (scenario.type === 'promotion') {
    impactMultiplier = scenario.parameters.multiplier || 2;
  }

  return {
    totalDemandImpact: Math.round(totalDemand * (impactMultiplier - 1)),
    percentageChange: Math.round((impactMultiplier - 1) * 100),
    productsAffected: products?.length || 0,
    severity: impactMultiplier > 1.5 ? 'high' : impactMultiplier > 1.2 ? 'medium' : 'low'
  };
}

/**
 * Helper: Calculate risk level
 */
function calculateRiskLevel(scenario) {
  if (scenario.type === 'supply_disruption') {
    return 'high';
  } else if (scenario.type === 'demand_shock' && scenario.parameters.multiplier > 2) {
    return 'high';
  } else if (scenario.type === 'promotion') {
    return 'medium';
  }
  return 'low';
}

/**
 * Helper: Extract recommendations
 */
function extractRecommendations(response) {
  const recommendations = [];
  const lines = response.split('\n');
  
  let inRecs = false;
  for (const line of lines) {
    if (line.toLowerCase().includes('recommend')) {
      inRecs = true;
      continue;
    }
    if (inRecs && (line.startsWith('-') || line.match(/^\d+\./))) {
      const rec = line.replace(/^[-\d.\s]*/, '').trim();
      if (rec && rec.length > 10) {
        recommendations.push(rec);
      }
    }
    if (recommendations.length >= 3) break;
  }

  return recommendations.length > 0 
    ? recommendations 
    : ['Monitor inventory levels', 'Review safety stock', 'Prepare contingency plan'];
}

module.exports = router;