import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { IdentityV2025 } from 'sailpoint-api-client';
import * as d3 from 'd3';
import { ThemeService } from '../../theme/theme.service';

interface ChartDataPoint {
  label: string;
  value: number;
}

@Component({
  selector: 'app-manager-distribution-chart',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './manager-distribution-chart.component.html',
  styleUrl: './manager-distribution-chart.component.scss'
})
export class ManagerDistributionChartComponent implements OnChanges, OnDestroy {
  // Inject services using Angular 20 inject() function
  private router = inject(Router);
  private themeService = inject(ThemeService);

  // Use Angular 20 signals for reactive state
  isDark = signal<boolean>(false);

  constructor() {
    // Use effect to react to theme changes
    effect(() => {
      const isDark = this.themeService.isDark();
      this.isDark.set(Boolean(isDark));
      if (this.identities.length > 0) {
        this.renderManagerDistributionChart();
      }
    });
  }

  @Input() identities: IdentityV2025[] = [];
  @ViewChild('pieChart', { static: true }) private pieChartContainer!: ElementRef;

  // Chart dimensions
  private width = 700;
  private height = 400;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['identities'] && this.identities.length > 0) {
      this.renderManagerDistributionChart();
    }
  }

  renderManagerDistributionChart() {
    if (!this.pieChartContainer) return;

    const element = this.pieChartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    // Count identities by manager
    const managerCounts: { [key: string]: number } = {};
    this.identities.forEach(identity => {
      const manager = identity.managerRef?.name || 'No Manager';
      managerCounts[manager] = (managerCounts[manager] || 0) + 1;
    });

    const data: ChartDataPoint[] = Object.entries(managerCounts)
      .map(([key, value]) => ({ label: key, value }))
      .sort((a, b) => b.value - a.value);

    const svg = d3.select(element)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

    const radius = Math.min(this.width, this.height) / 2 - 40;

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.label))
      .range(d3.schemeCategory10);

    const pie = d3.pie<ChartDataPoint>()
      .value(d => d.value);

    const arc = d3.arc<d3.PieArcDatum<ChartDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const labelArc = d3.arc<d3.PieArcDatum<ChartDataPoint>>()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    // Add pie slices
    const slices = svg.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.label))
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        void this.router.navigate(['/identity-detail', 'manager', d.data.label]);
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.7);
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('opacity', 1);
      });

    // Add labels
    svg.selectAll('text')
      .data(pie(data))
      .enter()
      .append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('fill', this.isDark() ? '#ffffff' : '#000000')
      .text(d => d.data.label)
      .style('font-size', '12px');

    // Add value labels
    svg.selectAll('.value-label')
      .data(pie(data))
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('fill', this.isDark() ? '#ffffff' : '#000000')
      .text(d => d.data.value)
      .style('font-size', '14px')
      .style('font-weight', 'bold');

    // Add title
    svg.append('text')
      .attr('x', 0)
      .attr('y', -radius - 20)
      .attr('text-anchor', 'middle')
      .attr('fill', this.isDark() ? '#ffffff' : '#000000')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Manager Distribution');
  }

  ngOnDestroy(): void {
    // No need to unsubscribe from signals as they are not RxJS subjects
  }
}