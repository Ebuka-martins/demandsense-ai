// assets/src/inventory-dashboard.js - Inventory management UI components

class InventoryDashboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.inventoryData = null;
        this.products = [];
        this.healthMetrics = [];
    }

    /**
     * Render inventory overview
     */
    renderOverview(data) {
        this.inventoryData = data;
        this.products = data.products || [];
        this.healthMetrics = data.healthMetrics || [];

        if (!this.container) return;

        let html = `
            <div class="inventory-dashboard">
                <div class="dashboard-header">
                    <h3><i class="fas fa-boxes"></i> Inventory Overview</h3>
                    <div class="header-actions">
                        <button class="refresh-btn" onclick="window.inventoryDashboard.refresh()">
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
                            <div class="stat-value">${data.summary?.totalStock || 0}</div>
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

                    <div class="stat-card warning">
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
                    <div class="classification-list">
                        ${this.renderClassificationList(data.classifiedProducts)}
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
                    <div class="metrics-table">
                        ${this.renderHealthMetrics(data.healthMetrics)}
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
            return '<p class="no-data">No classification data</p>';
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
     * Render classification list
     */
    renderClassificationList(classifiedProducts) {
        if (!classifiedProducts || classifiedProducts.length === 0) {
            return '';
        }

        const grouped = {
            A: classifiedProducts.filter(p => p.class === 'A').slice(0, 5),
            B: classifiedProducts.filter(p => p.class === 'B').slice(0, 5),
            C: classifiedProducts.filter(p => p.class === 'C').slice(0, 5)
        };

        return `
            <div class="classification-groups">
                <div class="class-group class-a">
                    <h5>A Class (High Value)</h5>
                    <ul>
                        ${grouped.A.map(p => `<li>${p.name || p.product_name}</li>`).join('')}
                        ${grouped.A.length === 5 ? '<li class="more">...</li>' : ''}
                    </ul>
                </div>
                <div class="class-group class-b">
                    <h5>B Class (Medium Value)</h5>
                    <ul>
                        ${grouped.B.map(p => `<li>${p.name || p.product_name}</li>`).join('')}
                        ${grouped.B.length === 5 ? '<li class="more">...</li>' : ''}
                    </ul>
                </div>
                <div class="class-group class-c">
                    <h5>C Class (Low Value)</h5>
                    <ul>
                        ${grouped.C.map(p => `<li>${p.name || p.product_name}</li>`).join('')}
                        ${grouped.C.length === 5 ? '<li class="more">...</li>' : ''}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Render urgent orders
     */
    renderUrgentOrders(optimalOrders) {
        if (!optimalOrders || optimalOrders.length === 0) {
            return '<p class="no-data">No urgent orders</p>';
        }

        const urgent = optimalOrders.filter(o => o.urgent);

        if (urgent.length === 0) {
            return '<p class="no-data good">✅ No urgent orders needed</p>';
        }

        return urgent.map(order => `
            <div class="reorder-item ${order.critical ? 'critical' : ''}">
                <div class="reorder-info">
                    <div class="product-name">${order.product_name}</div>
                    <div class="product-details">
                        Current: ${order.current_stock || 0} units
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
                        <th>Turnover</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.slice(0, 10).map(m => `
                        <tr>
                            <td>${m.product_name}</td>
                            <td>${m.daily_demand?.toFixed(1) || '-'}</td>
                            <td>${m.safety_stock || '-'}</td>
                            <td>${m.reorder_point || '-'}</td>
                            <td>
                                <span class="risk-badge risk-${m.stockout_probability > 0.5 ? 'high' : (m.stockout_probability > 0.2 ? 'medium' : 'low')}">
                                    ${Math.round((m.stockout_probability || 0) * 100)}%
                                </span>
                            </td>
                            <td>${m.turnover_rate?.toFixed(2) || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Add any interactive elements here
    }

    /**
     * Refresh data
     */
    refresh() {
        // Implement refresh logic
        console.log('Refreshing inventory dashboard...');
    }
}

// Make globally available
window.InventoryDashboard = InventoryDashboard;