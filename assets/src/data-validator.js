// assets/src/data-validator.js - Input validation for supply chain data

class DataValidator {
    constructor() {
        this.validationRules = {
            sales: {
                required: ['date', 'sales'],
                dateFormat: 'YYYY-MM-DD',
                numericFields: ['sales', 'revenue', 'quantity', 'price']
            },
            products: {
                required: ['id', 'name', 'category'],
                numericFields: ['unit_cost', 'unit_price', 'current_stock', 'lead_time_days']
            },
            inventory: {
                required: ['product_id', 'current_stock'],
                numericFields: ['current_stock', 'reorder_point', 'safety_stock', 'max_stock']
            }
        };
    }

    /**
     * Validate sales data
     */
    validateSalesData(data) {
        if (!Array.isArray(data)) {
            return {
                valid: false,
                errors: ['Data must be an array'],
                warnings: []
            };
        }

        if (data.length === 0) {
            return {
                valid: false,
                errors: ['No data provided'],
                warnings: []
            };
        }

        const errors = [];
        const warnings = [];
        const stats = {
            totalRows: data.length,
            validRows: 0,
            invalidRows: 0,
            dateRange: { min: null, max: null },
            numericStats: {}
        };

        // Check each row
        data.forEach((row, index) => {
            const rowErrors = this.validateSalesRow(row, index);
            
            if (rowErrors.length === 0) {
                stats.validRows++;
                
                // Update date range
                if (row.date) {
                    const date = new Date(row.date);
                    if (!stats.dateRange.min || date < stats.dateRange.min) {
                        stats.dateRange.min = date;
                    }
                    if (!stats.dateRange.max || date > stats.dateRange.max) {
                        stats.dateRange.max = date;
                    }
                }

                // Collect numeric stats
                ['sales', 'revenue', 'quantity'].forEach(field => {
                    if (row[field] !== undefined) {
                        if (!stats.numericStats[field]) {
                            stats.numericStats[field] = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
                        }
                        const value = parseFloat(row[field]);
                        if (!isNaN(value)) {
                            stats.numericStats[field].min = Math.min(stats.numericStats[field].min, value);
                            stats.numericStats[field].max = Math.max(stats.numericStats[field].max, value);
                            stats.numericStats[field].sum += value;
                            stats.numericStats[field].count++;
                        }
                    }
                });
            } else {
                stats.invalidRows++;
                errors.push(...rowErrors.map(e => `Row ${index + 1}: ${e}`));
            }
        });

        // Check data quality
        if (stats.validRows < data.length * 0.8) {
            warnings.push(`Only ${stats.validRows} of ${data.length} rows are valid (${Math.round(stats.validRows/data.length*100)}%)`);
        }

        if (stats.validRows < 10) {
            warnings.push('Very few valid data points. Forecast may be unreliable.');
        }

        // Calculate averages
        Object.keys(stats.numericStats).forEach(field => {
            const f = stats.numericStats[field];
            f.avg = f.sum / f.count;
        });

        return {
            valid: errors.length === 0,
            errors: errors.slice(0, 20), // Limit error display
            warnings,
            stats
        };
    }

    /**
     * Validate a single sales row
     */
    validateSalesRow(row, index) {
        const errors = [];

        // Check required fields
        for (const field of this.validationRules.sales.required) {
            if (row[field] === undefined || row[field] === null || row[field] === '') {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate date format
        if (row.date) {
            const dateStr = String(row.date);
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                errors.push(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`);
            }
        }

        // Validate numeric fields
        for (const field of this.validationRules.sales.numericFields) {
            if (row[field] !== undefined && row[field] !== '') {
                const num = parseFloat(row[field]);
                if (isNaN(num)) {
                    errors.push(`Field ${field} must be a number: ${row[field]}`);
                } else if (num < 0) {
                    errors.push(`Field ${field} cannot be negative: ${num}`);
                }
            }
        }

        return errors;
    }

    /**
     * Validate product data
     */
    validateProductsData(data) {
        if (!Array.isArray(data)) {
            return { valid: false, errors: ['Products must be an array'] };
        }

        const errors = [];
        const ids = new Set();

        data.forEach((product, index) => {
            // Check required fields
            for (const field of this.validationRules.products.required) {
                if (!product[field]) {
                    errors.push(`Product ${index + 1}: Missing ${field}`);
                }
            }

            // Check for duplicate IDs
            if (product.id) {
                if (ids.has(product.id)) {
                    errors.push(`Duplicate product ID: ${product.id}`);
                }
                ids.add(product.id);
            }

            // Validate numeric fields
            for (const field of this.validationRules.products.numericFields) {
                if (product[field] !== undefined) {
                    const num = parseFloat(product[field]);
                    if (isNaN(num)) {
                        errors.push(`Product ${product.id || index + 1}: ${field} must be a number`);
                    } else if (num < 0) {
                        errors.push(`Product ${product.id || index + 1}: ${field} cannot be negative`);
                    }
                }
            }

            // Validate lead time
            if (product.lead_time_days !== undefined && product.lead_time_days < 0) {
                errors.push(`Product ${product.id || index + 1}: lead_time_days cannot be negative`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors.slice(0, 20),
            productCount: data.length,
            uniqueIds: ids.size
        };
    }

    /**
     * Validate inventory data
     */
    validateInventoryData(data) {
        if (!Array.isArray(data)) {
            return { valid: false, errors: ['Inventory must be an array'] };
        }

        const errors = [];

        data.forEach((item, index) => {
            for (const field of this.validationRules.inventory.required) {
                if (item[field] === undefined) {
                    errors.push(`Item ${index + 1}: Missing ${field}`);
                }
            }

            for (const field of this.validationRules.inventory.numericFields) {
                if (item[field] !== undefined) {
                    const num = parseFloat(item[field]);
                    if (isNaN(num)) {
                        errors.push(`Item ${index + 1}: ${field} must be a number`);
                    }
                }
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors.slice(0, 20),
            itemCount: data.length
        };
    }

    /**
     * Auto-detect data type
     */
    detectDataType(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return 'unknown';
        }

        const sample = data[0];
        const fields = Object.keys(sample);

        // Check for sales data patterns
        if (fields.some(f => f.toLowerCase().includes('date')) &&
            fields.some(f => f.toLowerCase().includes('sales') || f.toLowerCase().includes('revenue'))) {
            return 'sales';
        }

        // Check for product data patterns
        if (fields.some(f => f.toLowerCase().includes('product')) &&
            fields.some(f => f.toLowerCase().includes('price') || f.toLowerCase().includes('cost'))) {
            return 'products';
        }

        // Check for inventory patterns
        if (fields.some(f => f.toLowerCase().includes('stock')) &&
            fields.some(f => f.toLowerCase().includes('product'))) {
            return 'inventory';
        }

        return 'unknown';
    }

    /**
     * Suggest fixes for common issues
     */
    suggestFixes(validationResult, dataType) {
        const suggestions = [];

        if (validationResult.errors.length > 0) {
            if (dataType === 'sales') {
                suggestions.push(
                    'Ensure each row has a date field (format: YYYY-MM-DD)',
                    'Make sure sales/quantity fields are numbers',
                    'Remove any empty rows or header rows'
                );
            } else if (dataType === 'products') {
                suggestions.push(
                    'Each product must have a unique ID',
                    'Price and cost fields should be numbers',
                    'Lead time should be in days (number)'
                );
            }
        }

        if (validationResult.warnings.length > 0) {
            suggestions.push(
                'Consider using more historical data for better accuracy',
                'Check for outliers in your data',
                'Ensure dates are consecutive'
            );
        }

        return suggestions;
    }

    /**
     * Clean and normalize data
     */
    cleanData(data, dataType) {
        if (!Array.isArray(data)) return data;

        return data
            .filter(row => {
                // Remove completely empty rows
                return Object.values(row).some(v => v !== null && v !== '' && v !== undefined);
            })
            .map(row => {
                const cleaned = {};
                
                Object.entries(row).forEach(([key, value]) => {
                    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
                    
                    // Clean value based on field name
                    if (this.validationRules.sales.numericFields.includes(cleanKey) ||
                        this.validationRules.products.numericFields.includes(cleanKey) ||
                        this.validationRules.inventory.numericFields.includes(cleanKey)) {
                        // Convert to number
                        cleaned[cleanKey] = parseFloat(value) || 0;
                    } else if (cleanKey === 'date') {
                        // Normalize date
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            cleaned[cleanKey] = date.toISOString().split('T')[0];
                        } else {
                            cleaned[cleanKey] = value;
                        }
                    } else {
                        cleaned[cleanKey] = String(value).trim();
                    }
                });
                
                return cleaned;
            });
    }

    /**
     * Generate summary statistics
     */
    generateSummary(data, dataType) {
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const summary = {
            dataType,
            rowCount: data.length,
            fields: Object.keys(data[0]),
            completeness: {},
            dateRange: null
        };

        // Calculate completeness for each field
        summary.fields.forEach(field => {
            const nonNull = data.filter(row => 
                row[field] !== null && row[field] !== undefined && row[field] !== ''
            ).length;
            summary.completeness[field] = (nonNull / data.length * 100).toFixed(1) + '%';
        });

        // Find date range if date field exists
        const dateField = summary.fields.find(f => f.includes('date'));
        if (dateField) {
            const dates = data
                .map(row => new Date(row[dateField]))
                .filter(d => !isNaN(d.getTime()))
                .sort((a, b) => a - b);
            
            if (dates.length > 0) {
                summary.dateRange = {
                    start: dates[0].toISOString().split('T')[0],
                    end: dates[dates.length - 1].toISOString().split('T')[0],
                    days: Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24))
                };
            }
        }

        return summary;
    }
}

// Make globally available
window.DataValidator = DataValidator;