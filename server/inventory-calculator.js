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
    // Z-score for service level (simplified)
    const zScores = {
      0.90: 1.28,
      0.95: 1.65,
      0.99: 2.33
    };
    
    const z = zScores[serviceLevel] || 1.65;
    
    // Safety stock = Z * σ * √L
    // where σ is standard deviation of demand, L is lead time
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
  calculateStockoutProbability(averageDemand, safetyStock, demandStdDev) {
    // Simplified: probability demand exceeds average + safety stock
    if (!demandStdDev || demandStdDev === 0) return 0;
    
    const z = safetyStock / demandStdDev;
    
    // Approximate probability using normal distribution
    // This is a simplified approximation
    const probability = Math.exp(-0.717 * z - 0.416 * z * z);
    
    return Math.min(1, Math.max(0, probability));
  }

  /**
   * Calculate optimal order quantity given constraints
   */
  calculateOptimalOrder(forecast, currentStock, reorderPoint, maxStock) {
    const recommendedOrder = Math.max(0, reorderPoint - currentStock);
    
    // Add buffer for forecasted demand during lead time
    const forecastedDemand = forecast.slice(0, 7).reduce((sum, f) => sum + f.predicted, 0);
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
   * Calculate ABC classification
   */
  classifyABC(items, valueKey = 'annualValue') {
    // Sort by value descending
    const sorted = [...items].sort((a, b) => b[valueKey] - a[valueKey]);
    
    const totalValue = sorted.reduce((sum, item) => sum + item[valueKey], 0);
    
    let cumulative = 0;
    const result = [];
    
    for (const item of sorted) {
      cumulative += item[valueKey];
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
      // Get product sales
      const productSales = salesData.filter(s => 
        s.product_id === product.id || s.product_name === product.name
      );
      
      // Calculate average daily demand
      const dailyDemand = this.calculateDailyDemand(productSales);
      
      // Calculate demand standard deviation
      const demandStdDev = this.calculateStdDev(productSales.map(s => s.sales || s.quantity || 0));
      
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
      
      // Get forecast for this product
      const productForecast = forecast?.forecast?.filter(f => 
        f.product_id === product.id
      ) || [];
      
      metrics.push({
        product_id: product.id,
        product_name: product.name,
        daily_demand: Math.round(dailyDemand * 100) / 100,
        demand_std_dev: Math.round(demandStdDev * 100) / 100,
        safety_stock: Math.round(safetyStock),
        reorder_point: Math.round(reorderPoint),
        stockout_probability: this.calculateStockoutProbability(dailyDemand, safetyStock, demandStdDev),
        turnover_rate: this.calculateTurnover(
          productSales.reduce((sum, s) => sum + (s.revenue || 0), 0),
          product.current_stock || 100
        ),
        days_of_inventory: this.calculateDIO(
          product.current_stock || 100,
          dailyDemand,
          1
        ),
        forecast_accuracy: this.calculateForecastAccuracy(productSales, productForecast)
      });
    }
    
    return metrics;
  }

  /**
   * Calculate daily demand
   */
  calculateDailyDemand(salesData) {
    if (salesData.length === 0) return 0;
    
    // Group by date
    const byDate = new Map();
    salesData.forEach(sale => {
      const date = sale.date || sale.Date;
      if (!date) return;
      
      const key = new Date(date).toISOString().split('T')[0];
      const value = sale.sales || sale.quantity || 0;
      
      byDate.set(key, (byDate.get(key) || 0) + value);
    });
    
    const total = Array.from(byDate.values()).reduce((sum, v) => sum + v, 0);
    return total / byDate.size;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0;
    
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
    
    // Simple matching by date
    let totalError = 0;
    let count = 0;
    
    actual.forEach(a => {
      const date = a.date || a.Date;
      const forecastItem = forecast.find(f => f.date === date);
      
      if (forecastItem) {
        const actualValue = a.sales || a.quantity || 0;
        const forecastValue = forecastItem.predicted || 0;
        
        if (actualValue > 0) {
          totalError += Math.abs((actualValue - forecastValue) / actualValue);
          count++;
        }
      }
    });
    
    if (count === 0) return null;
    
    const mape = totalError / count;
    return Math.max(0, 1 - mape);
  }
}

module.exports = new InventoryCalculator();