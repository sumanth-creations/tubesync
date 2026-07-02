/**
 * Copyright Monitoring System - Track and Manage Content Claims
 *
 * Features:
 * - Content ID claim tracking
 * - Strike monitoring
 * - Fair use analysis
 * - Dispute management
 * - Risk assessment
 * - Resolution recommendations
 */

import {
  getCopyrightReports, createCopyrightReport, resolveCopyrightReport,
} from './api';
import type { CopyrightReport, Video } from '../../lib/database';
import { IntelligenceCore, getAIClient } from './intelligence-core';

interface CopyrightRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: string[];
  recommendations: string[];
}

interface ContentClaim {
  id: string;
  videoId: string;
  claimType: 'audio' | 'visual' | 'both';
  claimant: string;
  assetTitle: string;
  status: 'active' | 'released' | 'disputed' | 'pending';
  revenueImpact: number;
  restrictions: string[];
}

interface DisputeRecommendation {
  canDispute: boolean;
  reason: string;
  evidence: string[];
  likelihood: 'low' | 'medium' | 'high';
  nextSteps: string[];
  template?: string;
}

interface ContentSafetyCheck {
  videoId: string;
  isSafe: boolean;
  risks: CopyrightRisk[];
  warnings: string[];
  suggestedActions: string[];
}

export class CopyrightMonitor {
  private aiClient: IntelligenceCore | null = null;

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
  }

  async getActiveClaims(): Promise<CopyrightReport[]> {
    return getCopyrightReports('active', 50);
  }

  async getAllClaims(): Promise<CopyrightReport[]> {
    return getCopyrightReports(undefined, 100);
  }

  async recordClaim(
    videoId: string,
    youtubeVideoId: string | null,
    claimDetails: {
      reportType: CopyrightReport['report_type'];
      claimant?: string;
      claimType?: string;
      assetTitle?: string;
      severity?: CopyrightReport['severity'];
      affectedContent?: string;
      restrictions?: Record<string, unknown>;
    }
  ): Promise<CopyrightReport> {
    return createCopyrightReport({
      video_id: videoId,
      youtube_video_id: youtubeVideoId,
      report_type: claimDetails.reportType,
      claimant: claimDetails.claimant || null,
      claim_type: claimDetails.claimType || null,
      asset_title: claimDetails.assetTitle || null,
      severity: claimDetails.severity || 'low',
      status: 'active',
      affected_content: claimDetails.affectedContent || null,
      restrictions: claimDetails.restrictions || null,
    });
  }

  async resolveClaim(claimId: string, resolutionNotes: string): Promise<void> {
    await resolveCopyrightReport(claimId, resolutionNotes);
  }

  async assessRisk(video: Video): Promise<CopyrightRisk[]> {
    const risks: CopyrightRisk[] = [];

    const musicRisk = await this.assessMusicRisk(video);
    if (musicRisk) risks.push(musicRisk);

    const visualRisk = await this.assessVisualRisk(video);
    if (visualRisk) risks.push(visualRisk);

    const titleRisk = this.assessTitleRisk(video);
    if (titleRisk) risks.push(titleRisk);

    const descriptionRisk = this.assessDescriptionRisk(video);
    if (descriptionRisk) risks.push(descriptionRisk);

    return risks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.level] - severityOrder[b.level];
    });
  }

  private async assessMusicRisk(video: Video): Promise<CopyrightRisk | null> {
    const description = (video.description || '').toLowerCase();
    const tags = video.tags.map(t => t.toLowerCase());

    const musicKeywords = ['music', 'song', 'soundtrack', 'audio', 'lyrics', 'cover', 'remix'];
    const hasMusicReference = musicKeywords.some(kw =>
      description.includes(kw) || tags.some(t => t.includes(kw))
    );

    if (!hasMusicReference) return null;

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (tags.some(t => t.includes('copyright') || t.includes('licensed'))) {
      factors.push('Music usage mentioned in tags');
      recommendations.push('Verify you have proper licensing');
      score += 20;
    }

    if (description.includes('fair use') || description.includes('transformative')) {
      factors.push('Fair use claim in description');
      recommendations.push('Document fair use justification thoroughly');
      score += 10;
    }

    if (description.includes('spotify') || description.includes('apple music')) {
      factors.push('Streaming service mentioned');
      recommendations.push('Playing copyrighted music may trigger claims');
      score += 30;
    }

    return {
      level: score > 50 ? 'high' : score > 30 ? 'medium' : 'low',
      score: Math.min(100, score),
      factors: factors.length > 0 ? factors : ['Music content detected'],
      recommendations: recommendations.length > 0 ? recommendations : [
        'Consider using royalty-free music',
        'Verify all music licensing',
      ],
    };
  }

  private async assessVisualRisk(video: Video): Promise<CopyrightRisk | null> {
    const description = (video.description || '').toLowerCase();
    const title = video.title.toLowerCase();

    const visualKeywords = ['clip', 'footage', 'scene', 'movie', 'tv show', 'gameplay', 'screenshot'];
    const hasVisualContent = visualKeywords.some(kw =>
      description.includes(kw) || title.includes(kw)
    );

    if (!hasVisualContent) return null;

    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (title.includes('reaction') || title.includes('review')) {
      factors.push('Reaction/review content');
      recommendations.push('Ensure transformative use with commentary');
      score += 15;
    }

    if (description.includes('gameplay')) {
      factors.push('Gameplay footage');
      recommendations.push('Check game publisher policies');
      score += 10;
    }

    if (title.includes('full') && (title.includes('movie') || title.includes('episode'))) {
      factors.push('Potentially full content');
      recommendations.push('HIGH RISK: Avoid posting full copyrighted content');
      score += 80;
    }

    return {
      level: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
      score: Math.min(100, score),
      factors: factors.length > 0 ? factors : ['Visual content detected'],
      recommendations: recommendations.length > 0 ? recommendations : [
        'Use short clips under fair use',
        'Add transformative commentary',
      ],
    };
  }

  private assessTitleRisk(video: Video): CopyrightRisk | null {
    const title = video.title.toLowerCase();
    const riskyPatterns = [
      /\bfull movie\b/,
      /\bfull episode\b/,
      /\bfree download\b/,
      /\bpirated\b/,
      /\btorrent\b/,
    ];

    for (const pattern of riskyPatterns) {
      if (pattern.test(title)) {
        return {
          level: 'critical',
          score: 100,
          factors: ['Title contains high-risk pattern'],
          recommendations: [
            'Remove content or modify title',
            'This pattern often triggers automatic strikes',
          ],
        };
      }
    }

    return null;
  }

  private assessDescriptionRisk(video: Video): CopyrightRisk | null {
    const description = (video.description || '').toLowerCase();

    const disclaimers = [
      'i do not own',
      'no copyright infringement',
      'copyright disclaimer',
      'for educational purposes',
    ];

    const hasDisclaimer = disclaimers.some(d => description.includes(d));

    if (hasDisclaimer) {
      return {
        level: 'medium',
        score: 40,
        factors: ['Copyright disclaimer present'],
        recommendations: [
          'Disclaimers do not provide legal protection',
          'Rely on fair use principles instead',
          'Document transformative purpose',
        ],
      };
    }

    return null;
  }

  async analyzeDisputePotential(report: CopyrightReport): Promise<DisputeRecommendation> {
    if (!this.aiClient) await this.initialize();

    const result: DisputeRecommendation = {
      canDispute: false,
      reason: '',
      evidence: [],
      likelihood: 'low',
      nextSteps: [],
    };

    switch (report.report_type) {
      case 'content_id_match':
        result.canDispute = true;
        result.reason = 'Content ID claims can be disputed if you believe the match is incorrect';
        result.likelihood = 'medium';
        result.evidence.push('Original content creation proof');
        result.evidence.push('Licensing documentation');
        result.nextSteps.push('Gather original files with timestamps');
        result.nextSteps.push('Document your creative process');
        break;

      case 'claim':
        result.canDispute = true;
        result.reason = 'Claims may be disputed under fair use if content is transformative';
        result.likelihood = 'medium';
        result.evidence.push('Transformative nature of your content');
        result.evidence.push('Commentary or criticism purpose');
        result.nextSteps.push('Document how your content transforms the original');
        break;

      case 'strike':
        result.canDispute = true;
        result.reason = 'Strikes have serious consequences - dispute only with strong evidence';
        result.likelihood = 'low';
        result.evidence.push('Clear fair use justification');
        result.evidence.push('License or permission documentation');
        result.nextSteps.push('Consider legal consultation');
        result.nextSteps.push('File counter-notification if applicable');
        break;

      case 'takedown':
        result.canDispute = true;
        result.reason = 'DMCA takedowns can be counter-notified';
        result.likelihood = 'medium';
        result.evidence.push('Good faith belief of fair use or license');
        result.nextSteps.push('File counter-notification through YouTube');
        result.nextSteps.push('Be prepared for legal response');
        break;

      default:
        result.reason = 'Insufficient information to assess dispute potential';
    }

    if (this.aiClient && result.canDispute) {
      try {
        result.template = await this.generateDisputeTemplate(report);
      } catch {
        // Template generation is optional
      }
    }

    return result;
  }

  private async generateDisputeTemplate(report: CopyrightReport): Promise<string> {
    if (!this.aiClient) return '';

    const response = await this.aiClient.generate(
      `Generate a professional dispute statement for this claim:
Type: ${report.report_type}
Claimant: ${report.claimant || 'Unknown'}
Asset: ${report.asset_title || 'Unknown'}
My content: ${report.affected_content || 'Video content'}

Provide a single paragraph suitable for YouTube dispute submission.`,
      'You are a legal content expert. Provide professional, factual dispute language.',
      { temperature: 0.5, maxTokens: 300 }
    );

    return response.content.trim();
  }

  async checkContentSafety(video: Video): Promise<ContentSafetyCheck> {
    const risks = await this.assessRisk(video);
    const warnings: string[] = [];
    const suggestedActions: string[] = [];

    for (const risk of risks) {
      if (risk.level === 'critical' || risk.level === 'high') {
        warnings.push(`${risk.level.toUpperCase()} RISK: ${risk.factors.join(', ')}`);
        suggestedActions.push(...risk.recommendations);
      }
    }

    const hasCriticalRisk = risks.some(r => r.level === 'critical');
    const hasHighRisk = risks.some(r => r.level === 'high');

    if (hasCriticalRisk) {
      suggestedActions.unshift('Do not publish - critical copyright risk detected');
    } else if (hasHighRisk) {
      suggestedActions.unshift('Review content before publishing');
    }

    return {
      videoId: video.id,
      isSafe: !hasCriticalRisk && !hasHighRisk,
      risks,
      warnings,
      suggestedActions: [...new Set(suggestedActions)],
    };
  }

  async getClaimSummary(): Promise<{
    total: number;
    active: number;
    resolved: number;
    critical: number;
    revenueAtRisk: number;
  }> {
    const allClaims = await this.getAllClaims();

    return {
      total: allClaims.length,
      active: allClaims.filter(c => c.status === 'active').length,
      resolved: allClaims.filter(c => c.status === 'resolved').length,
      critical: allClaims.filter(c => c.severity === 'critical' || c.severity === 'high').length,
      revenueAtRisk: allClaims
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (c.metadata?.revenueImpact as number || 0), 0),
    };
  }

  async getRecentAlerts(): Promise<CopyrightReport[]> {
    const active = await this.getActiveClaims();
    return active.filter(c => c.detected_at &&
      Date.now() - new Date(c.detected_at).getTime() < 7 * 24 * 60 * 60 * 1000
    );
  }
}

export const copyrightMonitor = new CopyrightMonitor();
