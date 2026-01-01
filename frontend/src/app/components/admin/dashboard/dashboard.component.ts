import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { MenuService } from '../../../services/menu.service';
import { OrderService } from '../../../services/order.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions, Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  template: `
    <div class="admin-dashboard">
      <div class="container">
        <!-- Header -->
        <div class="dashboard-header">
          <p>ניהול תפריטים, הזמנות ועדכונים</p>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid" *ngIf="!isLoadingStats">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ totalOrders }}</div>
              <div class="stat-label">סה"כ הזמנות</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-utensils"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ activeProducts }}</div>
              <div class="stat-label">פריטים פעילים</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ newOrders }}</div>
              <div class="stat-label">הזמנות חדשות</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-star"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ popularProducts }}</div>
              <div class="stat-label">פריטים מומלצים</div>
            </div>
          </div>
        </div>

        <!-- Loading Stats -->
        <div class="stats-loading" *ngIf="isLoadingStats">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען סטטיסטיקות...</span>
        </div>

        <!-- Revenue Trend Chart -->
        <div class="chart-container" *ngIf="!isLoadingStats">
          <div class="chart-header">
            <h3 class="chart-title">
              <i class="fas fa-chart-line"></i>
              מגמת הכנסות (7 ימים אחרונים)
            </h3>
          </div>
          <div class="chart-wrapper">
            <canvas baseChart
                    [data]="chartData"
                    [options]="chartOptions"
                    [type]="'line'">
            </canvas>
          </div>
        </div>

        <!-- Quick Actions Grid -->
        <div class="admin-grid">
          <a routerLink="/admin/menu" class="admin-card link-card">
            <div class="card-icon">
              <i class="fas fa-utensils"></i>
            </div>
            <h3>ניהול תפריט</h3>
            <p>הוסף ועדכן פריטי תפריט</p>
          </a>
          <a routerLink="/admin/orders" class="admin-card link-card">
            <div class="card-icon">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <h3>הזמנות</h3>
            <p>צפה בהזמנות האחרונות</p>
          </a>
          <div class="admin-card">
            <div class="card-icon">
              <i class="fas fa-star"></i>
            </div>
            <h3>המלצות לקוחות</h3>
            <p>נהל המלצות לקוחות</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    // Productivity-First Clean SaaS Theme Variables (Semantic Colors)
    $primary-blue: #3b82f6; // Calming Azure
    $success-green: #10b981; // Emerald Green
    $danger-red: #ef4444; // Soft Red
    $text-dark: #0f172a; // Dark Slate
    $white: #ffffff;
    $bg-light: #f3f4f6; // Cool Light Gray
    $card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); // Very subtle shadow
    
    // Contextual Icon Colors
    $icon-success-bg: #d1fae5; // Light Green background
    $icon-success: #059669; // Dark Green icon
    $icon-info-bg: #dbeafe; // Light Blue background
    $icon-info: #2563eb; // Dark Blue icon
    $icon-warning-bg: #fed7aa; // Light Orange background
    $icon-warning: #ea580c; // Orange icon

    .admin-dashboard {
      padding: 2rem 0;
      min-height: 60vh;
      background-color: $bg-light; // Cool Light Gray (#f3f4f6)
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .dashboard-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .dashboard-header p {
      color: #64748b; // Medium gray
      margin: 0;
      font-size: 1.1rem;
    }

    // Stats Cards Grid
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .stat-card {
      background: $white; // White (#ffffff)
      padding: 2rem;
      border-radius: 8px; // Cleaner, less rounded
      box-shadow: $card-shadow; // Very subtle shadow
      display: flex;
      align-items: center;
      gap: 1.5rem;
      transition: box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
      // No colored borders - clean data focus
    }

    .stat-card:hover {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); // Slightly stronger on hover
    }

    // Minimalist Green Icons (No Background/Circle)
    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      // No background, no border, no circle - standalone icon
    }

    .stat-icon i {
      font-size: 2.5rem; // Larger icon (40px) since no circle frame
      color: #059669; // Emerald Green (#059669)
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 2.5rem; // Large but not huge
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; // Clean Sans-Serif
      font-weight: 700;
      color: #1f2937; // Dark/Black for readability
      line-height: 1;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.875rem; // Standard size
      color: #059669; // Emerald Green (#059669)
      font-weight: 600; // Medium Bold
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stats-loading {
      text-align: center;
      padding: 3rem;
      color: #64748b; // Medium gray
    }

    .stats-loading i {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: $primary-blue; // Calming Azure
    }

    // Quick Actions Grid
    .admin-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }

    .admin-card {
      background: $white;
      padding: 2rem;
      border-radius: 8px; // Cleaner, less rounded
      box-shadow: $card-shadow; // Very subtle shadow
      text-align: center;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      transition: box-shadow 0.2s ease;
      cursor: pointer;
    }

    .admin-card:hover {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); // Slightly stronger on hover
    }

    .admin-card h3 {
      color: $text-dark; // Dark Slate
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .admin-card p {
      color: #64748b; // Medium gray
      margin: 0;
      font-size: 0.875rem;
    }

    .card-icon {
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $icon-info-bg; // Light Blue background
      border-radius: 50%;
      margin-bottom: 1rem;
    }

    .admin-card i {
      font-size: 1.5rem;
      color: $icon-info; // Dark Blue
    }

    .link-card {
      border: 1px solid rgba(59, 130, 246, 0.2); // Subtle blue border
    }

    .link-card:hover {
      background: rgba(59, 130, 246, 0.05);
      border-color: $primary-blue;
    }

    // Chart Container
    .chart-container {
      background: $white;
      border-radius: 8px; // Cleaner, less rounded
      box-shadow: $card-shadow; // Very subtle shadow
      padding: 2rem;
      margin-bottom: 2rem;
      margin-top: 2rem;
    }

    .chart-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .chart-title {
      color: $text-dark; // Dark Slate
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .chart-title i {
      color: $primary-blue; // Calming Azure
      font-size: 1.25rem;
    }

    .chart-wrapper {
      height: 300px;
      position: relative;
    }
    
    // Responsive
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .admin-grid {
        grid-template-columns: 1fr;
      }

    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private router = inject(Router);
  private menuService = inject(MenuService);
  private orderService = inject(OrderService);

  totalOrders = 0;
  activeProducts = 0;
  newOrders = 0;
  popularProducts = 0;
  isLoadingStats = true;

  // Chart Configuration
  chartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(26, 42, 58, 0.95)',
        titleColor: '#ffffff',
        titleFont: {
          family: "'Inter', 'Roboto', sans-serif",
          size: 14,
          weight: 'bold'
        },
        bodyColor: '#ffffff',
        bodyFont: {
          family: "'Assistant', 'Heebo', sans-serif",
          size: 13
        },
        borderColor: '#3b82f6', // Royal Blue
        borderWidth: 2,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `₪${value.toLocaleString('he-IL')}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false // Hide X-axis grid lines
        },
        ticks: {
          color: '#64748b', // Medium gray
          font: {
            family: "'Inter', 'Roboto', sans-serif", // Clean Sans-Serif
            size: 12,
            weight: 'normal' as const
          }
        },
        border: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(108, 117, 125, 0.15)', // Very light gray
          lineWidth: 1,
          drawOnChartArea: true,
          drawTicks: false
          // Note: Dashed lines not directly supported in Chart.js 4 GridLineOptions
          // Using solid light gray lines instead for clean minimal look
        } as any, // Type assertion to allow any grid properties
        ticks: {
          color: '#64748b', // Medium gray
          font: {
            family: "'Inter', 'Roboto', sans-serif", // Clean Sans-Serif
            size: 12,
            weight: 'normal' as const
          },
          callback: (value) => {
            return `₪${Number(value).toLocaleString('he-IL')}`;
          }
        },
        border: {
          display: false
        }
      }
    },
    elements: {
      point: {
        radius: 0, // Hide points by default
        hoverRadius: 6, // Show on hover
        hoverBorderWidth: 2,
        hoverBorderColor: '#3b82f6', // Royal Blue
        hoverBackgroundColor: '#ffffff'
      },
      line: {
        borderWidth: 2, // Clean line width
        borderColor: '#3b82f6', // Royal Blue
        tension: 0.4, // Smooth curved line
        fill: true // Enable gradient fill
      }
    }
  };

  ngOnInit(): void {
    this.loadStatistics();
    this.loadRevenueData();
  }

  private loadRevenueData(): void {
    this.orderService.getRevenueStats().subscribe({
      next: (stats) => {
        this.updateChartWithRealData(stats);
      },
      error: (error) => {
        console.error('Error loading revenue stats:', error);
        // Fallback to dummy data if API fails
        this.initializeChartWithDummyData();
      }
    });
  }

  private updateChartWithRealData(stats: { date: string; total: number }[]): void {
    // Generate all 7 days labels
    const allDaysLabels = this.getLast7DaysLabels();
    const allDaysDates = this.getLast7DaysDates();
    
    // Create a map of date -> total for quick lookup
    const statsMap = new Map<string, number>();
    stats.forEach(stat => {
      statsMap.set(stat.date, stat.total);
    });
    
    // Map data: fill with 0 for days without orders
    const revenueData = allDaysDates.map(date => {
      return statsMap.get(date) || 0;
    });
    
    // Update chart data - gradient will be created dynamically
    this.chartData = {
      labels: allDaysLabels,
      datasets: [
        {
          label: 'הכנסות',
          data: revenueData,
          borderColor: '#3b82f6', // Royal Blue
          backgroundColor: (context: any) => {
            // Create gradient dynamically from chart context
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) {
              return 'rgba(59, 130, 246, 0.2)';
            }
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)'); // Blue with 30% opacity at top
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)'); // Fade to transparent at bottom
            return gradient;
          },
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#3b82f6',
          pointHoverBorderWidth: 2,
          pointRadius: 0, // Hide points by default
          pointHoverRadius: 6, // Show on hover
          tension: 0.4, // Smooth curved line
          fill: true // Enable gradient fill
        }
      ]
    };
  }

  private initializeChartWithDummyData(): void {
    const revenueData = this.calculateWeeklyRevenue();
    const labels = this.getLast7DaysLabels();

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'הכנסות',
          data: revenueData,
          borderColor: '#3b82f6', // Royal Blue
          backgroundColor: (context: any) => {
            // Create gradient dynamically from chart context
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) {
              return 'rgba(59, 130, 246, 0.2)';
            }
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)'); // Blue with 30% opacity at top
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)'); // Fade to transparent at bottom
            return gradient;
          },
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#3b82f6',
          pointHoverBorderWidth: 2,
          pointRadius: 0, // Hide points by default
          pointHoverRadius: 6, // Show on hover
          tension: 0.4, // Smooth curved line
          fill: true // Enable gradient fill
        }
      ]
    };
  }

  private calculateWeeklyRevenue(): number[] {
    // Mock data for the last 7 days (fallback)
    const baseRevenue = 5000;
    const variance = 1500;
    
    return Array.from({ length: 7 }, () => {
      return Math.floor(baseRevenue + (Math.random() * variance * 2) - variance);
    });
  }

  private getLast7DaysLabels(): string[] {
    const labels: string[] = [];
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayIndex = date.getDay();
      const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1];
      labels.push(dayName);
    }
    
    return labels;
  }

  private getLast7DaysDates(): string[] {
    const dates: string[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    
    return dates;
  }

  loadStatistics(): void {
    this.isLoadingStats = true;

    // Load orders
    this.orderService.getAllOrders().subscribe({
      next: (orders) => {
        this.totalOrders = orders.length;
        this.newOrders = orders.filter(o => o.status === 'new').length;
        this.updateStatsLoading();
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.updateStatsLoading();
      }
    });

    // Load menu items
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        this.activeProducts = items.filter(i => i.isAvailable !== false).length;
        this.popularProducts = items.filter(i => i.isPopular === true).length;
        this.updateStatsLoading();
      },
      error: (error) => {
        console.error('Error loading menu items:', error);
        this.updateStatsLoading();
      }
    });
  }

  private updateStatsLoading(): void {
    // Check if both requests completed (simple approach)
    setTimeout(() => {
      this.isLoadingStats = false;
    }, 500);
  }
}
