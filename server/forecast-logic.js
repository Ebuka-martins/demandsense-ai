// server/forecast-logic.js - Groq-powered demand forecasting
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const promptTemplates = require('./prompt-templates');
const seasonalityUtils = require('./seasonality-utils');

dotenv.config();

// In-memory forecast cache
const forecastCache = new Map();

class ForecastLogic {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY;
    this.provider = process.env.AI_PROVIDER || 'groq';
    this.baseURL = this.provider === 'groq' 
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.deepseek.com/v1/chat/completions';
    this.model = this.provider === 'groq' 
      ? 'llama-3.3-70b-versatile'
      : 'deepseek-chat';
  }

  /**
   * Generate demand forecast based on historical sales data
   */
  async generateForecast(salesData, products, options = {}) {
    const {
      forecastPeriods = 30, // days to forecast
      confidenceLevel = 0.95,
      includeExternalFactors = true,
      seasonalityDetection = true,
      cacheKey = null
    } = options;

    // Check cache if cacheKey provided
    if (cacheKey && forecastCache.has(cacheKey)) {
      const cached = forecastCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        console.log('📦 Returning cached forecast');
        return cached.data;
      }
    }

    try {
      // Validate input data
      if (!salesData || salesData.length === 0) {
        throw new Error('No sales data provided');
      }

      // Detect seasonality if enabled
      let seasonality = null;
      if (seasonalityDetection) {
        seasonality = seasonalityUtils.detectSeasonality(salesData);
        console.log('📊 Detected seasonality:', seasonality);
      }

      // Prepare data sample
      const salesSample = salesData.slice(-500); // Last 500 records max
      const productsSample = products || [];

      // Get external factors (mock for now)
      const externalFactors = includeExternalFactors 
        ? await this.getExternalFactors() 
        : null;

      // Build the prompt
      const prompt = promptTemplates.buildForecastPrompt({
        salesData: salesSample,
        products: productsSample,
        forecastPeriods,
        confidenceLevel,
        seasonality,
        externalFactors
      });

      console.log('🤖 Sending forecast request to AI...');

      // Call AI API
      const response = await this.callAI(prompt);

      // Parse the response
      const forecast = this.parseForecastResponse(response, salesSample);

      // Add metadata
      const result = {
        ...forecast,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataPoints: salesData.length,
          forecastPeriods,
          confidenceLevel,
          seasonalityDetected: !!seasonality,
          provider: this.provider,
          model: this.model
        }
      };

      // Cache the result
      if (cacheKey) {
        forecastCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.error('Forecast generation error:', error);
      throw new Error(`Failed to generate forecast: ${error.message}`);
    }
  }

  /**
   * Call AI API
   */
  async callAI(prompt) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: promptTemplates.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent forecasts
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;

    } catch (error) {
      console.error('AI call failed:', error);
      throw error;
    }
  }

  /**
   * Parse AI response into structured forecast
   */
  parseForecastResponse(response, originalData) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      let forecastData;
      if (jsonMatch) {
        forecastData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        // Fallback: create basic forecast structure
        forecastData = this.createFallbackForecast(originalData);
      }

      return {
        forecast: forecastData.forecast || forecastData,
        insights: forecastData.insights || this.extractInsights(response),
        recommendations: forecastData.recommendations || [],
        confidence: forecastData.confidence || 0.85,
        chartData: this.prepareChartData(forecastData, originalData)
      };

    } catch (error) {
      console.error('Failed to parse forecast response:', error);
      return this.createFallbackForecast(originalData);
    }
  }

  /**
   * Prepare chart data for visualization
   */
  prepareChartData(forecastData, historicalData) {
    // Aggregate historical data by date
    const historical = this.aggregateHistoricalData(historicalData);
    
    // Prepare forecast points
    const forecast = forecastData.forecast || [];
    
    // Combine for chart
    const labels = [];
    const historicalValues = [];
    const forecastValues = [];
    const upperBound = [];
    const lowerBound = [];

    // Add historical data
    historical.forEach((item, index) => {
      labels.push(item.date);
      historicalValues.push(item.sales);
    });

    // Add forecast data
    forecast.forEach((item, index) => {
      labels.push(item.date);
      forecastValues.push(item.predicted);
      upperBound.push(item.upper_bound || item.predicted * 1.1);
      lowerBound.push(item.lower_bound || item.predicted * 0.9);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Historical Sales',
          data: historicalValues,
          borderColor: '#ff4d6d',
          backgroundColor: 'rgba(255, 77, 109, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Forecast',
          data: [...Array(historical.length).fill(null), ...forecastValues],
          borderColor: '#ff006e',
          borderDash: [5, 5],
          backgroundColor: 'rgba(255, 0, 110, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Confidence Interval',
          data: [...Array(historical.length).fill(null), ...upperBound],
          borderColor: 'rgba(255, 0, 110, 0.3)',
          backgroundColor: 'rgba(255, 0, 110, 0.1)',
          borderDash: [2, 2],
          fill: '+1',
          pointRadius: 0
        },
        {
          label: 'Confidence Interval Lower',
          data: [...Array(historical.length).fill(null), ...lowerBound],
          borderColor: 'rgba(255, 0, 110, 0.3)',
          backgroundColor: 'transparent',
          borderDash: [2, 2],
          fill: false,
          pointRadius: 0
        }
      ]
    };
  }

  /**
   * Aggregate historical data by date
   */
  aggregateHistoricalData(data) {
    const aggregated = new Map();
    
    data.forEach(row => {
      const date = row.date || row.Date || row.timestamp;
      if (!date) return;
      
      const sales = parseFloat(row.sales || row.Sales || row.quantity || 0);
      const key = new Date(date).toISOString().split('T')[0];
      
      if (aggregated.has(key)) {
        aggregated.set(key, aggregated.get(key) + sales);
      } else {
        aggregated.set(key, sales);
      }
    });

    return Array.from(aggregated.entries())
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Create fallback forecast using simple moving average
   */
  createFallbackForecast(data) {
    const historical = this.aggregateHistoricalData(data);
    const values = historical.map(h => h.sales);
    
    // Simple moving average
    const windowSize = Math.min(7, values.length);
    const lastAvg = values.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
    
    const forecast = [];
    const lastDate = new Date(historical[historical.length - 1].date);
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      
      // Add some randomness
      const variation = (Math.random() - 0.5) * lastAvg * 0.1;
      const predicted = lastAvg + variation;
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: Math.round(predicted * 100) / 100,
        upper_bound: Math.round(predicted * 1.15 * 100) / 100,
        lower_bound: Math.round(predicted * 0.85 * 100) / 100
      });
    }

    return {
      forecast,
      insights: [
        'Based on historical average, demand appears stable',
        'Consider seasonal factors for more accurate forecast',
        'Inventory levels should be maintained at current levels'
      ],
      recommendations: [
        'Monitor weekly sales trends for early signals',
        'Review safety stock levels for top products',
        'Consider external factors like promotions and holidays'
      ],
      confidence: 0.75,
      chartData: this.prepareChartData({ forecast }, data)
    };
  }

  /**
   * Extract insights from text response
   */
  extractInsights(response) {
    const insights = [];
    const lines = response.split('\n');
    
    let inInsights = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('insight') || line.toLowerCase().includes('key finding')) {
        inInsights = true;
        continue;
      }
      
      if (inInsights && line.trim().startsWith('-')) {
        insights.push(line.replace('-', '').trim());
      }
      
      if (insights.length >= 5) break;
    }
    
    return insights.length > 0 ? insights : ['No specific insights extracted'];
  }

  /**
   * Get external factors (mock data)
   */
  async getExternalFactors() {
    // In production, this would call actual APIs for weather, economic data, etc.
    return {
      season: this.getCurrentSeason(),
      holidays: this.getUpcomingHolidays(),
      economicIndicators: {
        consumerConfidence: 0.75,
        unemployment: 0.038,
        gdpGrowth: 0.021
      },
      weather: {
        forecast: 'Mild conditions expected'
      }
    };
  }

  /**
   * Get current season
   */
  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  /**
   * Get upcoming holidays
   */
  getUpcomingHolidays() {
    const holidays = [
      { name: 'New Year\'s Day', date: '2025-01-01', impact: 'high' },
      { name: 'Valentine\'s Day', date: '2025-02-14', impact: 'medium' },
      { name: 'Black Friday', date: '2025-11-28', impact: 'high' },
      { name: 'Christmas', date: '2025-12-25', impact: 'high' }
    ];
    
    const today = new Date();
    const next30Days = new Date(today);
    next30Days.setDate(today.getDate() + 30);
    
    return holidays.filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate >= today && holidayDate <= next30Days;
    });
  }

  /**
   * Clear forecast cache
   */
  clearCache() {
    forecastCache.clear();
    console.log('🧹 Forecast cache cleared');
  }
}

module.exports = new ForecastLogic();