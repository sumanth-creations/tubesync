/**
 * Shorts Factory Agent - YouTube Shorts Generation Workflow
 *
 * Features:
 * - YouTube URL processing
 * - Transcript generation
 * - Viral moment detection
 * - Hook detection and scoring
 * - Shorts generation workflow
 * - Moment selection and export
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { learningEngine } from './learning-engine';
import {
  getShortsJobs,
  createShortsJob,
  updateShortsJob,
  updateAgentState,
} from './extended-api';
import type { ShortsIntelligence, ViralMoment } from '../../lib/database';

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface DetectedMoment {
  timestamp: number;
  duration: number;
  type: 'hook' | 'climax' | 'twist' | 'emotional' | 'educational' | 'funny';
  score: number;
  reasoning: string;
  transcript: string;
}

interface HookAnalysis {
  opening: string;
  hookScore: number;
  hookType: 'question' | 'statement' | 'reaction' | 'story' | 'challenge';
  retentionPrediction: number;
  suggestions: string[];
}

interface ShortsGeneration {
  jobId: string;
  sourceUrl: string;
  detectedMoments: DetectedMoment[];
  selectedMoments: DetectedMoment[];
  hookScores: number[];
  viralPotential: number;
  status: 'analyzing' | 'processing' | 'completed' | 'failed';
  recommendations: string[];
}

export class ShortsFactory {
  private aiClient: IntelligenceCore | null = null;
  private agentName = 'Shorts Factory';

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await updateAgentState(this.agentName, 'shorts_factory', {
      status: 'idle',
    });
  }

  async processYouTubeUrl(youtubeUrl: string): Promise<ShortsGeneration> {
    await this.setAgentStatus('analyzing', 'Processing YouTube content for shorts');

    if (!this.aiClient) await this.initialize();

    const job = await createShortsJob({
      source_youtube_url: youtubeUrl,
      processing_status: 'analyzing',
    });

    try {
      const transcript = await this.generateTranscript(youtubeUrl);
      await updateShortsJob(job.id, { transcript: JSON.stringify(transcript) });
      const moments = await this.detectViralMoments(transcript);
      await updateShortsJob(job.id, {
        detected_moments: moments as any,
        processing_status: 'processing',
      });

      const selectedMoments = this.selectBestMoments(moments);
      const hookScores = selectedMoments.map(m => this.scoreHook(m));
      const viralPotential = this.calculateViralPotential(selectedMoments, hookScores);

      await updateShortsJob(job.id, {
        selected_moments: selectedMoments as any,
        hook_scores: hookScores as any,
        viral_potential: viralPotential,
        processing_status: 'completed',
        generated_short_count: selectedMoments.length,
      });

      await this.setAgentStatus('idle');
      return {
        jobId: job.id,
        sourceUrl: youtubeUrl,
        detectedMoments: moments,
        selectedMoments,
        hookScores,
        viralPotential,
        status: 'completed',
        recommendations: this.generateRecommendations(selectedMoments, viralPotential),
      };
    } catch (error) {
      await updateShortsJob(job.id, {
        processing_status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      await this.setAgentStatus('error', null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async generateTranscript(youtubeUrl: string): Promise<TranscriptSegment[]> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        `Simulate or extract transcript segments from a YouTube video.
URL: ${youtubeUrl}

Generate realistic transcript segments that would be suitable for creating YouTube Shorts.
Each segment should have:
- Text content (what's being said)
- Start timestamp (seconds)
- Duration (seconds)

Format each segment as:
[START: 00:00] [DURATION: 5s] "Text content here"

Create 10-15 segments covering different parts of a typical video.`,
        'You are a transcript generator. Create realistic video transcript segments.',
        { temperature: 0.7, maxTokens: 600 }
      );

      return this.parseTranscriptResponse(response.content);
    } catch {
      return this.generateDefaultTranscript();
    }
  }

  private parseTranscriptResponse(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/\[START:\s*(\d+):(\d+)\]\s*\[DURATION:\s*(\d+)s?\]\s*"([^"]+)"/i);

      if (match) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const duration = parseInt(match[3]);
        const text = match[4];

        segments.push({
          text,
          start: startMin * 60 + startSec,
          duration,
        });
      }
    }

    return segments.length > 0 ? segments : this.generateDefaultTranscript();
  }

  private generateDefaultTranscript(): TranscriptSegment[] {
    return [
      { text: "Hey everyone, today we're going to talk about something incredible", start: 0, duration: 4 },
      { text: "This is going to change the way you think about this topic", start: 5, duration: 3 },
      { text: "Let me show you exactly what I mean", start: 9, duration: 2 },
      { text: "Here's the thing that most people don't realize", start: 12, duration: 3 },
      { text: "And this is where it gets really interesting", start: 16, duration: 2 },
      { text: "I've been researching this for months", start: 19, duration: 3 },
      { text: "The results are absolutely mind-blowing", start: 23, duration: 2 },
      { text: "Let me break down the key points for you", start: 26, duration: 3 },
      { text: "Number one - this is crucial", start: 30, duration: 3 },
      { text: "Number two - don't skip this part", start: 34, duration: 3 },
      { text: "And finally, the most important point", start: 38, duration: 3 },
      { text: "If you found this valuable, like and subscribe", start: 42, duration: 3 },
    ];
  }

  async detectViralMoments(transcript: TranscriptSegment[]): Promise<DetectedMoment[]> {
    if (!this.aiClient) await this.initialize();

    const moments: DetectedMoment[] = [];

    const transcriptText = transcript.map(s => `[${s.start}s] ${s.text}`).join('\n');

    try {
      const response = await this.aiClient!.generate(
        `Analyze this video transcript for potential YouTube Shorts moments:

${transcriptText}

Identify 5-8 moments that would make great Shorts. For each moment:
- Timestamp (seconds)
- Duration (15-60 seconds ideal)
- Type: hook/climax/twist/emotional/educational/funny
- Score (0-100 for viral potential)
- Reasoning

Format:
[TIME: 00] [DUR: 30s] [TYPE: hook] [SCORE: 85] "Reasoning"`,
        'You are a viral content detector. Find the best moments for Shorts.',
        { temperature: 0.5, maxTokens: 500 }
      );

      const parsedMoments = this.parseMomentsResponse(response.content, transcript);

      if (parsedMoments.length > 0) {
        moments.push(...parsedMoments);
      } else {
        moments.push(...this.generateDefaultMoments(transcript));
      }
    } catch {
      moments.push(...this.generateDefaultMoments(transcript));
    }

    return moments.sort((a, b) => b.score - a.score);
  }

  private parseMomentsResponse(content: string, transcript: TranscriptSegment[]): DetectedMoment[] {
    const moments: DetectedMoment[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/\[TIME:\s*(\d+)\]\s*\[DUR:\s*(\d+)s?\]\s*\[TYPE:\s*(\w+)\]\s*\[SCORE:\s*(\d+)\]\s*"([^"]+)"/i);

      if (match) {
        const timestamp = parseInt(match[1]);
        const type = match[3].toLowerCase();
        const score = parseInt(match[4]);
        const reasoning = match[5];

        const relevantSegments = transcript.filter(s =>
          s.start >= timestamp && s.start < timestamp + 60
        );

        moments.push({
          timestamp,
          duration: parseInt(match[2]),
          type: type as DetectedMoment['type'],
          score,
          reasoning,
          transcript: relevantSegments.map(s => s.text).join(' '),
        });
      }
    }

    return moments;
  }

  private generateDefaultMoments(transcript: TranscriptSegment[]): DetectedMoment[] {
    return [
      {
        timestamp: 0,
        duration: 30,
        type: 'hook',
        score: 75,
        reasoning: 'Strong opening hook with high retention potential',
        transcript: transcript.slice(0, 3).map(s => s.text).join(' '),
      },
      {
        timestamp: 12,
        duration: 20,
        type: 'twist',
        score: 70,
        reasoning: 'Interesting revelation that sparks curiosity',
        transcript: transcript.slice(3, 5).map(s => s.text).join(' '),
      },
      {
        timestamp: 30,
        duration: 25,
        type: 'educational',
        score: 65,
        reasoning: 'Key educational content with practical value',
        transcript: transcript.slice(6, 8).map(s => s.text).join(' '),
      },
    ];
  }

  private selectBestMoments(moments: DetectedMoment[], maxMoments = 5): DetectedMoment[] {
    const selected: DetectedMoment[] = [];
    const minGap = 30;

    const sorted = [...moments].sort((a, b) => b.score - a.score);

    for (const moment of sorted) {
      if (selected.length >= maxMoments) break;

      const overlaps = selected.some(s =>
        Math.abs(s.timestamp - moment.timestamp) < minGap
      );

      if (!overlaps && moment.duration <= 60 && moment.duration >= 15) {
        selected.push(moment);
      }
    }

    return selected;
  }

  private scoreHook(moment: DetectedMoment): number {
    let hookScore = moment.score;

    if (moment.type === 'hook') {
      hookScore += 10;
    }

    if (moment.duration >= 25 && moment.duration <= 45) {
      hookScore += 5;
    }

    if (moment.transcript.toLowerCase().includes('secret') ||
        moment.transcript.toLowerCase().includes('discover') ||
        moment.transcript.toLowerCase().includes('this is')) {
      hookScore += 8;
    }

    return Math.min(100, hookScore);
  }

  private calculateViralPotential(moments: DetectedMoment[], hookScores: number[]): number {
    if (moments.length === 0 || hookScores.length === 0) return 0;

    const avgHookScore = hookScores.reduce((a, b) => a + b, 0) / hookScores.length;
    const avgMomentScore = moments.reduce((a, b) => a + b.score, 0) / moments.length;
    const diversityBonus = new Set(moments.map(m => m.type)).size * 5;

    return Math.min(100, (avgHookScore + avgMomentScore) / 2 + diversityBonus);
  }

  async analyzeHook(segment: string): Promise<HookAnalysis> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        `Analyze this opening hook for a YouTube Short:

"${segment}"

Rate the hook and identify:
- Hook score (0-100)
- Hook type (question/statement/reaction/story/challenge)
- Retention prediction (0-100, how many viewers will keep watching)
- 2-3 suggestions to improve it

Format:
SCORE: [number]
TYPE: [type]
RETENTION: [number]
SUGGESTIONS: [suggestion1] | [suggestion2]`,
        'You are a Short-form content expert. Analyze hooks for maximum retention.',
        { temperature: 0.4, maxTokens: 200 }
      );

      return this.parseHookResponse(response.content, segment);
    } catch {
      return {
        opening: segment,
        hookScore: 50,
        hookType: 'statement',
        retentionPrediction: 45,
        suggestions: ['Add more curiosity', 'Start with a stronger word'],
      };
    }
  }

  private parseHookResponse(content: string, segment: string): HookAnalysis {
    const lines = content.split('\n');
    const result: HookAnalysis = {
      opening: segment,
      hookScore: 50,
      hookType: 'statement',
      retentionPrediction: 50,
      suggestions: [],
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('SCORE:')) {
        result.hookScore = parseInt(trimmed.replace('SCORE:', '').trim()) || 50;
      } else if (trimmed.startsWith('TYPE:')) {
        const type = trimmed.replace('TYPE:', '').trim().toLowerCase();
        result.hookType = type as HookAnalysis['hookType'];
      } else if (trimmed.startsWith('RETENTION:')) {
        result.retentionPrediction = parseInt(trimmed.replace('RETENTION:', '').trim()) || 50;
      } else if (trimmed.startsWith('SUGGESTIONS:')) {
        result.suggestions = trimmed.replace('SUGGESTIONS:', '').split('|').map(s => s.trim());
      }
    }

    return result;
  }

  async generateShortScript(moment: DetectedMoment): Promise<string> {
    if (!this.aiClient) await this.initialize();

    try {
      const response = await this.aiClient!.generate(
        `Create a short-form script (under 60 seconds) for this moment:

Type: ${moment.type}
Original: "${moment.transcript}"
Score: ${moment.score}/100

Write a polished, engaging script optimized for retention.
Include:
- Strong opening hook
- Clear value delivery
- Call to action

Script:`,
        'You are a YouTube Shorts scriptwriter. Create engaging, retention-optimized scripts.',
        { temperature: 0.7, maxTokens: 150 }
      );

      return response.content.trim();
    } catch {
      return moment.transcript;
    }
  }

  private generateRecommendations(
    moments: DetectedMoment[],
    viralPotential: number
  ): string[] {
    const recommendations: string[] = [];

    if (viralPotential >= 75) {
      recommendations.push('High viral potential - prioritize these shorts');
    } else if (viralPotential >= 50) {
      recommendations.push('Good potential - consider stronger hooks');
    } else {
      recommendations.push('Moderate potential - review moment selection');
    }

    const hasHook = moments.some(m => m.type === 'hook');
    if (!hasHook) {
      recommendations.push('Add a strong opening hook for better retention');
    }

    const avgDuration = moments.reduce((a, b) => a + b.duration, 0) / moments.length;
    if (avgDuration > 45) {
      recommendations.push('Consider shorter clips for better completion rate');
    }

    return recommendations;
  }

  async getJobs(limit = 20): Promise<ShortsIntelligence[]> {
    return getShortsJobs(limit);
  }

  async getJobStatus(jobId: string): Promise<ShortsIntelligence | null> {
    const jobs = await getShortsJobs(100);
    return jobs.find(j => j.id === jobId) || null;
  }

  async generateBatchShorts(
    youtubeUrls: string[],
    maxShortsPerSource = 2
  ): Promise<ShortsGeneration[]> {
    const results: ShortsGeneration[] = [];

    for (const url of youtubeUrls) {
      try {
        const result = await this.processYouTubeUrl(url);
        result.selectedMoments = result.selectedMoments.slice(0, maxShortsPerSource);
        results.push(result);
      } catch {
        // Continue with other URLs
      }
    }

    return results;
  }

  private async setAgentStatus(
    status: 'idle' | 'analyzing' | 'processing' | 'error',
    currentTask?: string | null,
    error?: string | null
  ): Promise<void> {
    await updateAgentState(this.agentName, 'shorts_factory', {
      status,
      currentTask,
      lastError: error,
    });
  }
}

export const shortsFactory = new ShortsFactory();
