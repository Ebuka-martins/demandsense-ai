// server/inventory-calculator.js - Inventory optimization calculations

class InventoryCalculator {
  /**
   * Calculate economic order quantity (EOQ)
   */
  calculateEOQ(annualDemand, orderingCost, holdingCost) {
    if (!annualDemand || !orderingCost || !holdingCost || holdingCost === 0) {
      return null;
    }
    
    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
    return Math.round(eoq * 100) / 100;
  }

  /**
   * Calculate reorder point
   */
  calculateReorderPoint(averageDailyDemand, leadTimeDays, safetyStock) {
    return (averageDailyDemand * leadTimeDays) + safetyStock;
  }

  /**
   * Calculate safety stock
   */
  calculateSafetyStock(averageDailyDemand, leadTimeDays, serviceLevel, demandStdDev) {
    // Z-score for service level
    const zScores = {
      0.90: 1.28,
      0.95: 1.65,
      0.99: 2.33
    };
    
    const z = zScores[serviceLevel] || 1.65;
    
    // Safety stock = Z * σ * √L
    const safetyStock = z * demandStdDev * Math.sqrt(leadTimeDays);
    
    return Math.round(safetyStock * 100) / 100;
  }

  /**
   * Calculate inventory turnover
   */
  calculateTurnover(costOfGoodsSold, averageInventory) {
    if (!averageInventory || averageInventory === 0) return 0;
    return costOfGoodsSold / averageInventory;
  }

  /**
   * Calculate days of inventory outstanding
   */
  calculateDIO(averageInventory, costOfGoodsSold, days = 365) {
    if (!costOfGoodsSold || costOfGoodsSold === 0) return 0;
    return (averageInventory / costOfGoodsSold) * days;
  }

  /**
   * Calculate fill rate
   */
  calculateFillRate(unitsShipped, unitsOrdered) {
    if (!unitsOrdered || unitsOrdered === 0) return 1;
    return unitsShipped / unitsOrdered;
  }

  /**
   * Calculate stockout probability
   */
  calculateStockoutProbability(averageDemand, currentStock, leadTimeDays, safetyStock, demandStdDev) {
    if (averageDemand === 0) return 0;
    
    // Calculate demand during lead time
    const demandDuringLeadTime = averageDemand * leadTimeDays;
    
    // If current stock is more than demand during lead time + safety stock, probability is low
    if (currentStock > demandDuringLeadTime + safetyStock) {
      return 0.1; // 10% base risk
    }
    
    // If current stock is less than demand during lead time, probability is high
    if (currentStock < demandDuringLeadTime) {
      const shortfall = demandDuringLeadTime - currentStock;
      return Math.min(0.95, 0.5 + (shortfall / demandDuringLeadTime) * 0.5);
    }
    
    // Calculate z-score
    const z = (currentStock - demandDuringLeadTime) / (demandStdDev * Math.sqrt(leadTimeDays) || 1);
    
    // Approximate probability using logistic function
    const probability = 1 / (1 + Math.exp(1.5 * z));
    
    return Math.min(0.95, Math.max(0.05, probability));
  }

  /**
   * Calculate optimal order quantity given constraints
   */
  calculateOptimalOrder(forecast, currentStock, reorderPoint, maxStock) {
    const recommendedOrder = Math.max(0, reorderPoint - currentStock);
    
    // Add buffer for forecasted demand during lead time
    const forecastedDemand = forecast.slice(0, 7).reduce((sum, f) => sum + (f.predicted || 0), 0);
    const adjustedOrder = Math.max(recommendedOrder, forecastedDemand * 1.2);
    
    // Cap at max stock
    const finalOrder = Math.min(adjustedOrder, maxStock - currentStock);
    
    return {
      recommended: Math.round(recommendedOrder),
      adjusted: Math.round(adjustedOrder),
      final: Math.max(0, Math.round(finalOrder)),
      urgent: currentStock < reorderPoint * 0.5,
      critical: currentStock < reorderPoint * 0.25
    };
  }

  /**
   * Calculate ABC classification based on annual value
   */
  classifyABC(items, valueKey = 'annualValue') {
    if (!items || items.length === 0) return [];
    
    // Sort by value descending
    const sorted = [...items].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    
    const totalValue = sorted.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
    
    if (totalValue === 0) {
      return items.map(item => ({ ...item, class: 'C' }));
    }
    
    let cumulative = 0;
    const result = [];
    
    for (const item of sorted) {
      cumulative += item[valueKey] || 0;
      const percentage = cumulative / totalValue;
      
      if (percentage <= 0.8) {
        item.class = 'A';
      } else if (percentage <= 0.95) {
        item.class = 'B';
      } else {
        item.class = 'C';
      }
      
      result.push(item);
    }
    
    return result;
  }

  /**
   * Calculate inventory health metrics
   */
  calculateHealthMetrics(products, salesData, forecast) {
    const metrics = [];
    
    for (const product of products) {
      // Get product sales - try multiple matching strategies
      const productSales = salesData.filter(s => {
        const saleProduct = s.product_name || s.productName || s.product || s.Product;
        const saleProductId = s.product_id || s.productId || s.ProductID;
        
        // Match by name (case insensitive)
        if (saleProduct && product.name) {
          return saleProduct.toLowerCase() === product.name.toLowerCase();
        }
        
        // Match by ID
        if (saleProductId && product.id) {
          return saleProductId === product.id;
        }
        
        return false;
      });
      
      // Calculate average daily demand from actual sales
      const dailyDemand = this.calculateDailyDemand(productSales);
      
      // Calculate demand standard deviation
      const salesValues = productSales.map(s => 
        parseFloat(s.sales || s.Sales || s.quantity || s.Quantity || 0)
      ).filter(v => !isNaN(v) && v > 0);
      
      const demandStdDev = salesValues.length > 1 ? 
        this.calculateStdDev(salesValues) : (dailyDemand * 0.3); // Default 30% variation
      
      // Calculate safety stock
      const safetyStock = this.calculateSafetyStock(
        dailyDemand || 10, // Default if no data
        product.lead_time_days || 7,
        0.95,
        demandStdDev || 5
      );
      
      // Calculate reorder point
      const reorderPoint = this.calculateReorderPoint(
        dailyDemand || 10,
        product.lead_time_days || 7,
        safetyStock
      );
      
      // Get forecast for this product
      const productForecast = forecast?.forecast?.filter(f => {
        const forecastProduct = f.product_id || f.product || f.Product || f.product_name;
        return forecastProduct === product.id || 
               forecastProduct === product.name ||
               (product.name && forecastProduct && 
                product.name.toLowerCase() === forecastProduct.toLowerCase());
      }) || [];
      
      // Calculate forecast accuracy if we have both actual and forecast
      const forecastAccuracy = this.calculateForecastAccuracy(productSales, productForecast);
      
      // Calculate stockout probability
      const stockoutProbability = this.calculateStockoutProbability(
        dailyDemand || 10,
        product.current_stock || 0,
        product.lead_time_days || 7,
        safetyStock,
        demandStdDev || 5
      );
      
      // Calculate turnover rate
      const totalSalesValue = productSales.reduce((sum, s) => {
        const revenue = parseFloat(s.revenue || s.Revenue || 0);
        const quantity = parseFloat(s.sales || s.Sales || s.quantity || s.Quantity || 0);
        return sum + (revenue || quantity * (product.unit_price || 0));
      }, 0);
      
      const turnoverRate = this.calculateTurnover(
        totalSalesValue || (dailyDemand * 365 * (product.unit_cost || 0)),
        (product.current_stock || 0) * (product.unit_cost || 0) || 1
      );
      
      // Calculate days of inventory
      const daysOfInventory = this.calculateDIO(
        product.current_stock || 0,
        dailyDemand || 10,
        1
      );
      
      metrics.push({
        product_id: product.id,
        product_name: product.name,
        daily_demand: Math.round(dailyDemand * 100) / 100,
        demand_std_dev: Math.round(demandStdDev * 100) / 100,
        safety_stock: Math.round(safetyStock),
        reorder_point: Math.round(reorderPoint),
        stockout_probability: Math.round(stockoutProbability * 100) / 100,
        turnover_rate: Math.round(turnoverRate * 100) / 100,
        days_of_inventory: Math.round(daysOfInventory * 10) / 10,
        forecast_accuracy: forecastAccuracy ? Math.round(forecastAccuracy * 100) / 100 : null,
        current_stock: product.current_stock || 0,
        unit_cost: product.unit_cost || 0,
        unit_price: product.unit_price || 0
      });
    }
    
    return metrics;
  }

  /**
   * Calculate daily demand from sales data
   */
  calculateDailyDemand(salesData) {
    if (salesData.length === 0) return 0;
    
    // Group by date
    const byDate = new Map();
    salesData.forEach(sale => {
      const date = sale.date || sale.Date;
      if (!date) return;
      
      const key = new Date(date).toISOString().split('T')[0];
      const value = parseFloat(sale.sales || sale.Sales || sale.quantity || sale.Quantity || 0);
      
      if (!isNaN(value) && value > 0) {
        byDate.set(key, (byDate.get(key) || 0) + value);
      }
    });
    
    if (byDate.size === 0) return 0;
    
    const total = Array.from(byDate.values()).reduce((sum, v) => sum + v, 0);
    return total / byDate.size;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0] * 0.1; // 10% of value if only one data point
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate forecast accuracy (MAPE)
   */
  calculateForecastAccuracy(actual, forecast) {
    if (actual.length === 0 || forecast.length === 0) return null;
    
    // Create map of actual sales by date
    const actualByDate = new Map();
    actual.forEach(a => {
      const date = a.date || a.Date;
      if (date) {
        const key = new Date(date).toISOString().split('T')[0];
        const value = parseFloat(a.sales || a.Sales || a.quantity || a.Quantity || 0);
        if (!isNaN(value) && value > 0) {
          actualByDate.set(key, value);
        }
      }
    });
    
    // Match forecast with actual
    let totalError = 0;
    let count = 0;
    
    forecast.forEach(f => {
      const date = f.date;
      const actualValue = actualByDate.get(date);
      
      if (actualValue !== undefined && actualValue > 0) {
        const forecastValue = f.predicted || 0;
        if (forecastValue > 0) {
          totalError += Math.min(2, Math.abs((actualValue - forecastValue) / actualValue)); // Cap error at 200%
          count++;
        }
      }
    });
    
    if (count === 0) return null;
    
    const mape = totalError / count;
    return Math.max(0, 1 - mape);
  }

  /**
   * Calculate reorder recommendations
   */
  calculateReorderRecommendations(products, salesData, forecast) {
    const recommendations = [];
    
    for (const product of products) {
      // Get product sales - try multiple matching strategies
      const productSales = salesData.filter(s => {
        const saleProduct = s.product_name || s.productName || s.product || s.Product;
        const saleProductId = s.product_id || s.productId || s.ProductID;
        
        if (saleProduct && product.name) {
          return saleProduct.toLowerCase() === product.name.toLowerCase();
        }
        if (saleProductId && product.id) {
          return saleProductId === product.id;
        }
        return false;
      });
      
      // Calculate daily demand
      const dailyDemand = this.calculateDailyDemand(productSales) || 10;
      
      // Calculate demand standard deviation
      const salesValues = productSales.map(s => 
        parseFloat(s.sales || s.Sales || s.quantity || s.Quantity || 0)
      ).filter(v => !isNaN(v) && v > 0);
      
      const demandStdDev = salesValues.length > 1 ? 
        this.calculateStdDev(salesValues) : dailyDemand * 0.3;
      
      // Calculate safety stock
      const safetyStock = this.calculateSafetyStock(
        dailyDemand,
        product.lead_time_days || 7,
        0.95,
        demandStdDev
      );
      
      // Calculate reorder point
      const reorderPoint = this.calculateReorderPoint(
        dailyDemand,
        product.lead_time_days || 7,
        safetyStock
      );
      
      const currentStock = product.current_stock || 0;
      const daysUntilReorder = currentStock > 0 ? 
        Math.max(0, (currentStock - reorderPoint) / dailyDemand) : 0;
      
      // Get forecast for this product
      const productForecast = forecast?.forecast?.filter(f => {
        const forecastProduct = f.product_id || f.product || f.Product || f.product_name;
        return forecastProduct === product.id || 
               forecastProduct === product.name ||
               (product.name && forecastProduct && 
                product.name.toLowerCase() === forecastProduct.toLowerCase());
      }) || [];
      
      // Calculate optimal order
      const optimalOrder = this.calculateOptimalOrder(
        productForecast,
        currentStock,
        reorderPoint,
        product.max_stock || 500
      );
      
      // Calculate stockout probability
      const stockoutProbability = this.calculateStockoutProbability(
        dailyDemand,
        currentStock,
        product.lead_time_days || 7,
        safetyStock,
        demandStdDev
      );
      
      recommendations.push({
        product_id: product.id,
        product_name: product.name,
        current_stock: currentStock,
        daily_demand: Math.round(dailyDemand * 100) / 100,
        reorder_point: Math.round(reorderPoint),
        safety_stock: Math.round(safetyStock),
        days_until_reorder: Math.round(daysUntilReorder * 10) / 10,
        should_reorder: currentStock <= reorderPoint,
        recommended_order: optimalOrder.final,
        urgent: optimalOrder.urgent,
        critical: optimalOrder.critical,
        stockout_probability: Math.round(stockoutProbability * 100) / 100
      });
    }
    
    return recommendations;
  }
}

module.exports = new InventoryCalculator();