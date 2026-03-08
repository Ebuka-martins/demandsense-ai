// assets/src/inventory-dashboard.js - Inventory management UI components with real data

class InventoryDashboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.inventoryData = null;
        this.products = [];
        this.healthMetrics = [];
        this.forecastData = null;
    }

    /**
     * Render inventory overview with real data
     */
    renderOverview(data) {
        this.inventoryData = data;
        this.products = data.products || [];
        this.healthMetrics = data.healthMetrics || [];
        this.forecastData = data.forecast || null;

        if (!this.container) return;

        // Calculate classification counts
        const aCount = data.classifiedProducts?.filter(p => p.class === 'A').length || 0;
        const bCount = data.classifiedProducts?.filter(p => p.class === 'B').length || 0;
        const cCount = data.classifiedProducts?.filter(p => p.class === 'C').length || 0;
        const totalProducts = data.classifiedProducts?.length || 1;

        let html = `
            <div class="inventory-dashboard">
                <div class="dashboard-header">
                    <h3><i class="fas fa-boxes"></i> Inventory Overview</h3>
                    <div class="header-actions">
                        <button class="refresh-btn" onclick="window.inventoryDashboard?.refresh()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-cubes"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${data.summary?.totalProducts || 0}</div>
                            <div class="stat-label">Total Products</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${this.formatNumber(data.summary?.totalStock || 0)}</div>
                            <div class="stat-label">Total Stock (units)</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">$${this.formatNumber(data.summary?.totalValue || 0)}</div>
                            <div class="stat-label">Total Value</div>
                        </div>
                    </div>

                    <div class="stat-card ${(data.summary?.urgentOrders || 0) > 0 ? 'warning' : ''}">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${data.summary?.urgentOrders || 0}</div>
                            <div class="stat-label">Urgent Orders</div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-section">
                    <h4><i class="fas fa-chart-pie"></i> ABC Classification</h4>
                    <div class="classification-bars">
                        ${this.renderClassificationBars(data.classifiedProducts)}
                    </div>
                    <div class="classification-stats">
                        <div class="class-stat">
                            <span class="class-dot class-a"></span>
                            <span>A Class: ${aCount} items (${Math.round(aCount / totalProducts * 100)}%)</span>
                        </div>
                        <div class="class-stat">
                            <span class="class-dot class-b"></span>
                            <span>B Class: ${bCount} items (${Math.round(bCount / totalProducts * 100)}%)</span>
                        </div>
                        <div class="class-stat">
                            <span class="class-dot class-c"></span>
                            <span>C Class: ${cCount} items (${Math.round(cCount / totalProducts * 100)}%)</span>
                        </div>
                    </div>
                </div>

                <div class="dashboard-section">
                    <h4><i class="fas fa-truck"></i> Urgent Reorders</h4>
                    <div class="reorder-list">
                        ${this.renderUrgentOrders(data.optimalOrders)}
                    </div>
                </div>

                <div class="dashboard-section">
                    <h4><i class="fas fa-heartbeat"></i> Health Metrics</h4>
                    <div class="metrics-table-container">
                        ${this.renderHealthMetrics(data.healthMetrics)}
                    </div>
                </div>

                <div class="dashboard-section">
                    <h4><i class="fas fa-exclamation-circle"></i> Stockout Risks</h4>
                    <div class="risks-container">
                        ${this.renderStockoutRisks(data.stockoutRisks)}
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Render classification bars
     */
    renderClassificationBars(classifiedProducts) {
        if (!classifiedProducts || classifiedProducts.length === 0) {
            return '<p class="no-data">No classification data available</p>';
        }

        const counts = {
            A: classifiedProducts.filter(p => p.class === 'A').length,
            B: classifiedProducts.filter(p => p.class === 'B').length,
            C: classifiedProducts.filter(p => p.class === 'C').length
        };

        const total = classifiedProducts.length;

        return `
            <div class="classification-bar-container">
                <div class="classification-bar">
                    <div class="bar-segment class-a" style="width: ${(counts.A / total) * 100}%">
                        <span>A (${counts.A})</span>
                    </div>
                    <div class="bar-segment class-b" style="width: ${(counts.B / total) * 100}%">
                        <span>B (${counts.B})</span>
                    </div>
                    <div class="bar-segment class-c" style="width: ${(counts.C / total) * 100}%">
                        <span>C (${counts.C})</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render urgent orders
     */
    renderUrgentOrders(optimalOrders) {
        if (!optimalOrders || optimalOrders.length === 0) {
            return '<p class="no-data">No order data available</p>';
        }

        const urgent = optimalOrders.filter(o => o.urgent);

        if (urgent.length === 0) {
            return '<p class="no-data good">✅ No urgent orders needed - inventory levels are healthy</p>';
        }

        return urgent.slice(0, 5).map(order => `
            <div class="reorder-item ${order.critical ? 'critical' : ''}">
                <div class="reorder-info">
                    <div class="product-name">${order.product_name || 'Unknown'}</div>
                    <div class="product-details">
                        Current: ${order.current_stock || 0} units | 
                        Daily Demand: ${order.daily_demand?.toFixed(1) || '?'} units
                    </div>
                </div>
                <div class="reorder-action">
                    <span class="order-badge">Order ${order.recommended}</span>
                    ${order.critical ? '<span class="critical-badge">CRITICAL</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render health metrics
     */
    renderHealthMetrics(metrics) {
        if (!metrics || metrics.length === 0) {
            return '<p class="no-data">No health metrics available</p>';
        }

        return `
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Daily Demand</th>
                        <th>Safety Stock</th>
                        <th>Reorder Point</th>
                        <th>Stockout Risk</th>
                        <th>Days of Inv</th>
                        <th>Turnover</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.slice(0, 10).map(m => `
                        <tr>
                            <td title="${m.product_name}">${this.truncateText(m.product_name, 20)}</td>
                            <td>${m.daily_demand?.toFixed(1) || '-'}</td>
                            <td>${m.safety_stock || '-'}</td>
                            <td>${m.reorder_point || '-'}</td>
                            <td>
                                <span class="risk-badge risk-${this.getRiskLevel(m.stockout_probability)}">
                                    ${Math.round((m.stockout_probability || 0) * 100)}%
                                </span>
                            </td>
                            <td>${m.days_of_inventory?.toFixed(1) || '-'}</td>
                            <td>${m.turnover_rate?.toFixed(2) || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Render stockout risks
     */
    renderStockoutRisks(risks) {
        if (!risks || risks.length === 0) {
            return '<p class="no-data">No risk data available</p>';
        }

        const highRisk = risks.filter(r => r.risk_level === 'high');
        const mediumRisk = risks.filter(r => r.risk_level === 'medium');

        if (highRisk.length === 0 && mediumRisk.length === 0) {
            return '<p class="no-data good">✅ Low stockout risk across all products</p>';
        }

        let html = '';

        if (highRisk.length > 0) {
            html += '<h5 class="risk-title">🔴 High Risk Items</h5>';
            html += highRisk.slice(0, 5).map(r => `
                <div class="risk-item high">
                    <div class="risk-item-name">${r.product_name}</div>
                    <div class="risk-item-details">
                        Stock: ${r.current_stock} | Demand: ${r.daily_demand?.toFixed(1)}/day
                        <span class="risk-percent">${Math.round(r.stockout_probability * 100)}% risk</span>
                    </div>
                </div>
            `).join('');
        }

        if (mediumRisk.length > 0) {
            html += '<h5 class="risk-title">🟡 Medium Risk Items</h5>';
            html += mediumRisk.slice(0, 5).map(r => `
                <div class="risk-item medium">
                    <div class="risk-item-name">${r.product_name}</div>
                    <div class="risk-item-details">
                        Stock: ${r.current_stock} | Demand: ${r.daily_demand?.toFixed(1)}/day
                        <span class="risk-percent">${Math.round(r.stockout_probability * 100)}% risk</span>
                    </div>
                </div>
            `).join('');
        }

        return html;
    }

    /**
     * Get risk level from probability
     */
    getRiskLevel(probability) {
        if (probability > 0.7) return 'high';
        if (probability > 0.3) return 'medium';
        return 'low';
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Truncate text
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Add click handlers for reorder items
        const reorderItems = this.container.querySelectorAll('.reorder-item');
        reorderItems.forEach(item => {
            item.addEventListener('click', () => {
                // Could open detailed view
                console.log('Reorder item clicked');
            });
        });
    }

    /**
     * Refresh data - will be called from parent
     */
    refresh() {
        if (window.app && window.app.forecastData) {
            window.app.generateInventoryRecommendations();
        }
    }
}

// Make globally available
window.InventoryDashboard = InventoryDashboard;