/**
 * Competitor Intelligence Agent - Analyzes Competitor Channels
 *
 * Features:
 * - Competitor channel tracking
 * - Content pattern detection
 * - Growth trend analysis
 * - Strength/weakness identification
 * - Content gap detection
 * - Opportunity area suggestions
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { learningEngine } from './learning-engine';
import {
  getCompetitors,
  addCompetitor,
  removeCompetitor,
  updateAgentState,
} from './extended-api';
import type { CompetitorIntelligence } from '../../types';

interface CompetitorProfile {
  channelId: string;
  title: string;
  thumbnail: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  niche: string | null;
}

interface ContentPattern {
  type: string;
  frequency: number;
  avgPerformance: number;
  examples: string[];
}

interface CompetitorAnalysis {
  profile: CompetitorProfile;
  contentPatterns: ContentPattern[];
  uploadFrequency: string;
  avgPerformance: number;
  growthTrend: 'growing' | 'stable' | 'declining';
  strengths: string[];
  weaknesses: string[];
  contentGaps: string[];
  opportunityAreas: string[];
  recommendations: string[];
}

interface CompetitorComparison {
  yourChannel: {
    subscribers: number;
    avgViews: number;
    uploadFrequency: string;
  };
  competitor: CompetitorProfile;
  advantages: string[];
  disadvantages: string[];
  actionItems: string[];
}

export class CompetitorIntel {
  private aiClient: IntelligenceCore | null = null;
  private agentName = 'Competitor Intel';

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await updateAgentState(this.agentName, 'competitor_intel', {
      status: 'idle',
    });
  }

  async trackCompetitor(profile: CompetitorProfile): Promise<CompetitorIntelligence> {
    await this.setAgentStatus('analyzing', `Analyzing competitor: ${profile.title}`);

    const analysis = await this.analyzeCompetitor(profile);

    const saved = await addCompetitor({
      competitor_channel_id: profile.channelId,
      competitor_title: profile.title,
      competitor_thumbnail: profile.thumbnail,
      competitor_subscribers: profile.subscribers,
      competitor_views: profile.totalViews,
      competitor_video_count: profile.videoCount,
      niche: profile.niche,
      content_patterns: analysis.contentPatterns,
      upload_frequency: analysis.uploadFrequency,
      avg_video_performance: analysis.avgPerformance,
      growth_trend: analysis.growthTrend,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      content_gaps: analysis.contentGaps,
      opportunity_areas: analysis.opportunityAreas,
    });

    await this.setAgentStatus('idle');
    return saved;
  }

  async analyzeCompetitor(profile: CompetitorProfile): Promise<CompetitorAnalysis> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        this.buildAnalysisPrompt(profile),
        'You are a YouTube competitor analyst. Provide strategic insights about competitor channels.',
        { temperature: 0.5, maxTokens: 600 }
      );

      return this.parseAnalysisResponse(response.content, profile);
    } catch {
      return this.getDefaultAnalysis(profile);
    }
  }

  private buildAnalysisPrompt(profile: CompetitorProfile): string {
    return `Analyze this YouTube competitor channel:
- Title: ${profile.title}
- Subscribers: ${profile.subscribers.toLocaleString()}
- Total Views: ${profile.totalViews.toLocaleString()}
- Video Count: ${profile.videoCount}
- Niche: ${profile.niche || 'Unknown'}

Provide analysis on:
1. Content patterns (what types of content do they post?)
2. Upload frequency estimate
3. Average video performance estimate
4. Growth trend (growing/stable/declining)
5. 3-5 strengths
6. 3-5 weaknesses
7. 3-5 content gaps (what are they missing?)
8. 3-5 opportunity areas for us

Format:
PATTERNS: [pattern1] | [pattern2]
FREQUENCY: [estimate]
AVG_PERFORMANCE: [number]
GROWTH: [growing/stable/declining]
STRENGTHS: [strength1] | [strength2]
WEAKNESSES: [weakness1] | [weakness2]
GAPS: [gap1] | [gap2]
OPPORTUNITIES: [opp1] | [opp2]`;
  }

  private parseAnalysisResponse(content: string, profile: CompetitorProfile): CompetitorAnalysis {
    const lines = content.split('\n');
    const result: CompetitorAnalysis = {
      profile,
      contentPatterns: [],
      uploadFrequency: 'unknown',
      avgPerformance: 0,
      growthTrend: 'stable',
      strengths: [],
      weaknesses: [],
      contentGaps: [],
      opportunityAreas: [],
      recommendations: [],
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('PATTERNS:')) {
        const patterns = trimmed.replace('PATTERNS:', '').split('|').map(p => p.trim());
        result.contentPatterns = patterns.map(p => ({
          type: p,
          frequency: 50,
          avgPerformance: 50,
          examples: [],
        }));
      } else if (trimmed.startsWith('FREQUENCY:')) {
        result.uploadFrequency = trimmed.replace('FREQUENCY:', '').trim();
      } else if (trimmed.startsWith('AVG_PERFORMANCE:')) {
        result.avgPerformance = parseInt(trimmed.replace('AVG_PERFORMANCE:', '').trim()) || 50;
      } else if (trimmed.startsWith('GROWTH:')) {
        const trend = trimmed.replace('GROWTH:', '').trim().toLowerCase();
        result.growthTrend = trend === 'growing' || trend === 'declining' ? trend : 'stable';
      } else if (trimmed.startsWith('STRENGTHS:')) {
        result.strengths = trimmed.replace('STRENGTHS:', '').split('|').map(s => s.trim());
      } else if (trimmed.startsWith('WEAKNESSES:')) {
        result.weaknesses = trimmed.replace('WEAKNESSES:', '').split('|').map(w => w.trim());
      } else if (trimmed.startsWith('GAPS:')) {
        result.contentGaps = trimmed.replace('GAPS:', '').split('|').map(g => g.trim());
      } else if (trimmed.startsWith('OPPORTUNITIES:')) {
        result.opportunityAreas = trimmed.replace('OPPORTUNITIES:', '').split('|').map(o => o.trim());
      }
    }

    result.recommendations = this.generateRecommendations(result);
    return result;
  }

  private getDefaultAnalysis(profile: CompetitorProfile): CompetitorAnalysis {
    return {
      profile,
      contentPatterns: [{ type: 'Standard content', frequency: 50, avgPerformance: 50, examples: [] }],
      uploadFrequency: 'unknown',
      avgPerformance: profile.videoCount > 0 ? profile.totalViews / profile.videoCount : 0,
      growthTrend: 'stable',
      strengths: ['Established channel'],
      weaknesses: [],
      contentGaps: ['Niche-specific content opportunities'],
      opportunityAreas: ['Create unique content they don\'t have'],
      recommendations: ['Monitor competitor for more insights'],
    };
  }

  private generateRecommendations(analysis: CompetitorAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.weaknesses.length > 0) {
      recommendations.push(`Address their weakness: ${analysis.weaknesses[0]}`);
    }

    if (analysis.contentGaps.length > 0) {
      recommendations.push(`Fill content gap: ${analysis.contentGaps[0]}`);
    }

    if (analysis.opportunityAreas.length > 0) {
      recommendations.push(`Pursue opportunity: ${analysis.opportunityAreas[0]}`);
    }

    if (analysis.growthTrend === 'declining') {
      recommendations.push('Competitor is declining - opportunity to capture audience');
    }

    return recommendations.slice(0, 5);
  }

  async getTrackedCompetitors(limit = 20): Promise<CompetitorIntelligence[]> {
    return getCompetitors(limit);
  }

  async stopTrackingCompetitor(competitorId: string): Promise<void> {
    await removeCompetitor(competitorId);
  }

  async compareWithCompetitor(
    yourStats: { subscribers: number; avgViews: number; uploadFrequency: string },
    competitorId: string
  ): Promise<CompetitorComparison> {
    await this.setAgentStatus('analyzing', 'Comparing with competitor');

    const competitors = await getCompetitors(50);
    const competitor = competitors.find(c => c.id === competitorId);

    if (!competitor) {
      await this.setAgentStatus('error', null, 'Competitor not found');
      throw new Error('Competitor not found');
    }

    const comparison: CompetitorComparison = {
      yourChannel: yourStats,
      competitor: {
        channelId: competitor.competitor_channel_id,
        title: competitor.competitor_title,
        thumbnail: competitor.competitor_thumbnail,
        subscribers: competitor.competitor_subscribers,
        totalViews: competitor.competitor_views,
        videoCount: competitor.competitor_video_count,
        niche: competitor.niche,
      },
      advantages: [],
      disadvantages: [],
      actionItems: [],
    };

    if (yourStats.uploadFrequency === 'daily' && competitor.upload_frequency !== 'daily') {
      comparison.advantages.push('Higher upload frequency');
    } else if (yourStats.uploadFrequency !== 'daily' && competitor.upload_frequency === 'daily') {
      comparison.disadvantages.push('Lower upload frequency');
    }

    if (yourStats.avgViews > (competitor.avg_video_performance || 0)) {
      comparison.advantages.push('Higher average video performance');
    } else {
      comparison.disadvantages.push('Lower average video performance');
    }

    if (competitor.content_gaps && competitor.content_gaps.length > 0) {
      comparison.actionItems.push(`Create content on: ${competitor.content_gaps.slice(0, 2).join(', ')}`);
    }

    if (competitor.opportunity_areas && competitor.opportunity_areas.length > 0) {
      comparison.actionItems.push(`Pursue: ${competitor.opportunity_areas[0]}`);
    }

    await this.setAgentStatus('idle');
    return comparison;
  }

  async getCompetitiveAdvantages(niche?: string): Promise<{
    advantages: string[];
    competitorWeaknesses: Map<string, string[]>;
    gapsToFill: string[];
  }> {
    const competitors = await getCompetitors(50);
    const advantages: string[] = [];
    const competitorWeaknesses = new Map<string, string[]>();
    const gapsToFill: string[] = [];

    for (const competitor of competitors) {
      if (niche && competitor.niche !== niche) continue;

      if (competitor.weaknesses && competitor.weaknesses.length > 0) {
        competitorWeaknesses.set(competitor.competitor_title, competitor.weaknesses);
      }

      if (competitor.content_gaps) {
        gapsToFill.push(...competitor.content_gaps);
      }
    }

    const uniqueGaps = [...new Set(gapsToFill)];

    if (competitorWeaknesses.size > 0) {
      advantages.push('Multiple competitors have weaknesses you can exploit');
    }

    if (uniqueGaps.length > 0) {
      advantages.push(`Content gaps available: ${uniqueGaps.length} topics`);
    }

    return {
      advantages,
      competitorWeaknesses,
      gapsToFill: uniqueGaps,
    };
  }

  async generateCompetitiveStrategy(niche: string): Promise<{
    strategy: string;
    focusAreas: string[];
    differentiationPoints: string[];
    timeline: string;
  }> {
    if (!this.aiClient) await this.initialize();

    const competitors = await getCompetitors(10);
    const allWeaknesses = competitors.flatMap(c => c.weaknesses || []);
    const allGaps = competitors.flatMap(c => c.content_gaps || []);

    try {
      const response = await this.aiClient!.generate(
        `Based on:
- Competitor weaknesses: ${allWeaknesses.slice(0, 5).join(', ') || 'None identified'}
- Content gaps: ${allGaps.slice(0, 5).join(', ') || 'None identified'}
- Niche: ${niche}

Generate a competitive strategy with:
1. Overall strategy statement
2. 3 focus areas
3. 3 differentiation points
4. Suggested timeline

Format:
STRATEGY: [overall strategy]
FOCUS: [area1] | [area2] | [area3]
DIFFERENTIATION: [point1] | [point2] | [point3]
TIMELINE: [suggested timeline]`,
        'You are a competitive strategy expert for YouTube creators.',
        { temperature: 0.6, maxTokens: 300 }
      );

      return this.parseStrategyResponse(response.content);
    } catch {
      return {
        strategy: 'Focus on content gaps and exploit competitor weaknesses',
        focusAreas: allGaps.slice(0, 3),
        differentiationPoints: ['Unique perspective', 'Higher quality', 'Better engagement'],
        timeline: '3-6 months',
      };
    }
  }

  private parseStrategyResponse(content: string): {
    strategy: string;
    focusAreas: string[];
    differentiationPoints: string[];
    timeline: string;
  } {
    const lines = content.split('\n');
    const result = {
      strategy: '',
      focusAreas: [],
      differentiationPoints: [],
      timeline: '',
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('STRATEGY:')) {
        result.strategy = trimmed.replace('STRATEGY:', '').trim();
      } else if (trimmed.startsWith('FOCUS:')) {
        result.focusAreas = trimmed.replace('FOCUS:', '').split('|').map(f => f.trim());
      } else if (trimmed.startsWith('DIFFERENTIATION:')) {
        result.differentiationPoints = trimmed.replace('DIFFERENTIATION:', '').split('|').map(d => d.trim());
      } else if (trimmed.startsWith('TIMELINE:')) {
        result.timeline = trimmed.replace('TIMELINE:', '').trim();
      }
    }

    return result;
  }

  private async setAgentStatus(
    status: 'idle' | 'analyzing' | 'error',
    currentTask?: string | null,
    error?: string | null
  ): Promise<void> {
    await updateAgentState(this.agentName, 'competitor_intel', {
      status,
      currentTask,
      lastError: error,
    });
  }
}

export const competitorIntel = new CompetitorIntel();
