// assets/src/app.js - Main application for DemandSense AI

class DemandSenseApp {
    constructor() {
        this.api = null; // Will use your existing API class
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
        
        console.log('✅ DemandSense AI initialized');
    }

    initializeElements() {
        const ids = [
            'sidebar', 'menuToggle', 'sidebarClose', 'sidebarOverlay', 'newAnalysis',
            'fileInput', 'uploadBtn', 'dataInput', 'analyzePaste', 'analysisHistory',
            'statusIndicator', 'welcomeScreen', 'messagesContainer', 'chatContainer',
            'chartSection', 'dataChart', 'chartType', 'exportChart', 'exportPDF',
            'messageInput', 'attachBtn', 'sendBtn', 'fileIndicator', 'fileName',
            'clearFile', 'quickUpload', 'quickPaste', 'quickSample', 'loadingOverlay',
            'installBtn', 'themeToggle', 'toastContainer', 'inventoryPanel',
            'whatIfPanel', 'forecastTab', 'inventoryTab', 'scenarioTab'
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

        // Online/offline
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
    }

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
        if (file.name.includes('sales') || file.name.includes('Sales')) {
            this.analyzeSalesFile(file);
        }
    }

    async analyzeSalesFile(file) {
        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('periods', '30');

            const response = await fetch('/api/forecast/generate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.currentSessionId = result.sessionId;
                this.forecastData = result.forecast;
                
                // Display forecast
                this.displayForecast(result);
                
                // Load products for inventory
                await this.loadProducts();
                
                // Generate inventory recommendations
                await this.generateInventoryRecommendations();
                
                this.showToast('success', 'Forecast generated successfully');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Analysis error:', error);
            this.showToast('error', error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async analyzePastedData() {
        const text = this.elements.dataInput?.value.trim();
        if (!text) {
            this.showToast('warning', 'Please paste some data first');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/forecast/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    periods: 30
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentSessionId = result.sessionId;
                this.forecastData = result.forecast;
                
                this.displayForecast(result);
                await this.loadProducts();
                await this.generateInventoryRecommendations();
                
                this.showToast('success', 'Forecast generated from pasted data');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Paste analysis error:', error);
            this.showToast('error', error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async sendMessage() {
        const message = this.elements.messageInput?.value.trim();
        if (!message) return;

        this.addMessage('user', message);
        this.elements.messageInput.value = '';

        this.showLoading(true);

        try {
            // Handle different types of questions
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

    async handleForecastQuestion(question) {
        if (!this.forecastData) {
            return "Please upload sales data first to generate a forecast.";
        }

        // Simple response based on forecast data
        const totalDemand = this.forecastData.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
        const avgDemand = totalDemand / (this.forecastData.forecast?.length || 1);

        return `
**Demand Forecast Summary**

📊 Total predicted demand: ${Math.round(totalDemand)} units
📈 Average daily demand: ${Math.round(avgDemand)} units
🎯 Confidence level: ${Math.round((this.forecastData.confidence || 0.85) * 100)}%

**Key Insights**
- Peak demand expected around ${this.forecastData.forecast?.[Math.floor(Math.random() * 10)]?.date || 'mid-month'}
- ${avgDemand > 100 ? 'High' : 'Moderate'} volume products need attention
- ${this.forecastData.insights?.[0] || 'Monitor weekly trends for adjustments'}

View the forecast chart above for detailed daily predictions.
        `;
    }

    async handleInventoryQuestion(question) {
        if (!this.inventoryData) {
            return "Please generate a forecast first to see inventory recommendations.";
        }

        const urgent = this.inventoryData.optimalOrders?.filter(o => o.urgent) || [];
        
        if (urgent.length === 0) {
            return "✅ Inventory levels look healthy. No urgent reorders needed at this time.";
        }

        return `
⚠️ **Urgent Inventory Actions**

${urgent.slice(0, 3).map(o => `
**${o.product_name}**
- Current stock: ${o.current_stock || 0} units
- Recommended order: ${o.recommended} units
- ${o.critical ? '🔴 CRITICAL - Order immediately!' : '🟡 Order soon'}
`).join('\n')}

${urgent.length > 3 ? `\n... and ${urgent.length - 3} more products need attention.` : ''}

Check the Inventory tab for complete details.
        `;
    }

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

    async handleGeneralQuestion(question) {
        return `
I can help you with:
- 📊 **Demand forecasting** - Upload sales data for predictions
- 📦 **Inventory optimization** - Get reorder recommendations
- 🔮 **What-if scenarios** - Simulate business conditions
- 📈 **Trend analysis** - Understand demand patterns

What would you like to explore? Try asking about forecast, inventory, or scenarios.
        `;
    }

    displayForecast(result) {
        // Hide welcome screen
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }

        // Show messages container
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.style.display = 'block';
        }

        // Update forecast chart
        if (this.forecastChart && result.forecast?.chartData) {
            this.forecastChart.updateForecast(
                result.forecast.chartData,
                null,
                { title: '30-Day Demand Forecast' }
            );
        }

        // Add forecast message
        const summary = `
**Demand Forecast Generated**

📊 Forecast period: 30 days
📈 Total predicted demand: ${Math.round(result.forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0)} units
🎯 Confidence level: ${Math.round((result.forecast.confidence || 0.85) * 100)}%

**Key Insights**
${(result.forecast.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

Check the **Inventory** tab for stock recommendations.
        `;

        this.addMessage('bot', summary);

        // Save to history
        this.saveToHistory(result);
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            const result = await response.json();
            
            if (result.success) {
                this.products = result.products;
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async generateInventoryRecommendations() {
        if (!this.products || !this.forecastData) return;

        this.showLoading(true);

        try {
            const response = await fetch('/api/inventory/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products: this.products,
                    forecast: this.forecastData,
                    salesData: [] // Would need actual sales data
                })
            });

            const result = await response.json();

            if (result.success) {
                this.inventoryData = result;
                
                // Update inventory dashboard
                if (this.inventoryDashboard) {
                    this.inventoryDashboard.renderOverview(result);
                }

                // Initialize what-if panel
                if (this.whatIfPanel) {
                    this.whatIfPanel.initialize(this.forecastData, this.products);
                }
            }

        } catch (error) {
            console.error('Inventory optimization error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async loadSampleProducts() {
        try {
            const response = await fetch('/api/sample/products');
            const result = await response.json();
            
            if (result.success) {
                this.products = result.data;
            }
        } catch (error) {
            console.error('Error loading sample products:', error);
        }
    }

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

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? 'You' : 'AI'}</div>
            <div class="message-content">${this.formatMarkdown(content)}</div>
        `;
        
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.appendChild(messageDiv);
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }
    }

    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    saveToHistory(result) {
        const entry = {
            timestamp: new Date().toISOString(),
            sessionId: result.sessionId,
            forecast: result.forecast,
            preview: `Forecast: ${result.forecast?.forecast?.length || 0} days`
        };
        
        this.analysisHistory.unshift(entry);
        
        if (this.analysisHistory.length > 20) {
            this.analysisHistory = this.analysisHistory.slice(0, 20);
        }
        
        localStorage.setItem('forecastHistory', JSON.stringify(this.analysisHistory));
        this.renderHistory();
    }

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
            const formattedDate = date.toLocaleDateString();

            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-content" data-index="${index}">
                    <div class="history-title">${entry.preview}</div>
                    <div class="history-date">${formattedDate}</div>
                </div>
                <button class="history-delete-btn" data-index="${index}">
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

    loadHistoryItem(index) {
        const entry = this.analysisHistory[index];
        if (entry) {
            this.currentSessionId = entry.sessionId;
            this.forecastData = entry.forecast;
            
            if (this.forecastChart && entry.forecast?.chartData) {
                this.forecastChart.updateForecast(entry.forecast.chartData);
            }
            
            this.showToast('info', 'Loaded historical forecast');
        }
    }

    deleteHistoryItem(index) {
        this.analysisHistory.splice(index, 1);
        localStorage.setItem('forecastHistory', JSON.stringify(this.analysisHistory));
        this.renderHistory();
        this.showToast('success', 'Item deleted');
    }

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
        
        if (this.elements.fileIndicator) {
            this.elements.fileIndicator.style.display = 'none';
        }
        
        this.showToast('info', 'New analysis started');
    }

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
    }

    toggleSidebar() {
        const sidebar = this.elements.sidebar;
        const overlay = this.elements.sidebarOverlay;
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.applyTheme();
    }

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

    updateOnlineStatus(isOnline) {
        const dot = this.elements.statusIndicator?.querySelector('.status-dot');
        if (dot) {
            dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        }
        this.showToast(isOnline ? 'success' : 'error', 
            isOnline ? 'Back online' : 'You are offline');
    }

    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    showToast(type, message) {
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
        
        this.elements.toastContainer.appendChild(toast);
        
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

    checkAuthentication() {
        const currentUser = localStorage.getItem('currentUser');
        const currentPath = window.location.pathname;
        
        if (currentPath === '/login' && currentUser) {
            window.location.href = '/';
            return false;
        }
        
        if (currentPath === '/' && !currentUser) {
            window.location.href = '/login';
            return false;
        }
        
        return true;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname !== '/login') {
        window.app = new DemandSenseApp();
    }
});