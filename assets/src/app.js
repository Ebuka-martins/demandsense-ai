// assets/src/app.js - Main application for DemandSense AI

// Cache buster - runs before everything
(function() {
    const APP_VERSION = '1.0.1';
    const STORAGE_KEY = 'app_version';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    if (lastVersion !== APP_VERSION) {
        console.log(`🔄 Updating from v${lastVersion} to v${APP_VERSION}`);
        
        // Clear all caches
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key.startsWith('demandsense-')) {
                        console.log('🗑️ Deleting cache:', key);
                        caches.delete(key);
                    }
                });
            });
        }
        
        // Update version
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
    }
})();

class DemandSenseApp {
    constructor() {
        this.api = new DemandSenseAPI();
        this.currentSessionId = null;
        this.currentFile = null;
        this.forecastData = null;
        this.inventoryData = null;
        this.products = [];
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.analysisHistory = JSON.parse(localStorage.getItem('forecastHistory')) || [];
        
        // Managers
        this.forecastChart = null;
        this.inventoryDashboard = null;
        this.whatIfPanel = null;
        this.dataValidator = new DataValidator();
        this.pdfExporter = new PDFExporter();
        
        // Elements
        this.elements = {};
        this.initializeElements();
        
        // Check authentication
        if (!this.checkAuthentication()) {
            return;
        }
        
        this.applyTheme();
        this.initializeManagers();
        this.initializeEventListeners();
        this.loadSampleProducts();
        this.renderHistory();
        
        console.log('✅ DemandSense AI v1.0.1 initialized');
    }

    initializeElements() {
        const ids = [
            'sidebar', 'menuToggle', 'sidebarClose', 'sidebarOverlay', 'newAnalysis',
            'fileInput', 'uploadBtn', 'dataInput', 'analyzePaste', 'analysisHistory',
            'clearAllHistory', 'statusIndicator', 'welcomeScreen', 'messagesContainer', 
            'chatContainer', 'dataChart', 'messageInput', 'sendBtn', 'fileIndicator', 
            'fileName', 'clearFile', 'quickUpload', 'quickPaste', 'quickSample', 
            'loadingOverlay', 'installBtn', 'themeToggle', 'toastContainer', 
            'inventoryPanel', 'whatIfPanel', 'forecastTab', 'inventoryTab', 'scenarioTab',
            'forecastPeriod', 'exportForecast', 'forecastStats', 'welcomeHint', 'closeWelcomeHint'
        ];

        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    initializeManagers() {
        // Initialize forecast chart
        if (this.elements.dataChart) {
            this.forecastChart = new ForecastChartManager(this.elements.dataChart);
            this.forecastChart.initialize();
        }

        // Initialize inventory dashboard
        if (this.elements.inventoryPanel) {
            this.inventoryDashboard = new InventoryDashboard('inventoryPanel');
        }

        // Initialize what-if panel
        if (this.elements.whatIfPanel) {
            this.whatIfPanel = new WhatIfPanel('whatIfPanel');
        }
    }

    initializeEventListeners() {
        // Menu toggle
        if (this.elements.menuToggle) {
            this.elements.menuToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Sidebar close
        if (this.elements.sidebarClose) {
            this.elements.sidebarClose.addEventListener('click', () => this.toggleSidebar());
        }

        // Overlay click
        if (this.elements.sidebarOverlay) {
            this.elements.sidebarOverlay.addEventListener('click', () => this.toggleSidebar());
        }

        // New analysis
        if (this.elements.newAnalysis) {
            this.elements.newAnalysis.addEventListener('click', () => this.resetAnalysis());
        }

        // File upload
        if (this.elements.uploadBtn) {
            this.elements.uploadBtn.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Clear file
        if (this.elements.clearFile) {
            this.elements.clearFile.addEventListener('click', () => this.clearFile());
        }

        // Analyze paste
        if (this.elements.analyzePaste) {
            this.elements.analyzePaste.addEventListener('click', () => this.analyzePastedData());
        }

        // Send message
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Auto-resize textarea
            this.elements.messageInput.addEventListener('input', () => {
                this.elements.messageInput.style.height = 'auto';
                this.elements.messageInput.style.height = this.elements.messageInput.scrollHeight + 'px';
            });
        }

        // Quick actions
        if (this.elements.quickUpload) {
            this.elements.quickUpload.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }

        if (this.elements.quickPaste) {
            this.elements.quickPaste.addEventListener('click', () => {
                this.elements.dataInput?.focus();
            });
        }

        if (this.elements.quickSample) {
            this.elements.quickSample.addEventListener('click', () => this.loadSampleData());
        }

        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Tab switching
        if (this.elements.forecastTab) {
            this.elements.forecastTab.addEventListener('click', () => this.switchTab('forecast'));
        }

        if (this.elements.inventoryTab) {
            this.elements.inventoryTab.addEventListener('click', () => this.switchTab('inventory'));
        }

        if (this.elements.scenarioTab) {
            this.elements.scenarioTab.addEventListener('click', () => this.switchTab('scenario'));
        }

        // Forecast period change
        if (this.elements.forecastPeriod) {
            this.elements.forecastPeriod.addEventListener('change', () => {
                this.handlePeriodChange();
            });
        }

        // Export forecast
        if (this.elements.exportForecast) {
            this.elements.exportForecast.addEventListener('click', () => {
                this.exportForecast();
            });
        }

        // Clear all history
        if (this.elements.clearAllHistory) {
            this.elements.clearAllHistory.addEventListener('click', () => {
                if (confirm('Clear all forecast history?')) {
                    this.clearAllHistory();
                }
            });
        }

        // Close welcome hint button
        if (this.elements.closeWelcomeHint) {
            this.elements.closeWelcomeHint.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.elements.welcomeHint) {
                    this.elements.welcomeHint.remove();
                    localStorage.setItem('welcomeHintClosed', 'true');
                }
            });
        }

        // Make the whole welcome hint clickable to trigger file upload
        if (this.elements.welcomeHint) {
            this.elements.welcomeHint.addEventListener('click', (e) => {
                if (!e.target.closest('#closeWelcomeHint')) {
                    this.elements.fileInput.click();
                }
            });
        }

        // Online/offline
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));

        // Install PWA
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (this.elements.installBtn) {
                this.elements.installBtn.style.display = 'flex';
                this.elements.installBtn.addEventListener('click', () => this.installPWA());
            }
        });
    }

    /**
     * Handle file selection and upload
     */
    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.currentFile = file;
        
        if (this.elements.fileName) {
            this.elements.fileName.textContent = file.name;
        }
        
        if (this.elements.fileIndicator) {
            this.elements.fileIndicator.style.display = 'flex';
        }

        this.showToast('success', `File "${file.name}" selected`);
        
        // Automatically analyze if it's a sales file
        if (file.name.includes('sales') || file.name.includes('Sales') || file.name.includes('data')) {
            this.analyzeSalesFile(file);
        }
    }

    /**
     * Clear selected file
     */
    clearFile() {
        this.currentFile = null;
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
        if (this.elements.fileIndicator) {
            this.elements.fileIndicator.style.display = 'none';
        }
        if (this.elements.fileName) {
            this.elements.fileName.textContent = 'No file selected';
        }
    }

/**
 * Analyze uploaded sales file
 */
async analyzeSalesFile(file) {
    this.showLoading(true);

    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const periodSelect = this.elements.forecastPeriod;
        let periodValue = periodSelect ? periodSelect.value : '30';
        
        formData.append('periods', periodValue);

        const response = await fetch('/api/forecast/generate', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            this.currentSessionId = result.sessionId;
            this.forecastData = result.forecast;
            
            // Use products from the forecast response if available
            if (result.products && result.products.length > 0) {
                this.products = result.products;
                console.log('Products from forecast:', this.products);
            }
            
            this.displayForecast(result);
            
            // Generate inventory recommendations using the products from the forecast
            await this.generateInventoryRecommendations();
            
            const days = result.metadata?.forecastPeriods || 30;
            const years = days / 365;
            if (years >= 1) {
                this.showToast('success', `${years.toFixed(1)}-year strategic forecast generated`);
            } else {
                this.showToast('success', `${days}-day forecast generated successfully`);
            }
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        this.showToast('error', error.message || 'Failed to generate forecast');
    } finally {
        this.showLoading(false);
    }
}

    /**
     * Analyze pasted text data
     */
    async analyzePastedData() {
        const text = this.elements.dataInput?.value.trim();
        if (!text) {
            this.showToast('warning', 'Please paste some data first');
            return;
        }

        this.showLoading(true);

        try {
            const periodSelect = this.elements.forecastPeriod;
            const periodValue = periodSelect ? periodSelect.value : '30';

            const response = await fetch('/api/forecast/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    periods: periodValue,
                    sessionId: this.currentSessionId
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentSessionId = result.sessionId;
                this.forecastData = result.forecast;
                
                this.displayForecast(result);
                await this.loadProducts();
                await this.generateInventoryRecommendations();
                
                const days = result.metadata?.forecastPeriods || 30;
                const years = days / 365;
                if (years >= 1) {
                    this.showToast('success', `${years.toFixed(1)}-year strategic forecast generated from pasted data`);
                } else {
                    this.showToast('success', `${days}-day forecast generated from pasted data`);
                }
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Paste analysis error:', error);
            this.showToast('error', error.message || 'Failed to analyze pasted data');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Handle forecast period change
     */
    handlePeriodChange() {
        if (this.forecastData) {
            this.regenerateForecast();
        }
    }

    /**
     * Regenerate forecast with new period
     */
    async regenerateForecast() {
        if (!this.currentSessionId) {
            this.showToast('warning', 'No forecast session found');
            return;
        }

        this.showLoading(true);

        try {
            const sessionResponse = await fetch(`/api/forecast/session/${this.currentSessionId}`);
            const sessionResult = await sessionResponse.json();

            if (sessionResult.success) {
                const periodSelect = this.elements.forecastPeriod;
                const periodValue = periodSelect ? periodSelect.value : '30';
                
                if (this.currentFile) {
                    const formData = new FormData();
                    formData.append('file', this.currentFile);
                    formData.append('periods', periodValue);
                    
                    const response = await fetch('/api/forecast/generate', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.forecastData = result.forecast;
                        this.displayForecast(result);
                        
                        const days = result.metadata?.forecastPeriods || 30;
                        const years = days / 365;
                        this.showToast('success', years >= 1 ? 
                            `Regenerated ${years.toFixed(1)}-year forecast` : 
                            `Regenerated ${days}-day forecast`);
                    }
                } else {
                    this.showToast('warning', 'Original data not available for regeneration');
                }
            }
        } catch (error) {
            console.error('Regenerate error:', error);
            this.showToast('error', 'Failed to regenerate forecast');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Export forecast as PDF
     */
    async exportForecast() {
        if (!this.forecastData) {
            this.showToast('warning', 'No forecast data to export');
            return;
        }

        try {
            await this.pdfExporter.exportForecast(this.forecastData, this.products);
            this.showToast('success', 'Forecast exported as PDF');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('error', 'Failed to export forecast');
        }
    }

    /**
     * Send message in chat
     */
    async sendMessage() {
        const message = this.elements.messageInput?.value.trim();
        if (!message) return;

        this.addMessage('user', message);
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';

        this.showLoading(true);

        try {
            let response;
            
            if (message.toLowerCase().includes('forecast') || message.toLowerCase().includes('demand')) {
                response = await this.handleForecastQuestion(message);
            } else if (message.toLowerCase().includes('inventory') || message.toLowerCase().includes('stock')) {
                response = await this.handleInventoryQuestion(message);
            } else if (message.toLowerCase().includes('scenario') || message.toLowerCase().includes('what if')) {
                response = await this.handleScenarioQuestion(message);
            } else {
                response = await this.handleGeneralQuestion(message);
            }

            this.addMessage('bot', response);

        } catch (error) {
            console.error('Send message error:', error);
            this.addMessage('bot', `Error: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Handle forecast questions
     */
    async handleForecastQuestion(question) {
        if (!this.forecastData) {
            return "Please upload sales data first to generate a forecast.";
        }

        const totalDemand = this.forecastData.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
        const avgDemand = totalDemand / (this.forecastData.forecast?.length || 1);
        const days = this.forecastData.forecast?.length || 30;
        const years = days / 365;

        if (years >= 1) {
            return `
**Strategic Forecast Summary (${years.toFixed(1)} Years)**

📊 Total projected demand: ${Math.round(totalDemand)} units
📈 Average yearly demand: ${Math.round(totalDemand / years)} units
🎯 Confidence level: ${Math.round((this.forecastData.confidence || 0.85) * 100)}%

**Strategic Insights**
${(this.forecastData.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

View the forecast chart above for detailed long-term projections.
            `;
        } else {
            return `
**Demand Forecast Summary (${days} Days)**

📊 Total predicted demand: ${Math.round(totalDemand)} units
📈 Average daily demand: ${Math.round(avgDemand)} units
🎯 Confidence level: ${Math.round((this.forecastData.confidence || 0.85) * 100)}%

**Key Insights**
${(this.forecastData.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

View the forecast chart above for detailed daily predictions.
            `;
        }
    }

    /**
     * Handle inventory questions
     */
    async handleInventoryQuestion(question) {
        if (!this.inventoryData) {
            return "Please generate a forecast first to see inventory recommendations.";
        }

        const urgent = this.inventoryData.optimalOrders?.filter(o => o.urgent) || [];
        const critical = this.inventoryData.optimalOrders?.filter(o => o.critical) || [];
        const highRisk = this.inventoryData.stockoutRisks?.filter(r => r.risk_level === 'high') || [];
        
        if (urgent.length === 0 && critical.length === 0 && highRisk.length === 0) {
            return "✅ Inventory levels look healthy. No urgent reorders or high risks detected at this time.";
        }

        let response = "⚠️ **Inventory Status**\n\n";
        
        if (critical.length > 0) {
            response += `🔴 **Critical Items (Order Immediately)**\n`;
            critical.slice(0, 3).forEach(o => {
                response += `- ${o.product_name}: Stock ${o.current_stock}, Order ${o.recommended}\n`;
            });
            response += '\n';
        }
        
        if (urgent.length > 0) {
            response += `🟡 **Urgent Items (Order Soon)**\n`;
            urgent.slice(0, 3).forEach(o => {
                response += `- ${o.product_name}: Stock ${o.current_stock}, Order ${o.recommended}\n`;
            });
            response += '\n';
        }
        
        if (highRisk.length > 0) {
            response += `📈 **High Risk Items**\n`;
            highRisk.slice(0, 3).forEach(r => {
                response += `- ${r.product_name}: ${Math.round(r.stockout_probability * 100)}% stockout risk\n`;
            });
        }

        response += `\nCheck the Inventory tab for complete details.`;
        
        return response;
    }

    /**
     * Handle scenario questions
     */
    async handleScenarioQuestion(question) {
        return `
**What-If Scenario Analysis**

You can simulate different business conditions:
1. 📈 **Demand Shock** - Sudden increase in demand
2. 🚚 **Supply Disruption** - Delays in supply chain
3. 🎉 **Promotion** - Sales lift from marketing

Go to the **Scenarios** tab to run simulations and see real-time impact on your inventory.

Example: Try a 50% demand increase for 7 days to see stockout risks.
        `;
    }

    /**
     * Handle general questions
     */
    async handleGeneralQuestion(question) {
        return `
I can help you with:
- 📊 **Demand forecasting** - Upload sales data for predictions (7 days to 10 years)
- 📦 **Inventory optimization** - Get reorder recommendations based on your forecast
- 🔮 **What-if scenarios** - Simulate business conditions
- 📈 **Trend analysis** - Understand demand patterns

What would you like to explore? Try asking about forecast, inventory, or scenarios.
        `;
    }

    /**
     * Display forecast with appropriate context
     */
    displayForecast(result) {
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }

        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.style.display = 'block';
        }

        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        let title;
        
        if (years >= 1) {
            title = `${years.toFixed(1)}-Year Strategic Demand Forecast`;
        } else {
            title = `${days}-Day Demand Forecast`;
        }

        if (this.forecastChart && result.forecast?.chartData) {
            this.forecastChart.updateForecast(
                result.forecast.chartData,
                null,
                { title }
            );
        }

        this.updateForecastStats(result.forecast);

        const totalDemand = result.forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
        const avgDemand = totalDemand / days;
        
        let summary = '';
        if (years >= 1) {
            summary = `
**${years.toFixed(1)}-Year Strategic Forecast Generated**

📊 Forecast period: ${days} days (${years.toFixed(1)} years)
📈 Total projected demand: ${Math.round(totalDemand)} units
📊 Average yearly demand: ${Math.round(totalDemand / years)} units
🎯 Confidence level: ${Math.round((result.forecast.confidence || 0.85) * 100)}%

**Strategic Insights**
${(result.forecast.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

**Long-term Recommendations**
${(result.forecast.recommendations || []).slice(0, 3).map(r => `- ${r}`).join('\n')}

This is a strategic forecast for long-term planning. Review and adjust annually.
            `;
        } else {
            summary = `
**${days}-Day Demand Forecast Generated**

📊 Forecast period: ${days} days
📈 Total predicted demand: ${Math.round(totalDemand)} units
📊 Average daily demand: ${Math.round(avgDemand)} units
🎯 Confidence level: ${Math.round((result.forecast.confidence || 0.85) * 100)}%

**Key Insights**
${(result.forecast.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

Check the **Inventory** tab for stock recommendations based on this forecast.
            `;
        }

        this.addMessage('bot', summary);

        this.saveToHistory(result);
    }

    /**
     * Update forecast statistics display
     */
    updateForecastStats(forecast) {
        if (!this.elements.forecastStats) return;

        const totalDemand = forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
        const avgDemand = totalDemand / (forecast.forecast?.length || 1);
        const peakDemand = Math.max(...(forecast.forecast?.map(f => f.predicted) || [0]));
        const confidence = forecast.confidence || 0.85;

        this.elements.forecastStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(totalDemand)}</div>
                    <div class="stat-label">Total Demand</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(avgDemand)}</div>
                    <div class="stat-label">Daily Avg</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(peakDemand)}</div>
                    <div class="stat-label">Peak Demand</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(confidence * 100)}%</div>
                    <div class="stat-label">Confidence</div>
                </div>
            </div>
        `;
    }

    /**
     * Add message to chat
     */
    addMessage(role, content) {
        const messagesContainer = this.elements.messagesContainer;
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? 'You' : 'AI'}</div>
            <div class="message-content">${this.formatMarkdown(content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Format markdown text
     */
    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    /**
     * Save forecast to history
     */
    saveToHistory(result) {
        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        let preview;
        
        if (years >= 1) {
            preview = `${years.toFixed(1)}-Year Strategic Forecast`;
        } else {
            preview = `${days}-Day Forecast`;
        }

        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            sessionId: result.sessionId,
            forecast: {
                total: result.forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0,
                periods: result.forecast.forecast?.length || 0
            },
            preview: preview
        };
        
        this.analysisHistory.unshift(entry);
        
        if (this.analysisHistory.length > 20) {
            this.analysisHistory = this.analysisHistory.slice(0, 20);
        }
        
        localStorage.setItem('forecastHistory', JSON.stringify(this.analysisHistory));
        this.renderHistory();
    }

    /**
     * Render history list
     */
    renderHistory() {
        const historyList = this.elements.analysisHistory;
        if (!historyList) return;

        historyList.innerHTML = '';

        if (this.analysisHistory.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No forecasts yet</p>
                </div>
            `;
            return;
        }

        this.analysisHistory.forEach((entry, index) => {
            const date = new Date(entry.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-content" data-index="${index}">
                    <div class="history-title">${entry.preview}</div>
                    <div class="history-date">${formattedDate}</div>
                </div>
                <button class="history-delete-btn" data-index="${index}" title="Delete">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            item.querySelector('.history-item-content').addEventListener('click', () => {
                this.loadHistoryItem(index);
            });

            item.querySelector('.history-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteHistoryItem(index);
            });

            historyList.appendChild(item);
        });
    }

    /**
     * Load history item
     */
    loadHistoryItem(index) {
        const entry = this.analysisHistory[index];
        if (entry && entry.sessionId) {
            this.loadSession(entry.sessionId);
        }
    }

    /**
     * Load session data
     */
    async loadSession(sessionId) {
        this.showLoading(true);

        try {
            const response = await fetch(`/api/forecast/session/${sessionId}`);
            const result = await response.json();

            if (result.success) {
                this.currentSessionId = sessionId;
                this.forecastData = result.session.forecast;
                
                if (this.forecastChart && this.forecastData?.chartData) {
                    this.forecastChart.updateForecast(this.forecastData.chartData);
                }
                
                this.updateForecastStats(this.forecastData);
                this.showToast('info', 'Loaded historical forecast');
            }
        } catch (error) {
            console.error('Error loading session:', error);
            this.showToast('error', 'Failed to load forecast');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Delete history item
     */
    deleteHistoryItem(index) {
        this.analysisHistory.splice(index, 1);
        localStorage.setItem('forecastHistory', JSON.stringify(this.analysisHistory));
        this.renderHistory();
        this.showToast('success', 'Item deleted');
    }

    /**
     * Clear all history
     */
    clearAllHistory() {
        this.analysisHistory = [];
        localStorage.setItem('forecastHistory', JSON.stringify([]));
        this.renderHistory();
        this.showToast('success', 'All history cleared');
    }

    /**
     * Load products from API
     */
    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            const result = await response.json();
            
            if (result.success) {
                this.products = result.products;
                console.log('Products loaded:', this.products.length);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    /**
     * Load sample products
     */
    async loadSampleProducts() {
        try {
            const response = await fetch('/api/sample/products');
            const result = await response.json();
            
            if (result.success) {
                this.products = result.data;
                console.log('Sample products loaded:', this.products.length);
            }
        } catch (error) {
            console.error('Error loading sample products:', error);
        }
    }

    /**
     * Generate inventory recommendations using actual forecast data
     */
    async generateInventoryRecommendations() {
        if (!this.products || !this.forecastData) {
            console.log('⚠️ Cannot generate inventory: missing products or forecast');
            return;
        }

        this.showLoading(true);

        try {
            // Get sales data from current session if available
            let salesData = [];
            if (this.currentSessionId) {
                try {
                    const sessionResponse = await fetch(`/api/forecast/session/${this.currentSessionId}`);
                    const sessionResult = await sessionResponse.json();
                    if (sessionResult.success) {
                        salesData = sessionResult.session.salesData || [];
                        console.log('Sales data loaded:', salesData.length, 'records');
                    }
                } catch (e) {
                    console.warn('Could not fetch session sales data:', e);
                }
            }

            console.log('Sending inventory optimization request with:', {
                products: this.products.length,
                forecast: this.forecastData ? 'yes' : 'no',
                salesData: salesData.length
            });

            const response = await fetch('/api/inventory/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products: this.products,
                    forecast: this.forecastData,
                    salesData: salesData,
                    sessionId: this.currentSessionId
                })
            });

            const result = await response.json();

            if (result.success) {
                // Debug logging
                console.log('✅ Inventory optimization result:', result);
                console.log('📊 Health metrics:', result.healthMetrics);
                console.log('📦 Classified products:', result.classifiedProducts);
                console.log('⚠️ Stockout risks:', result.stockoutRisks);
                
                this.inventoryData = result;
                
                // Update inventory dashboard with real data
                if (this.inventoryDashboard) {
                    this.inventoryDashboard.renderOverview({
                        ...result,
                        products: this.products,
                        forecast: this.forecastData
                    });
                }

                // Show summary in chat
                const urgentCount = result.summary?.urgentOrders || 0;
                const criticalCount = result.summary?.criticalOrders || 0;
                const highRiskCount = result.summary?.highRiskItems || 0;

                let inventoryMessage = `**Inventory Optimization Complete**\n\n`;
                inventoryMessage += `📊 **Summary**\n`;
                inventoryMessage += `- Total Products: ${result.summary?.totalProducts || 0}\n`;
                inventoryMessage += `- Total Stock Value: $${this.formatNumber(result.summary?.totalValue || 0)}\n\n`;

                if (urgentCount > 0 || criticalCount > 0 || highRiskCount > 0) {
                    inventoryMessage += `⚠️ **Actions Needed**\n`;
                    if (criticalCount > 0) inventoryMessage += `- 🔴 Critical orders: ${criticalCount}\n`;
                    if (urgentCount > 0) inventoryMessage += `- 🟡 Urgent orders: ${urgentCount}\n`;
                    if (highRiskCount > 0) inventoryMessage += `- 📈 High risk items: ${highRiskCount}\n`;
                } else {
                    inventoryMessage += `✅ **All inventory levels are healthy!**\n`;
                }

                this.addMessage('bot', inventoryMessage);
                this.showToast('success', 'Inventory optimization complete');
            } else {
                console.error('Inventory optimization failed:', result.error);
                this.showToast('error', result.error || 'Failed to optimize inventory');
            }

        } catch (error) {
            console.error('❌ Inventory optimization error:', error);
            this.showToast('error', 'Failed to optimize inventory');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Load sample data
     */
    loadSampleData() {
        const sampleData = `Date,Product,Sales,Revenue
2024-01-01,Wireless Headphones,45,4495.50
2024-01-01,Smart Watch,32,6396.80
2024-01-02,Wireless Headphones,52,5194.80
2024-01-02,Smart Watch,41,8195.90
2024-01-03,Wireless Headphones,38,3796.20
2024-01-03,Smart Watch,29,5797.10
2024-01-04,Wireless Headphones,63,6293.70
2024-01-04,Smart Watch,47,9395.30`;

        if (this.elements.dataInput) {
            this.elements.dataInput.value = sampleData;
        }
        
        this.showToast('success', 'Sample sales data loaded');
    }

    /**
     * Reset analysis
     */
    resetAnalysis() {
        this.currentSessionId = null;
        this.forecastData = null;
        this.inventoryData = null;
        
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }
        
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'flex';
        }
        
        if (this.forecastChart) {
            this.forecastChart.showNoData();
        }
        
        if (this.elements.forecastStats) {
            this.elements.forecastStats.innerHTML = '';
        }
        
        this.clearFile();
        
        this.showToast('info', 'New analysis started');
    }

    /**
     * Switch between tabs
     */
    switchTab(tab) {
        const tabs = ['forecast', 'inventory', 'scenario'];
        
        tabs.forEach(t => {
            const element = document.getElementById(`${t}Panel`);
            const tabElement = this.elements[`${t}Tab`];
            
            if (element) {
                element.style.display = t === tab ? 'block' : 'none';
            }
            
            if (tabElement) {
                tabElement.classList.toggle('active', t === tab);
            }
        });

        // Refresh inventory data when switching to inventory tab
        if (tab === 'inventory' && this.inventoryData && this.inventoryDashboard) {
            this.inventoryDashboard.renderOverview({
                ...this.inventoryData,
                products: this.products,
                forecast: this.forecastData
            });
        }
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = this.elements.sidebar;
        const overlay = this.elements.sidebarOverlay;
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.applyTheme();
    }

    /**
     * Apply theme
     */
    applyTheme() {
        document.documentElement.setAttribute(
            'data-theme',
            this.isDarkMode ? 'dark' : 'light'
        );
        
        if (this.elements.themeToggle) {
            this.elements.themeToggle.innerHTML = this.isDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
        }
    }

    /**
     * Update online status
     */
    updateOnlineStatus(isOnline) {
        const dot = this.elements.statusIndicator?.querySelector('.status-dot');
        if (dot) {
            dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        }
        this.showToast(isOnline ? 'success' : 'error', 
            isOnline ? 'Back online' : 'You are offline');
    }

    /**
     * Install PWA
     */
    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.showToast('success', 'Thanks for installing!');
        }
        
        this.deferredPrompt = null;
        if (this.elements.installBtn) {
            this.elements.installBtn.style.display = 'none';
        }
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Show toast notification
     */
    showToast(type, message) {
        const container = this.elements.toastContainer;
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        }[type] || 'info-circle';
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Check authentication
     */
    checkAuthentication() {
        const currentUser = localStorage.getItem('currentUser');
        const currentPath = window.location.pathname;
        
        if (currentPath === '/login' && currentUser) {
            window.location.href = '/';
            return false;
        }
        
        if (currentPath === '/' && !currentUser && window.location.hostname !== 'localhost') {
            window.location.href = '/login';
            return false;
        }
        
        return true;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname !== '/login') {
        window.app = new DemandSenseApp();
    }
});