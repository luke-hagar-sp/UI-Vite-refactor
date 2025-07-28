import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { IdentityV2025 } from 'sailpoint-api-client';
import * as d3 from 'd3';
import { ThemeService } from '../../theme/theme.service';

@Component({
  selector: 'app-lifecycle-state-chart',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './lifecycle-state-chart.component.html',
  styleUrl: './lifecycle-state-chart.component.scss'
})
export class LifecycleStateChartComponent implements OnChanges, OnDestroy {
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
        this.renderLifecycleStateChart();
      }
    });
  }

  @Input() identities: IdentityV2025[] = [];
  @ViewChild('lifecycleChart', { static: true }) private lifecycleChartContainer!: ElementRef;

  // Chart dimensions
  private width = 700;
  private height = 400;
  private margin = { top: 20, right: 30, bottom: 60, left: 40 };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['identities'] && this.identities.length > 0) {
      this.renderLifecycleStateChart();
    }
  }

  renderLifecycleStateChart() {
    if (!this.lifecycleChartContainer) return;

    const element = this.lifecycleChartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    // Count identities by lifecycle state
    const stateCounts: { [key: string]: number } = {};
    this.identities.forEach(identity => {
      const state = identity.lifecycleState?.stateName || 'Unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });

    const data = Object.entries(stateCounts).map(([key, value]) => ({ state: key, count: value }));

    const svg = d3.select(element)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.state))
      .range([0, this.width - this.margin.left - this.margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 0])
      .nice()
      .range([this.height - this.margin.top - this.margin.bottom, 0]);

    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y));

    // Color scale
    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.state))
      .range(d3.schemeCategory10);

    // Add bars with click events
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.state) || 0)
      .attr('y', d => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => this.height - this.margin.top - this.margin.bottom - y(d.count))
      .attr('fill', d => color(d.state))
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        void this.router.navigate(['/identity-detail', 'lifecycleState', d.state]);
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.7);
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('opacity', 1);
      });

    // Add value labels on bars
    svg.selectAll('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', d => (x(d.state) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', this.isDark() ? '#ffffff' : '#000000')
      .text(d => d.count);

    // Add title
    svg.append('text')
      .attr('x', (this.width - this.margin.left - this.margin.right) / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', this.isDark() ? '#ffffff' : '#000000')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Lifecycle State Distribution');
  }

  ngOnDestroy(): void {
    // No need to unsubscribe from signals as they are not RxJS subjects
  }
}