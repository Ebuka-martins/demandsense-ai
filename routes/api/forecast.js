// routes/api/forecast.js - Forecast endpoints with long-term support
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const forecastLogic = require('../../server/forecast-logic');
const seasonalityUtils = require('../../server/seasonality-utils');

// In-memory forecast cache
const forecastSessions = new Map();

/**
 * Parse uploaded file to JSON with better handling for different formats
 */
async function parseFile(filePath, fileExt) {
  return new Promise((resolve, reject) => {
    if (fileExt === '.csv') {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // If we have headers, use them
        if (data.length > 0) {
          const headers = data[0];
          const rows = data.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              // Clean header names
              const cleanHeader = header.toString()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
              obj[cleanHeader] = row[index];
            });
            return obj;
          });
          resolve(rows);
        } else {
          resolve([]);
        }
      } catch (error) {
        reject(error);
      }
    } else if (fileExt === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      resolve(JSON.parse(content));
    } else {
      reject(new Error('Unsupported file type'));
    }
  });
}

/**
 * POST /api/forecast/generate
 * Generate demand forecast from uploaded file
 */
router.post('/generate', (req, res) => {
  const upload = req.app.locals.upload;
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const sessionId = req.body.sessionId || uuidv4();

    try {
      // Parse the file
      console.log(`📄 Parsing file: ${req.file.originalname}`);
      const rawData = await parseFile(filePath, fileExt);
      
      console.log(`📊 Parsed ${rawData.length} rows`);
      if (rawData.length > 0) {
        console.log('First row sample:', rawData[0]);
      }

      // Normalize the data for forecasting
      const salesData = rawData.map(row => {
        const normalized = {};
        
        // Try to find date field
        const dateField = Object.keys(row).find(key => 
          key.includes('date') || key.includes('Date') || key.includes('fecha') || key.includes('time')
        );
        if (dateField) {
          normalized.date = row[dateField];
        } else {
          normalized.date = new Date().toISOString().split('T')[0];
        }

        // Try to find product field
        const productField = Object.keys(row).find(key => 
          key.includes('product') || key.includes('Product') || 
          key.includes('item') || key.includes('sku') || key.includes('name')
        );
        if (productField) {
          normalized.product = row[productField];
        }

        // Try to find sales/quantity field
        const salesField = Object.keys(row).find(key => 
          key.includes('sales') || key.includes('Sales') || 
          key.includes('quantity') || key.includes('qty') || 
          key.includes('units') || key.includes('amount')
        );
        if (salesField) {
          normalized.sales = parseFloat(row[salesField]) || 0;
        } else {
          // If no sales field, try to find any numeric field
          const numericField = Object.keys(row).find(key => 
            !isNaN(parseFloat(row[key])) && !key.includes('date') && !key.includes('id')
          );
          if (numericField) {
            normalized.sales = parseFloat(row[numericField]) || 0;
          }
        }

        // Try to find revenue field
        const revenueField = Object.keys(row).find(key => 
          key.includes('revenue') || key.includes('Revenue') || 
          key.includes('total') || key.includes('amount')
        );
        if (revenueField) {
          normalized.revenue = parseFloat(row[revenueField]) || 0;
        }

        return normalized;
      }).filter(row => row.sales > 0); // Only keep rows with sales data

      console.log(`📈 Normalized ${salesData.length} rows with sales data`);

      // Extract unique products for inventory
      const uniqueProducts = [...new Set(salesData
        .map(row => row.product)
        .filter(p => p && p.toString().trim())
      )];

      // Create product catalog from sales data
      const products = uniqueProducts.map((product, index) => ({
        id: `P${String(index + 1).padStart(3, '0')}`,
        name: product.toString().trim(),
        category: 'General',
        unit_cost: 10, // Default values - you might want to get these from another source
        unit_price: 20,
        current_stock: Math.floor(Math.random() * 100) + 50, // Random stock for demo
        lead_time_days: 7,
        reorder_point: 30,
        safety_stock: 15,
        max_stock: 500
      }));

      console.log(`📦 Created ${products.length} products from sales data`);

      // Parse options
      let forecastPeriods = parseInt(req.body.periods) || 30;
      
      const periodMap = {
        '7': 7,
        '30': 30,
        '90': 90,
        '365': 365,
        '1825': 1825,
        '3650': 3650
      };
      
      if (typeof req.body.periods === 'string' && periodMap[req.body.periods]) {
        forecastPeriods = periodMap[req.body.periods];
      }

      const options = {
        forecastPeriods: forecastPeriods,
        confidenceLevel: parseFloat(req.body.confidence) || 0.95,
        includeExternalFactors: req.body.external !== 'false',
        seasonalityDetection: req.body.seasonality !== 'false',
        cacheKey: sessionId
      };

      console.log(`🔮 Generating forecast for ${forecastPeriods} days...`);

      // Generate forecast
      const forecast = await forecastLogic.generateForecast(
        salesData, 
        products, 
        options
      );

      // Detect seasonality
      const seasonality = await seasonalityUtils.detectSeasonality(salesData);

      // Store session data
      forecastSessions.set(sessionId, {
        salesData,
        products,
        forecast,
        seasonality,
        timestamp: Date.now()
      });

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      // Return response with products included
      res.json({
        success: true,
        sessionId,
        forecast,
        seasonality,
        products, // Include the generated products
        metadata: {
          dataPoints: salesData.length,
          productsCount: products.length,
          generatedAt: new Date().toISOString(),
          forecastPeriods: forecastPeriods
        }
      });

    } catch (error) {
      console.error('❌ Forecast generation error:', error);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate forecast'
      });
    }
  });
});

/**
 * POST /api/forecast/text
 * Generate forecast from pasted text data - Handle longer periods
 */
router.post('/text', async (req, res) => {
  const { text, products, periods = 30, confidence = 0.95, sessionId } = req.body;

  if (!text) {
    return res.status(400).json({ success: false, error: 'No data provided' });
  }

  const newSessionId = sessionId || uuidv4();

  try {
    // Parse the text data
    let salesData;
    try {
      // Try to parse as JSON first
      salesData = JSON.parse(text);
    } catch {
      // Try to parse as CSV
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      salesData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || '';
        });
        return obj;
      });
    }

    // Ensure it's an array
    if (!Array.isArray(salesData)) {
      salesData = [salesData];
    }

    // Parse products if provided
    let productData = [];
    if (products) {
      try {
        productData = JSON.parse(products);
      } catch (e) {
        console.warn('Could not parse products');
      }
    }

    // Handle period mapping
    let forecastPeriods = parseInt(periods) || 30;
    const periodMap = {
      '7': 7,
      '30': 30,
      '90': 90,
      '365': 365,
      '1825': 1825,
      '3650': 3650
    };
    
    if (typeof periods === 'string' && periodMap[periods]) {
      forecastPeriods = periodMap[periods];
    }

    // Generate forecast
    const forecast = await forecastLogic.generateForecast(salesData, productData, {
      forecastPeriods: forecastPeriods,
      confidenceLevel: confidence,
      cacheKey: newSessionId
    });

    // Detect seasonality
    const seasonality = await seasonalityUtils.detectSeasonality(salesData);

    // Store session
    forecastSessions.set(newSessionId, {
      salesData,
      products: productData,
      forecast,
      seasonality,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      sessionId: newSessionId,
      forecast,
      seasonality,
      metadata: {
        dataPoints: salesData.length,
        productsCount: productData.length,
        generatedAt: new Date().toISOString(),
        forecastPeriods: forecastPeriods
      }
    });

  } catch (error) {
    console.error('Text forecast error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate forecast from text'
    });
  }
});

/**
 * GET /api/forecast/session/:sessionId
 * Get forecast session data
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const session = forecastSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  res.json({
    success: true,
    session: {
      ...session,
      salesData: session.salesData.slice(-100) // Return last 100 records only
    }
  });
});

/**
 * DELETE /api/forecast/session/:sessionId
 * Clear forecast session
 */
router.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (forecastSessions.delete(sessionId)) {
    res.json({ success: true, message: 'Session cleared' });
  } else {
    res.status(404).json({ success: false, error: 'Session not found' });
  }
});

/**
 * GET /api/forecast/health
 * Get forecast system health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    activeSessions: forecastSessions.size,
    cacheSize: forecastLogic.cache?.size || 0,
    uptime: process.uptime()
  });
});

/**
 * POST /api/forecast/clear-cache
 * Clear forecast cache (admin only - add auth in production)
 */
router.post('/clear-cache', (req, res) => {
  forecastLogic.clearCache();
  forecastSessions.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

module.exports = router;