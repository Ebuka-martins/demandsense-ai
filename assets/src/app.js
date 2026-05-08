// assets/src/app.js - DemandSense AI Main Application
// Version: 1.0.1

// ============================================
// CACHE MANAGEMENT
// ============================================
(function() {
    const APP_VERSION = '1.0.1';
    const STORAGE_KEY = 'app_version';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    if (lastVersion !== APP_VERSION) {
        console.log(`🔄 Updating from v${lastVersion} to v${APP_VERSION}`);
        
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
        
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
    }
})();

// ============================================
// MAIN APPLICATION CLASS
// ============================================
class DemandSenseApp {
    // ----------------------------
    // Constructor & Initialization
    // ----------------------------
    constructor() {
        // Core data
        this.api = new DemandSenseAPI();
        this.currentSessionId = null;
        this.currentFile = null;
        this.forecastData = null;
        this.inventoryData = null;
        this.products = [];
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.analysisHistory = JSON.parse(localStorage.getItem('forecastHistory')) || [];
        
        // UI Managers
        this.forecastChart = null;
        this.inventoryDashboard = null;
        this.whatIfPanel = null;
        this.dataValidator = new DataValidator();
        this.pdfExporter = new PDFExporter();
        
        // DOM Elements
        this.elements = {};
        
        // Initialize
        this.initializeElements();
        
        if (!this.checkAuthentication()) return;
        
        this.applyTheme();
        this.initializeManagers();
        this.initializeEventListeners();
        this.loadSampleProducts();
        this.renderHistory();
        
        console.log('✅ DemandSense AI v1.0.1 initialized');
    }

    // ----------------------------
    // DOM Element Management
    // ----------------------------
    initializeElements() {
        const elementIds = [
            // Layout
            'sidebar', 'menuToggle', 'sidebarClose', 'sidebarOverlay',
            // Main controls
            'newAnalysis', 'fileInput', 'uploadBtn', 'dataInput', 'analyzePaste',
            // Chat & messages
            'analysisHistory', 'clearAllHistory', 'statusIndicator', 'welcomeScreen',
            'messagesContainer', 'chatContainer', 'dataChart', 'messageInput', 'sendBtn',
            // File management
            'fileIndicator', 'fileName', 'clearFile',
            // Quick actions
            'quickUpload', 'quickPaste', 'quickSample',
            // UI overlays
            'loadingOverlay', 'installBtn', 'themeToggle', 'toastContainer',
            // Panels
            'inventoryPanel', 'whatIfPanel',
            // Tabs
            'forecastTab', 'inventoryTab', 'scenarioTab',
            // Forecast controls
            'forecastPeriod', 'exportForecast', 'forecastStats',
            // Welcome hint
            'welcomeHint', 'closeWelcomeHint'
        ];

        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    // ----------------------------
    // Manager Initialization
    // ----------------------------
    initializeManagers() {
        // Forecast chart
        if (this.elements.dataChart) {
            this.forecastChart = new ForecastChartManager(this.elements.dataChart);
            this.forecastChart.initialize();
        }

        // Inventory dashboard
        if (this.elements.inventoryPanel) {
            this.inventoryDashboard = new InventoryDashboard('inventoryPanel');
        }

        // What-if panel
        this.whatIfPanel = new WhatIfPanel('whatIfContainer');
    }

    // ----------------------------
    // Event Listeners
    // ----------------------------
    initializeEventListeners() {
        this.initializeMenuListeners();
        this.initializeFileListeners();
        this.initializeChatListeners();
        this.initializeQuickActionListeners();
        this.initializeTabListeners();
        this.initializeForecastListeners();
        this.initializeSystemListeners();
    }

    initializeMenuListeners() {
        // Sidebar toggle
        const toggleElements = ['menuToggle', 'sidebarClose', 'sidebarOverlay'];
        toggleElements.forEach(id => {
            if (this.elements[id]) {
                this.elements[id].addEventListener('click', () => this.toggleSidebar());
            }
        });

        // New analysis
        if (this.elements.newAnalysis) {
            this.elements.newAnalysis.addEventListener('click', () => this.resetAnalysis());
        }

        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    initializeFileListeners() {
        // Upload button
        if (this.elements.uploadBtn && this.elements.fileInput) {
            this.elements.uploadBtn.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Clear file
        if (this.elements.clearFile) {
            this.elements.clearFile.addEventListener('click', () => this.clearFile());
        }

        // Analyze pasted data
        if (this.elements.analyzePaste) {
            this.elements.analyzePaste.addEventListener('click', () => this.analyzePastedData());
        }
    }

    initializeChatListeners() {
        // Send message button
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Enter key in message input
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
    }

    initializeQuickActionListeners() {
        // Quick upload
        if (this.elements.quickUpload && this.elements.fileInput) {
            this.elements.quickUpload.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }

        // Quick paste
        if (this.elements.quickPaste && this.elements.dataInput) {
            this.elements.quickPaste.addEventListener('click', () => {
                this.elements.dataInput.focus();
            });
        }

        // Quick sample
        if (this.elements.quickSample) {
            this.elements.quickSample.addEventListener('click', () => this.loadSampleData());
        }

        // Clear all history
        if (this.elements.clearAllHistory) {
            this.elements.clearAllHistory.addEventListener('click', () => {
                if (confirm('Clear all forecast history?')) {
                    this.clearAllHistory();
                }
            });
        }
    }

    initializeTabListeners() {
        const tabs = ['forecast', 'inventory', 'scenario'];
        tabs.forEach(tab => {
            const tabElement = this.elements[`${tab}Tab`];
            if (tabElement) {
                tabElement.addEventListener('click', () => this.switchTab(tab));
            }
        });
    }

    initializeForecastListeners() {
        // Forecast period change
        if (this.elements.forecastPeriod) {
            this.elements.forecastPeriod.addEventListener('change', () => this.handlePeriodChange());
        }

        // Export forecast
        if (this.elements.exportForecast) {
            this.elements.exportForecast.addEventListener('click', () => this.exportForecast());
        }
    }

    initializeSystemListeners() {
        // Online/offline status
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));

        // PWA installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (this.elements.installBtn) {
                this.elements.installBtn.style.display = 'flex';
                this.elements.installBtn.addEventListener('click', () => this.installPWA());
            }
        });

        // Welcome hint
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

        // Make welcome hint clickable to trigger file upload
        if (this.elements.welcomeHint) {
            this.elements.welcomeHint.addEventListener('click', (e) => {
                if (!e.target.closest('#closeWelcomeHint') && this.elements.fileInput) {
                    this.elements.fileInput.click();
                }
            });
        }
    }

    // ----------------------------
    // File & Data Management
    // ----------------------------
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
        await this.analyzeSalesFile(file);
    }

    clearFile() {
        this.currentFile = null;
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.fileIndicator) this.elements.fileIndicator.style.display = 'none';
        if (this.elements.fileName) this.elements.fileName.textContent = 'No file selected';
    }

    async analyzeSalesFile(file) {
        this.showLoading(true);
        
        const periodValue = this.getPeriodValue();
        const periodDisplay = this.getPeriodDisplay(periodValue);
        
        console.log(`📊 Analyzing file "${file.name}" for ${periodDisplay} forecast...`);
        this.addMessage('bot', `📊 Analyzing your data for a ${periodDisplay} demand forecast...`);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('periods', periodValue);

            const response = await fetch('/api/forecast/generate', { method: 'POST', body: formData });
            const result = await response.json();

            if (result.success) {
                await this.processForecastResult(result);
                const successMsg = this.getForecastSuccessMessage(result);
                this.showToast('success', successMsg);
                this.addMessage('bot', `✅ ${successMsg}! Check the chart above for detailed predictions.`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showToast('error', error.message || 'Failed to generate forecast');
            this.addMessage('bot', `❌ Failed to analyze: ${error.message}`);
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
        const periodValue = this.getPeriodValue();

        try {
            console.log('📋 Analyzing pasted data...');
            console.log('First 100 chars:', text.substring(0, 100));
            
            this.addMessage('bot', `📋 Analyzing your pasted data for ${this.getPeriodDisplay(periodValue)} demand forecast...`);

            const response = await fetch('/api/forecast/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    periods: parseInt(periodValue),
                    sessionId: this.currentSessionId
                })
            });

            const result = await response.json();

            if (result.success) {
                await this.processForecastResult(result);
                const successMsg = this.getForecastSuccessMessage(result);
                this.showToast('success', `${successMsg} from pasted data`);
                this.addMessage('bot', `✅ ${successMsg} from your pasted data!`);
                
                // Clear the input after successful analysis
                if (this.elements.dataInput) {
                    this.elements.dataInput.value = '';
                }
            } else {
                throw new Error(result.error || 'Failed to analyze pasted data');
            }
        } catch (error) {
            console.error('Paste analysis error:', error);
            this.handlePasteError(error);
        } finally {
            this.showLoading(false);
        }
    }

    handlePasteError(error) {
        let errorMessage = error.message || 'Failed to analyze pasted data';
        let userHelpMessage = '';
        
        // Check for common issues and provide helpful messages
        if (errorMessage.toLowerCase().includes('date')) {
            userHelpMessage = `
❌ **Date Format Error**

Your data has date format issues. Please ensure:
- Dates are in YYYY-MM-DD format (e.g., 2024-01-15)
- The date column is clearly labeled "Date"
- No empty or invalid dates in your data

**Example format:**
\`\`\`
Date,Sales
2024-01-01,100
2024-01-02,150
2024-01-03,120
\`\`\`

Try using the sample data button to see the correct format.`;
        
            this.showToast('error', 'Invalid date format in pasted data');
            
        } else if (errorMessage.toLowerCase().includes('sales') || errorMessage.toLowerCase().includes('numeric')) {
            userHelpMessage = `
❌ **Sales Data Error**

Your sales column contains non-numeric values. Please ensure:
- The sales column contains only numbers
- The column is clearly labeled "Sales" or "sales"
- No empty or text values in the sales column

**Example format:**
\`\`\`
Date,Sales
2024-01-01,100
2024-01-02,150
2024-01-03,120
\`\`\`

All sales values should be numbers (integers or decimals).`;
        
            this.showToast('error', 'Invalid sales data format');
            
        } else if (errorMessage.toLowerCase().includes('header') || errorMessage.toLowerCase().includes('column')) {
            userHelpMessage = `
❌ **Column Header Error**

Your data needs proper column headers. Please ensure:
- First row contains "Date" and "Sales" as column names
- Headers are spelled correctly (case-sensitive: Date, Sales)
- No extra spaces or special characters in headers

**Example format:**
\`\`\`
Date,Sales
2024-01-01,100
2024-01-02,150
2024-01-03,120
\`\`\`

Copy this example and replace with your data.`;
        
            this.showToast('error', 'Missing or incorrect column headers');
            
        } else {
            userHelpMessage = `
❌ **Analysis Failed**

${errorMessage}

**Please check:**
1. Your data has a "Date" column (YYYY-MM-DD format)
2. Your data has a "Sales" column (numeric values)
3. Data is comma-separated (CSV format)
4. No empty rows or missing values

**Try this sample first:**
Click the "Sample Data" button to see the correct format.`;
        
            this.showToast('error', 'Failed to analyze pasted data');
        }
        
        this.addMessage('bot', userHelpMessage);
    }

    // ----------------------------
    // Forecast Processing
    // ----------------------------
    async processForecastResult(result) {
        this.currentSessionId = result.sessionId;
        this.forecastData = result.forecast;
        
        if (result.products && result.products.length > 0) {
            this.products = result.products;
            console.log('✅ Products loaded:', this.products.length);
        }
        
        this.displayForecast(result);
        await this.generateInventoryRecommendations();
        
        if (this.whatIfPanel && this.forecastData) {
            this.whatIfPanel.initialize(this.forecastData, this.products);
        }
    }

    displayForecast(result) {
        this.hideWelcomeScreen();
        
        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        const title = years >= 1 ? `${years.toFixed(1)}-Year Strategic Demand Forecast` : `${days}-Day Demand Forecast`;

        if (this.forecastChart && result.forecast?.chartData) {
            this.forecastChart.updateForecast(result.forecast.chartData, null, { title });
        }

        this.updateForecastStats(result.forecast);
        
        if (this.whatIfPanel && result.forecast) {
            this.whatIfPanel.initialize(result.forecast, this.products);
        }

        this.addForecastSummary(result);
        this.saveToHistory(result);
    }

    addForecastSummary(result) {
        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        const totalDemand = result.forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
        const avgDemand = totalDemand / days;
        
        let summary;
        
        if (years >= 1) {
            summary = `
**${years.toFixed(1)}-Year Strategic Forecast Generated**

📊 Forecast period: ${days} days (${years.toFixed(1)} years)
📈 Total projected demand: ${Math.round(totalDemand).toLocaleString()} units
📊 Average yearly demand: ${Math.round(totalDemand / years).toLocaleString()} units
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
📈 Total predicted demand: ${Math.round(totalDemand).toLocaleString()} units
📊 Average daily demand: ${Math.round(avgDemand).toLocaleString()} units
🎯 Confidence level: ${Math.round((result.forecast.confidence || 0.85) * 100)}%

**Key Insights**
${(result.forecast.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

Check the **Inventory** tab for stock recommendations based on this forecast.
            `;
        }

        this.addMessage('bot', summary);
    }

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
                    <div class="stat-value">${Math.round(totalDemand).toLocaleString()}</div>
                    <div class="stat-label">Total Demand</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(avgDemand).toLocaleString()}</div>
                    <div class="stat-label">Daily Avg</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${Math.round(peakDemand).toLocaleString()}</div>
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

    async regenerateForecast() {
        if (!this.currentSessionId) {
            this.showToast('warning', 'No forecast session found');
            return;
        }

        const periodValue = this.getPeriodValue();
        const periodDisplay = this.getPeriodDisplay(periodValue);
        
        this.showLoading(true);
        this.addMessage('bot', `🔄 Regenerating forecast for ${periodDisplay}...`);

        try {
            const sessionResponse = await fetch(`/api/forecast/session/${this.currentSessionId}`);
            const sessionResult = await sessionResponse.json();

            if (sessionResult.success && this.currentFile) {
                const formData = new FormData();
                formData.append('file', this.currentFile);
                formData.append('periods', periodValue);
                
                const response = await fetch('/api/forecast/generate', { method: 'POST', body: formData });
                const result = await response.json();
                
                if (result.success) {
                    this.forecastData = result.forecast;
                    if (result.products && result.products.length > 0) this.products = result.products;
                    
                    if (this.whatIfPanel && this.forecastData) {
                        this.whatIfPanel.initialize(this.forecastData, this.products);
                    }
                    
                    this.displayForecast(result);
                    await this.generateInventoryRecommendations();
                    
                    const successMsg = this.getForecastSuccessMessage(result);
                    this.showToast('success', `Regenerated ${successMsg.toLowerCase()}`);
                    this.addMessage('bot', `✅ Regenerated ${successMsg.toLowerCase()} successfully!`);
                } else {
                    throw new Error(result.error);
                }
            } else {
                this.showToast('warning', 'Original data not available for regeneration');
            }
        } catch (error) {
            console.error('Regenerate error:', error);
            this.showToast('error', 'Failed to regenerate forecast');
        } finally {
            this.showLoading(false);
        }
    }

    // ----------------------------
    // Helper Methods
    // ----------------------------
    getPeriodValue() {
        const periodSelect = this.elements.forecastPeriod;
        return periodSelect ? periodSelect.value : '30';
    }

    getPeriodDisplay(periodValue) {
        const periods = {
            '7': '7 days',
            '30': '30 days', 
            '90': '90 days',
            '365': '1 year',
            '1825': '5 years',
            '3650': '10 years'
        };
        return periods[periodValue] || `${periodValue} days`;
    }

    getForecastSuccessMessage(result) {
        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        return years >= 1 ? `${years.toFixed(1)}-year strategic forecast generated` : `${days}-day forecast generated`;
    }

    hideWelcomeScreen() {
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.style.display = 'block';
        }
    }

    handlePeriodChange() {
        if (this.forecastData) {
            this.regenerateForecast();
        }
    }

    // ----------------------------
    // Inventory Management
    // ----------------------------
    async generateInventoryRecommendations() {
        if (!this.products || !this.forecastData) {
            console.log('⚠️ Cannot generate inventory: missing products or forecast');
            return;
        }

        this.showLoading(true);

        try {
            let salesData = [];
            if (this.currentSessionId) {
                try {
                    const sessionResponse = await fetch(`/api/forecast/session/${this.currentSessionId}`);
                    const sessionResult = await sessionResponse.json();
                    if (sessionResult.success) {
                        salesData = sessionResult.session.salesData || [];
                    }
                } catch (e) {
                    console.warn('Could not fetch session sales data:', e);
                }
            }

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
                this.inventoryData = result;
                
                if (this.inventoryDashboard) {
                    this.inventoryDashboard.renderOverview({
                        ...result,
                        products: this.products,
                        forecast: this.forecastData
                    });
                }

                this.addInventorySummary(result);
                this.showToast('success', 'Inventory optimization complete');
            } else {
                throw new Error(result.error || 'Failed to optimize inventory');
            }
        } catch (error) {
            console.error('❌ Inventory optimization error:', error);
            this.showToast('error', 'Failed to optimize inventory');
        } finally {
            this.showLoading(false);
        }
    }

    addInventorySummary(result) {
        const urgentCount = result.summary?.urgentOrders || 0;
        const criticalCount = result.summary?.criticalOrders || 0;
        const highRiskCount = result.summary?.highRiskItems || 0;

        let message = `**Inventory Optimization Complete**\n\n`;
        message += `📊 **Summary**\n`;
        message += `- Total Products: ${result.summary?.totalProducts || 0}\n`;
        message += `- Total Stock Value: $${this.formatNumber(result.summary?.totalValue || 0)}\n\n`;

        if (urgentCount > 0 || criticalCount > 0 || highRiskCount > 0) {
            message += `⚠️ **Actions Needed**\n`;
            if (criticalCount > 0) message += `- 🔴 Critical orders: ${criticalCount}\n`;
            if (urgentCount > 0) message += `- 🟡 Urgent orders: ${urgentCount}\n`;
            if (highRiskCount > 0) message += `- 📈 High risk items: ${highRiskCount}\n`;
        } else {
            message += `✅ **All inventory levels are healthy!**\n`;
        }

        this.addMessage('bot', message);
    }

    // ----------------------------
    // Export Functionality
    // ----------------------------
    async exportForecast() {
        if (!this.forecastData) {
            this.showToast('warning', 'No forecast data to export');
            this.addMessage('bot', '⚠️ No forecast data available. Please upload data first.');
            return;
        }

        this.showLoading(true);
        this.addMessage('bot', '📄 Generating your complete PDF report...');

        try {
            const messages = this.collectChatMessages();
            
            await this.pdfExporter.exportForecast(
                this.forecastData, 
                this.products, 
                this.inventoryData,
                messages
            );
            
            this.showToast('success', 'Complete forecast report exported as PDF');
            this.addMessage('bot', '✅ PDF report exported successfully! Check your downloads folder.');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('error', 'Failed to export PDF');
            this.addMessage('bot', `❌ Failed to export PDF: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    collectChatMessages() {
        const messages = [];
        const messageElements = this.elements.messagesContainer?.querySelectorAll('.message');
        
        if (messageElements) {
            messageElements.forEach(msg => {
                const role = msg.classList.contains('user-message') ? 'user' : 'assistant';
                const content = msg.querySelector('.message-content')?.innerText || '';
                if (content) messages.push({ role, content });
            });
        }
        
        return messages;
    }

    // ----------------------------
    // Chat Functionality
    // ----------------------------
    async sendMessage() {
        const message = this.elements.messageInput?.value.trim();
        if (!message) return;

        this.addMessage('user', message);
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        this.showLoading(true);

        try {
            let response;
            const lowerMessage = message.toLowerCase();
            
            if (lowerMessage.includes('forecast') || lowerMessage.includes('demand')) {
                response = await this.handleForecastQuestion(message);
            } else if (lowerMessage.includes('inventory') || lowerMessage.includes('stock')) {
                response = await this.handleInventoryQuestion(message);
            } else if (lowerMessage.includes('scenario') || lowerMessage.includes('what if')) {
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

    handleForecastQuestion(question) {
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

📊 Total projected demand: ${Math.round(totalDemand).toLocaleString()} units
📈 Average yearly demand: ${Math.round(totalDemand / years).toLocaleString()} units
🎯 Confidence level: ${Math.round((this.forecastData.confidence || 0.85) * 100)}%

**Strategic Insights**
${(this.forecastData.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

View the forecast chart above for detailed long-term projections.
            `;
        } else {
            return `
**Demand Forecast Summary (${days} Days)**

📊 Total predicted demand: ${Math.round(totalDemand).toLocaleString()} units
📈 Average daily demand: ${Math.round(avgDemand).toLocaleString()} units
🎯 Confidence level: ${Math.round((this.forecastData.confidence || 0.85) * 100)}%

**Key Insights**
${(this.forecastData.insights || []).slice(0, 3).map(i => `- ${i}`).join('\n')}

View the forecast chart above for detailed daily predictions.
            `;
        }
    }

    handleInventoryQuestion(question) {
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

    handleScenarioQuestion(question) {
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

    handleGeneralQuestion(question) {
        return `
I can help you with:
- 📊 **Demand forecasting** - Upload sales data for predictions (7 days to 10 years)
- 📦 **Inventory optimization** - Get reorder recommendations based on your forecast
- 🔮 **What-if scenarios** - Simulate business conditions
- 📈 **Trend analysis** - Understand demand patterns

What would you like to explore? Try asking about forecast, inventory, or scenarios.
        `;
    }

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

    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    // ----------------------------
    // History Management
    // ----------------------------
    saveToHistory(result) {
        const days = result.metadata?.forecastPeriods || 30;
        const years = days / 365;
        const preview = years >= 1 ? `${years.toFixed(1)}-Year Strategic Forecast` : `${days}-Day Forecast`;

        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            sessionId: result.sessionId,
            forecast: {
                total: result.forecast.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0,
                periods: result.forecast.forecast?.length || 0            },
            preview: preview
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

    async loadHistoryItem(index) {
        const entry = this.analysisHistory[index];
        if (entry && entry.sessionId) {
            await this.loadSession(entry.sessionId);
        }
    }

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
                
                if (this.whatIfPanel && this.forecastData) {
                    this.whatIfPanel.initialize(this.forecastData, this.products);
                }
                
                this.showToast('info', 'Loaded historical forecast');
            }
        } catch (error) {
            console.error('Error loading session:', error);
            this.showToast('error', 'Failed to load forecast');
        } finally {
            this.showLoading(false);
        }
    }

    deleteHistoryItem(index) {
        this.analysisHistory.splice(index, 1);
        localStorage.setItem('forecastHistory', JSON.stringify(this.analysisHistory));
        this.renderHistory();
        this.showToast('success', 'Item deleted');
    }

    clearAllHistory() {
        this.analysisHistory = [];
        localStorage.setItem('forecastHistory', JSON.stringify([]));
        this.renderHistory();
        this.showToast('success', 'All history cleared');
    }

    // ----------------------------
    // Product & Sample Data
    // ----------------------------
    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            const result = await response.json();
            if (result.success) this.products = result.products;
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async loadSampleProducts() {
        try {
            const response = await fetch('/api/sample/products');
            const result = await response.json();
            if (result.success) this.products = result.data;
        } catch (error) {
            console.error('Error loading sample products:', error);
        }
    }

    loadSampleData() {
        const sampleData = `Date,Sales
2024-01-01,45
2024-01-02,52
2024-01-03,38
2024-01-04,63
2024-01-05,71
2024-01-06,49
2024-01-07,55
2024-01-08,68
2024-01-09,73
2024-01-10,82
2024-01-11,59
2024-01-12,64
2024-01-13,77
2024-01-14,85
2024-01-15,91
2024-01-16,68
2024-01-17,74
2024-01-18,88
2024-01-19,95
2024-01-20,102
2024-01-21,78
2024-01-22,84
2024-01-23,97
2024-01-24,105
2024-01-25,112
2024-01-26,88
2024-01-27,94
2024-01-28,108
2024-01-29,115
2024-01-30,122`;

        if (this.elements.dataInput) {
            this.elements.dataInput.value = sampleData;
            this.showToast('success', '✅ Sample sales data loaded! Click "Analyze" to generate forecast.');
            this.addMessage('bot', `📊 **Sample data loaded!**

I've loaded 30 days of sample sales data with the correct format:
- **Date column**: Dates in YYYY-MM-DD format
- **Sales column**: Numeric values

Click the **"Analyze"** button below to generate a forecast with this sample data.

After seeing how it works, you can paste your own data following the same format.`);
        } else {
            this.showToast('error', 'Could not load sample data');
        }
    }

    // ----------------------------
    // UI Management
    // ----------------------------
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
        this.addMessage('bot', '🔄 Started a new analysis session. Upload a file or paste data to begin.');
    }

    switchTab(tab) {
        const tabs = ['forecast', 'inventory', 'scenario'];
        
        tabs.forEach(t => {
            const element = document.getElementById(`${t}Panel`);
            const tabElement = this.elements[`${t}Tab`];
            
            if (element) element.style.display = t === tab ? 'block' : 'none';
            if (tabElement) tabElement.classList.toggle('active', t === tab);
        });

        if (tab === 'inventory' && this.inventoryData && this.inventoryDashboard) {
            this.inventoryDashboard.renderOverview({
                ...this.inventoryData,
                products: this.products,
                forecast: this.forecastData
            });
        }
        
        if (tab === 'scenario' && this.whatIfPanel && this.forecastData) {
            this.whatIfPanel.initialize(this.forecastData, this.products);
        }
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
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        
        if (this.elements.themeToggle) {
            this.elements.themeToggle.innerHTML = this.isDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
        }
    }

    updateOnlineStatus(isOnline) {
        const dot = this.elements.statusIndicator?.querySelector('.status-dot');
        if (dot) dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        this.showToast(isOnline ? 'success' : 'error', isOnline ? 'Back online' : 'You are offline');
    }

    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') this.showToast('success', 'Thanks for installing!');
        
        this.deferredPrompt = null;
        if (this.elements.installBtn) this.elements.installBtn.style.display = 'none';
    }

    // ----------------------------
    // Utility Methods
    // ----------------------------
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    showLoading(show) {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    showToast(type, message) {
        const container = this.elements.toastContainer;
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon"><i class="fas fa-${icons[type] || 'info-circle'}"></i></div>
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

    // Placeholder for logout (handled by logout-modal.js)
    logout() {
        console.log('Logout handled by modal - no default browser dialog will appear');
    }
}

// ============================================
// APPLICATION INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname !== '/login') {
        window.app = new DemandSenseApp();
    }
});