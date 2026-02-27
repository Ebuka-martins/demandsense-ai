// assets/src/api.js - API client for DemandSense AI

class DemandSenseAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.sessionId = null;
    }

    /**
     * Upload file for forecast generation
     */
    async uploadFile(file, periods = 30) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('periods', periods);
        
        if (this.sessionId) {
            formData.append('sessionId', this.sessionId);
        }

        try {
            const response = await fetch(`${this.baseURL}/api/forecast/generate`, {
                method: 'POST',
                body: formData
            });

            const result = await this.handleResponse(response);
            
            if (result.sessionId) {
                this.sessionId = result.sessionId;
            }
            
            return result;

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    /**
     * Analyze pasted text data
     */
    async analyzeText(text, periods = 30) {
        try {
            const response = await fetch(`${this.baseURL}/api/forecast/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    periods,
                    sessionId: this.sessionId
                })
            });

            const result = await this.handleResponse(response);
            
            if (result.sessionId) {
                this.sessionId = result.sessionId;
            }
            
            return result;

        } catch (error) {
            console.error('Text analysis error:', error);
            throw error;
        }
    }

    /**
     * Get forecast session data
     */
    async getSession(sessionId) {
        try {
            const response = await fetch(`${this.baseURL}/api/forecast/session/${sessionId || this.sessionId}`);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Get session error:', error);
            throw error;
        }
    }

    /**
     * Optimize inventory
     */
    async optimizeInventory(products, forecast, salesData = []) {
        try {
            const response = await fetch(`${this.baseURL}/api/inventory/optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products,
                    forecast,
                    salesData,
                    sessionId: this.sessionId
                })
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Inventory optimization error:', error);
            throw error;
        }
    }

    /**
     * Calculate reorder recommendations
     */
    async calculateReorder(products, forecast) {
        try {
            const response = await fetch(`${this.baseURL}/api/inventory/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products,
                    forecast
                })
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Reorder calculation error:', error);
            throw error;
        }
    }

    /**
     * Analyze what-if scenario
     */
    async analyzeScenario(baseForecast, scenario, products = []) {
        try {
            const response = await fetch(`${this.baseURL}/api/scenarios/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseForecast,
                    scenario,
                    products,
                    sessionId: this.sessionId
                })
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Scenario analysis error:', error);
            throw error;
        }
    }

    /**
     * Get all products
     */
    async getProducts() {
        try {
            const response = await fetch(`${this.baseURL}/api/products`);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Get products error:', error);
            throw error;
        }
    }

    /**
     * Create new product
     */
    async createProduct(product) {
        try {
            const response = await fetch(`${this.baseURL}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Create product error:', error);
            throw error;
        }
    }

    /**
     * Update product
     */
    async updateProduct(id, product) {
        try {
            const response = await fetch(`${this.baseURL}/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Update product error:', error);
            throw error;
        }
    }

    /**
     * Delete product
     */
    async deleteProduct(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/products/${id}`, {
                method: 'DELETE'
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Delete product error:', error);
            throw error;
        }
    }

    /**
     * Generate report
     */
    async generateReport(forecast, inventory, products, scenarios = []) {
        try {
            const response = await fetch(`${this.baseURL}/api/reports/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    forecast,
                    inventory,
                    products,
                    scenarios
                })
            });

            return await this.handleResponse(response);

        } catch (error) {
            console.error('Report generation error:', error);
            throw error;
        }
    }

    /**
     * Export data
     */
    async exportData(type, format = 'csv') {
        try {
            const response = await fetch(`${this.baseURL}/api/reports/export?type=${type}&format=${format}`);
            
            if (format === 'csv' || format === 'json') {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
                a.click();
                window.URL.revokeObjectURL(url);
                return { success: true };
            }
            
            return await response.json();

        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    /**
     * Login
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseURL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();
            
            if (result.success && result.token) {
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
            }
            
            return result;

        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Register
     */
    async register(email, password, name) {
        try {
            const response = await fetch(`${this.baseURL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const result = await response.json();
            
            if (result.success && result.token) {
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
            }
            
            return result;

        } catch (error) {
            console.error('Register error:', error);
            throw error;
        }
    }

    /**
     * Logout
     */
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.sessionId = null;
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: `HTTP error! status: ${response.status}` };
            }
            throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    }

    /**
     * Clear session
     */
    clearSession() {
        this.sessionId = null;
    }
}

// Make globally available
window.DemandSenseAPI = DemandSenseAPI;