/**
 * YouTube Intelligence Agent - Master Decision-Making Brain
 *
 * The central authority for all intelligence decisions:
 * - SEO approval authority
 * - Upload approval authority
 * - Thumbnail approval authority
 * - Shorts approval authority
 * - Growth recommendation authority
 * - Final decision arbitration
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { learningEngine } from './learning-engine';
import { seoAnalyzer } from './seo-analyzer';
import { channelIntelligence } from './channel-history';
import { growthHub } from './growth-intelligence';
import { copyrightMonitor } from './copyright-monitor';
import { smartQueue } from './smart-queue';
import {
  getPendingDecisions,
  createDecision,
  resolveDecision,
  getIntelligenceReport,
  getTrends,
  getCompetitors,
  getThumbnailAnalyses,
  getShortsJobs,
  updateAgentState,
} from './extended-api';
import type {
  Video,
  IntelligenceDecision,
  TrendIntelligence,
  CompetitorIntelligence,
  ThumbnailIntelligence,
  ShortsIntelligence,
} from '../../types';

interface ApprovalRequest {
  type: 'seo' | 'upload' | 'thumbnail' | 'shorts' | 'growth';
  itemId: string;
  context: Record<string, unknown>;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  autoApproveThreshold?: number;
}

interface ApprovalResult {
  approved: boolean;
  confidence: number;
  reasoning: string;
  suggestions?: string[];
  requiresUserDecision: boolean;
  decisionId?: string;
}

interface IntelligenceAssessment {
  overallScore: number;
  seoScore: number;
  viralPotential: number;
  copyrightRisk: number;
  timingScore: number;
  competitorAdvantage: number;
  recommendations: string[];
  warnings: string[];
}

interface MasterDecision {
  action: 'approve' | 'reject' | 'defer' | 'escalate';
  confidence: number;
  reasoning: string;
  conditions?: string[];
  alternatives?: string[];
}

export class YouTubeIntelligence {
  private aiClient: IntelligenceCore | null = null;
  private agentName = 'YouTube Intelligence';

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await updateAgentState(this.agentName, 'youtube_intelligence', {
      status: 'idle',
    });
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    await this.setAgentStatus('analyzing', `Reviewing ${request.type} approval request`);

    try {
      const assessment = await this.assessRequest(request);
      const threshold = request.autoApproveThreshold ?? 0.85;

      if (assessment.overallScore >= threshold && assessment.warnings.length === 0) {
        await this.setAgentStatus('idle');
        return {
          approved: true,
          confidence: assessment.overallScore,
          reasoning: 'Auto-approved based on high confidence and no warnings',
          suggestions: assessment.recommendations,
          requiresUserDecision: false,
        };
      }

      if (assessment.warnings.length > 0 && assessment.warnings.some(w => w.includes('copyright'))) {
        const decision = await this.createPendingDecision(request, assessment);
        await this.setAgentStatus('idle');
        return {
          approved: false,
          confidence: assessment.overallScore,
          reasoning: 'Requires user decision due to copyright concerns',
          suggestions: assessment.recommendations,
          requiresUserDecision: true,
          decisionId: decision.id,
        };
      }

      if (request.urgency === 'critical' && assessment.overallScore >= 0.7) {
        await this.setAgentStatus('idle');
        return {
          approved: true,
          confidence: assessment.overallScore,
          reasoning: 'Critical urgency with acceptable score',
          suggestions: assessment.recommendations,
          requiresUserDecision: false,
        };
      }

      const decision = await this.createPendingDecision(request, assessment);
      await this.setAgentStatus('idle');
      return {
        approved: false,
        confidence: assessment.overallScore,
        reasoning: `Score ${assessment.overallScore.toFixed(2)} below auto-approve threshold`,
        suggestions: assessment.recommendations,
        requiresUserDecision: true,
        decisionId: decision.id,
      };
    } catch (error) {
      await this.setAgentStatus('error', null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async assessRequest(request: ApprovalRequest): Promise<IntelligenceAssessment> {
    const scores = {
      seoScore: 0,
      viralPotential: 0,
      copyrightRisk: 0,
      timingScore: 0,
      competitorAdvantage: 0,
    };
    const recommendations: string[] = [];
    const warnings: string[] = [];

    switch (request.type) {
      case 'seo':
        const seoAnalysis = await this.assessSEO(request.context);
        scores.seoScore = seoAnalysis.score;
        scores.viralPotential = seoAnalysis.viralPotential;
        recommendations.push(...seoAnalysis.recommendations);
        break;

      case 'upload':
        const uploadAnalysis = await this.assessUpload(request.context);
        scores.timingScore = uploadAnalysis.timingScore;
        scores.copyrightRisk = uploadAnalysis.copyrightRisk;
        warnings.push(...uploadAnalysis.warnings);
        recommendations.push(...uploadAnalysis.recommendations);
        break;

      case 'thumbnail':
        const thumbnailAnalysis = await this.assessThumbnail(request.context);
        scores.viralPotential = thumbnailAnalysis.ctrPotential;
        scores.competitorAdvantage = thumbnailAnalysis.competitorAdvantage;
        recommendations.push(...thumbnailAnalysis.recommendations);
        break;

      case 'shorts':
        const shortsAnalysis = await this.assessShorts(request.context);
        scores.viralPotential = shortsAnalysis.viralPotential;
        scores.timingScore = shortsAnalysis.timingScore;
        recommendations.push(...shortsAnalysis.recommendations);
        break;

      case 'growth':
        const growthAnalysis = await this.assessGrowth(request.context);
        scores.viralPotential = growthAnalysis.potential;
        scores.competitorAdvantage = growthAnalysis.competitorAdvantage;
        recommendations.push(...growthAnalysis.recommendations);
        break;
    }

    const overallScore = this.calculateOverallScore(scores);

    return {
      overallScore,
      ...scores,
      recommendations,
      warnings,
    };
  }

  private async assessSEO(context: Record<string, unknown>): Promise<{
    score: number;
    viralPotential: number;
    recommendations: string[];
  }> {
    const title = context.title as string || '';
    const description = context.description as string || '';
    const tags = context.tags as string[] || [];

    if (!title && !description && tags.length === 0) {
      return { score: 0.5, viralPotential: 0.3, recommendations: ['Add metadata for better assessment'] };
    }

    let score = 0.5;
    const recommendations: string[] = [];

    if (title.length >= 30 && title.length <= 60) {
      score += 0.2;
    } else if (title.length > 0) {
      recommendations.push('Title length should be 30-60 characters for optimal visibility');
    }

    if (description.length >= 150) {
      score += 0.15;
    } else if (description.length > 0) {
      recommendations.push('Description should be at least 150 characters');
    }

    if (tags.length >= 5 && tags.length <= 15) {
      score += 0.15;
    } else if (tags.length > 0) {
      recommendations.push('Use 5-15 tags for best discoverability');
    }

    try {
      const keywordTrends = await seoAnalyzer.analyzeKeywordTrends();
      const relevantKeywords = keywordTrends.filter(k =>
        title.toLowerCase().includes(k.keyword.toLowerCase()) ||
        description.toLowerCase().includes(k.keyword.toLowerCase())
      );

      if (relevantKeywords.length > 0) {
        score += 0.1;
      }
    } catch {
      // Keyword trends not available
    }

    return {
      score: Math.min(1, score),
      viralPotential: score * 0.8,
      recommendations,
    };
  }

  private async assessUpload(context: Record<string, unknown>): Promise<{
    timingScore: number;
    copyrightRisk: number;
    warnings: string[];
    recommendations: string[];
  }> {
    const video = context.video as Video;
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let timingScore = 0.7;
    let copyrightRisk = 0;

    if (video) {
      try {
        const risks = await copyrightMonitor.assessRisk(video);
        if (risks.length > 0) {
          copyrightRisk = risks.reduce((sum, r) => sum + (r.level === 'high' ? 0.5 : r.level === 'medium' ? 0.25 : 0.1), 0);
          if (copyrightRisk > 0.3) {
            warnings.push('Copyright concerns detected - review before uploading');
          }
        }
      } catch {
        // Copyright monitor not available
      }

      try {
        const bestTimes = await smartQueue.findBestUploadTime(video.channel_id || '');
        if (bestTimes.length > 0 && bestTimes[0].score > 80) {
          timingScore = 0.9;
          recommendations.push(`Optimal upload window detected: ${bestTimes[0].reasoning}`);
        }
      } catch {
        // Smart queue not available
      }
    }

    return {
      timingScore,
      copyrightRisk,
      warnings,
      recommendations,
    };
  }

  private async assessThumbnail(context: Record<string, unknown>): Promise<{
    ctrPotential: number;
    competitorAdvantage: number;
    recommendations: string[];
  }> {
    const thumbnailUrl = context.thumbnailUrl as string;
    const score = context.score as number || 0;
    const recommendations: string[] = [];

    let ctrPotential = 0.5;
    let competitorAdvantage = 0.3;

    if (score > 0) {
      ctrPotential = score / 100;
    }

    if (ctrPotential < 0.6) {
      recommendations.push('Consider higher contrast and more prominent text');
    }

    if (ctrPotential >= 0.75) {
      recommendations.push('Strong thumbnail - ready for A/B testing');
      competitorAdvantage = 0.6;
    }

    return {
      ctrPotential,
      competitorAdvantage,
      recommendations,
    };
  }

  private async assessShorts(context: Record<string, unknown>): Promise<{
    viralPotential: number;
    timingScore: number;
    recommendations: string[];
  }> {
    const hookScore = context.hookScore as number || 0.5;
    const duration = context.duration as number || 60;
    const recommendations: string[] = [];

    let viralPotential = hookScore;

    if (duration > 60) {
      recommendations.push('Shorts under 60 seconds tend to perform better');
      viralPotential *= 0.9;
    }

    if (hookScore < 0.6) {
      recommendations.push('Strengthen the opening hook for better retention');
    }

    if (hookScore >= 0.8) {
      viralPotential = Math.min(1, viralPotential * 1.2);
      recommendations.push('Excellent hook - high viral potential');
    }

    return {
      viralPotential,
      timingScore: 0.75,
      recommendations,
    };
  }

  private async assessGrowth(context: Record<string, unknown>): Promise<{
    potential: number;
    competitorAdvantage: number;
    recommendations: string[];
  }> {
    const niche = context.niche as string || '';
    const recommendations: string[] = [];

    let potential = 0.5;
    let competitorAdvantage = 0.3;

    try {
      const trends = await getTrends(10);
      const relevantTrends = trends.filter(t =>
        niche ? t.topic.toLowerCase().includes(niche.toLowerCase()) : false
      );

      if (relevantTrends.length > 0) {
        potential = relevantTrends[0].opportunity_score / 100;
        recommendations.push(`Trending topic detected: ${relevantTrends[0].topic}`);
      }
    } catch {
      // Trends not available
    }

    try {
      const competitors = await getCompetitors(5);
      if (competitors.length > 0) {
        competitorAdvantage = 0.4 + (competitors.filter(c => c.opportunity_areas?.length > 0).length / competitors.length) * 0.3;
        if (competitorAdvantage > 0.5) {
          recommendations.push('Competitor gaps identified - opportunity for content');
        }
      }
    } catch {
      // Competitors not available
    }

    return {
      potential,
      competitorAdvantage,
      recommendations,
    };
  }

  private calculateOverallScore(scores: Record<string, number>): number {
    const weights = {
      seoScore: 0.2,
      viralPotential: 0.25,
      copyrightRisk: -0.3,
      timingScore: 0.15,
      competitorAdvantage: 0.1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const value = scores[key as keyof typeof scores] || 0;
      weightedSum += value * weight;
      totalWeight += Math.abs(weight);
    }

    return Math.max(0, Math.min(1, weightedSum / totalWeight + 0.5));
  }

  private async createPendingDecision(
    request: ApprovalRequest,
    assessment: IntelligenceAssessment
  ): Promise<IntelligenceDecision> {
    const recommendation = assessment.overallScore >= 0.7 ? 'approved' :
                           assessment.overallScore >= 0.5 ? 'modified' : 'rejected';

    const reasoning = this.generateDecisionReasoning(request, assessment);

    return createDecision({
      decision_type: request.type as any,
      context: request.context,
      proposed_action: {
        action: recommendation,
        itemId: request.itemId,
      },
      agent_recommendation: recommendation,
      confidence: assessment.overallScore,
      reasoning,
    });
  }

  private generateDecisionReasoning(
    request: ApprovalRequest,
    assessment: IntelligenceAssessment
  ): string {
    const parts: string[] = [];

    parts.push(`${request.type.toUpperCase()} approval request for ${request.itemId}`);
    parts.push(`Overall score: ${(assessment.overallScore * 100).toFixed(0)}%`);

    if (assessment.seoScore > 0) {
      parts.push(`SEO: ${(assessment.seoScore * 100).toFixed(0)}%`);
    }
    if (assessment.viralPotential > 0) {
      parts.push(`Viral potential: ${(assessment.viralPotential * 100).toFixed(0)}%`);
    }
    if (assessment.copyrightRisk > 0) {
      parts.push(`Copyright risk: ${(assessment.copyrightRisk * 100).toFixed(0)}%`);
    }

    if (assessment.warnings.length > 0) {
      parts.push(`Warnings: ${assessment.warnings.join(', ')}`);
    }

    return parts.join('. ');
  }

  async getMasterDecision(context: {
    video?: Video;
    trend?: TrendIntelligence;
    competitor?: CompetitorIntelligence;
    thumbnail?: ThumbnailIntelligence;
    shorts?: ShortsIntelligence;
    question?: string;
  }): Promise<MasterDecision> {
    await this.setAgentStatus('thinking', 'Synthesizing intelligence for master decision');

    if (!this.aiClient) {
      await this.initialize();
    }

    const report = await getIntelligenceReport();
    const memories = await learningEngine.recall(context.question || 'current context', undefined, 5);

    const prompt = this.buildMasterPrompt(context, report, memories);

    try {
      const response = await this.aiClient!.generate(
        prompt,
        'You are the Master YouTube Intelligence Agent. Make strategic decisions with clear reasoning.',
        { temperature: 0.3, maxTokens: 400 }
      );

      const decision = this.parseMasterResponse(response.content);
      await this.setAgentStatus('idle');
      return decision;
    } catch (error) {
      await this.setAgentStatus('error', null, error instanceof Error ? error.message : 'Unknown error');
      return {
        action: 'escalate',
        confidence: 0,
        reasoning: 'Unable to process - please review manually',
      };
    }
  }

  private buildMasterPrompt(
    context: {
      video?: Video;
      trend?: TrendIntelligence;
      competitor?: CompetitorIntelligence;
      thumbnail?: ThumbnailIntelligence;
      shorts?: ShortsIntelligence;
      question?: string;
    },
    report: { pendingDecisions: number; activeTrends: number; trackingCompetitors: number; pendingShortsJobs: number; thumbnailQueue: number },
    memories: { memory: { category: string; key: string; value: string }; relevance: number }[]
  ): string {
    const parts: string[] = ['Current Intelligence Status:'];
    parts.push(`Pending decisions: ${report.pendingDecisions}`);
    parts.push(`Active trends: ${report.activeTrends}`);
    parts.push(`Tracking competitors: ${report.trackingCompetitors}`);

    if (memories.length > 0) {
      parts.push('\nRelevant context from memory:');
      memories.forEach(m => parts.push(`[${m.memory.category}] ${m.memory.key}: ${m.memory.value}`));
    }

    if (context.video) {
      parts.push(`\nVideo: ${context.video.title}`);
      parts.push(`Status: ${context.video.status}`);
      parts.push(`Viral Score: ${context.video.viral_score || 'N/A'}`);
      parts.push(`SEO Score: ${context.video.seo_score || 'N/A'}`);
    }

    if (context.trend) {
      parts.push(`\nTrend: ${context.trend.topic}`);
      parts.push(`Opportunity Score: ${context.trend.opportunity_score}`);
      parts.push(`Growth Rate: ${context.trend.growth_rate}%`);
    }

    if (context.question) {
      parts.push(`\nQuestion: ${context.question}`);
    }

    parts.push('\nProvide a decision: approve/reject/defer with confidence (0-1) and reasoning.');

    return parts.join('\n');
  }

  private parseMasterResponse(content: string): MasterDecision {
    const lowerContent = content.toLowerCase();
    let action: MasterDecision['action'] = 'escalate';

    if (lowerContent.includes('approve')) {
      action = 'approve';
    } else if (lowerContent.includes('reject')) {
      action = 'reject';
    } else if (lowerContent.includes('defer')) {
      action = 'defer';
    }

    const confidenceMatch = content.match(/confidence[:\s]+(\d+\.?\d*)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

    return {
      action,
      confidence: Math.min(1, Math.max(0, confidence)),
      reasoning: content,
    };
  }

  async getPendingApprovals(): Promise<IntelligenceDecision[]> {
    return getPendingDecisions(20);
  }

  async resolveApproval(
    decisionId: string,
    userDecision: 'approved' | 'rejected' | 'modified',
    feedback?: string
  ): Promise<void> {
    await resolveDecision(decisionId, userDecision, feedback);

    if (feedback) {
      await learningEngine.learnFromFeedback(
        'Agent recommendation',
        feedback,
        'other'
      );
    }
  }

  async getSystemReport(): Promise<{
    pendingDecisions: number;
    activeTrends: number;
    trackingCompetitors: number;
    pendingShortsJobs: number;
    thumbnailQueue: number;
    agentStatus: {
      name: string;
      status: string;
      currentTask: string | null;
    }[];
  }> {
    const report = await getIntelligenceReport();

    return {
      ...report,
      agentStatus: [],
    };
  }

  private async setAgentStatus(
    status: 'idle' | 'thinking' | 'analyzing' | 'error',
    currentTask?: string | null,
    error?: string | null
  ): Promise<void> {
    await updateAgentState(this.agentName, 'youtube_intelligence', {
      status,
      currentTask,
      lastError: error,
    });
  }
}

export const youtubeIntelligence = new YouTubeIntelligence();
