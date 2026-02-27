// assets/src/pdf-export.js - PDF Export with neon theme support

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
            // Load jsPDF
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                // Load autoTable
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

            // Timeout after 10 seconds
            setTimeout(() => reject(new Error('PDF dependency loading timeout')), 10000);
        });
    }

    /**
     * Export forecast report as PDF
     */
    async exportForecast(forecastData, products = [], options = {}) {
        const {
            filename = `forecast-${new Date().toISOString().slice(0, 10)}.pdf`,
            title = 'DemandSense AI - Demand Forecast Report',
            includeCharts = true,
            includeProducts = true
        } = options;

        try {
            await this.loadDependencies();

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            let yPos = 20;

            // Add header with neon theme
            doc.setFontSize(24);
            doc.setTextColor(255, 0, 110); // Neon pink
            doc.text('DemandSense AI', 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(16);
            doc.setTextColor(255, 77, 109); // Neon red
            doc.text(title, 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
            
            yPos += 15;

            // Add forecast summary
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.text('Forecast Summary', 20, yPos);
            
            yPos += 8;
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            const totalDemand = forecastData.forecast?.reduce((sum, f) => sum + (f.predicted || 0), 0) || 0;
            const avgDemand = totalDemand / (forecastData.forecast?.length || 1);
            
            doc.text(`• Forecast Period: ${forecastData.forecast?.length || 30} days`, 25, yPos);
            yPos += 6;
            doc.text(`• Total Predicted Demand: ${Math.round(totalDemand)} units`, 25, yPos);
            yPos += 6;
            doc.text(`• Average Daily Demand: ${Math.round(avgDemand)} units`, 25, yPos);
            yPos += 6;
            doc.text(`• Confidence Level: ${Math.round((forecastData.confidence || 0.85) * 100)}%`, 25, yPos);
            
            yPos += 12;

            // Add chart if requested
            if (includeCharts) {
                const chartCanvas = document.getElementById('dataChart');
                if (chartCanvas) {
                    try {
                        const chartImage = chartCanvas.toDataURL('image/png');
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 80);
                        yPos += 90;
                    } catch (e) {
                        console.warn('Could not add chart to PDF:', e);
                    }
                }
            }

            // Add insights
            if (forecastData.insights && forecastData.insights.length > 0) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.text('Key Insights', 20, yPos);
                
                yPos += 8;
                
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                
                forecastData.insights.slice(0, 5).forEach(insight => {
                    if (yPos > 280) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`• ${insight}`, 25, yPos);
                    yPos += 6;
                });
                
                yPos += 6;
            }

            // Add product recommendations
            if (includeProducts && products.length > 0) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.text('Product Recommendations', 20, yPos);
                
                yPos += 8;

                const tableData = products.slice(0, 15).map(p => [
                    p.id || '-',
                    p.name || 'Unknown',
                    p.current_stock?.toString() || '0',
                    p.reorder_point?.toString() || '-',
                    p.lead_time_days?.toString() || '-'
                ]);

                if (window.jspdf.autoTable) {
                    doc.autoTable({
                        startY: yPos,
                        head: [['ID', 'Product', 'Stock', 'Reorder Point', 'Lead Time']],
                        body: tableData,
                        theme: 'striped',
                        headStyles: { fillColor: [255, 0, 110] },
                        margin: { left: 20, right: 20 }
                    });
                }
            }

            // Add footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    doc.internal.pageSize.width / 2,
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }

            // Save PDF
            doc.save(filename);
            
            return { success: true, filename };

        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }

    /**
     * Export inventory report as PDF
     */
    async exportInventory(inventoryData, options = {}) {
        const {
            filename = `inventory-${new Date().toISOString().slice(0, 10)}.pdf`,
            title = 'DemandSense AI - Inventory Optimization Report'
        } = options;

        try {
            await this.loadDependencies();

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            let yPos = 20;

            // Header
            doc.setFontSize(24);
            doc.setTextColor(255, 0, 110);
            doc.text('DemandSense AI', 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(16);
            doc.setTextColor(255, 77, 109);
            doc.text(title, 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
            
            yPos += 15;

            // Summary
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.text('Inventory Summary', 20, yPos);
            
            yPos += 8;
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            doc.text(`• Total Products: ${inventoryData.summary?.totalProducts || 0}`, 25, yPos);
            yPos += 6;
            doc.text(`• Total Stock: ${inventoryData.summary?.totalStock || 0} units`, 25, yPos);
            yPos += 6;
            doc.text(`• Total Value: $${inventoryData.summary?.totalValue?.toLocaleString() || 0}`, 25, yPos);
            yPos += 6;
            doc.text(`• Urgent Orders: ${inventoryData.summary?.urgentOrders || 0}`, 25, yPos);
            
            yPos += 12;

            // Urgent Orders
            if (inventoryData.optimalOrders?.filter(o => o.urgent).length > 0) {
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.text('Urgent Reorder Recommendations', 20, yPos);
                
                yPos += 8;

                const urgentData = inventoryData.optimalOrders
                    .filter(o => o.urgent)
                    .slice(0, 10)
                    .map(o => [
                        o.product_name || 'Unknown',
                        o.current_stock?.toString() || '0',
                        o.recommended?.toString() || '0',
                        o.critical ? 'CRITICAL' : 'URGENT'
                    ]);

                if (window.jspdf.autoTable) {
                    doc.autoTable({
                        startY: yPos,
                        head: [['Product', 'Current Stock', 'Order Quantity', 'Priority']],
                        body: urgentData,
                        theme: 'striped',
                        headStyles: { fillColor: [255, 0, 110] },
                        margin: { left: 20, right: 20 }
                    });
                }
            }

            doc.save(filename);
            
            return { success: true, filename };

        } catch (error) {
            console.error('Inventory PDF export error:', error);
            throw error;
        }
    }

    /**
     * Export scenario analysis as PDF
     */
    async exportScenario(scenarioData, options = {}) {
        const {
            filename = `scenario-${new Date().toISOString().slice(0, 10)}.pdf`,
            title = 'DemandSense AI - Scenario Analysis Report'
        } = options;

        try {
            await this.loadDependencies();

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            let yPos = 20;

            // Header
            doc.setFontSize(24);
            doc.setTextColor(255, 0, 110);
            doc.text('DemandSense AI', 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(16);
            doc.setTextColor(255, 77, 109);
            doc.text(title, 20, yPos);
            
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
            
            yPos += 15;

            // Scenario details
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 110);
            doc.text('Scenario Details', 20, yPos);
            
            yPos += 8;
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            doc.text(`• Type: ${scenarioData.scenario?.type || 'Unknown'}`, 25, yPos);
            yPos += 6;
            doc.text(`• Parameters: ${JSON.stringify(scenarioData.scenario?.parameters || {})}`, 25, yPos);
            
            yPos += 12;

            // Impact
            if (scenarioData.impact) {
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.text('Impact Analysis', 20, yPos);
                
                yPos += 8;
                
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                
                doc.text(`• Demand Impact: ${scenarioData.impact.percentageChange > 0 ? '+' : ''}${scenarioData.impact.percentageChange || 0}%`, 25, yPos);
                yPos += 6;
                doc.text(`• Additional Units: ${scenarioData.impact.totalDemandImpact || 0}`, 25, yPos);
                yPos += 6;
                doc.text(`• Products Affected: ${scenarioData.impact.productsAffected || 0}`, 25, yPos);
                
                yPos += 12;
            }

            // Insights
            if (scenarioData.analysis?.insights?.length > 0) {
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 110);
                doc.text('Insights', 20, yPos);
                
                yPos += 8;
                
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                
                scenarioData.analysis.insights.slice(0, 5).forEach(insight => {
                    if (yPos > 280) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`• ${insight}`, 25, yPos);
                    yPos += 6;
                });
            }

            doc.save(filename);
            
            return { success: true, filename };

        } catch (error) {
            console.error('Scenario PDF export error:', error);
            throw error;
        }
    }
}

// Make globally available
window.PDFExporter = PDFExporter;