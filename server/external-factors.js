// server/external-factors.js - External factors integration
const fs = require('fs');
const path = require('path');

class ExternalFactors {
    constructor() {
        this.cache = null;
        this.cacheTime = null;
        this.cacheDuration = 60 * 60 * 1000; // 1 hour
    }

    /**
     * Load external factors from mock data
     */
    async loadFactors() {
        // Check cache
        if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.cacheDuration)) {
            return this.cache;
        }

        try {
            const dataPath = path.join(__dirname, '../data/mock/external-factors.json');
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            
            this.cache = data;
            this.cacheTime = Date.now();
            
            return data;
        } catch (error) {
            console.error('Error loading external factors:', error);
            return this.getDefaultFactors();
        }
    }

    /**
     * Get default factors if mock data unavailable
     */
    getDefaultFactors() {
        return {
            economic: {
                consumerConfidence: 0.75,
                unemployment: 0.04,
                gdpGrowth: 0.02,
                inflation: 0.03
            },
            holidays: [],
            weather: {
                regions: []
            },
            trends: {
                overall: 'stable',
                growthRate: 0.02
            }
        };
    }

    /**
     * Get factors for a specific date range
     */
    async getFactorsForPeriod(startDate, endDate) {
        const factors = await this.loadFactors();
        
        // Filter holidays in the date range
        const holidaysInRange = (factors.holidays || []).filter(holiday => {
            const holidayDate = new Date(holiday.date);
            return holidayDate >= startDate && holidayDate <= endDate;
        });

        return {
            ...factors,
            holidays: holidaysInRange,
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        };
    }

    /**
     * Get impact multiplier for a date
     */
    async getDateMultiplier(date) {
        const factors = await this.loadFactors();
        let multiplier = 1.0;

        // Check for holidays
        const dateStr = date.toISOString().split('T')[0];
        const holiday = (factors.holidays || []).find(h => h.date === dateStr);
        
        if (holiday) {
            switch (holiday.impact) {
                case 'high':
                    multiplier *= 2.0;
                    break;
                case 'medium':
                    multiplier *= 1.5;
                    break;
                case 'low':
                    multiplier *= 1.2;
                    break;
            }
        }

        // Apply seasonal adjustments
        const month = date.getMonth();
        if (month === 11) { // December
            multiplier *= 1.8; // Holiday season
        } else if (month === 0) { // January
            multiplier *= 0.7; // Post-holiday dip
        } else if (month === 6 || month === 7) { // July-August
            multiplier *= 1.2; // Summer
        }

        // Apply economic trend
        multiplier *= (1 + (factors.trends?.growthRate || 0.02));

        return Math.round(multiplier * 100) / 100;
    }

    /**
     * Get weather impact for region
     */
    async getWeatherImpact(region, date) {
        const factors = await this.loadFactors();
        const regionData = (factors.weather?.regions || []).find(r => r.region === region);
        
        if (!regionData) {
            return { impact: 'none', multiplier: 1.0 };
        }

        const month = date.getMonth();
        let multiplier = 1.0;
        let impact = 'none';

        // Simple weather impact logic
        if (regionData.season === 'Winter' && month >= 0 && month <= 2) {
            multiplier = 0.7; // Reduced demand due to weather
            impact = 'negative';
        } else if (regionData.season === 'Summer' && month >= 5 && month <= 7) {
            multiplier = 1.3; // Increased demand
            impact = 'positive';
        }

        return { impact, multiplier };
    }

    /**
     * Get competitor activity
     */
    async getCompetitorActivity() {
        const factors = await this.loadFactors();
        return factors.competitor || { marketShare: 0, competitors: [] };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache = null;
        this.cacheTime = null;
    }
}

module.exports = new ExternalFactors();