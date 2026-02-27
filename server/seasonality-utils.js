// server/seasonality-utils.js - Seasonality detection for demand patterns

class SeasonalityUtils {
  /**
   * Detect seasonality patterns in time series data
   */
  detectSeasonality(data, dateField = 'date', valueField = 'sales') {
    if (data.length < 30) {
      return { detected: false, reason: 'Insufficient data (need at least 30 points)' };
    }

    // Extract values in chronological order
    const sorted = [...data].sort((a, b) => 
      new Date(a[dateField]) - new Date(b[dateField])
    );
    
    const values = sorted.map(d => parseFloat(d[valueField]) || 0);
    
    // Check for weekly pattern (7 days)
    const weeklyStrength = this.checkPeriodicity(values, 7);
    
    // Check for monthly pattern (30 days)
    const monthlyStrength = this.checkPeriodicity(values, 30);
    
    // Determine dominant pattern
    let pattern = null;
    let strength = 0;
    
    if (weeklyStrength > 0.3) {
      pattern = 'weekly';
      strength = weeklyStrength;
    } else if (monthlyStrength > 0.2) {
      pattern = 'monthly';
      strength = monthlyStrength;
    }

    // Calculate day-of-week averages if weekly pattern detected
    let dayOfWeekPattern = null;
    if (pattern === 'weekly') {
      dayOfWeekPattern = this.calculateDayOfWeekAverages(sorted, valueField);
    }

    return {
      detected: !!pattern,
      pattern,
      strength: Math.round(strength * 100) / 100,
      dayOfWeekPattern,
      recommendation: this.getRecommendation(pattern, strength)
    };
  }

  /**
   * Check periodicity using autocorrelation
   */
  checkPeriodicity(values, lag) {
    if (values.length <= lag) return 0;
    
    // Calculate mean
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Calculate autocorrelation at given lag
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < values.length - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }
    
    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }
    
    if (denominator === 0) return 0;
    
    return Math.abs(numerator / denominator);
  }

  /**
   * Calculate day-of-week averages
   */
  calculateDayOfWeekAverages(data, valueField) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    
    data.forEach(item => {
      const date = new Date(item.date || item.Date);
      const dayOfWeek = date.getDay();
      const value = parseFloat(item[valueField]) || 0;
      
      sums[dayOfWeek] += value;
      counts[dayOfWeek]++;
    });
    
    const averages = days.map((day, index) => ({
      day,
      average: counts[index] > 0 ? sums[index] / counts[index] : 0,
      index
    }));
    
    // Sort by average to find peak day
    const sorted = [...averages].sort((a, b) => b.average - a.average);
    
    return {
      averages,
      peakDay: sorted[0].day,
      lowDay: sorted[6].day,
      weekendEffect: this.calculateWeekendEffect(averages)
    };
  }

  /**
   * Calculate weekend effect
   */
  calculateWeekendEffect(averages) {
    const weekdays = averages.slice(1, 6).map(a => a.average);
    const weekend = [averages[0].average, averages[6].average];
    
    const avgWeekday = weekdays.reduce((a, b) => a + b, 0) / weekdays.length;
    const avgWeekend = weekend.reduce((a, b) => a + b, 0) / weekend.length;
    
    if (avgWeekday === 0) return 0;
    
    return (avgWeekend - avgWeekday) / avgWeekday;
  }

  /**
   * Get recommendation based on detected pattern
   */
  getRecommendation(pattern, strength) {
    if (!pattern) {
      return 'No strong seasonal pattern detected. Use moving averages for forecasting.';
    }
    
    if (pattern === 'weekly') {
      if (strength > 0.7) {
        return 'Strong weekly pattern detected. Adjust inventory for day-of-week variations.';
      } else if (strength > 0.4) {
        return 'Moderate weekly pattern. Consider day-of-week in safety stock calculations.';
      } else {
        return 'Weak weekly pattern. Monitor for emerging trends.';
      }
    }
    
    if (pattern === 'monthly') {
      if (strength > 0.5) {
        return 'Monthly seasonality detected. Plan for month-end peaks.';
      } else {
        return 'Slight monthly variation. Review monthly targets.';
      }
    }
    
    return 'Consider longer historical data for better seasonality detection.';
  }

  /**
   * Adjust forecast for seasonality
   */
  applySeasonality(forecast, seasonality) {
    if (!seasonality?.detected || !seasonality?.dayOfWeekPattern) {
      return forecast;
    }
    
    return forecast.map(item => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay();
      const dayAverage = seasonality.dayOfWeekPattern.averages[dayOfWeek]?.average || 1;
      
      // Calculate overall average
      const overallAvg = seasonality.dayOfWeekPattern.averages
        .reduce((sum, d) => sum + d.average, 0) / 7;
      
      // Apply seasonal factor
      const factor = overallAvg > 0 ? dayAverage / overallAvg : 1;
      
      return {
        ...item,
        predicted: item.predicted * factor,
        upper_bound: item.upper_bound * factor,
        lower_bound: item.lower_bound * factor,
        seasonal_factor: Math.round(factor * 100) / 100
      };
    });
  }
}

module.exports = new SeasonalityUtils();