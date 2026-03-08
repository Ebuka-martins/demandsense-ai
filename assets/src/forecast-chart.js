// assets/src/forecast-chart.js - Advanced forecast visualizations with long-term support

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

        if (!forecastData || !forecastData.labels || forecastData.labels.length === 0) {
            console.warn('No forecast data to display');
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

            // Calculate reasonable y-axis max
            const allValues = [
                ...(forecastData.historical || []),
                ...(forecastData.forecast || []),
                ...(forecastData.upperBound || [])
            ].filter(v => v !== null && v !== undefined);
            
            const maxValue = Math.max(...allValues, 1);
            const yAxisMax = Math.ceil(maxValue * 1.1); // Add 10% padding

            this.currentChart = new Chart(ctx, {
                type: options.chartType || 'line',
                data: {
                    labels: forecastData.labels,
                    datasets: datasets
                },
                options: this.getChartOptions({
                    ...options,
                    yAxisMax
                })
            });

            console.log('Chart updated with', forecastData.labels.length, 'data points');
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
        
        const colors = {
            historical: '#ff4d6d',
            forecast: '#ff006e',
            confidence: 'rgba(255, 0, 110, 0.2)'
        };

        // Find the split point between historical and forecast
        const historicalLength = forecastData.historical?.length || 0;
        
        // Create arrays with nulls for proper alignment
        const historicalWithNulls = [
            ...(forecastData.historical || []),
            ...Array(forecastData.forecast?.length || 0).fill(null)
        ];
        
        const forecastWithNulls = [
            ...Array(historicalLength).fill(null),
            ...(forecastData.forecast || [])
        ];

        // Historical dataset
        datasets.push({
            label: 'Historical Sales',
            data: historicalWithNulls,
            borderColor: colors.historical,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointBackgroundColor: colors.historical,
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: false,
            order: 1
        });

        // Forecast dataset
        datasets.push({
            label: 'Forecast',
            data: forecastWithNulls,
            borderColor: colors.forecast,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: colors.forecast,
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: false,
            order: 2
        });

        // Confidence interval (if available)
        if (forecastData.upperBound && forecastData.lowerBound) {
            const upperWithNulls = [
                ...Array(historicalLength).fill(null),
                ...(forecastData.upperBound || [])
            ];
            
            const lowerWithNulls = [
                ...Array(historicalLength).fill(null),
                ...(forecastData.lowerBound || [])
            ];

            // Upper bound dataset (for area fill)
            datasets.push({
                label: 'Confidence Interval',
                data: upperWithNulls,
                borderColor: 'rgba(255, 0, 110, 0.3)',
                backgroundColor: 'rgba(255, 0, 110, 0.1)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: '+1',
                tension: 0.4,
                order: 3
            });

            // Lower bound dataset
            datasets.push({
                label: 'Confidence Interval Lower',
                data: lowerWithNulls,
                borderColor: 'rgba(255, 0, 110, 0.3)',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false,
                tension: 0.4,
                order: 4
            });
        }

        return datasets;
    }

    /**
     * Get chart options
     */
    getChartOptions(options) {
        const isLongTerm = options.title?.includes('Year') || options.title?.includes('year') || false;
        
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
                        pointStyle: 'circle',
                        filter: (item) => !item.text.includes('Confidence Interval Lower')
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
                                if (context.parsed.y >= 1000000) {
                                    label += (context.parsed.y / 1000000).toFixed(1) + 'M';
                                } else if (context.parsed.y >= 1000) {
                                    label += (context.parsed.y / 1000).toFixed(1) + 'K';
                                } else {
                                    label += context.parsed.y.toFixed(0);
                                }
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
                        maxTicksLimit: isLongTerm ? 12 : 15,
                        callback: function(val, index) {
                            const label = this.getLabelForValue(val);
                            if (isLongTerm && label) {
                                const date = new Date(label);
                                if (!isNaN(date.getTime())) {
                                    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                                }
                            }
                            if (label && label.length > 10) {
                                return label.substring(5, 10);
                            }
                            return label;
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: options.yAxisMax,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: true,
                        borderColor: 'rgba(255, 0, 110, 0.3)'
                    },
                    ticks: {
                        color: '#e0e0ff',
                        callback: (value) => {
                            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                            return value;
                        }
                    }
                }
            },
            elements: {
                line: {
                    tension: isLongTerm ? 0.2 : 0.4
                },
                point: {
                    radius: isLongTerm ? 2 : 3,
                    hoverRadius: 5
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
                        text: 'Upload sales data to generate forecast',
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