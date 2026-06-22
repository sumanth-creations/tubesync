/**
 * Thumbnail Intelligence Agent - Thumbnail Scoring and CTR Prediction
 *
 * Features:
 * - Thumbnail quality scoring
 * - CTR prediction
 * - Engagement potential assessment
 * - Visual element analysis
 * - Face/emotion detection
 * - A/B test suggestions
 * - Improvement recommendations
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { learningEngine } from './learning-engine';
import {
  getThumbnailAnalyses,
  createThumbnailAnalysis,
  updateAgentState,
} from './extended-api';
import type { ThumbnailIntelligence, ThumbnailScore } from '../../types';

interface ThumbnailAssessment {
  overallScore: number;
  ctrPrediction: number;
  engagementPotential: number;
  clarityScore: number;
  eyeCatchingScore: number;
  textReadabilityScore: number;
  colorHarmonyScore: number;
  faceDetection: boolean;
  emotionDetected: string | null;
  improvements: string[];
  aBTestSuggestions: ABTestVariant[];
}

interface ABTestVariant {
  description: string;
  expectedImpact: number;
  changes: string[];
}

interface ThumbnailComparison {
  thumbnailA: ThumbnailAssessment;
  thumbnailB: ThumbnailAssessment;
  recommendation: 'A' | 'B' | 'test_both';
  reasoning: string;
}

export class ThumbnailIntel {
  private aiClient: IntelligenceCore | null = null;
  private agentName = 'Thumbnail Intel';

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await updateAgentState(this.agentName, 'thumbnail_intel', {
      status: 'idle',
    });
  }

  async analyzeThumbnail(
    thumbnailUrl: string,
    videoContext?: { title?: string; category?: string }
  ): Promise<ThumbnailAssessment> {
    await this.setAgentStatus('analyzing', 'Scoring thumbnail quality');

    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        this.buildAnalysisPrompt(thumbnailUrl, videoContext),
        'You are a YouTube thumbnail expert. Score thumbnails and provide improvement suggestions.',
        { temperature: 0.4, maxTokens: 500 }
      );

      const assessment = this.parseAssessmentResponse(response.content);

      await this.saveAnalysis(thumbnailUrl, assessment, videoContext?.title);
      await this.setAgentStatus('idle');

      return assessment;
    } catch (error) {
      await this.setAgentStatus('error', null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private buildAnalysisPrompt(
    thumbnailUrl: string,
    context?: { title?: string; category?: string }
  ): string {
    const parts: string[] = ['Analyze this YouTube thumbnail for effectiveness.'];

    if (context?.title) {
      parts.push(`Video title: "${context.title}"`);
    }

    if (context?.category) {
      parts.push(`Category: ${context.category}`);
    }

    parts.push('\nProvide scores (0-100) for:');
    parts.push('- Overall score');
    parts.push('- CTR prediction (expected click-through rate quality)');
    parts.push('- Engagement potential');
    parts.push('- Clarity (is the message clear?)');
    parts.push('- Eye-catching (does it grab attention?)');
    parts.push('- Text readability');
    parts.push('- Color harmony');

    parts.push('\nAlso provide:');
    parts.push('- Face detection (yes/no)');
    parts.push('- Emotion detected (if face)');
    parts.push('- 3-5 improvement suggestions');
    parts.push('- 2 A/B test variant ideas');

    parts.push('\nFormat:');
    parts.push('OVERALL: [score]');
    parts.push('CTR: [score]');
    parts.push('ENGAGEMENT: [score]');
    parts.push('CLARITY: [score]');
    parts.push('EYE_CATCHING: [score]');
    parts.push('TEXT: [score]');
    parts.push('COLOR: [score]');
    parts.push('FACE: [yes/no]');
    parts.push('EMOTION: [emotion or none]');
    parts.push('IMPROVEMENTS: [improvement1] | [improvement2]');
    parts.push('AB_TEST_1: [description]');
    parts.push('AB_TEST_2: [description]');

    return parts.join('\n');
  }

  private parseAssessmentResponse(content: string): ThumbnailAssessment {
    const lines = content.split('\n');
    const result: ThumbnailAssessment = {
      overallScore: 50,
      ctrPrediction: 50,
      engagementPotential: 50,
      clarityScore: 50,
      eyeCatchingScore: 50,
      textReadabilityScore: 50,
      colorHarmonyScore: 50,
      faceDetection: false,
      emotionDetected: null,
      improvements: [],
      aBTestSuggestions: [],
    };

    const abTests: ABTestVariant[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('OVERALL:')) {
        result.overallScore = parseInt(trimmed.replace('OVERALL:', '').trim()) || 50;
      } else if (trimmed.startsWith('CTR:')) {
        result.ctrPrediction = parseInt(trimmed.replace('CTR:', '').trim()) || 50;
      } else if (trimmed.startsWith('ENGAGEMENT:')) {
        result.engagementPotential = parseInt(trimmed.replace('ENGAGEMENT:', '').trim()) || 50;
      } else if (trimmed.startsWith('CLARITY:')) {
        result.clarityScore = parseInt(trimmed.replace('CLARITY:', '').trim()) || 50;
      } else if (trimmed.startsWith('EYE_CATCHING:')) {
        result.eyeCatchingScore = parseInt(trimmed.replace('EYE_CATCHING:', '').trim()) || 50;
      } else if (trimmed.startsWith('TEXT:')) {
        result.textReadabilityScore = parseInt(trimmed.replace('TEXT:', '').trim()) || 50;
      } else if (trimmed.startsWith('COLOR:')) {
        result.colorHarmonyScore = parseInt(trimmed.replace('COLOR:', '').trim()) || 50;
      } else if (trimmed.startsWith('FACE:')) {
        result.faceDetection = trimmed.replace('FACE:', '').trim().toLowerCase() === 'yes';
      } else if (trimmed.startsWith('EMOTION:')) {
        const emotion = trimmed.replace('EMOTION:', '').trim();
        result.emotionDetected = emotion !== 'none' ? emotion : null;
      } else if (trimmed.startsWith('IMPROVEMENTS:')) {
        result.improvements = trimmed.replace('IMPROVEMENTS:', '').split('|').map(i => i.trim());
      } else if (trimmed.startsWith('AB_TEST_')) {
        abTests.push({
          description: trimmed.replace(/AB_TEST_\d:/, '').trim(),
          expectedImpact: 0.1,
          changes: [],
        });
      }
    }

    result.aBTestSuggestions = abTests.slice(0, 2);
    return result;
  }

  private async saveAnalysis(
    thumbnailUrl: string,
    assessment: ThumbnailAssessment,
    videoId?: string
  ): Promise<ThumbnailIntelligence> {
    return createThumbnailAnalysis({
      video_id: videoId,
      thumbnail_url: thumbnailUrl,
      overall_score: assessment.overallScore,
      ctr_prediction: assessment.ctrPrediction,
      engagement_potential: assessment.engagementPotential,
      clarity_score: assessment.clarityScore,
      eye_catching_score: assessment.eyeCatchingScore,
      text_readability_score: assessment.textReadabilityScore,
      color_harmony_score: assessment.colorHarmonyScore,
      face_detection: assessment.faceDetection,
      emotion_detected: assessment.emotionDetected,
      improvements_suggested: assessment.improvements,
      a_b_test_variants: assessment.aBTestSuggestions,
    });
  }

  async getRecentAnalyses(limit = 20): Promise<ThumbnailIntelligence[]> {
    return getThumbnailAnalyses(limit);
  }

  async compareThumbnails(
    thumbnailAUrl: string,
    thumbnailBUrl: string,
    videoContext?: { title?: string; category?: string }
  ): Promise<ThumbnailComparison> {
    await this.setAgentStatus('analyzing', 'Comparing thumbnails');

    const [assessmentA, assessmentB] = await Promise.all([
      this.analyzeThumbnail(thumbnailAUrl, videoContext),
      this.analyzeThumbnail(thumbnailBUrl, videoContext),
    ]);

    let recommendation: 'A' | 'B' | 'test_both' = 'test_both';
    let reasoning = '';

    const scoreDiff = assessmentA.overallScore - assessmentB.overallScore;

    if (Math.abs(scoreDiff) < 5) {
      recommendation = 'test_both';
      reasoning = 'Scores are close - recommend A/B testing both';
    } else if (scoreDiff > 0) {
      recommendation = 'A';
      reasoning = `Thumbnail A scores ${scoreDiff} points higher`;
    } else {
      recommendation = 'B';
      reasoning = `Thumbnail B scores ${Math.abs(scoreDiff)} points higher`;
    }

    await this.setAgentStatus('idle');
    return {
      thumbnailA: assessmentA,
      thumbnailB: assessmentB,
      recommendation,
      reasoning,
    };
  }

  async generateThumbnailIdeas(
    videoTitle: string,
    category?: string,
    count = 3
  ): Promise<string[]> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        `Generate ${count} YouTube thumbnail ideas for:
Video Title: "${videoTitle}"
Category: ${category || 'General'}

For each thumbnail idea, describe:
- Main visual element
- Text overlay (if any)
- Color scheme
- Emotional tone

Format each idea as a single line description.`,
        'You are a YouTube thumbnail designer expert.',
        { temperature: 0.8, maxTokens: 300 }
      );

      return response.content.split('\n').filter(line => line.trim().length > 0).slice(0, count);
    } catch {
      return [
        'Bold text with contrasting background',
        'Close-up face with expressive emotion',
        'Before/after split screen comparison',
      ];
    }
  }

  async getBestPractices(category?: string): Promise<string[]> {
    const practices = [
      'Use high contrast colors for readability',
      'Include faces with expressive emotions when appropriate',
      'Keep text minimal - 3-5 words max',
      'Use bright, saturated colors',
      'Ensure text is readable at small sizes',
      'Create visual hierarchy with focal points',
      'Avoid cluttered backgrounds',
      'Test on mobile preview before finalizing',
    ];

    if (category) {
      const categorySpecific: Record<string, string[]> = {
        gaming: ['Show gameplay action', 'Use game UI elements', 'Include character close-ups'],
        education: ['Clear title text', 'Professional look', 'Subject matter visual'],
        entertainment: ['Bold reactions', 'Bright colors', 'Teaser elements'],
        vlog: ['Personal photos', 'Lifestyle elements', 'Authentic feel'],
      };

      const additional = categorySpecific[category.toLowerCase()];
      if (additional) {
        practices.push(...additional);
      }
    }

    return practices;
  }

  async predictCTR(
    thumbnailUrl: string,
    videoContext?: { title?: string; category?: string }
  ): Promise<{
    predictedCTR: number;
    confidence: number;
    factors: { factor: string; impact: number }[];
  }> {
    const assessment = await this.analyzeThumbnail(thumbnailUrl, videoContext);

    const predictedCTR = assessment.ctrPrediction / 100 * 12;
    const confidence = 0.7;

    const factors = [
      { factor: 'Clarity', impact: assessment.clarityScore / 100 * 0.2 },
      { factor: 'Eye-catching', impact: assessment.eyeCatchingScore / 100 * 0.25 },
      { factor: 'Text readability', impact: assessment.textReadabilityScore / 100 * 0.15 },
      { factor: 'Color harmony', impact: assessment.colorHarmonyScore / 100 * 0.15 },
      { factor: 'Face presence', impact: assessment.faceDetection ? 0.15 : 0.05 },
    ];

    return {
      predictedCTR: Math.min(15, predictedCTR),
      confidence,
      factors,
    };
  }

  async getImprovementPriority(assessment: ThumbnailAssessment): Promise<{
    priority: string;
    currentScore: number;
    potentialGain: number;
    action: string;
  }[]> {
    const scores = [
      { name: 'Clarity', score: assessment.clarityScore, weight: 0.2 },
      { name: 'Eye-catching', score: assessment.eyeCatchingScore, weight: 0.25 },
      { name: 'Text readability', score: assessment.textReadabilityScore, weight: 0.2 },
      { name: 'Color harmony', score: assessment.colorHarmonyScore, weight: 0.15 },
      { name: 'Engagement potential', score: assessment.engagementPotential, weight: 0.2 },
    ];

    return scores
      .map(s => ({
        priority: s.name,
        currentScore: s.score,
        potentialGain: (100 - s.score) * s.weight,
        action: this.getImprovementAction(s.name, s.score),
      }))
      .sort((a, b) => b.potentialGain - a.potentialGain);
  }

  private getImprovementAction(area: string, currentScore: number): string {
    const actions: Record<string, string> = {
      'Clarity': 'Simplify the main message and remove distracting elements',
      'Eye-catching': 'Add more contrast, bolder colors, or dynamic elements',
      'Text readability': 'Increase font size, use higher contrast, reduce word count',
      'Color harmony': 'Use complementary colors or a consistent color palette',
      'Engagement potential': 'Add emotional triggers or curiosity gaps',
    };

    if (currentScore < 40) {
      return `Critical: ${actions[area]}`;
    } else if (currentScore < 60) {
      return `Improve: ${actions[area]}`;
    } else {
      return `Optimize: Fine-tune ${area.toLowerCase()} for marginal gains`;
    }
  }

  private async setAgentStatus(
    status: 'idle' | 'analyzing' | 'error',
    currentTask?: string | null,
    error?: string | null
  ): Promise<void> {
    await updateAgentState(this.agentName, 'thumbnail_intel', {
      status,
      currentTask,
      lastError: error,
    });
  }
}

export const thumbnailIntel = new ThumbnailIntel();
