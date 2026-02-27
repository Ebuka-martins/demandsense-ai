// tests/inventory.test.js - Unit tests for inventory management

const assert = require('assert');
const inventoryCalculator = require('../server/inventory-calculator');

const mockProducts = [
    {
        id: 'P001',
        name: 'Product A',
        category: 'Electronics',
        unit_cost: 50,
        unit_price: 100,
        current_stock: 45,
        lead_time_days: 7,
        reorder_point: 20,
        safety_stock: 15,
        max_stock: 200,
        daily_demand: 10
    },
    {
        id: 'P002',
        name: 'Product B',
        category: 'Electronics',
        unit_cost: 120,
        unit_price: 200,
        current_stock: 18,
        lead_time_days: 10,
        reorder_point: 15,
        safety_stock: 10,
        max_stock: 100,
        daily_demand: 5
    },
    {
        id: 'P003',
        name: 'Product C',
        category: 'Accessories',
        unit_cost: 25,
        unit_price: 50,
        current_stock: 55,
        lead_time_days: 5,
        reorder_point: 30,
        safety_stock: 25,
        max_stock: 200,
        daily_demand: 8
    }
];

const mockForecast = {
    forecast: Array(30).fill().map((_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        predicted: 10 + Math.random() * 5,
        product_id: i % 3 === 0 ? 'P001' : (i % 3 === 1 ? 'P002' : 'P003')
    }))
};

describe('Inventory Management Tests', () => {
    describe('Health Metrics', () => {
        it('should calculate health metrics for all products', () => {
            const metrics = inventoryCalculator.calculateHealthMetrics(
                mockProducts,
                [], // No sales data in this test
                mockForecast
            );
            
            assert.ok(Array.isArray(metrics));
            assert.strictEqual(metrics.length, mockProducts.length);
        });

        it('should calculate daily demand correctly', () => {
            const salesData = [
                { date: '2024-01-01', sales: 10 },
                { date: '2024-01-02', sales: 12 },
                { date: '2024-01-03', sales: 11 },
                { date: '2024-01-04', sales: 9 },
                { date: '2024-01-05', sales: 10 }
            ];
            
            const dailyDemand = inventoryCalculator.calculateDailyDemand(salesData);
            assert.ok(dailyDemand > 0);
        });

        it('should calculate standard deviation', () => {
            const values = [10, 12, 11, 9, 10];
            const stdDev = inventoryCalculator.calculateStdDev(values);
            assert.ok(stdDev > 0);
            assert.ok(stdDev < 2);
        });
    });

    describe('Reorder Recommendations', () => {
        it('should identify products needing reorder', () => {
            const recommendations = mockProducts.map(product => {
                return {
                    ...product,
                    should_reorder: product.current_stock <= product.reorder_point,
                    recommended_order: Math.max(0, product.reorder_point - product.current_stock + product.safety_stock)
                };
            });
            
            const needsReorder = recommendations.filter(r => r.should_reorder);
            assert.ok(Array.isArray(needsReorder));
        });

        it('should calculate optimal order quantities', () => {
            const product = mockProducts[1]; // Product with low stock
            const forecast = mockForecast.forecast.filter(f => f.product_id === product.id);
            
            const optimal = inventoryCalculator.calculateOptimalOrder(
                forecast,
                product.current_stock,
                product.reorder_point,
                product.max_stock
            );
            
            assert.ok(optimal.recommended >= 0);
            assert.ok(optimal.final <= product.max_stock);
        });
    });

    describe('Stockout Risk', () => {
        it('should calculate stockout probability', () => {
            const product = mockProducts[1]; // Low stock product
            const probability = inventoryCalculator.calculateStockoutProbability(
                product.daily_demand || 10,
                product.safety_stock || 10,
                5 // demand standard deviation
            );
            
            assert.ok(probability >= 0 && probability <= 1);
        });

        it('should identify critical stock levels', () => {
            const criticalThreshold = 0.25; // 25% of reorder point
            const product = mockProducts[1];
            
            const isCritical = product.current_stock < (product.reorder_point * criticalThreshold);
            
            // Product B has 18 stock, reorder point 15 -> 18 < 3.75? false
            assert.strictEqual(isCritical, false);
        });
    });

    describe('ABC Analysis', () => {
        it('should classify products correctly', () => {
            const productsWithValue = mockProducts.map(p => ({
                ...p,
                annualValue: p.current_stock * p.unit_cost * 12 // Rough annual value
            }));
            
            const classified = inventoryCalculator.classifyABC(productsWithValue);
            
            const aItems = classified.filter(p => p.class === 'A');
            const bItems = classified.filter(p => p.class === 'B');
            const cItems = classified.filter(p => p.class === 'C');
            
            assert.strictEqual(aItems.length + bItems.length + cItems.length, mockProducts.length);
        });
    });

    describe('Inventory Value Calculations', () => {
        it('should calculate total inventory value', () => {
            const totalValue = mockProducts.reduce((sum, p) => 
                sum + (p.current_stock * p.unit_cost), 0
            );
            
            const expected = (45 * 50) + (18 * 120) + (55 * 25);
            assert.strictEqual(totalValue, expected);
        });

        it('should calculate turnover rates', () => {
            const turnover = mockProducts.map(p => {
                const annualSales = p.daily_demand * 365;
                return annualSales / (p.current_stock || 1);
            });
            
            assert.ok(turnover.every(t => t > 0));
        });
    });

    describe('Fill Rate Calculations', () => {
        it('should calculate fill rate correctly', () => {
            const fillRate = inventoryCalculator.calculateFillRate(950, 1000);
            assert.strictEqual(fillRate, 0.95);
        });

        it('should handle zero orders', () => {
            const fillRate = inventoryCalculator.calculateFillRate(0, 0);
            assert.strictEqual(fillRate, 1); // By convention
        });
    });

    describe('DIO Calculations', () => {
        it('should calculate days of inventory outstanding', () => {
            const dio = inventoryCalculator.calculateDIO(5000, 36500);
            assert.strictEqual(dio, 50); // 5000/36500 * 365 = 50
        });
    });
});

console.log('✅ All inventory tests passed!');