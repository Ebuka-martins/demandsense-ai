// routes/api/forecast.js - Forecast endpoints
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const forecastLogic = require('../../server/forecast-logic');
const inventoryCalculator = require('../../server/inventory-calculator');
const seasonalityUtils = require('../../server/seasonality-utils');

// In-memory forecast cache
const forecastSessions = new Map();

/**
 * Parse uploaded file to JSON
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
        const data = XLSX.utils.sheet_to_json(sheet);
        resolve(data);
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
      const salesData = await parseFile(filePath, fileExt);

      // Get products data if provided
      let products = [];
      if (req.body.products) {
        try {
          products = JSON.parse(req.body.products);
        } catch (e) {
          console.warn('Could not parse products data');
        }
      }

      // Parse options
      const options = {
        forecastPeriods: parseInt(req.body.periods) || 30,
        confidenceLevel: parseFloat(req.body.confidence) || 0.95,
        includeExternalFactors: req.body.external !== 'false',
        seasonalityDetection: req.body.seasonality !== 'false',
        cacheKey: sessionId
      };

      // Generate forecast
      console.log('🔮 Generating forecast...');
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

      // Return response
      res.json({
        success: true,
        sessionId,
        forecast,
        seasonality,
        metadata: {
          dataPoints: salesData.length,
          productsCount: products.length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Forecast generation error:', error);
      
      // Clean up file if it exists
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
 * Generate forecast from pasted text data
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

    // Generate forecast
    const forecast = await forecastLogic.generateForecast(salesData, productData, {
      forecastPeriods: periods,
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
        generatedAt: new Date().toISOString()
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