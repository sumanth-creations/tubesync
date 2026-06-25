/**
 * Agent Orchestrator - Main AI Agent Controller
 *
 * Central controller that coordinates all agent subsystems:
 * - Intelligence Core (AI)
 * - Learning Engine (Memory)
 * - SEO Analyzer
 * - Channel Intelligence
 * - Growth Hub
 * - Copyright Monitor
 * - Smart Queue
 */

import { IntelligenceCore, getAIClient } from './intelligence-core';
import { LearningEngine, learningEngine } from './learning-engine';
import { SEOAnalyzer, seoAnalyzer } from './seo-analyzer';
import { ChannelIntelligence, channelIntelligence } from './channel-history';
import { GrowthHub, growthHub } from './growth-intelligence';
import { CopyrightMonitor, copyrightMonitor } from './copyright-monitor';
import { SmartQueue, smartQueue } from './smart-queue';
import type { Video, YouTubeChannel, AgentMemory } from '../../types';
import { createSession, endSession, addMessage } from './api';

interface AgentContext {
  sessionId: string | null;
  channelId: string | null;
  videoId: string | null;
  history: { role: 'user' | 'assistant'; content: string }[];
}

interface AgentResponse {
  content: string;
  intent: string;
  toolCalls: string[];
  suggestions: string[];
  metadata: Record<string, unknown>;
}

type AgentIntent =
  | 'chat'
  | 'analyze_video'
  | 'generate_content'
  | 'schedule_upload'
  | 'check_seo'
  | 'review_channel'
  | 'check_copyright'
  | 'optimize_queue'
  | 'unknown';

const INTENT_PATTERNS: Record<AgentIntent, RegExp[]> = {
  chat: [
    /^(hi|hello|hey|how are you|what's up|help)/i,
    /^(tell me|explain|what is|how does)/i,
    /^(thanks|thank you|ok|got it)/i,
  ],
  analyze_video: [
    /(analyze|review|check).*video/i,
    /video.*(performance|stats|analytics)/i,
    /how.*(is|are) .*doing/i,
  ],
  generate_content: [
    /(generate|create|make|write).*(title|description|script|idea)/i,
    /(suggest|recommend).*content/i,
    /ai.*(content|generation)/i,
  ],
  schedule_upload: [
    /(schedule|plan|queue).*upload/i,
    /when.*(should|to) (post|upload)/i,
    /best time.*(post|upload)/i,
  ],
  check_seo: [
    /(seo|search|keyword)/i,
    /(rank|position|visibility)/i,
    /optimize.*(search|title|description)/i,
  ],
  review_channel: [
    /channel.*(health|growth|stats|performance)/i,
    /(subscribers|views|growth)/i,
    /how.*(channel|channel) .*doing/i,
  ],
  check_copyright: [
    /(copyright|claim|strike|content id)/i,
    /is.*(my|this).*safe/i,
    /(dispute|fair use)/i,
  ],
  optimize_queue: [
    /(queue|uploads|pending)/i,
    /what.*(waiting|pending|queued)/i,
    /(prioritize|reorder|optimize).*(queue|uploads)/i,
  ],
  unknown: [],
};

export class AgentOrchestrator {
  private aiClient: IntelligenceCore | null = null;
  private context: AgentContext = {
    sessionId: null,
    channelId: null,
    videoId: null,
    history: [],
  };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.aiClient = await getAIClient();
    await learningEngine.initialize();
    await seoAnalyzer.initialize();
    await channelIntelligence.initialize();
    await growthHub.initialize();
    await copyrightMonitor.initialize();
    await smartQueue.initialize();

    this.initialized = true;
  }

  async startSession(): Promise<string> {
    const session = await createSession('chat', `Agent Session ${new Date().toLocaleString()}`);
    this.context.sessionId = session.id;
    return session.id;
  }

  async endSession(summary?: string): Promise<void> {
    if (this.context.sessionId) {
      await endSession(this.context.sessionId, summary);
    }
    this.context.sessionId = null;
    this.context.history = [];
  }

  setContext(options: { channelId?: string; videoId?: string }): void {
    if (options.channelId) this.context.channelId = options.channelId;
    if (options.videoId) this.context.videoId = options.videoId;
  }

  async chat(message: string): Promise<AgentResponse> {
    await this.initialize();

    if (!this.context.sessionId) {
      await this.startSession();
    }

    const intent = this.detectIntent(message);
    const toolCalls: string[] = [];
    const suggestions: string[] = [];
    const metadata: Record<string, unknown> = {};

    let responseContent = '';

    await learningEngine.logInteraction('user', message);

    const relevantMemories = await learningEngine.recall(message, undefined, 5);
    const memoryContext = relevantMemories.map(m => `[${m.memory.category}] ${m.memory.key}: ${m.memory.value}`).join('\n');

    switch (intent) {
      case 'analyze_video':
        if (this.context.videoId) {
          const videos = await this.getVideos();
          const video = videos.find(v => v.id === this.context.videoId);
          if (video) {
            const risks = await copyrightMonitor.assessRisk(video);
            const safety = await copyrightMonitor.checkContentSafety(video);
            responseContent = this.formatVideoAnalysis(video, risks);
            toolCalls.push('assess_risk', 'check_safety');
            metadata.viralScore = video.viral_score;
            metadata.seoScore = video.seo_score;
          }
        }
        break;

      case 'generate_content':
        responseContent = await this.generateAIContent(message);
        toolCalls.push('generate_content');
        break;

      case 'schedule_upload':
        const bestTimes = await smartQueue.findBestUploadTime(this.context.channelId || '');
        responseContent = this.formatBestTimes(bestTimes);
        toolCalls.push('find_best_time');
        break;

      case 'check_seo':
        const keywords = await seoAnalyzer.analyzeKeywordTrends();
        responseContent = this.formatKeywordTrends(keywords);
        toolCalls.push('analyze_keywords');
        break;

      case 'review_channel':
        if (this.context.channelId) {
          const health = await channelIntelligence.generateHealthReport(this.context.channelId);
          responseContent = this.formatChannelHealth(health);
          toolCalls.push('generate_health_report');
        }
        break;

      case 'check_copyright':
        const summary = await copyrightMonitor.getClaimSummary();
        const alerts = await copyrightMonitor.getRecentAlerts();
        responseContent = this.formatCopyrightSummary(summary, alerts);
        toolCalls.push('get_claim_summary', 'get_recent_alerts');
        break;

      case 'optimize_queue':
        const queueAnalysis = await smartQueue.analyzeQueue();
        responseContent = this.formatQueueAnalysis(queueAnalysis);
        toolCalls.push('analyze_queue');
        break;

      case 'chat':
      case 'unknown':
      default:
        responseContent = await this.generalChat(message, memoryContext);
        break;
    }

    await learningEngine.logInteraction('assistant', responseContent, {
      toolResult: { intent, toolCalls }});

    this.context.history.push({ role: 'user', content: message });
    this.context.history.push({ role: 'assistant', content: responseContent });

    suggestions.push(...this.generateSuggestions(intent));

    return {
      content: responseContent,
      intent,
      toolCalls,
      suggestions};
  }

  private detectIntent(message: string): AgentIntent {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (intent === 'unknown') continue;
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return intent as AgentIntent;
        }
      }
    }
    return 'unknown';
  }

  private async generalChat(message: string, memoryContext: string): Promise<string> {
    if (!this.aiClient) {
      return "I need a Gemini API key to provide intelligent responses. Please add one in Settings.";
    }

    const systemPrompt = `You are an AI assistant for a YouTube automation platform called TubeSync.

You help creators with:
- Video content generation and ideas
- SEO optimization and keyword research
- Channel growth analysis and predictions
- Upload scheduling and queue management
- Copyright monitoring and safety checks

Be concise, helpful, and actionable. Provide specific recommendations when possible.

Relevant user memories and preferences:
${memoryContext || 'None yet - this is a new conversation.'}`;

    try {
      const response = await this.aiClient.chat(
        this.context.history as any,
        message,
        systemPrompt,
        { temperature: 0.7, maxTokens: 500 }
      );
      return response.content;
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_API_KEY') {
        return "Please add your free Gemini API key in Settings to unlock AI-powered assistance.";
      }
      return "I encountered an error processing your request. Please try again.";
    }
  }

  private async generateAIContent(prompt: string): Promise<string> {
    if (!this.aiClient) {
      return "I need a Gemini API key to generate content. Please add one in Settings.";
    }

    try {
      const response = await this.aiClient.generate(
        `Generate YouTube content based on: "${prompt}"

Provide:
1. 3 title options (compelling, click-worthy)
2. A description (2-3 sentences)
3. 5-8 tags
4. Hashtag suggestions`,
        'You are a YouTube content strategist. Create viral-worthy content suggestions.',
        { temperature: 0.8, maxTokens: 600 }
      );
      return response.content;
    } catch {
      return "Unable to generate content. Please check your API key and try again.";
    }
  }

  private formatVideoAnalysis(video: Video, risks: any[]): string {
    let output = `Video Analysis: ${video.title}\n\n`;
    output += `Status: ${video.status}\n`;
    if (video.viral_score) output += `Viral Score: ${video.viral_score}/100\n`;
    if (video.seo_score) output += `SEO Score: ${video.seo_score}/100\n`;

    if (risks.length > 0) {
      output += `\nCopyright Risk Assessment:\n`;
      for (const risk of risks) {
        output += `- ${risk.level.toUpperCase()}: ${risk.factors.join(', ')}\n`;
        output += `  Recommendation: ${risk.recommendations[0]}\n`;
      }
    }

    return output;
  }

  private formatBestTimes(times: any[]): string {
    if (times.length === 0) return "No optimal times found.";

    let output = `Best Upload Times:\n\n`;
    for (const time of times.slice(0, 5)) {
      output += `${time.date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' })}\n`;
      output += `  Score: ${time.score}/100 - ${time.reasoning}\n\n`;
    }
    return output;
  }

  private formatKeywordTrends(keywords: any[]): string {
    if (keywords.length === 0) return "No keyword data available.";

    let output = `Keyword Performance:\n\n`;
    for (const kw of keywords.slice(0, 5)) {
      output += `"${kw.keyword}"\n`;
      output += `  Position: ${kw.averagePosition.toFixed(1)} (${kw.trajectory})\n`;
      output += `  Impressions: ${kw.totalImpressions.toLocaleString()} | CTR: ${kw.averageCTR.toFixed(1)}%\n`;
      output += `  Potential: ${kw.potential}\n\n`;
    }
    return output;
  }

  private formatChannelHealth(health: any): string {
    let output = `Channel Health Report\n\n`;
    output += `Overall Score: ${health.overallHealth}/100\n`;
    output += `Growth Trend: ${health.growthTrend}\n`;
    output += `Engagement: ${health.engagementHealth}/100\n`;
    output += `Consistency: ${health.consistencyScore}/100\n\n`;

    if (health.recommendations.length > 0) {
      output += `Recommendations:\n`;
      for (const rec of health.recommendations) {
        output += `- ${rec}\n`;
      }
    }

    return output;
  }

  private formatCopyrightSummary(summary: any, alerts: any[]): string {
    let output = `Copyright Summary\n\n`;
    output += `Total Claims: ${summary.total}\n`;
    output += `Active: ${summary.active} | Critical: ${summary.critical}\n\n`;

    if (alerts.length > 0) {
      output += `Recent Alerts:\n`;
      for (const alert of alerts.slice(0, 3)) {
        output += `- ${alert.report_type}: ${alert.severity} severity\n`;
      }
    } else {
      output += `No recent alerts. Your channel looks clean.`;
    }

    return output;
  }

  private formatQueueAnalysis(analysis: any): string {
    let output = `Upload Queue Analysis\n\n`;
    output += `Total Items: ${analysis.totalItems}\n`;
    output += `High Priority: ${analysis.highPriority} | Scheduled: ${analysis.scheduled}\n`;
    output += `Pending: ${analysis.pending} | Failed: ${analysis.failed}\n`;
    output += `Average Wait: ${analysis.avgWaitTime} hours\n\n`;

    if (analysis.bottlenecks.length > 0) {
      output += `Bottlenecks:\n`;
      for (const b of analysis.bottlenecks) {
        output += `- ${b}\n`;
      }
    }

    if (analysis.recommendations.length > 0) {
      output += `\nRecommendations:\n`;
      for (const r of analysis.recommendations) {
        output += `- ${r}\n`;
      }
    }

    return output;
  }

  private generateSuggestions(intent: AgentIntent): string[] {
    const suggestionsByIntent: Record<string, string[]> = {
      chat: [
        'Analyze my channel growth',
        'Check my upload queue',
        'Generate video ideas',
      ],
      analyze_video: [
        'Generate better titles',
        'Check SEO score',
        'Plan upload schedule',
      ],
      generate_content: [
        'Create similar content',
        'Optimize for SEO',
        'Schedule for best time',
      ],
      schedule_upload: [
        'Analyze queue priority',
        'Check channel activity',
        'Review upcoming releases',
      ],
      check_seo: [
        'Optimize video metadata',
        'Track keyword rankings',
        'Analyze competitor keywords',
      ],
      review_channel: [
        'View growth predictions',
        'Check engagement trends',
        'Get content recommendations',
      ],
      check_copyright: [
        'Run safety check',
        'Review claim history',
        'Learn about fair use',
      ],
      optimize_queue: [
        'Prioritize by viral score',
        'Find best upload times',
        'Schedule batch upload',
      ],
      unknown: [
        'What can you help me with?',
        'Analyze my channel',
        'Check my upload queue',
      ],
    };

    return suggestionsByIntent[intent] || suggestionsByIntent.unknown;
  }

  private async getVideos(): Promise<Video[]> {
    const { getVideos: fetchVideos } = await import('../api');
    return fetchVideos(100);
  }

  async getQuickStats(): Promise<{
    queueStats: ReturnType<SmartQueue['getQueueStats']> extends Promise<infer T> ? T : never;
    copyrightSummary: ReturnType<CopyrightMonitor['getClaimSummary']> extends Promise<infer T> ? T : never;
    growthPredictions: Awaited<ReturnType<ChannelIntelligence['predictGrowth']>>;
  }> {
    await this.initialize();

    const [queueStats, copyrightSummary, growthPredictions] = await Promise.all([
      smartQueue.getQueueStats(),
      copyrightMonitor.getClaimSummary(),
      this.context.channelId ? channelIntelligence.predictGrowth(this.context.channelId) : Promise.resolve([]),
    ]);

    return { queueStats, copyrightSummary, growthPredictions };
  }

  getContext(): AgentContext {
    return { ...this.context };
  }
}

export const agentOrchestrator = new AgentOrchestrator();

