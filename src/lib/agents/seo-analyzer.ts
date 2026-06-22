/**
 * SEO History Analyzer - Track and Analyze Search Performance
 *
 * Features:
 * - Keyword tracking over time
 * - Position change detection
 * - Trend analysis and predictions
 * - Content optimization suggestions
 * - Historical performance insights
 */

import {
  getSEOHistory, recordSEOMetrics,
} from './api';
import type { SEOHistory, Video } from '../../types';
import { IntelligenceCore, getAIClient } from './intelligence-core';

interface SEOMetricSnapshot {
  keyword: string;
  current: {
    position: number | null;
    impressions: number;
    clicks: number;
    ctr: number;
  };
  previous?: {
    position: number | null;
    impressions: number;
    clicks: number;
    ctr: number;
  };
  change: {
    position: number | null;
    impressions: number;
    clicks: number;
    ctr: number;
  };
  trend: 'improving' | 'declining' | 'stable' | 'new';
}

interface KeywordTrend {
  keyword: string;
  averagePosition: number;
  positionChange: number;
  totalImpressions: number;
  totalClicks: number;
  averageCTR: number;
  trajectory: 'rising' | 'falling' | 'stable';
  potential: 'high' | 'medium' | 'low';
}

interface SEOOptimizationSuggestion {
  type: 'title' | 'description' | 'tags' | 'content' | 'thumbnail';
  priority: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
  expectedImpact: string;
}

interface SEOScoreBreakdown {
  overall: number;
  keywordRelevance: number;
  clickThroughRate: number;
  impressions: number;
  position: number;
  trend: number;
}

export class SEOAnalyzer {
  private aiClient: IntelligenceCore | null = null;
  private cache: Map<string, { data: SEOHistory[]; timestamp: number }> = new Map();
  private cacheTTL = 10 * 60 * 1000;

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
  }

  async trackKeyword(
    keyword: string,
    videoId: string | null,
    metrics: {
      position?: number;
      impressions?: number;
      clicks?: number;
      ctr?: number;
    }
  ): Promise<SEOHistory> {
    const existing = await this.getExistingRecord(keyword, videoId);
    const avgPosition = this.calculateAveragePosition(keyword, metrics.position);

    return recordSEOMetrics({
      video_id: videoId,
      keyword,
      position: metrics.position || null,
      impressions: metrics.impressions || 0,
      clicks: metrics.clicks || 0,
      ctr: metrics.ctr || null,
      average_position: avgPosition,
      date: new Date().toISOString().split('T')[0],
    });
  }

  private async getExistingRecord(keyword: string, videoId: string | null): Promise<SEOHistory | null> {
    const history = await getSEOHistory(videoId || undefined, 1);
    return history.find(h => h.keyword === keyword) || null;
  }

  private calculateAveragePosition(keyword: string, newPosition: number | undefined): number {
    if (!newPosition) return 0;
    return newPosition;
  }

  async getKeywordPerformance(keyword: string, days = 30): Promise<SEOMetricSnapshot[]> {
    const history = await this.fetchCachedHistory(keyword);

    const relevantHistory = history
      .filter(h => h.keyword === keyword)
      .slice(0, days);

    const snapshots: SEOMetricSnapshot[] = [];

    for (let i = 0; i < relevantHistory.length; i++) {
      const current = relevantHistory[i];
      const previous = relevantHistory[i + 1];

      snapshots.push({
        keyword: current.keyword,
        current: {
          position: current.position,
          impressions: current.impressions,
          clicks: current.clicks,
          ctr: current.ctr || 0,
        },
        previous: previous ? {
          position: previous.position,
          impressions: previous.impressions,
          clicks: previous.clicks,
          ctr: previous.ctr || 0,
        } : undefined,
        change: {
          position: previous && current.position && previous.position
            ? previous.position - current.position
            : null,
          impressions: current.impressions - (previous?.impressions || 0),
          clicks: current.clicks - (previous?.clicks || 0),
          ctr: (current.ctr || 0) - (previous?.ctr || 0),
        },
        trend: this.determineTrend(current, previous),
      });
    }

    return snapshots;
  }

  private determineTrend(current: SEOHistory, previous?: SEOHistory): 'improving' | 'declining' | 'stable' | 'new' {
    if (!previous) return 'new';

    const positionChange = (previous.position || 100) - (current.position || 100);
    const ctrChange = (current.ctr || 0) - (previous.ctr || 0);

    if (positionChange > 2 || ctrChange > 0.5) return 'improving';
    if (positionChange < -2 || ctrChange < -0.5) return 'declining';
    return 'stable';
  }

  async analyzeKeywordTrends(days = 30): Promise<KeywordTrend[]> {
    const history = await getSEOHistory(undefined, days * 10);
    const keywordData = new Map<string, SEOHistory[]>();

    for (const record of history) {
      if (!keywordData.has(record.keyword)) {
        keywordData.set(record.keyword, []);
      }
      keywordData.get(record.keyword)!.push(record);
    }

    const trends: KeywordTrend[] = [];

    for (const [keyword, records] of keywordData) {
      const sorted = records.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      if (sorted.length < 2) continue;

      const recentRecords = sorted.slice(0, Math.min(7, sorted.length));
      const olderRecords = sorted.slice(Math.min(7, sorted.length));

      const avgRecentPosition = this.avg(
        recentRecords.filter(r => r.position).map(r => r.position!)
      );
      const avgOlderPosition = this.avg(
        olderRecords.filter(r => r.position).map(r => r.position!)
      );

      const totalImpressions = records.reduce((sum, r) => sum + r.impressions, 0);
      const totalClicks = records.reduce((sum, r) => sum + r.clicks, 0);
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      const positionChange = avgOlderPosition - avgRecentPosition;

      trends.push({
        keyword,
        averagePosition: avgRecentPosition,
        positionChange,
        totalImpressions,
        totalClicks,
        averageCTR: avgCTR,
        trajectory: positionChange > 2 ? 'rising' : positionChange < -2 ? 'falling' : 'stable',
        potential: this.assessPotential(avgRecentPosition, totalImpressions, avgCTR),
      });
    }

    return trends.sort((a, b) => a.averagePosition - b.averagePosition);
  }

  private avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  private assessPotential(position: number, impressions: number, ctr: number): 'high' | 'medium' | 'low' {
    let score = 0;

    if (position > 0 && position <= 20) score += 2;
    else if (position > 20 && position <= 50) score += 1;

    if (impressions > 1000) score += 2;
    else if (impressions > 100) score += 1;

    if (ctr > 5) score += 2;
    else if (ctr > 2) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  async generateOptimizationSuggestions(
    video: Video,
    keywordHistory: SEOHistory[]
  ): Promise<SEOOptimizationSuggestion[]> {
    const suggestions: SEOOptimizationSuggestion[] = [];

    const titleWords = video.title.toLowerCase().split(/\s+/);
    const topKeywords = keywordHistory
      .filter(h => h.average_position && h.average_position <= 20)
      .slice(0, 5);

    for (const kw of topKeywords) {
      const keywordWords = kw.keyword.toLowerCase().split(/\s+/);
      const matchedWords = keywordWords.filter(w => titleWords.includes(w));

      if (matchedWords.length < keywordWords.length * 0.5) {
        suggestions.push({
          type: 'title',
          priority: 'high',
          issue: `Missing keyword "${kw.keyword}" in title`,
          suggestion: `Consider adding "${kw.keyword}" to your title for better SEO`,
          expectedImpact: `Potential CTR increase of ${Math.round((kw.ctr || 2) * 1.2)}%`,
        });
      }
    }

    if (video.description && video.description.length < 100) {
      suggestions.push({
        type: 'description',
        priority: 'medium',
        issue: 'Description is too short',
        suggestion: 'Expand description to at least 200 characters with relevant keywords',
        expectedImpact: 'Improved search visibility',
      });
    }

    if (video.tags.length < 5) {
      suggestions.push({
        type: 'tags',
        priority: 'medium',
        issue: 'Too few tags',
        suggestion: 'Add more tags including related keywords and variations',
        expectedImpact: 'Better discoverability',
      });
    }

    if (!this.aiClient) await this.initialize();

    try {
      const aiSuggestions = await this.getAIOptimizations(video, keywordHistory);
      suggestions.push(...aiSuggestions);
    } catch {
      // AI suggestions are optional
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async getAIOptimizations(
    video: Video,
    history: SEOHistory[]
  ): Promise<SEOOptimizationSuggestion[]> {
    if (!this.aiClient) return [];

    const topKeywords = history
      .filter(h => h.average_position && h.average_position <= 30)
      .map(h => h.keyword)
      .slice(0, 5);

    const prompt = `Analyze this video for SEO optimization:
Title: ${video.title}
Description: ${video.description || 'None'}
Tags: ${video.tags.join(', ')}
Top ranking keywords: ${topKeywords.join(', ')}

Suggest 2-3 specific SEO improvements. Format each as:
priority|type|issue|suggestion|expectedImpact`;

    try {
      const response = await this.aiClient.generate(prompt, undefined, { temperature: 0.5, maxTokens: 500 });
      const suggestions: SEOOptimizationSuggestion[] = [];

      for (const line of response.content.split('\n')) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          suggestions.push({
            priority: parts[0].trim() as 'high' | 'medium' | 'low',
            type: parts[1].trim() as SEOOptimizationSuggestion['type'],
            issue: parts[2].trim(),
            suggestion: parts[3].trim(),
            expectedImpact: parts[4].trim(),
          });
        }
      }

      return suggestions;
    } catch {
      return [];
    }
  }

  async calculateSEOScore(
    video: Video,
    keywordHistory: SEOHistory[]
  ): Promise<SEOScoreBreakdown> {
    let keywordRelevance = 0;
    let clickThroughRate = 0;
    let impressions = 0;
    let position = 0;
    let trend = 0;

    const relevantHistory = keywordHistory.filter(h => h.video_id === video.id);

    if (relevantHistory.length > 0) {
      const latest = relevantHistory[0];

      keywordRelevance = Math.min(100, (100 - (latest.average_position || 100)));
      clickThroughRate = Math.min(100, (latest.ctr || 0) * 10);
      impressions = Math.min(100, Math.log10(latest.impressions + 1) * 20);
      position = Math.min(100, 100 - ((latest.position || 100)));

      if (relevantHistory.length > 1) {
        const previous = relevantHistory[1];
        const positionImprovement = (previous.position || 100) - (latest.position || 100);
        trend = Math.min(100, Math.max(0, 50 + positionImprovement * 5));
      } else {
        trend = 50;
      }
    }

    const overall = Math.round((keywordRelevance * 0.3 + clickThroughRate * 0.25 +
      impressions * 0.15 + position * 0.2 + trend * 0.1));

    return {
      overall,
      keywordRelevance: Math.round(keywordRelevance),
      clickThroughRate: Math.round(clickThroughRate),
      impressions: Math.round(impressions),
      position: Math.round(position),
      trend: Math.round(trend),
    };
  }

  private async fetchCachedHistory(keyword?: string): Promise<SEOHistory[]> {
    const cacheKey = keyword || 'all';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const data = await getSEOHistory(undefined, 180);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const seoAnalyzer = new SEOAnalyzer();
