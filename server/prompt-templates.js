// server/prompt-templates.js - AI prompt templates for forecasting with long-term support

class PromptTemplates {
  /**
   * Get system prompt for forecasting AI
   */
  getSystemPrompt(isLongTerm = false) {
    if (isLongTerm) {
      return `You are DemandSense AI, an expert supply chain demand forecasting assistant specializing in LONG-TERM strategic forecasting (1-10 years).

Your task is to analyze historical sales data and generate accurate long-term demand forecasts considering:
- Macroeconomic trends
- Market growth patterns
- Industry cycles
- Technological changes
- Competitive landscape

For long-term forecasts, focus on:
- Year-over-year growth rates
- Multi-year seasonality patterns
- Strategic inventory planning
- Capacity planning recommendations

You MUST structure your response in the following format:

# Strategic Long-Term Forecast Summary
[Brief 2-3 sentence overview of the long-term forecast]

## Key Strategic Metrics
Total Historical Data Points: [total]
Historical Period Covered: [date range]
Forecast Period: [years] years
Projected CAGR: [percentage]
Confidence Level: [percentage]

## Strategic Forecast Data
[Generate forecast for the requested period with these exact fields for each day:
- date
- predicted (numeric)
- upper_bound (numeric, ~15% higher)
- lower_bound (numeric, ~15% lower)
]

## Strategic Insights
- [First strategic insight about long-term trends]
- [Second strategic insight about market opportunities]
- [Third strategic insight about risks]

## Strategic Recommendations
1. [First strategic recommendation for long-term planning]
2. [Second strategic recommendation for capacity planning]
3. [Third strategic recommendation for supplier relationships]

## Risk Factors
- [First long-term risk to monitor]
- [Second long-term risk to monitor]

CRITICAL: Include a JSON object at the end with the forecast data structure.
Wrap the JSON in \`\`\`json \`\`\` code blocks:

\`\`\`json
{
  "forecast": [
    {"date": "2025-01-01", "predicted": 125.5, "upper_bound": 144.3, "lower_bound": 106.7},
    ...
  ],
  "insights": ["Strategic insight 1", "Strategic insight 2"],
  "recommendations": ["Strategic rec 1", "Strategic rec 2"],
  "confidence": 0.85
}
\`\`\`

Use markdown formatting. Be precise with numbers.`;
    }

    // Short-term forecast prompt (existing)
    return `You are DemandSense AI, an expert supply chain demand forecasting assistant with deep knowledge of inventory optimization, seasonality analysis, and predictive analytics.

Your task is to analyze historical sales data and generate accurate demand forecasts with actionable insights.

You MUST structure your response in the following format:

# Demand Forecast Summary
[Brief 2-3 sentence overview of the forecast]

## Key Metrics
Total Historical Sales: [total]
Average Daily Demand: [avg]
Demand Volatility: [low/medium/high]
Forecast Period: [dates]
Confidence Level: [percentage]

## Forecast Data
[Generate forecast for the requested period with these exact fields for each day:
- date
- predicted (numeric)
- upper_bound (numeric, ~15% higher)
- lower_bound (numeric, ~15% lower)
]

## Key Insights
- [First insight about demand patterns]
- [Second insight about seasonality]
- [Third insight about trends]

## Recommendations
1. [First actionable inventory recommendation]
2. [Second actionable inventory recommendation]
3. [Third actionable inventory recommendation]

## Risk Factors
- [First risk to consider]
- [Second risk to consider]

CRITICAL: Include a JSON object at the end with the forecast data structure.
Wrap the JSON in \`\`\`json \`\`\` code blocks:

\`\`\`json
{
  "forecast": [
    {"date": "2025-01-01", "predicted": 125.5, "upper_bound": 144.3, "lower_bound": 106.7},
    ...
  ],
  "insights": ["insight1", "insight2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 0.92
}
\`\`\`

Use markdown formatting. Be precise with numbers.`;
  }

  /**
   * Build forecast prompt with data
   */
  buildForecastPrompt({ salesData, products, forecastPeriods, confidenceLevel, seasonality, externalFactors, isLongTerm }) {
    // Prepare sales summary
    const salesSummary = this.prepareSalesSummary(salesData);
    
    // Prepare product summary
    const productSummary = products.length > 0 
      ? products.slice(0, 10).map(p => `${p.name} (${p.category})`).join(', ')
      : 'No product data provided';

    // Calculate years for long-term forecasts
    const years = forecastPeriods / 365;
    const isMultiYear = years >= 1;

    // Build context-appropriate prompt
    if (isLongTerm || isMultiYear) {
      return `Generate a LONG-TERM STRATEGIC demand forecast based on the following data:

HISTORICAL SALES DATA (${salesData.length} records):
${JSON.stringify(salesSummary, null, 2)}

PRODUCT CATALOG (sample):
${productSummary}

FORECAST PARAMETERS:
- Forecast Period: ${forecastPeriods} days (${years.toFixed(1)} years)
- Desired Confidence Level: ${confidenceLevel * 100}%
${seasonality ? `- Detected Seasonality: ${seasonality.pattern} (strength: ${seasonality.strength})` : '- Seasonality: Not detected'}
${externalFactors ? `- External Factors: ${JSON.stringify(externalFactors)}` : '- External Factors: Not considered'}

STRATEGIC FORECASTING REQUIREMENTS:
1. Analyze long-term trends and growth patterns
2. Consider macroeconomic factors and market conditions
3. Project demand with appropriate confidence intervals
4. Provide strategic recommendations for:
   - Multi-year procurement planning
   - Warehouse capacity planning
   - Supplier relationship management
   - Technology investment timing

FOCUS ON:
- Year-over-year growth rates
- Multi-year seasonality
- Long-term demand patterns
- Strategic inventory positioning
- Capacity planning

Return a comprehensive strategic forecast with all required sections.`;
    }

    // Short-term prompt (existing)
    return `Generate a demand forecast based on the following data:

HISTORICAL SALES DATA (${salesData.length} records):
${JSON.stringify(salesSummary, null, 2)}

PRODUCT CATALOG (sample):
${productSummary}

FORECAST PARAMETERS:
- Forecast Period: ${forecastPeriods} days
- Desired Confidence Level: ${confidenceLevel * 100}%
${seasonality ? `- Detected Seasonality: ${seasonality.pattern} (strength: ${seasonality.strength})` : '- Seasonality: Not detected'}
${externalFactors ? `- External Factors: ${JSON.stringify(externalFactors)}` : '- External Factors: Not considered'}

TASK:
1. Analyze the historical sales patterns
2. Identify trends, seasonality, and anomalies
3. Generate a ${forecastPeriods}-day demand forecast
4. Calculate confidence intervals (upper/lower bounds)
5. Provide actionable insights for inventory management

FOCUS ON:
- Daily demand patterns
- Weekly seasonality
- Monthly trends
- Product-specific variations (if multiple products)
- Inventory optimization recommendations

Return a comprehensive forecast with all required sections.`;
  }

  /**
   * Prepare sales summary for prompt
   */
  prepareSalesSummary(salesData) {
    // Group by date
    const byDate = new Map();
    const byProduct = new Map();
    
    salesData.forEach(row => {
      const date = row.date || row.Date;
      const product = row.product_name || row.product_id || 'Unknown';
      const sales = parseFloat(row.sales || row.Sales || row.quantity || 0);
      
      if (date) {
        const dateKey = new Date(date).toISOString().split('T')[0];
        byDate.set(dateKey, (byDate.get(dateKey) || 0) + sales);
      }
      
      const productKey = product;
      byProduct.set(productKey, (byProduct.get(productKey) || 0) + sales);
    });

    // Calculate statistics
    const salesValues = Array.from(byDate.values());
    const avgSales = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
    const maxSales = Math.max(...salesValues);
    const minSales = Math.min(...salesValues);
    
    // Get top products
    const topProducts = Array.from(byProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    return {
      date_range: {
        start: salesData[0]?.date || 'Unknown',
        end: salesData[salesData.length - 1]?.date || 'Unknown'
      },
      total_records: salesData.length,
      unique_dates: byDate.size,
      unique_products: byProduct.size,
      statistics: {
        average_daily_sales: Math.round(avgSales * 100) / 100,
        max_daily_sales: maxSales,
        min_daily_sales: minSales,
        total_sales: salesValues.reduce((a, b) => a + b, 0)
      },
      top_products: topProducts,
      recent_days: Array.from(byDate.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7)
        .map(([date, sales]) => ({ date, sales }))
    };
  }

  /**
   * Build what-if scenario prompt
   */
  buildScenarioPrompt(baseForecast, scenario) {
    const { type, parameters } = scenario;
    
    let scenarioDescription = '';
    switch (type) {
      case 'demand_shock':
        scenarioDescription = `Demand Shock: ${parameters.multiplier * 100}% increase for ${parameters.duration} days`;
        break;
      case 'supply_disruption':
        scenarioDescription = `Supply Disruption: ${parameters.duration} days lead time increase, ${parameters.impact}% capacity reduction`;
        break;
      case 'promotion':
        scenarioDescription = `Promotion: ${parameters.multiplier * 100}% sales lift for ${parameters.duration} days`;
        break;
      default:
        scenarioDescription = `Custom scenario: ${JSON.stringify(parameters)}`;
    }

    return `Analyze this what-if scenario based on the baseline forecast:

BASELINE FORECAST:
${JSON.stringify(baseForecast, null, 2)}

SCENARIO: ${scenarioDescription}

TASK:
1. Calculate the impact on demand and inventory
2. Identify potential stockouts or overstock situations
3. Recommend inventory adjustments
4. Assess risk level

Provide quantitative analysis and actionable recommendations.`;
  }
}

module.exports = new PromptTemplates();