/**
 * Trend Research Agent - Detects Trending Topics and Rising Opportunities
 *
 * Features:
 * - Platform trend detection
 * - Rising opportunity identification
 * - Trend velocity analysis
 * - Opportunity scoring
 * - Content angle suggestions
 * - Competition level assessment
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { learningEngine } from './learning-engine';
import {
  getTrends,
  createTrend,
  actionTrend,
  updateAgentState,
} from './extended-api';
import type { TrendIntelligence, DetectedTrend } from '../../lib/database';

interface TrendAnalysis {
  topic: string;
  velocity: number;
  volume: number;
  growthRate: number;
  opportunityScore: number;
  competitionLevel: 'low' | 'medium' | 'high';
  suggestedAngles: string[];
  relatedKeywords: string[];
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'general';
  peakTime: string | null;
  expiresAt: string | null;
}

interface TrendSearchResult {
  trends: TrendAnalysis[];
  analysisTimestamp: string;
  source: string;
}

interface OpportunityMatch {
  trend: TrendIntelligence;
  fit: number;
  reasoning: string;
  suggestedContent: string;
}

export class TrendResearch {
  private aiClient: IntelligenceCore | null = null;
  private agentName = 'Trend Research';

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await updateAgentState(this.agentName, 'trend_research', {
      status: 'idle',
    });
  }

  async discoverTrends(
    niche?: string,
    platforms: string[] = ['youtube', 'tiktok', 'instagram']
  ): Promise<TrendSearchResult> {
    await this.setAgentStatus('researching', 'Scanning for trending topics');

    if (!this.aiClient) await this.initialize();

    try {
      const prompt = this.buildDiscoveryPrompt(niche, platforms);
      const response = await this.aiClient!.generate(
        prompt,
        'You are a trend research specialist. Identify current trending topics with opportunity scoring.',
        { temperature: 0.6, maxTokens: 800 }
      );

      const trends = this.parseTrendResponse(response.content, platforms);
      await this.setAgentStatus('idle');

      return {
        trends,
        analysisTimestamp: new Date().toISOString(),
        source: 'ai_analysis',
      };
    } catch (error) {
      await this.setAgentStatus('error', null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private buildDiscoveryPrompt(niche?: string, platforms?: string[]): string {
    const parts: string[] = ['Identify trending content opportunities for YouTube creators.'];

    if (niche) {
      parts.push(`Focus on the "${niche}" niche.`);
    }

    parts.push('\nFor each trend, provide:');
    parts.push('- Topic name');
    parts.push('- Velocity (0-100, how fast it\'s growing)');
    parts.push('- Volume (estimated searches/interest, 0-100)');
    parts.push('- Growth rate percentage');
    parts.push('- Competition level (low/medium/high)');
    parts.push('- 2-3 content angle suggestions');
    parts.push('- Related keywords');
    parts.push('- Platform where trending');

    parts.push('\nFormat each trend as:');
    parts.push('TREND: [topic]');
    parts.push('VELOCITY: [number]');
    parts.push('VOLUME: [number]');
    parts.push('GROWTH: [percentage]%');
    parts.push('COMPETITION: [level]');
    parts.push('ANGLES: [angle1] | [angle2]');
    parts.push('KEYWORDS: [keyword1], [keyword2]');
    parts.push('PLATFORM: [platform]');

    return parts.join('\n');
  }

  private parseTrendResponse(content: string, platforms: string[]): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];
    const lines = content.split('\n');

    let currentTrend: Partial<TrendAnalysis> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('TREND:')) {
        if (currentTrend && currentTrend.topic) {
          trends.push(this.completeTrend(currentTrend));
        }
        currentTrend = { topic: trimmed.replace('TREND:', '').trim() };
      } else if (currentTrend) {
        if (trimmed.startsWith('VELOCITY:')) {
          currentTrend.velocity = parseInt(trimmed.replace('VELOCITY:', '').trim()) || 50;
        } else if (trimmed.startsWith('VOLUME:')) {
          currentTrend.volume = parseInt(trimmed.replace('VOLUME:', '').trim()) || 50;
        } else if (trimmed.startsWith('GROWTH:')) {
          const growthStr = trimmed.replace('GROWTH:', '').replace('%', '').trim();
          currentTrend.growthRate = parseFloat(growthStr) || 0;
        } else if (trimmed.startsWith('COMPETITION:')) {
          const level = trimmed.replace('COMPETITION:', '').trim().toLowerCase();
          currentTrend.competitionLevel = level === 'high' || level === 'medium' || level === 'low'
            ? level
            : 'medium';
        } else if (trimmed.startsWith('ANGLES:')) {
          currentTrend.suggestedAngles = trimmed.replace('ANGLES:', '').trim().split('|').map(a => a.trim());
        } else if (trimmed.startsWith('KEYWORDS:')) {
          currentTrend.relatedKeywords = trimmed.replace('KEYWORDS:', '').trim().split(',').map(k => k.trim());
        } else if (trimmed.startsWith('PLATFORM:')) {
          const platform = trimmed.replace('PLATFORM:', '').trim().toLowerCase();
          currentTrend.platform = platforms.includes(platform) ? platform as any : 'general';
        }
      }
    }

    if (currentTrend && currentTrend.topic) {
      trends.push(this.completeTrend(currentTrend));
    }

    return trends;
  }

  private completeTrend(partial: Partial<TrendAnalysis>): TrendAnalysis {
    return {
      topic: partial.topic || 'Unknown',
      velocity: partial.velocity || 50,
      volume: partial.volume || 50,
      growthRate: partial.growthRate || 0,
      opportunityScore: this.calculateOpportunityScore(partial),
      competitionLevel: partial.competitionLevel || 'medium',
      suggestedAngles: partial.suggestedAngles || [],
      relatedKeywords: partial.relatedKeywords || [],
      platform: partial.platform || 'youtube',
      peakTime: null,
      expiresAt: null,
    };
  }

  private calculateOpportunityScore(trend: Partial<TrendAnalysis>): number {
    let score = 50;

    if (trend.velocity) {
      score += (trend.velocity / 100) * 25;
    }

    if (trend.growthRate) {
      score += Math.min(15, trend.growthRate / 5);
    }

    if (trend.competitionLevel === 'low') {
      score += 15;
    } else if (trend.competitionLevel === 'medium') {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  async saveTrend(trend: TrendAnalysis): Promise<TrendIntelligence> {
    return createTrend({
      topic: trend.topic,
      category: 'discovered',
      trend_type: trend.growthRate > 50 ? 'emerging' : trend.growthRate > 20 ? 'rising' : 'stable',
      platform: trend.platform,
      velocity: trend.velocity,
      volume: trend.volume,
      growth_rate: trend.growthRate,
      peak_time: trend.peakTime,
      related_keywords: trend.relatedKeywords,
      suggested_angles: trend.suggestedAngles,
      competition_level: trend.competitionLevel,
      opportunity_score: trend.opportunityScore,
      expires_at: trend.expiresAt,
    });
  }

  async getStoredTrends(limit = 20, trendType?: string): Promise<TrendIntelligence[]> {
    return getTrends(limit, trendType);
  }

  async markTrendActioned(trendId: string): Promise<void> {
    await actionTrend(trendId);
  }

  async findOpportunities(
    niche: string,
    minOpportunityScore = 60,
    maxCompetition: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<OpportunityMatch[]> {
    await this.setAgentStatus('analyzing', 'Finding trend opportunities');

    const trends = await getTrends(50);
    const competitionLevels = ['low'];
    if (maxCompetition === 'medium' || maxCompetition === 'high') competitionLevels.push('medium');
    if (maxCompetition === 'high') competitionLevels.push('high');

    const filtered = trends.filter(t =>
      t.opportunity_score >= minOpportunityScore &&
      competitionLevels.includes(t.competition_level || 'medium') &&
      !t.is_actioned
    );

    const matches: OpportunityMatch[] = [];

    for (const trend of filtered) {
      const fit = this.calculateNicheFit(trend, niche);
      if (fit >= 0.4) {
        matches.push({
          trend,
          fit,
          reasoning: this.generateFitReasoning(trend, fit),
          suggestedContent: trend.suggested_angles?.[0] || `Create content about ${trend.topic}`,
        });
      }
    }

    await this.setAgentStatus('idle');
    return matches.sort((a, b) => b.fit - a.fit).slice(0, 10);
  }

  private calculateNicheFit(trend: TrendIntelligence, niche: string): number {
    const nicheLower = niche.toLowerCase();
    const topicLower = trend.topic.toLowerCase();

    if (topicLower.includes(nicheLower) || nicheLower.includes(topicLower)) {
      return 0.9;
    }

    const keywords = trend.related_keywords || [];
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(nicheLower) || nicheLower.includes(kw.toLowerCase())) {
        return 0.75;
      }
    }

    return 0.3;
  }

  private generateFitReasoning(trend: TrendIntelligence, fit: number): string {
    const parts: string[] = [];

    if (fit >= 0.8) {
      parts.push('Direct topic match');
    } else if (fit >= 0.6) {
      parts.push('Strong keyword overlap');
    } else {
      parts.push('Related topic opportunity');
    }

    parts.push(`${trend.opportunity_score}% opportunity score`);

    if (trend.competition_level === 'low') {
      parts.push('low competition');
    }

    return parts.join(' with ');
  }

  async analyzeTrendTrajectory(trendId: string): Promise<{
    trend: TrendIntelligence;
    trajectory: 'rising' | 'peaking' | 'declining';
    recommendation: string;
  }> {
    const trends = await getTrends(100);
    const trend = trends.find(t => t.id === trendId);

    if (!trend) {
      throw new Error('Trend not found');
    }

    let trajectory: 'rising' | 'peaking' | 'declining' = 'rising';
    let recommendation = '';

    if (trend.growth_rate > 30) {
      trajectory = 'rising';
      recommendation = 'Act quickly - trend is gaining momentum';
    } else if (trend.growth_rate > 10 && trend.growth_rate <= 30) {
      trajectory = 'rising';
      recommendation = 'Good time to create content - steady growth';
    } else if (trend.growth_rate >= -10 && trend.growth_rate <= 10) {
      trajectory = 'peaking';
      recommendation = 'Trend may be peaking - consider unique angles';
    } else {
      trajectory = 'declining';
      recommendation = 'Trend is fading - consider if still relevant to audience';
    }

    return { trend, trajectory, recommendation };
  }

  async generateContentIdeas(topic: string, count = 5): Promise<string[]> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        `Generate ${count} unique YouTube video ideas for the topic "${topic}".
Each idea should be:
- Engaging and click-worthy
- Optimized for YouTube algorithm
- Different from typical content on this topic

List each idea on a new line.`,
        'You are a YouTube content strategist.',
        { temperature: 0.8, maxTokens: 300 }
      );

      return response.content.split('\n').filter(line => line.trim().length > 0).slice(0, count);
    } catch {
      return [`Create a beginner's guide to ${topic}`, `Top 10 ${topic} tips`, `${topic}: What they don't tell you`];
    }
  }

  private async setAgentStatus(
    status: 'idle' | 'researching' | 'analyzing' | 'error',
    currentTask?: string | null,
    error?: string | null
  ): Promise<void> {
    await updateAgentState(this.agentName, 'trend_research', {
      status,
      currentTask,
      lastError: error,
    });
  }
}

export const trendResearch = new TrendResearch();
