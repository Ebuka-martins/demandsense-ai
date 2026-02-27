// assets/src/what-if-panel.js - Scenario analysis interface

class WhatIfPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.baseForecast = null;
        this.products = null;
        this.currentScenario = null;
    }

    /**
     * Initialize the panel
     */
    initialize(baseForecast, products) {
        this.baseForecast = baseForecast;
        this.products = products;

        this.renderPanel();
        this.attachEventListeners();
    }

    /**
     * Render the what-if panel
     */
    renderPanel() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="what-if-panel">
                <div class="panel-header">
                    <h3><i class="fas fa-flask"></i> What-If Scenarios</h3>
                    <p class="panel-description">Simulate different business conditions and see the impact on demand</p>
                </div>

                <div class="scenario-tabs">
                    <button class="scenario-tab active" data-scenario="demand">
                        <i class="fas fa-chart-line"></i>
                        Demand Shock
                    </button>
                    <button class="scenario-tab" data-scenario="supply">
                        <i class="fas fa-truck"></i>
                        Supply Disruption
                    </button>
                    <button class="scenario-tab" data-scenario="promotion">
                        <i class="fas fa-tag"></i>
                        Promotion
                    </button>
                    <button class="scenario-tab" data-scenario="custom">
                        <i class="fas fa-sliders-h"></i>
                        Custom
                    </button>
                </div>

                <div class="scenario-content">
                    ${this.renderDemandShock()}
                </div>

                <div class="scenario-results" id="scenarioResults">
                    <div class="results-placeholder">
                        <i class="fas fa-chart-bar"></i>
                        <p>Adjust parameters above to see impact</p>
                    </div>
                </div>

                <div class="panel-actions">
                    <button class="apply-scenario-btn" id="applyScenario">
                        <i class="fas fa-play"></i>
                        Run Scenario
                    </button>
                    <button class="reset-scenario-btn" id="resetScenario">
                        <i class="fas fa-undo"></i>
                        Reset
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render demand shock scenario
     */
    renderDemandShock() {
        return `
            <div class="scenario-form" id="demandShockForm">
                <div class="form-group">
                    <label>Demand Increase (%)</label>
                    <div class="slider-container">
                        <input type="range" id="demandMultiplier" min="0" max="200" value="50" step="10">
                        <span class="slider-value" id="demandValue">+50%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Duration (days)</label>
                    <div class="slider-container">
                        <input type="range" id="demandDuration" min="1" max="30" value="7" step="1">
                        <span class="slider-value" id="durationValue">7 days</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Affected Products</label>
                    <select id="affectedProducts" multiple>
                        <option value="all" selected>All Products</option>
                        ${this.products?.map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Render supply disruption scenario
     */
    renderSupplyDisruption() {
        return `
            <div class="scenario-form" id="supplyDisruptionForm">
                <div class="form-group">
                    <label>Delay (days)</label>
                    <div class="slider-container">
                        <input type="range" id="supplyDelay" min="0" max="30" value="14" step="1">
                        <span class="slider-value" id="delayValue">14 days</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Capacity Reduction (%)</label>
                    <div class="slider-container">
                        <input type="range" id="capacityReduction" min="0" max="100" value="30" step="5">
                        <span class="slider-value" id="capacityValue">30%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Affected Products</label>
                    <select id="supplyAffectedProducts" multiple>
                        <option value="all" selected>All Products</option>
                        ${this.products?.map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Render promotion scenario
     */
    renderPromotion() {
        return `
            <div class="scenario-form" id="promotionForm">
                <div class="form-group">
                    <label>Sales Lift (%)</label>
                    <div class="slider-container">
                        <input type="range" id="promotionLift" min="0" max="300" value="100" step="10">
                        <span class="slider-value" id="liftValue">+100%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Duration (days)</label>
                    <div class="slider-container">
                        <input type="range" id="promotionDuration" min="1" max="14" value="3" step="1">
                        <span class="slider-value" id="promoDurationValue">3 days</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Promotion Type</label>
                    <select id="promotionType">
                        <option value="discount">Discount</option>
                        <option value="bundle">Bundle Deal</option>
                        <option value="featured">Featured Placement</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * Render custom scenario
     */
    renderCustom() {
        return `
            <div class="scenario-form" id="customForm">
                <div class="form-group">
                    <label>Scenario Name</label>
                    <input type="text" id="scenarioName" placeholder="e.g., Holiday Season">
                </div>
                <div class="form-group">
                    <label>Adjustment Type</label>
                    <select id="adjustmentType">
                        <option value="multiply">Multiply Demand</option>
                        <option value="add">Add to Demand</option>
                        <option value="trend">Trend Shift</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Adjustment Value</label>
                    <input type="number" id="adjustmentValue" step="0.1" value="1.5">
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Tab switching
        const tabs = this.container.querySelectorAll('.scenario-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const scenario = tab.dataset.scenario;
                this.switchScenario(scenario);
            });
        });

        // Sliders
        const demandSlider = document.getElementById('demandMultiplier');
        if (demandSlider) {
            demandSlider.addEventListener('input', (e) => {
                document.getElementById('demandValue').textContent = `+${e.target.value}%`;
            });
        }

        const durationSlider = document.getElementById('demandDuration');
        if (durationSlider) {
            durationSlider.addEventListener('input', (e) => {
                document.getElementById('durationValue').textContent = `${e.target.value} days`;
            });
        }

        // Apply button
        const applyBtn = document.getElementById('applyScenario');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.runScenario());
        }

        // Reset button
        const resetBtn = document.getElementById('resetScenario');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetScenario());
        }
    }

    /**
     * Switch scenario type
     */
    switchScenario(scenario) {
        const contentDiv = this.container.querySelector('.scenario-content');
        
        switch(scenario) {
            case 'demand':
                contentDiv.innerHTML = this.renderDemandShock();
                break;
            case 'supply':
                contentDiv.innerHTML = this.renderSupplyDisruption();
                break;
            case 'promotion':
                contentDiv.innerHTML = this.renderPromotion();
                break;
            case 'custom':
                contentDiv.innerHTML = this.renderCustom();
                break;
        }

        // Re-attach slider listeners
        this.attachEventListeners();
    }

    /**
     * Run the current scenario
     */
    async runScenario() {
        const activeTab = this.container.querySelector('.scenario-tab.active');
        const scenarioType = activeTab.dataset.scenario;

        let params = {};
        
        switch(scenarioType) {
            case 'demand':
                params = {
                    multiplier: 1 + (parseFloat(document.getElementById('demandMultiplier')?.value || 50) / 100),
                    duration: parseInt(document.getElementById('demandDuration')?.value || 7)
                };
                break;
            case 'supply':
                params = {
                    delayDays: parseInt(document.getElementById('supplyDelay')?.value || 14),
                    capacityReduction: parseFloat(document.getElementById('capacityReduction')?.value || 30) / 100
                };
                break;
            case 'promotion':
                params = {
                    multiplier: 1 + (parseFloat(document.getElementById('promotionLift')?.value || 100) / 100),
                    duration: parseInt(document.getElementById('promotionDuration')?.value || 3),
                    type: document.getElementById('promotionType')?.value
                };
                break;
        }

        this.currentScenario = {
            type: scenarioType,
            parameters: params
        };

        // Call API
        try {
            const response = await fetch('/api/scenarios/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseForecast: this.baseForecast,
                    scenario: this.currentScenario,
                    products: this.products
                })
            });

            const result = await response.json();
            this.displayResults(result);

        } catch (error) {
            console.error('Scenario error:', error);
            this.displayError(error.message);
        }
    }

    /**
     * Display scenario results
     */
    displayResults(result) {
        const resultsDiv = document.getElementById('scenarioResults');
        
        if (!resultsDiv) return;

        const impact = result.impact || {};
        const analysis = result.analysis || {};

        resultsDiv.innerHTML = `
            <div class="results-card">
                <div class="results-header">
                    <h4>Scenario Impact Analysis</h4>
                    <span class="risk-badge risk-${analysis.riskLevel || 'medium'}">
                        ${(analysis.riskLevel || 'MEDIUM').toUpperCase()} RISK
                    </span>
                </div>
                
                <div class="impact-grid">
                    <div class="impact-item">
                        <div class="impact-label">Demand Impact</div>
                        <div class="impact-value ${impact.percentageChange > 0 ? 'positive' : 'negative'}">
                            ${impact.percentageChange > 0 ? '+' : ''}${impact.percentageChange || 0}%
                        </div>
                    </div>
                    <div class="impact-item">
                        <div class="impact-label">Additional Units</div>
                        <div class="impact-value">${impact.totalDemandImpact || 0}</div>
                    </div>
                    <div class="impact-item">
                        <div class="impact-label">Products Affected</div>
                        <div class="impact-value">${impact.productsAffected || 0}</div>
                    </div>
                </div>

                <div class="insights-section">
                    <h5>Key Insights</h5>
                    <ul>
                        ${analysis.insights?.map(i => `<li>${i}</li>`).join('') || '<li>No insights available</li>'}
                    </ul>
                </div>

                <div class="recommendations-section">
                    <h5>Recommendations</h5>
                    <ul>
                        ${result.recommendations?.map(r => `<li>${r}</li>`).join('') || '<li>No recommendations</li>'}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Display error
     */
    displayError(message) {
        const resultsDiv = document.getElementById('scenarioResults');
        
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="results-card error">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h4>Error Running Scenario</h4>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * Reset scenario
     */
    resetScenario() {
        this.currentScenario = null;
        
        const resultsDiv = document.getElementById('scenarioResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="results-placeholder">
                    <i class="fas fa-chart-bar"></i>
                    <p>Adjust parameters above to see impact</p>
                </div>
            `;
        }

        // Reset sliders to defaults
        const demandSlider = document.getElementById('demandMultiplier');
        if (demandSlider) {
            demandSlider.value = 50;
            document.getElementById('demandValue').textContent = '+50%';
        }

        const durationSlider = document.getElementById('demandDuration');
        if (durationSlider) {
            durationSlider.value = 7;
            document.getElementById('durationValue').textContent = '7 days';
        }
    }
}

// Make globally available
window.WhatIfPanel = WhatIfPanel;