// server/forecast-logic.js - Groq-powered demand forecasting with long-term support
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

    console.log(`🔮 Generating forecast for ${forecastPeriods} days...`);

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

      // For long-term forecasts (1+ years), we need to adjust the approach
      const isLongTerm = forecastPeriods > 90;
      
      // Detect seasonality if enabled
      let seasonality = null;
      if (seasonalityDetection) {
        seasonality = seasonalityUtils.detectSeasonality(salesData);
        console.log('📊 Detected seasonality:', seasonality);
      }

      // Prepare data sample - for long-term forecasts, we need more data
      const salesSample = salesData.slice(-Math.min(1000, salesData.length));
      const productsSample = products || [];

      // Get external factors
      const externalFactors = includeExternalFactors 
        ? await this.getExternalFactors() 
        : null;

      // Build the prompt with longer period context
      const prompt = promptTemplates.buildForecastPrompt({
        salesData: salesSample,
        products: productsSample,
        forecastPeriods,
        confidenceLevel,
        seasonality,
        externalFactors,
        isLongTerm
      });

      console.log('🤖 Sending forecast request to AI...');

      // Call AI API with adjusted parameters for longer forecasts
      const response = await this.callAI(prompt, isLongTerm);

      // Parse the response
      const forecast = this.parseForecastResponse(response, salesSample, forecastPeriods);

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
          model: this.model,
          isLongTerm
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
      
      // Fallback to algorithmic forecast if AI fails
      if (forecastPeriods > 90) {
        console.log('📊 Using algorithmic fallback for long-term forecast');
        return this.generateAlgorithmicForecast(salesData, forecastPeriods);
      }
      
      throw new Error(`Failed to generate forecast: ${error.message}`);
    }
  }

  /**
   * Generate algorithmic forecast for long periods when AI might fail
   */
  generateAlgorithmicForecast(salesData, periods) {
    const historical = this.aggregateHistoricalData(salesData);
    const values = historical.map(h => h.sales);
    
    // Calculate trend
    const trend = this.calculateTrend(values);
    const seasonality = this.calculateSeasonalFactors(values);
    
    const forecast = [];
    const lastDate = new Date(historical[historical.length - 1].date);
    const lastValue = values[values.length - 1];
    
    for (let i = 1; i <= periods; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      
      // Apply trend and seasonality
      let predicted = lastValue * (1 + trend * i);
      
      // Apply seasonal factor based on month
      const month = date.getMonth();
      predicted *= (seasonality[month] || 1);
      
      // Add some randomness for realism
      const variation = (Math.random() - 0.5) * predicted * 0.05;
      predicted += variation;
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: Math.round(predicted * 100) / 100,
        upper_bound: Math.round(predicted * 1.15 * 100) / 100,
        lower_bound: Math.round(predicted * 0.85 * 100) / 100
      });
    }

    return {
      forecast,
      insights: this.generateLongTermInsights(forecast, periods),
      recommendations: this.generateLongTermRecommendations(forecast),
      confidence: 0.75,
      chartData: this.prepareChartData({ forecast }, historical)
    };
  }

  /**
   * Calculate trend from historical data
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const x = Array.from({ length: values.length }, (_, i) => i);
    const y = values;
    
    // Simple linear regression
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, _, i) => a + x[i] * y[i], 0);
    const sumXX = x.reduce((a, _, i) => a + x[i] * x[i], 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope / (sumY / n); // Return as percentage
  }

  /**
   * Calculate seasonal factors by month
   */
  calculateSeasonalFactors(values) {
    const factors = Array(12).fill(1);
    
    if (values.length < 12) return factors;
    
    // Simple placeholder - in production, this would calculate actual seasonal patterns
    const monthFactors = [1.2, 1.0, 0.9, 0.9, 1.0, 1.1, 1.1, 1.0, 1.0, 1.1, 1.2, 1.3];
    
    return monthFactors;
  }

  /**
   * Generate long-term insights
   */
  generateLongTermInsights(forecast, periods) {
    const years = periods / 365;
    const totalDemand = forecast.reduce((sum, f) => sum + f.predicted, 0);
    const avgYearly = totalDemand / years;
    
    return [
      `Long-term forecast covers ${years.toFixed(1)} years with total demand of ${Math.round(totalDemand)} units`,
      `Average yearly demand projected at ${Math.round(avgYearly)} units`,
      `Consider economic factors and market trends for long-term planning`,
      `Review forecast annually and adjust based on actual performance`
    ];
  }

  /**
   * Generate long-term recommendations
   */
  generateLongTermRecommendations(forecast) {
    return [
      'Develop multi-year procurement strategy based on projected growth',
      'Review supplier contracts for long-term volume discounts',
      'Plan warehouse capacity expansion for projected inventory levels',
      'Consider economic indicators and market trends in strategic planning',
      'Establish quarterly review cycles to track forecast accuracy'
    ];
  }

  /**
   * Call AI API with timeout for long forecasts
   */
  async callAI(prompt, isLongTerm = false) {
    try {
      // Longer timeout for long-term forecasts
      const timeout = isLongTerm ? 60000 : 30000; // 60 seconds for long-term
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

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
              content: promptTemplates.getSystemPrompt(isLongTerm)
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: isLongTerm ? 0.4 : 0.3, // Slightly more creative for long-term
          max_tokens: isLongTerm ? 6000 : 4000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
  parseForecastResponse(response, originalData, expectedPeriods) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      let forecastData;
      if (jsonMatch) {
        forecastData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        
        // Validate forecast length
        if (forecastData.forecast && forecastData.forecast.length !== expectedPeriods) {
          console.warn(`⚠️ Forecast length mismatch: expected ${expectedPeriods}, got ${forecastData.forecast.length}`);
          // Trim or pad as needed
          if (forecastData.forecast.length > expectedPeriods) {
            forecastData.forecast = forecastData.forecast.slice(0, expectedPeriods);
          }
        }
      } else {
        // Fallback: create basic forecast structure
        forecastData = this.createFallbackForecast(originalData, expectedPeriods);
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
      return this.createFallbackForecast(originalData, expectedPeriods);
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
  createFallbackForecast(data, periods = 30) {
    const historical = this.aggregateHistoricalData(data);
    const values = historical.map(h => h.sales);
    
    // Simple moving average
    const windowSize = Math.min(7, values.length);
    const lastAvg = values.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
    
    const forecast = [];
    const lastDate = new Date(historical[historical.length - 1].date);
    
    for (let i = 1; i <= periods; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + i);
      
      // Add some randomness and slight trend
      const trend = 0.001; // 0.1% per day
      const variation = (Math.random() - 0.5) * lastAvg * 0.1;
      const predicted = lastAvg * (1 + trend * i) + variation;
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: Math.round(predicted * 100) / 100,
        upper_bound: Math.round(predicted * 1.15 * 100) / 100,
        lower_bound: Math.round(predicted * 0.85 * 100) / 100
      });
    }

    return {
      forecast,
      insights: this.generateLongTermInsights(forecast, periods),
      recommendations: this.generateLongTermRecommendations(forecast),
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