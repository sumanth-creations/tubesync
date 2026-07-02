/**
 * Channel History Intelligence - Track Channel Evolution & Performance
 *
 * Features:
 * - Channel growth tracking over time
 * - Subscriber and view count history
 * - Engagement rate analysis
 * - Performance comparison
 * - Anomaly detection
 * - Growth predictions
 */

import {
  getChannelHistory, recordChannelSnapshot,
} from './api';
import { getYouTubeChannels } from '../api';
import type { ChannelHistory, YouTubeChannel } from '../../lib/database';
import { IntelligenceCore, getAIClient } from './intelligence-core';

interface ChannelSnapshot {
  date: string;
  subscribers: number;
  views: number;
  videos: number;
  engagementRate: number;
}

interface GrowthMetrics {
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  velocity: number;
  acceleration: number;
}

interface ChannelAnomaly {
  type: 'spike' | 'drop' | 'plateau' | 'viral';
  metric: 'subscribers' | 'views' | 'engagement';
  date: string;
  value: number;
  expected: number;
  deviation: number;
  significance: 'high' | 'medium' | 'low';
}

interface GrowthPrediction {
  metric: 'subscribers' | 'views' | 'videos';
  currentValue: number;
  predictedValue: number;
  timeframe: string;
  confidence: number;
  factors: string[];
}

interface ChannelBenchmark {
  metric: string;
  yourScore: number;
  averageScore: number;
  percentile: number;
  comparison: 'above' | 'below' | 'average';
}

interface ChannelHealthReport {
  overallHealth: number;
  growthTrend: 'growing' | 'declining' | 'stable';
  engagementHealth: number;
  consistencyScore: number;
  anomalies: ChannelAnomaly[];
  predictions: GrowthPrediction[];
  benchmarks: ChannelBenchmark[];
  recommendations: string[];
}

export class ChannelIntelligence {
  private aiClient: IntelligenceCore | null = null;
  private cache: Map<string, { data: ChannelHistory[]; timestamp: number }> = new Map();
  private cacheTTL = 15 * 60 * 1000;

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
  }

  async recordSnapshot(channelId: string): Promise<ChannelHistory> {
    const channel = await this.getChannel(channelId);
    if (!channel) throw new Error('Channel not found');

    const previousSnapshot = await this.getLatestSnapshot(channelId);
    const previousSubscribers = previousSnapshot?.subscriber_count || channel.subscriber_count;
    const previousViews = previousSnapshot?.view_count || channel.view_count;

    return recordChannelSnapshot({
      channel_id: channelId,
      snapshot_date: new Date().toISOString().split('T')[0],
      subscriber_count: channel.subscriber_count,
      view_count: channel.view_count,
      video_count: channel.video_count,
      subscriber_change: channel.subscriber_count - previousSubscribers,
      view_change: channel.view_count - previousViews,
      engagement_rate: this.calculateEngagementRate(channel),
      avg_views_per_video: channel.video_count > 0 ? Math.round(channel.view_count / channel.video_count) : 0,
    });
  }

  private async getChannel(channelId: string): Promise<YouTubeChannel | null> {
    const channels = await getYouTubeChannels();
    return channels.find(c => c.id === channelId) || null;
  }

  private calculateEngagementRate(channel: YouTubeChannel): number {
    if (channel.view_count === 0 || channel.subscriber_count === 0) return 0;
    return Number(((channel.subscriber_count / channel.view_count) * 100).toFixed(2));
  }

  private async getLatestSnapshot(channelId: string): Promise<ChannelHistory | null> {
    const history = await getChannelHistory(channelId, 1);
    return history[0] || null;
  }

  async getHistory(channelId?: string, days = 90): Promise<ChannelHistory[]> {
    const cacheKey = channelId || 'all';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const data = await getChannelHistory(channelId, days);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async analyzeGrowth(channelId: string): Promise<GrowthMetrics> {
    const history = await this.getHistory(channelId, 90);

    if (history.length < 2) {
      return {
        dailyGrowth: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        velocity: 0,
        acceleration: 0,
      };
    }

    const sorted = history.sort((a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );

    const latest = sorted[sorted.length - 1];
    const oneDayAgo = sorted[sorted.length - 2] || latest;
    const oneWeekAgo = sorted[Math.max(0, sorted.length - 7)] || sorted[0];
    const oneMonthAgo = sorted[Math.max(0, sorted.length - 30)] || sorted[0];

    const dailyGrowth = latest.subscriber_change || 0;
    const weeklyGrowth = (latest.subscriber_count || 0) - (oneWeekAgo.subscriber_count || 0);
    const monthlyGrowth = (latest.subscriber_count || 0) - (oneMonthAgo.subscriber_count || 0);

    const recentGrowth = sorted.slice(-7).map(h => h.subscriber_change || 0);
    const olderGrowth = sorted.slice(-14, -7).map(h => h.subscriber_change || 0);

    const velocity = this.average(recentGrowth);
    const acceleration = velocity - this.average(olderGrowth);

    return {
      dailyGrowth,
      weeklyGrowth,
      monthlyGrowth,
      velocity,
      acceleration,
    };
  }

  private average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  async detectAnomalies(channelId: string): Promise<ChannelAnomaly[]> {
    const history = await this.getHistory(channelId, 60);
    const anomalies: ChannelAnomaly[] = [];

    if (history.length < 7) return anomalies;

    const subscriberChanges = history.map(h => h.subscriber_change || 0);
    const avgChange = this.average(subscriberChanges);
    const stdDev = this.stdDeviation(subscriberChanges);

    for (const record of history) {
      const change = record.subscriber_change || 0;
      const deviation = stdDev > 0 ? Math.abs(change - avgChange) / stdDev : 0;

      if (deviation > 3) {
        anomalies.push({
          type: change > avgChange ? (change > avgChange * 5 ? 'viral' : 'spike') : 'drop',
          metric: 'subscribers',
          date: record.snapshot_date,
          value: change,
          expected: avgChange,
          deviation: change - avgChange,
          significance: deviation > 5 ? 'high' : deviation > 4 ? 'medium' : 'low',
        });
      }

      if (Math.abs(change) < 1 && avgChange > 5) {
        const prevRecords = history.filter(h =>
          new Date(h.snapshot_date) < new Date(record.snapshot_date)
        ).slice(-7);

        if (prevRecords.every(h => Math.abs(h.subscriber_change || 0) < 1)) {
          anomalies.push({
            type: 'plateau',
            metric: 'subscribers',
            date: record.snapshot_date,
            value: change,
            expected: avgChange,
            deviation: avgChange - change,
            significance: 'medium',
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.deviation - a.deviation);
  }

  private stdDeviation(nums: number[]): number {
    if (nums.length < 2) return 0;
    const avg = this.average(nums);
    const squaredDiffs = nums.map(n => Math.pow(n - avg, 2));
    return Math.sqrt(this.average(squaredDiffs));
  }

  async predictGrowth(channelId: string, days = 30): Promise<GrowthPrediction[]> {
    const history = await this.getHistory(channelId, 90);

    if (history.length < 14) {
      return [];
    }

    const sorted = history.sort((a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );

    const latest = sorted[sorted.length - 1];
    const growth = await this.analyzeGrowth(channelId);

    const predictions: GrowthPrediction[] = [];

    const predictedSubscribers = Math.round(
      (latest.subscriber_count || 0) +
      (growth.velocity * days) +
      (0.5 * growth.acceleration * days * days / days)
    );

    predictions.push({
      metric: 'subscribers',
      currentValue: latest.subscriber_count || 0,
      predictedValue: predictedSubscribers,
      timeframe: `${days} days`,
      confidence: this.calculateConfidence(sorted, 'subscriber_count'),
      factors: this.identifyGrowthFactors(growth),
    });

    const avgViewsPerDay = this.average(sorted.slice(-7).map(h => h.view_change || 0));
    const predictedViews = Math.round((latest.view_count || 0) + avgViewsPerDay * days);

    predictions.push({
      metric: 'views',
      currentValue: latest.view_count || 0,
      predictedValue: predictedViews,
      timeframe: `${days} days`,
      confidence: this.calculateConfidence(sorted, 'view_count'),
      factors: this.identifyGrowthFactors(growth),
    });

    return predictions;
  }

  private calculateConfidence(history: ChannelHistory[], metric: 'subscriber_count' | 'view_count'): number {
    const values = history.map(h => h[metric] || 0);
    if (values.length < 3) return 0.5;

    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }

    const avg = this.average(changes);
    const stdDev = this.stdDeviation(changes);
    const coefficientOfVariation = avg > 0 ? stdDev / avg : 1;

    return Math.max(0.3, Math.min(0.95, 1 - coefficientOfVariation));
  }

  private identifyGrowthFactors(growth: GrowthMetrics): string[] {
    const factors: string[] = [];

    if (growth.velocity > 0) {
      factors.push('Consistent content schedule');
    }
    if (growth.acceleration > 0) {
      factors.push('Accelerating growth trend');
    }
    if (growth.weeklyGrowth > growth.monthlyGrowth / 4) {
      factors.push('Recent content performing well');
    }
    if (growth.dailyGrowth > growth.velocity) {
      factors.push('Daily momentum strong');
    }

    return factors.length > 0 ? factors : ['Growth trajectory being analyzed'];
  }

  async getBenchmarks(channelId: string): Promise<ChannelBenchmark[]> {
    const channel = await this.getChannel(channelId);
    if (!channel) return [];

    const channels = await getYouTubeChannels();
    const others = channels.filter(c => c.id !== channelId);

    if (others.length === 0) {
      return this.createSingleChannelBenchmarks(channel);
    }

    const benchmarks: ChannelBenchmark[] = [];

    const avgSubscribers = this.average(others.map(c => c.subscriber_count));
    benchmarks.push({
      metric: 'Subscribers',
      yourScore: channel.subscriber_count,
      averageScore: avgSubscribers,
      percentile: this.calculatePercentile(channel.subscriber_count, others.map(c => c.subscriber_count)),
      comparison: channel.subscriber_count > avgSubscribers ? 'above' : channel.subscriber_count < avgSubscribers ? 'below' : 'average',
    });

    const avgViews = this.average(others.map(c => c.view_count));
    benchmarks.push({
      metric: 'Total Views',
      yourScore: channel.view_count,
      averageScore: avgViews,
      percentile: this.calculatePercentile(channel.view_count, others.map(c => c.view_count)),
      comparison: channel.view_count > avgViews ? 'above' : channel.view_count < avgViews ? 'below' : 'average',
    });

    const avgVideos = this.average(others.map(c => c.video_count));
    benchmarks.push({
      metric: 'Video Count',
      yourScore: channel.video_count,
      averageScore: avgVideos,
      percentile: this.calculatePercentile(channel.video_count, others.map(c => c.video_count)),
      comparison: channel.video_count > avgVideos ? 'above' : channel.video_count < avgVideos ? 'below' : 'average',
    });

    return benchmarks;
  }

  private calculatePercentile(value: number, others: number[]): number {
    const below = others.filter(o => o < value).length;
    return Math.round((below / others.length) * 100);
  }

  private createSingleChannelBenchmarks(channel: YouTubeChannel): ChannelBenchmark[] {
    return [
      { metric: 'Subscribers', yourScore: channel.subscriber_count, averageScore: channel.subscriber_count, percentile: 50, comparison: 'average' },
      { metric: 'Total Views', yourScore: channel.view_count, averageScore: channel.view_count, percentile: 50, comparison: 'average' },
      { metric: 'Video Count', yourScore: channel.video_count, averageScore: channel.video_count, percentile: 50, comparison: 'average' },
    ];
  }

  async generateHealthReport(channelId: string): Promise<ChannelHealthReport> {
    const [history, growth, anomalies, predictions, benchmarks] = await Promise.all([
      this.getHistory(channelId, 30),
      this.analyzeGrowth(channelId),
      this.detectAnomalies(channelId),
      this.predictGrowth(channelId),
      this.getBenchmarks(channelId),
    ]);

    const sorted = history.sort((a, b) =>
      new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    );

    let healthScore = 50;

    if (growth.monthlyGrowth > 0) healthScore += 15;
    if (growth.weeklyGrowth > 0) healthScore += 10;
    if (growth.velocity > 0) healthScore += 10;
    if (growth.acceleration > 0) healthScore += 5;
    if (anomalies.filter(a => a.type === 'viral' || a.type === 'spike').length > 0) healthScore += 10;
    if (anomalies.filter(a => a.type === 'drop').length > 0) healthScore -= 10;

    const latest = sorted[0];
    if (latest?.engagement_rate && latest.engagement_rate > 5) healthScore += 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    let growthTrend: 'growing' | 'declining' | 'stable';
    if (growth.velocity > 1) growthTrend = 'growing';
    else if (growth.velocity < -1) growthTrend = 'declining';
    else growthTrend = 'stable';

    const engagementHealth = latest?.engagement_rate ? Math.min(100, latest.engagement_rate * 10) : 50;

    const consistencyScore = this.calculateConsistency(history);

    const recommendations = await this.generateRecommendations(
      growth,
      anomalies,
      benchmarks,
      healthScore
    );

    return {
      overallHealth: healthScore,
      growthTrend,
      engagementHealth: Math.round(engagementHealth),
      consistencyScore: Math.round(consistencyScore),
      anomalies,
      predictions,
      benchmarks,
      recommendations,
    };
  }

  private calculateConsistency(history: ChannelHistory[]): number {
    if (history.length < 7) return 50;

    const changes = history.map(h => h.subscriber_change || 0);
    const avg = this.average(changes);
    const stdDev = this.stdDeviation(changes);

    if (avg <= 0) return 30;
    if (stdDev === 0) return 90;

    const coefficient = stdDev / avg;
    return Math.max(0, Math.min(100, 100 - coefficient * 50));
  }

  private async generateRecommendations(
    growth: GrowthMetrics,
    anomalies: ChannelAnomaly[],
    benchmarks: ChannelBenchmark[],
    healthScore: number
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (growth.velocity <= 0) {
      recommendations.push('Increase content frequency to boost growth');
    }
    if (growth.acceleration < 0) {
      recommendations.push('Growth is slowing - try new content formats or topics');
    }
    if (anomalies.some(a => a.type === 'drop')) {
      recommendations.push('Investigate recent subscriber drops - check recent video performance');
    }

    const subBenchmark = benchmarks.find(b => b.metric === 'Subscribers');
    if (subBenchmark && subBenchmark.comparison === 'below') {
      recommendations.push('Focus on subscriber conversion strategies');
    }

    if (healthScore < 50) {
      recommendations.push('Channel health needs attention - review content strategy');
    } else if (healthScore > 80) {
      recommendations.push('Channel is performing well - maintain current momentum');
    }

    return recommendations.length > 0 ? recommendations : ['Continue current content strategy'];
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const channelIntelligence = new ChannelIntelligence();
