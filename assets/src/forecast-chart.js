// assets/src/forecast-chart.js - Advanced forecast visualizations

class ForecastChartManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.currentChart = null;
        this.forecastData = null;
        this.historicalData = null;
    }

    /**
     * Initialize the chart
     */
    initialize() {
        if (!this.canvas) return;
        
        this.showNoData();
    }

    /**
     * Update chart with forecast data
     */
    updateForecast(forecastData, historicalData, options = {}) {
        this.forecastData = forecastData;
        this.historicalData = historicalData;

        if (!forecastData || !forecastData.labels) {
            this.showNoData();
            return false;
        }

        try {
            // Prepare datasets
            const datasets = this.prepareDatasets(forecastData, options);
            
            // Create chart
            const ctx = this.canvas.getContext('2d');
            
            if (this.currentChart) {
                this.currentChart.destroy();
            }

            this.currentChart = new Chart(ctx, {
                type: options.chartType || 'line',
                data: {
                    labels: forecastData.labels,
                    datasets: datasets
                },
                options: this.getChartOptions(options)
            });

            return true;

        } catch (error) {
            console.error('Error updating forecast chart:', error);
            this.showNoData();
            return false;
        }
    }

    /**
     * Prepare datasets for forecast visualization
     */
    prepareDatasets(forecastData, options) {
        const datasets = [];
        
        // Add historical data
        if (forecastData.datasets) {
            // Use provided datasets
            return forecastData.datasets.map(ds => ({
                ...ds,
                borderWidth: ds.label?.includes('Confidence') ? 1 : 2,
                pointRadius: ds.label?.includes('Confidence') ? 0 : 3,
                pointHoverRadius: 5,
                tension: 0.4
            }));
        }

        // Create default datasets
        const colors = {
            historical: '#ff4d6d',
            forecast: '#ff006e',
            confidence: 'rgba(255, 0, 110, 0.2)'
        };

        // Historical dataset
        datasets.push({
            label: 'Historical Sales',
            data: forecastData.historical || [],
            borderColor: colors.historical,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointBackgroundColor: colors.historical,
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: false
        });

        // Forecast dataset
        datasets.push({
            label: 'Forecast',
            data: forecastData.forecast || [],
            borderColor: colors.forecast,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: colors.forecast,
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: false
        });

        // Confidence interval (if available)
        if (forecastData.upperBound && forecastData.lowerBound) {
            datasets.push({
                label: 'Confidence Interval',
                data: forecastData.upperBound,
                borderColor: 'rgba(255, 0, 110, 0.3)',
                backgroundColor: 'rgba(255, 0, 110, 0.1)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: '+1',
                tension: 0.4
            });

            datasets.push({
                label: 'Confidence Interval Lower',
                data: forecastData.lowerBound,
                borderColor: 'rgba(255, 0, 110, 0.3)',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false,
                tension: 0.4
            });
        }

        return datasets;
    }

    /**
     * Get chart options
     */
    getChartOptions(options) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0ff',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: !!options.title,
                    text: options.title || 'Demand Forecast',
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    backgroundColor: '#1f1f2e',
                    titleColor: '#ffffff',
                    bodyColor: '#e0e0ff',
                    borderColor: '#ff006e',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(0);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: true,
                        borderColor: 'rgba(255, 0, 110, 0.3)'
                    },
                    ticks: {
                        color: '#e0e0ff',
                        maxRotation: 45,
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: true,
                        borderColor: 'rgba(255, 0, 110, 0.3)'
                    },
                    ticks: {
                        color: '#e0e0ff',
                        callback: (value) => {
                            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                            return value;
                        }
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.4
                },
                point: {
                    hoverRadius: 6
                }
            }
        };
    }

    /**
     * Show no data message
     */
    showNoData() {
        if (!this.canvas) return;

        const ctx = this.canvas.getContext('2d');
        
        if (this.currentChart) {
            this.currentChart.destroy();
        }

        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'No Forecast Data',
                    data: [1],
                    backgroundColor: 'rgba(255, 0, 110, 0.2)',
                    borderColor: '#ff006e',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'No Forecast Available',
                        color: '#ffffff',
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    }

    /**
     * Export chart as PNG
     */
    exportChart(format = 'png') {
        if (!this.canvas) return null;

        try {
            const url = this.canvas.toDataURL(`image/${format}`);
            const link = document.createElement('a');
            link.download = `forecast-${new Date().toISOString().slice(0, 10)}.${format}`;
            link.href = url;
            link.click();
            return url;
        } catch (error) {
            console.error('Error exporting chart:', error);
            return null;
        }
    }

    /**
     * Destroy chart
     */
    destroy() {
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }
    }
}

// Make globally available
window.ForecastChartManager = ForecastChartManager;