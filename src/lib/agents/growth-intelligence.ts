/**
 * Growth Intelligence Hub - Predictions, Insights & Recommendations
 *
 * Features:
 * - AI-powered growth analysis
 * - Trend detection and predictions
 * - Actionable recommendations
 * - Content opportunity identification
 * - Anomaly alerts
 * - Custom insights based on user patterns
 */

import {
  getGrowthInsights, createGrowthInsight, markInsightActioned,
  getMemories,
} from './api';
import type { GrowthIntelligence, Video, YouTubeChannel } from '../../lib/database';
import { IntelligenceCore, getAIClient } from './intelligence-core';
import { channelIntelligence } from './channel-history';
import { seoAnalyzer } from './seo-analyzer';

interface GrowthOpportunity {
  type: 'content_gap' | 'trending_topic' | 'keyword_opportunity' | 'timing_optimization';
  title: string;
  description: string;
  potential: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  expectedROI: number;
  actionItems: string[];
}

interface ContentRecommendation {
  title: string;
  format: 'video' | 'short' | 'series';
  topics: string[];
  keywords: string[];
  targetAudience: string;
  estimatedViews: number;
  priority: number;
}

interface TimingInsight {
  dayOfWeek: string;
  hour: number;
  score: number;
  reasoning: string;
}

interface GrowthAnalysis {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: GrowthOpportunity[];
  recommendations: ContentRecommendation[];
  timing: TimingInsight[];
}

export class GrowthHub {
  private aiClient: IntelligenceCore | null = null;

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
  }

  async analyzeGrowth(channelId: string, videos: Video[]): Promise<GrowthAnalysis> {
    if (!this.aiClient) await this.initialize();

    const [channelHistory, benchmarks, existingInsights] = await Promise.all([
      channelIntelligence.getHistory(channelId, 30),
      channelIntelligence.getBenchmarks(channelId),
      this.getActiveInsights(),
    ]);

    const userPreferences = await this.getUserPreferences();

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: GrowthOpportunity[] = [];

    if (benchmarks.length > 0) {
      for (const b of benchmarks) {
        if (b.comparison === 'above') {
          strengths.push(`Strong ${b.metric.toLowerCase()} performance (${b.yourScore.toLocaleString()})`);
        } else if (b.comparison === 'below') {
          weaknesses.push(`${b.metric} below average (${b.percentile}th percentile)`);
        }
      }
    }

    const recentVideos = videos.slice(0, 10);
    if (recentVideos.length > 0) {
      const avgViralScore = this.average(recentVideos.filter(v => v.viral_score).map(v => v.viral_score!));
      if (avgViralScore > 75) {
        strengths.push('High viral potential content');
      } else if (avgViralScore < 50) {
        weaknesses.push('Content needs engagement optimization');
      }
    }

    if (channelHistory.length > 0) {
      const avgEngagement = this.average(channelHistory.map(h => h.engagement_rate || 0));
      if (avgEngagement > 10) {
        strengths.push('Strong audience engagement');
      } else if (avgEngagement < 3) {
        weaknesses.push('Low engagement rate - focus on call-to-actions');
      }
    }

    opportunities.push(...await this.identifyOpportunities(channelId, videos, userPreferences));

    const recommendations = await this.generateContentRecommendations(videos, userPreferences);
    const timing = await this.analyzeBestTiming(channelHistory);

    const overallScore = this.calculateOverallScore(strengths, weaknesses, opportunities);

    return {
      overallScore,
      strengths,
      weaknesses,
      opportunities,
      recommendations,
      timing,
    };
  }

  private average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  private async getUserPreferences(): Promise<Record<string, string>> {
    const preferences = await getMemories('preference');
    const result: Record<string, string> = {};
    for (const pref of preferences) {
      result[pref.key] = pref.value;
    }
    return result;
  }

  private async identifyOpportunities(
    channelId: string,
    videos: Video[],
    preferences: Record<string, string>
  ): Promise<GrowthOpportunity[]> {
    const opportunities: GrowthOpportunity[] = [];

    const uploadedVideos = videos.filter(v => v.status === 'uploaded');
    const uploadedIds = new Set(uploadedVideos.map(v => v.id));
    const draftVideos = videos.filter(v => v.status === 'draft');

    if (uploadedVideos.length > 10 && draftVideos.length < 3) {
      opportunities.push({
        type: 'content_gap',
        title: 'Low content pipeline',
        description: 'You have fewer than 3 videos in draft. Build a content reserve.',
        potential: 'high',
        effort: 'medium',
        expectedROI: 25,
        actionItems: ['Create 3-5 video drafts', 'Schedule content calendar', 'Batch produce content'],
      });
    }

    const shortsCount = videos.filter(v => v.is_short).length;
    const regularCount = videos.length - shortsCount;
    if (regularCount > 10 && shortsCount < regularCount * 0.5) {
      opportunities.push({
        type: 'trending_topic',
        title: 'Expand Shorts content',
        description: 'Shorts are underutilized. They can drive significant discovery.',
        potential: 'high',
        effort: 'low',
        expectedROI: 40,
        actionItems: ['Replicate top videos as Shorts', 'Add Shorts to content plan', 'Try trending sounds/formats'],
      });
    }

    const seoHistory = await seoAnalyzer.analyzeKeywordTrends();
    const highPotentialKeywords = seoHistory.filter(k => k.potential === 'high').slice(0, 3);

    if (highPotentialKeywords.length > 0) {
      opportunities.push({
        type: 'keyword_opportunity',
        title: 'Untapped keyword potential',
        description: `Keywords: ${highPotentialKeywords.map(k => k.keyword).join(', ')} have high growth potential`,
        potential: 'high',
        effort: 'medium',
        expectedROI: 35,
        actionItems: [
          'Create content targeting these keywords',
          'Optimize existing video descriptions',
          'Include keywords in tags',
        ],
      });
    }

    opportunities.push({
      type: 'timing_optimization',
      title: 'Optimize posting schedule',
      description: 'Posting at optimal times can increase initial views by 20-30%',
      potential: 'medium',
      effort: 'low',
      expectedROI: 20,
      actionItems: ['Analyze audience activity', 'Test different posting times', 'Use scheduling features'],
    });

    return opportunities.slice(0, 5);
  }

  private async generateContentRecommendations(
    videos: Video[],
    preferences: Record<string, string>
  ): Promise<ContentRecommendation[]> {
    if (!this.aiClient) await this.initialize();

    const recommendations: ContentRecommendation[] = [];
    const recentTitles = videos.slice(0, 5).map(v => v.title).join(', ');
    const niche = preferences['channel_niche'] || 'general';

    try {
      const response = await this.aiClient!.generate(
        `Based on these recent videos: "${recentTitles}"
And this niche: "${niche}"

Suggest 3 content ideas. Format each as:
title|format|topics|keywords|targetAudience|estimatedViews|priority

Keep it concise and actionable.`,
        'You are a YouTube content strategist. Provide data-driven recommendations.',
        { temperature: 0.7, maxTokens: 400 }
      );

      for (const line of response.content.split('\n')) {
        const parts = line.split('|');
        if (parts.length >= 7) {
          recommendations.push({
            title: parts[0].trim(),
            format: parts[1].trim() as 'video' | 'short' | 'series',
            topics: parts[2].split(',').map(t => t.trim()),
            keywords: parts[3].split(',').map(k => k.trim()),
            targetAudience: parts[4].trim(),
            estimatedViews: parseInt(parts[5]) || 1000,
            priority: parseInt(parts[6]) || 5,
          });
        }
      }
    } catch {
      // Fallback recommendations
      recommendations.push({
        title: 'Create content based on trending topics',
        format: 'video',
        topics: [niche],
        keywords: [niche, 'tutorial', 'guide'],
        targetAudience: 'Your existing subscribers',
        estimatedViews: 1000,
        priority: 5,
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private async analyzeBestTiming(channelHistory: import('../../types').ChannelHistory[]): Promise<TimingInsight[]> {
    const timingInsights: TimingInsight[] = [];

    const dayScores: Record<number, number[]> = {};
    const hourScores: Record<number, number[]> = {};

    for (const record of channelHistory) {
      const date = new Date(record.snapshot_date);
      const day = date.getDay();
      const hour = date.getHours();

      const growth = record.subscriber_change || 0;

      if (!dayScores[day]) dayScores[day] = [];
      dayScores[day].push(growth);

      if (!hourScores[hour]) hourScores[hour] = [];
      hourScores[hour].push(growth);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const [day, scores] of Object.entries(dayScores)) {
      const avg = this.average(scores);
      timingInsights.push({
        dayOfWeek: dayNames[parseInt(day)],
        hour: 12,
        score: Math.round(Math.max(0, Math.min(100, 50 + avg))),
        reasoning: avg > 0 ? 'Above average growth' : 'Below average growth',
      });
    }

    for (const [hour, scores] of Object.entries(hourScores)) {
      const avg = this.average(scores);
      timingInsights.push({
        dayOfWeek: 'Any',
        hour: parseInt(hour),
        score: Math.round(Math.max(0, Math.min(100, 50 + avg))),
        reasoning: avg > 0 ? 'Peak engagement hour' : 'Lower engagement',
      });
    }

    return timingInsights.slice(0, 7);
  }

  private calculateOverallScore(
    strengths: string[],
    weaknesses: string[],
    opportunities: GrowthOpportunity[]
  ): number {
    let score = 50;

    score += strengths.length * 8;
    score -= weaknesses.length * 10;

    const highOpportunities = opportunities.filter(o => o.potential === 'high').length;
    score += highOpportunities * 5;

    return Math.max(0, Math.min(100, score));
  }

  async createInsight(
    channelId: string,
    insightType: GrowthIntelligence['insight_type'],
    category: string,
    title: string,
    description: string,
    options?: {
      currentValue?: number;
      predictedValue?: number;
      confidence?: number;
      timeFrame?: string;
      actionItems?: Record<string, unknown>[];
      priority?: number;
    }
  ): Promise<GrowthIntelligence> {
    return createGrowthInsight({
      channel_id: channelId,
      insight_type: insightType,
      category,
      title,
      description,
      metric_name: category.toLowerCase(),
      current_value: options?.currentValue || null,
      predicted_value: options?.predictedValue || null,
      confidence: options?.confidence || null,
      time_frame: options?.timeFrame || null,
      action_items: options?.actionItems || null,
      priority: options?.priority || 5,
    });
  }

  async getActiveInsights(insightType?: GrowthIntelligence['insight_type']): Promise<GrowthIntelligence[]> {
    return getGrowthInsights(insightType, 20);
  }

  async actionInsight(insightId: string): Promise<void> {
    await markInsightActioned(insightId);
  }

  async generateDailyReport(channelId: string, videos: Video[]): Promise<{
    summary: string;
    keyMetrics: Record<string, number>;
    alerts: string[];
    todaysActions: string[];
  }> {
    const analysis = await this.analyzeGrowth(channelId, videos);
    const predictions = await channelIntelligence.predictGrowth(channelId, 7);

    const keyMetrics: Record<string, number> = {
      growthScore: analysis.overallScore,
      opportunities: analysis.opportunities.length,
      recommendations: analysis.recommendations.length,
    };

    const prediction = predictions.find(p => p.metric === 'subscribers');
    if (prediction) {
      keyMetrics.predictedWeekGrowth = prediction.predictedValue - prediction.currentValue;
    }

    const alerts: string[] = [];

    if (analysis.weaknesses.length > 3) {
      alerts.push('Multiple areas need attention - review growth analysis');
    }

    for (const opp of analysis.opportunities.filter(o => o.potential === 'high')) {
      alerts.push(`High potential opportunity: ${opp.title}`);
    }

    const todaysActions = analysis.opportunities
      .slice(0, 3)
      .flatMap(o => o.actionItems.slice(0, 1));

    const summary = `Your channel has a growth score of ${analysis.overallScore}/100. ` +
      `${analysis.strengths.length} strengths identified, ${analysis.weaknesses.length} areas for improvement. ` +
      `${analysis.opportunities.length} growth opportunities available.`;

    return {
      summary,
      keyMetrics,
      alerts,
      todaysActions,
    };
  }
}

export const growthHub = new GrowthHub();
