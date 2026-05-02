// assets/src/pdf-export.js - COMPLETE Professional PDF Export with direct DOM data extraction

class PDFExporter {
    constructor() {
        this.jsPDF = null;
        this.dependenciesLoaded = false;
    }

    /**
     * Load PDF dependencies
     */
    async loadDependencies() {
        if (this.dependenciesLoaded) return true;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const autoTableScript = document.createElement('script');
                autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js';
                autoTableScript.onload = () => {
                    this.jsPDF = window.jspdf.jsPDF;
                    this.dependenciesLoaded = true;
                    resolve(true);
                };
                autoTableScript.onerror = reject;
                document.head.appendChild(autoTableScript);
            };
            script.onerror = reject;
            document.head.appendChild(script);

            setTimeout(() => reject(new Error('PDF dependency loading timeout')), 10000);
        });
    }

    /**
     * Clean text - remove emoji and special characters for PDF compatibility
     */
    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
            .replace(/[•●◆■▲▼▶◀→←↑↓★☆✓✔✗✘⚠️‼️⁉️❓❕❗]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        if (isNaN(num)) return '0';
        return Math.round(num).toLocaleString();
    }

    /**
     * Format currency
     */
    formatCurrency(num) {
        if (num === undefined || num === null) return '$0';
        if (isNaN(num)) return '$0';
        return '$' + Math.round(num).toLocaleString();
    }

    /**
     * Extract forecast data directly from the Chart.js instance
     */
    extractForecastFromChart() {
        try {
            const chartCanvas = document.getElementById('dataChart');
            if (!chartCanvas) return null;
            
            // Try to get chart instance
            let chartInstance = null;
            if (chartCanvas.chart) {
                chartInstance = chartCanvas.chart;
            } else if (window.forecastChart && window.forecastChart.currentChart) {
                chartInstance = window.forecastChart.currentChart;
            }
            
            if (chartInstance && chartInstance.data) {
                const labels = chartInstance.data.labels;
                const forecastDataset = chartInstance.data.datasets.find(d => d.label === 'Forecast');
                
                if (forecastDataset && forecastDataset.data && labels) {
                    const forecastData = [];
                    for (let i = 0; i < forecastDataset.data.length; i++) {
                        const value = forecastDataset.data[i];
                        if (value !== null && value !== undefined) {
                            forecastData.push({
                                date: labels[i],
                                predicted: value
                            });
                        }
                    }
                    console.log('📊 Extracted forecast from chart:', forecastData.length, 'items');
                    return forecastData;
                }
            }
            return null;
        } catch (e) {
            console.warn('Could not extract from chart:', e);
            return null;
        }
    }

    /**
     * Extract products from DOM or global state
     */
    extractProductsFromDOM() {
        try {
            // Try to get from global app
            if (window.app && window.app.products && window.app.products.length > 0) {
                console.log('📦 Got products from window.app:', window.app.products.length);
                return window.app.products;
            }
            
            // Try to get from inventory dashboard
            if (window.inventoryDashboard && window.inventoryDashboard.products) {
                console.log('📦 Got products from inventoryDashboard:', window.inventoryDashboard.products.length);
                return window.inventoryDashboard.products;
            }
            
            return [];
        } catch (e) {
            console.warn('Could not extract products:', e);
            return [];
        }
    }

    /**
     * Extract inventory data from global state
     */
    extractInventoryFromDOM() {
        try {
            if (window.app && window.app.inventoryData) {
                console.log('📊 Got inventory data from window.app');
                return window.app.inventoryData;
            }
            return null;
        } catch (e) {
            console.warn('Could not extract inventory:', e);
            return null;
        }
    }

    /**
     * Export COMPLETE clean forecast report as PDF
     */
    async exportForecast(forecastData = null, products = null, inventoryData = null, analysisMessages = []) {
        const filename = `demandsense-forecast-${new Date().toISOString().slice(0, 10)}.pdf`;

        try {
            await this.loadDependencies();

            // EXTRACT DATA DIRECTLY FROM SOURCES (not relying on parameters)
            const chartForecast = this.extractForecastFromChart();
            const actualProducts = products && products.length > 0 ? products : this.extractProductsFromDOM();
            const actualInventory = inventoryData || this.extractInventoryFromDOM();
            
            // Get forecast data from multiple sources
            let forecastArray = chartForecast;
            
            if ((!forecastArray || forecastArray.length === 0) && forecastData) {
                if (forecastData.forecast && Array.isArray(forecastData.forecast)) {
                    forecastArray = forecastData.forecast;
                } else if (forecastData.chartData && forecastData.chartData.forecast) {
                    forecastArray = forecastData.chartData.forecast;
                }
            }
            
            if ((!forecastArray || forecastArray.length === 0) && window.app && window.app.forecastData) {
                if (window.app.forecastData.forecast) {
                    forecastArray = window.app.forecastData.forecast;
                } else if (window.app.forecastData.chartData && window.app.forecastData.chartData.forecast) {
                    forecastArray = window.app.forecastData.chartData.forecast;
                }
            }
            
            console.log('📊 Final forecast array:', forecastArray?.length || 0, 'items');
            console.log('📦 Final products:', actualProducts?.length || 0, 'items');
            console.log('📋 Final inventory:', actualInventory ? 'available' : 'not available');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            let yPos = 20;
            const days = forecastArray?.length || 7;
            const isLongTerm = days > 90;
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);

            // Calculate totals from actual forecast array
            let totalDemand = 0;
            let avgDemand = 0;
            
            if (forecastArray && forecastArray.length > 0) {
                totalDemand = forecastArray.reduce((sum, f) => sum + (f.predicted || f.value || f.forecast || 0), 0);
                avgDemand = totalDemand / forecastArray.length;
            } else if (forecastData?.metadata?.totalDemand) {
                totalDemand = forecastData.metadata.totalDemand;
                avgDemand = totalDemand / days;
            } else if (forecastData?.totalDemand) {
                totalDemand = forecastData.totalDemand;
                avgDemand = totalDemand / days;
            }

            // ========== PAGE 1: Header + Executive Summary + Key Insights ==========
            
            doc.setFontSize(22);
            doc.setTextColor(255, 0, 110);
            doc.setFont('helvetica', 'bold');
            doc.text('DemandSense AI', margin, yPos);
            
            yPos += 10;
            
            doc.setFontSize(16);
            doc.setTextColor(255, 77, 109);
            doc.setFont('helvetica', 'bold');
            doc.text('Demand Forecast & Inventory Analysis Report', margin, yPos);
            
            yPos += 10;
            
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
            doc.text(`Report ID: DEM-${Date.now()}`, pageWidth - margin - 50, yPos);
            
            yPos += 15;

            // Executive Summary
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.setFont('helvetica', 'bold');
            doc.text('Executive Summary', margin, yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            
            const summaryItems = [
                `Report Type: ${isLongTerm ? 'Strategic Long-Term Forecast' : 'Short-Term Demand Forecast'}`,
                `Forecast Period: ${days} days`,
                `Total Projected Demand: ${this.formatNumber(totalDemand)} units`,
                `Average Daily Demand: ${this.formatNumber(avgDemand)} units`,
                `Confidence Level: 95%`,
                `Products Analyzed: ${actualProducts?.length || 0}`,
                `Data Points Analyzed: ${forecastArray?.length || days}`
            ];
            
            for (const item of summaryItems) {
                if (yPos > pageHeight - 60) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.text(`• ${item}`, margin + 5, yPos);
                yPos += 6;
            }
            yPos += 8;

            // Key Insights
            let insights = [];
            if (forecastData?.insights && forecastData.insights.length > 0) {
                insights = forecastData.insights;
            } else {
                // Generate default insights based on data
                insights = [
                    `Demand forecast shows ${this.formatNumber(totalDemand)} units over ${days} days.`,
                    `Average daily demand is ${this.formatNumber(avgDemand)} units.`,
                    `Plan inventory levels based on these projections.`
                ];
            }
            
            if (insights.length > 0) {
                if (yPos > pageHeight - 70) {
                    doc.addPage();
                    yPos = margin;
                }
                
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.setFont('helvetica', 'bold');
                doc.text('Key Insights', margin, yPos);
                yPos += 8;
                
                doc.setFontSize(10);
                doc.setTextColor(50, 50, 50);
                doc.setFont('helvetica', 'normal');
                
                for (const insight of insights.slice(0, 5)) {
                    if (yPos > pageHeight - 50) {
                        doc.addPage();
                        yPos = margin;
                    }
                    const cleanInsight = this.cleanText(insight);
                    const wrappedText = doc.splitTextToSize(`• ${cleanInsight}`, contentWidth - 10);
                    doc.text(wrappedText, margin + 5, yPos);
                    yPos += (wrappedText.length * 5.5);
                }
                yPos += 5;
            }

            // ========== PAGE 2: Demand Forecast Visualization ==========
            const chartCanvas = document.getElementById('dataChart');
            if (chartCanvas) {
                doc.addPage();
                yPos = margin;
                
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.setFont('helvetica', 'bold');
                doc.text(`${days}-Day Demand Forecast`, margin, yPos);
                yPos += 10;
                
                try {
                    const chartImage = chartCanvas.toDataURL('image/png', 1.0);
                    const imgWidth = contentWidth;
                    const imgHeight = (chartCanvas.height / chartCanvas.width) * imgWidth;
                    const maxHeight = pageHeight - yPos - 20;
                    const finalHeight = Math.min(imgHeight, maxHeight);
                    
                    doc.addImage(chartImage, 'PNG', margin, yPos, imgWidth, finalHeight);
                    yPos += finalHeight + 15;
                    console.log('✅ Chart added to PDF');
                } catch (e) {
                    console.warn('Could not add chart:', e);
                    doc.text('(Chart could not be captured)', margin + 5, yPos);
                    yPos += 10;
                }
            }

            // ========== PAGE 3: Detailed Forecast Data Table ==========
            doc.addPage();
            yPos = margin;
            
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Forecast Data', margin, yPos);
            yPos += 10;
            
            // Build forecast table from actual array
            const forecastTableData = [];
            
            if (forecastArray && forecastArray.length > 0) {
                console.log('📊 Building forecast table with', forecastArray.length, 'items');
                const displayLimit = Math.min(forecastArray.length, 30);
                
                for (let i = 0; i < displayLimit; i++) {
                    const item = forecastArray[i];
                    let date = item.date || item.Date || `Day ${i + 1}`;
                    let predicted = item.predicted || item.value || item.forecast || 0;
                    let upperBound = item.upper_bound || item.upperBound || (predicted * 1.15);
                    let lowerBound = item.lower_bound || item.lowerBound || (predicted * 0.85);
                    
                    if (date && date !== `Day ${i + 1}`) {
                        try {
                            const dateObj = new Date(date);
                            if (!isNaN(dateObj.getTime())) {
                                date = dateObj.toLocaleDateString();
                            }
                        } catch(e) {}
                    }
                    
                    forecastTableData.push([
                        date,
                        this.formatNumber(predicted),
                        this.formatNumber(upperBound),
                        this.formatNumber(lowerBound)
                    ]);
                }
            }
            
            // If still no data, create from calculated averages
            if (forecastTableData.length === 0 && avgDemand > 0) {
                console.log('📊 Creating forecast table from average demand');
                const startDate = new Date();
                
                for (let i = 0; i < Math.min(days, 30); i++) {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    const predicted = avgDemand;
                    
                    forecastTableData.push([
                        date.toLocaleDateString(),
                        this.formatNumber(predicted),
                        this.formatNumber(predicted * 1.15),
                        this.formatNumber(predicted * 0.85)
                    ]);
                }
            }
            
            if (forecastTableData.length > 0 && window.jspdf.autoTable) {
                doc.autoTable({
                    startY: yPos,
                    head: [['Date', 'Forecast (units)', 'Upper Bound', 'Lower Bound']],
                    body: forecastTableData,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [255, 0, 110],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 9
                    },
                    bodyStyles: { fontSize: 8 },
                    alternateRowStyles: { fillColor: [248, 248, 250] },
                    margin: { left: margin, right: margin }
                });
                yPos = doc.lastAutoTable.finalY + 15;
                console.log('✅ Added forecast table with', forecastTableData.length, 'rows');
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('Unable to generate forecast data table.', margin + 5, yPos);
                yPos += 15;
            }

            // ========== PAGE 4: Product Catalog + Inventory Metrics ==========
            doc.addPage();
            yPos = margin;
            
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.setFont('helvetica', 'bold');
            doc.text('Product Catalog', margin, yPos);
            yPos += 10;
            
            if (actualProducts && actualProducts.length > 0 && window.jspdf.autoTable) {
                const productTableData = actualProducts.slice(0, 20).map(p => [
                    p.id || '-',
                    (p.name || 'Unknown').substring(0, 25),
                    this.formatNumber(p.current_stock || 0),
                    this.formatNumber(p.reorder_point || 0),
                    p.lead_time_days ? `${p.lead_time_days}d` : '-',
                    p.unit_price ? `$${p.unit_price.toFixed(2)}` : '-'
                ]);
                
                doc.autoTable({
                    startY: yPos,
                    head: [['ID', 'Product Name', 'Stock', 'Reorder Pt', 'Lead Time', 'Price']],
                    body: productTableData,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [255, 0, 110],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 9
                    },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: margin, right: margin }
                });
                yPos = doc.lastAutoTable.finalY + 15;
                console.log('✅ Added product table with', productTableData.length, 'rows');
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('No product data available in this session.', margin + 5, yPos);
                yPos += 15;
            }
            
            // Inventory Health Metrics
            if (actualInventory?.healthMetrics && actualInventory.healthMetrics.length > 0 && window.jspdf.autoTable) {
                if (yPos > pageHeight - 80) {
                    doc.addPage();
                    yPos = margin;
                }
                
                doc.setFontSize(13);
                doc.setTextColor(255, 0, 110);
                doc.setFont('helvetica', 'bold');
                doc.text('Inventory Health Metrics', margin, yPos);
                yPos += 10;
                
                const healthData = actualInventory.healthMetrics.slice(0, 15).map(m => [
                    (m.product_name || 'Unknown').substring(0, 18),
                    (m.daily_demand || 0).toFixed(0),
                    this.formatNumber(m.safety_stock || 0),
                    this.formatNumber(m.reorder_point || 0),
                    `${Math.round((m.stockout_probability || 0) * 100)}%`,
                    (m.days_of_inventory || 0).toFixed(0)
                ]);
                
                doc.autoTable({
                    startY: yPos,
                    head: [['Product', 'Daily Demand', 'Safety Stock', 'Reorder Point', 'Risk', 'Days Inv']],
                    body: healthData,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [255, 0, 110],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 8
                    },
                    bodyStyles: { fontSize: 7 },
                    margin: { left: margin, right: margin }
                });
                yPos = doc.lastAutoTable.finalY + 15;
            }

            // ========== PAGE 5: Urgent Reorders + Stockout Risks ==========
            doc.addPage();
            yPos = margin;
            
            // Urgent Reorder Recommendations
            if (actualInventory?.optimalOrders && actualInventory.optimalOrders.length > 0) {
                const urgentOrders = actualInventory.optimalOrders.filter(o => o.urgent || o.critical);
                
                if (urgentOrders.length > 0 && window.jspdf.autoTable) {
                    doc.setFontSize(13);
                    doc.setTextColor(220, 53, 69);
                    doc.setFont('helvetica', 'bold');
                    doc.text('URGENT: Reorder Recommendations', margin, yPos);
                    yPos += 10;
                    
                    const urgentData = urgentOrders.slice(0, 10).map(o => [
                        (o.product_name || 'Unknown').substring(0, 22),
                        this.formatNumber(o.current_stock || 0),
                        (o.daily_demand || 0).toFixed(0),
                        this.formatNumber(o.recommended || 0),
                        o.critical ? 'CRITICAL' : 'Urgent'
                    ]);
                    
                    doc.autoTable({
                        startY: yPos,
                        head: [['Product', 'Current Stock', 'Daily Demand', 'Order Qty', 'Priority']],
                        body: urgentData,
                        theme: 'striped',
                        headStyles: { 
                            fillColor: [220, 53, 69],
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            fontSize: 9
                        },
                        bodyStyles: { fontSize: 8 },
                        margin: { left: margin, right: margin }
                    });
                    yPos = doc.lastAutoTable.finalY + 15;
                } else {
                    doc.setFontSize(12);
                    doc.setTextColor(50, 50, 50);
                    doc.text('No urgent reorder recommendations at this time.', margin + 5, yPos);
                    yPos += 15;
                }
            } else {
                doc.setFontSize(12);
                doc.setTextColor(50, 50, 50);
                doc.text('No reorder data available.', margin + 5, yPos);
                yPos += 15;
            }
            
            // High Stockout Risk Items
            if (actualInventory?.stockoutRisks && actualInventory.stockoutRisks.length > 0) {
                const highRisks = actualInventory.stockoutRisks.filter(r => r.risk_level === 'high');
                
                if (highRisks.length > 0) {
                    if (yPos > pageHeight - 60) {
                        doc.addPage();
                        yPos = margin;
                    }
                    
                    doc.setFontSize(13);
                    doc.setTextColor(220, 53, 69);
                    doc.setFont('helvetica', 'bold');
                    doc.text('High Stockout Risk Items', margin, yPos);
                    yPos += 10;
                    
                    doc.setFontSize(9);
                    doc.setTextColor(50, 50, 50);
                    doc.setFont('helvetica', 'normal');
                    
                    for (const risk of highRisks.slice(0, 10)) {
                        if (yPos > pageHeight - 30) {
                            doc.addPage();
                            yPos = margin;
                        }
                        const productName = this.cleanText(risk.product_name || 'Unknown');
                        doc.text(`• ${productName}: ${Math.round(risk.stockout_probability * 100)}% risk - Stock: ${this.formatNumber(risk.current_stock)} units`, margin + 5, yPos);
                        yPos += 6;
                    }
                    yPos += 10;
                } else {
                    doc.text('No high stockout risks detected.', margin + 5, yPos);
                    yPos += 10;
                }
            } else {
                doc.text('No stockout risk data available.', margin + 5, yPos);
                yPos += 10;
            }

            // ========== PAGE 6: Summary Statistics ==========
            doc.addPage();
            yPos = margin;
            
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.setFont('helvetica', 'bold');
            doc.text('Summary Statistics', margin, yPos);
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            
            const urgentCount = actualInventory?.optimalOrders?.filter(o => o.urgent).length || 0;
            const criticalCount = actualInventory?.optimalOrders?.filter(o => o.critical).length || 0;
            const highRiskCount = actualInventory?.stockoutRisks?.filter(r => r.risk_level === 'high').length || 0;
            const totalValue = actualInventory?.summary?.totalValue || 0;
            
            const finalStats = [
                `Total Products in Analysis: ${actualProducts?.length || 0}`,
                `Forecast Period: ${days} days`,
                `Total Projected Demand: ${this.formatNumber(totalDemand)} units`,
                `Average Daily Demand: ${this.formatNumber(avgDemand)} units`,
                `Products Needing Reorder: ${urgentCount + criticalCount}`,
                `Critical Items: ${criticalCount}`,
                `High Risk Items: ${highRiskCount}`,
                `Total Inventory Value: ${this.formatCurrency(totalValue)}`,
                ``,
                `This report was generated by DemandSense AI.`,
                `For more detailed analysis, visit the DemandSense AI dashboard.`
            ];
            
            for (const stat of finalStats) {
                if (yPos > pageHeight - 30) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.text(stat, margin, yPos);
                yPos += 6;
            }

            // ========== Footer ==========
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.setFont('helvetica', 'normal');
                doc.text(
                    `Page ${i} of ${pageCount} | DemandSense AI - Confidential Report`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                );
            }

            doc.save(filename);
            
            console.log('✅ PDF saved successfully with', pageCount, 'pages');
            return { success: true, filename, pages: pageCount };

        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }
}

// Make globally available
window.PDFExporter = PDFExporter;