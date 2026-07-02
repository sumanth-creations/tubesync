/**
 * Learning Engine - Persistent Memory & Knowledge Management
 *
 * Manages:
 * - Long-term memory storage (facts, preferences, patterns)
 * - Context-aware retrieval with relevance scoring
 * - Knowledge base curation
 * - Learning from user feedback and corrections
 * - Memory consolidation and importance weighting
 */

import {
  getMemories, getMemoryByKey, storeMemory, deleteMemory, searchMemories,
  getKnowledge, addKnowledge, incrementKnowledgeUsage,
  getSession, createSession, endSession, getSessionMessages, addMessage,
} from './api';
import type { AgentMemory, AgentKnowledge, AgentSession } from '../../lib/database';
import { IntelligenceCore, getAIClient } from './intelligence-core';

interface LearningContext {
  category: string;
  sessionId?: string;
  videoId?: string;
  recentInteractions?: string[];
}

interface MemoryMatch {
  memory: AgentMemory;
  relevance: number;
}

interface LearnedPattern {
  pattern: string;
  frequency: number;
  lastSeen: string;
  confidence: number;
}

interface UserPreference {
  category: string;
  preference: string;
  strength: number;
}

export class LearningEngine {
  private aiClient: IntelligenceCore | null = null;
  private currentSession: AgentSession | null = null;
  private memoryCache: Map<string, AgentMemory[]> = new Map();
  private preferenceWeights: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
    await this.loadPreferences();
  }

  private async loadPreferences(): Promise<void> {
    const preferences = await getMemories('preference');
    for (const pref of preferences) {
      this.preferenceWeights.set(pref.key, pref.confidence);
    }
  }

  async startSession(
    sessionType: AgentSession['session_type'] = 'chat',
    title?: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    this.currentSession = await createSession(sessionType, title, context);
    return this.currentSession.id;
  }

  async endCurrentSession(summary?: string): Promise<void> {
    if (!this.currentSession) return;
    await endSession(this.currentSession.id, summary);
    this.currentSession = null;
  }

  async remember(
    memoryType: AgentMemory['memory_type'],
    category: string,
    key: string,
    value: string,
    context?: LearningContext
  ): Promise<AgentMemory> {
    const memory = await storeMemory({
      memory_type: memoryType,
      category,
      key,
      value,
      confidence: this.calculateConfidence(memoryType),
      source: context?.recentInteractions ? 'ai_inferred' : 'user_input',
      video_id: context?.videoId,
      context: context?.recentInteractions ?
        { recent: context.recentInteractions.slice(-5) } : undefined,
    });

    this.invalidateCache(category);
    return memory;
  }

  private calculateConfidence(memoryType: AgentMemory['memory_type']): number {
    switch (memoryType) {
      case 'fact': return 0.95;
      case 'preference': return 0.85;
      case 'feedback': return 0.90;
      case 'correction': return 1.0;
      case 'pattern': return 0.70;
      case 'insight': return 0.60;
      default: return 0.75;
    }
  }

  async recall(
    query: string,
    category?: string,
    limit: number = 10
  ): Promise<MemoryMatch[]> {
    const cacheKey = category || 'all';
    let memories: AgentMemory[];

    if (this.memoryCache.has(cacheKey)) {
      memories = this.memoryCache.get(cacheKey)!;
    } else {
      memories = await searchMemories(query, limit * 2);
      this.memoryCache.set(cacheKey, memories);
    }

    const matches = memories
      .filter(m => category ? m.category === category : true)
      .map(memory => ({
        memory,
        relevance: this.calculateRelevance(query, memory),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    for (const match of matches) {
      const prefWeight = this.preferenceWeights.get(match.memory.key) || 1;
      match.relevance *= prefWeight;
    }

    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  private calculateRelevance(query: string, memory: AgentMemory): number {
    const queryLower = query.toLowerCase();
    const keyLower = memory.key.toLowerCase();
    const valueLower = memory.value.toLowerCase();

    let score = 0;

    if (keyLower.includes(queryLower) || queryLower.includes(keyLower)) {
      score += 0.3;
    }
    if (valueLower.includes(queryLower)) {
      score += 0.2;
    }

    const queryWords = queryLower.split(/\s+/);
    const memoryWords = `${keyLower} ${valueLower}`.split(/\s+/);
    const commonWords = queryWords.filter(w => memoryWords.includes(w));
    score += (commonWords.length / queryWords.length) * 0.3;

    score += memory.confidence * 0.1;

    if (memory.last_accessed_at) {
      const daysSinceAccess = (Date.now() - new Date(memory.last_accessed_at).getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.max(0.5, 1 - daysSinceAccess / 30);
    }

    return Math.min(1, score);
  }

  async learnFromFeedback(
    originalContent: string,
    correctedContent: string,
    contextType: 'title' | 'description' | 'tags' | 'other'
  ): Promise<void> {
    await this.remember('correction', contextType, `correction_${Date.now()}`, correctedContent, {
      category: contextType,
    });

    if (!this.aiClient) await this.initialize();

    const pattern = await this.extractPattern(originalContent, correctedContent);
    if (pattern) {
      await this.remember('pattern', contextType, `pattern_${Date.now()}`, pattern);
    }
  }

  private async extractPattern(original: string, corrected: string): Promise<string | null> {
    if (!this.aiClient) return null;

    try {
      const response = await this.aiClient.generate(
        `Original: "${original}"
Corrected: "${corrected}"

Extract the learning pattern from this correction as a concise rule.`,
        'You are a pattern extraction expert. Reply with ONLY the extracted pattern as a single sentence, no explanation.',
        { maxTokens: 100, temperature: 0.3 }
      );
      return response.content.trim() || null;
    } catch {
      return null;
    }
  }

  async getPreference(category: string, key: string): Promise<string | null> {
    const memory = await getMemoryByKey(category, key);
    return memory?.value || null;
  }

  async setPreference(category: string, key: string, value: string): Promise<void> {
    await this.remember('preference', category, key, value);
    this.preferenceWeights.set(key, 0.85);
  }

  async detectPatterns(interactions: string[]): Promise<LearnedPattern[]> {
    const patterns: Map<string, { count: number; lastSeen: string }> = new Map();

    for (const interaction of interactions) {
      const words = interaction.toLowerCase().split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        const existing = patterns.get(bigram);
        if (existing) {
          existing.count++;
          existing.lastSeen = interaction;
        } else {
          patterns.set(bigram, { count: 1, lastSeen: interaction });
        }
      }
    }

    return Array.from(patterns.entries())
      .filter(([_, data]) => data.count >= 3)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        lastSeen: data.lastSeen,
        confidence: Math.min(0.9, data.count / 10),
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  async consolidateMemories(): Promise<void> {
    const memories = await getMemories(undefined, 1000);
    const grouped = new Map<string, AgentMemory[]>();

    for (const memory of memories) {
      const key = `${memory.category}:${memory.key}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(memory);
    }

    for (const [_, duplicates] of grouped) {
      if (duplicates.length > 1) {
        duplicates.sort((a, b) => {
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          if (a.access_count !== b.access_count) return b.access_count - a.access_count;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        for (let i = 1; i < duplicates.length; i++) {
          await deleteMemory(duplicates[i].id);
        }
      }
    }

    this.memoryCache.clear();
  }

  async buildContext(
    query: string,
    maxTokens: number = 2000
  ): Promise<string> {
    const memories = await this.recall(query, undefined, 20);
    let context = '';
    let tokenEstimate = 0;

    for (const match of memories) {
      const entry = `[${match.memory.category}] ${match.memory.key}: ${match.memory.value}`;
      const entryTokens = entry.split(/\s+/).length;

      if (tokenEstimate + entryTokens > maxTokens) break;

      context += entry + '\n';
      tokenEstimate += entryTokens;
    }

    return context;
  }

  private invalidateCache(category?: string): void {
    if (category) {
      this.memoryCache.delete(category);
      this.memoryCache.delete('all');
    } else {
      this.memoryCache.clear();
    }
  }

  async addToKnowledgeBase(
    domain: string,
    knowledgeType: AgentKnowledge['knowledge_type'],
    title: string,
    content: string,
    tags?: string[]
  ): Promise<AgentKnowledge> {
    return addKnowledge({
      domain,
      knowledge_type: knowledgeType,
      title,
      content,
      tags: tags || [],
    });
  }

  async getRelevantKnowledge(domain: string, query: string, limit = 5): Promise<AgentKnowledge[]> {
    const knowledge = await getKnowledge(domain, limit * 2);

    const scored = knowledge.map(k => ({
      knowledge: k,
      score: this.scoreKnowledgeRelevance(k, query),
    }));

    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.knowledge);

    for (const k of top) {
      await incrementKnowledgeUsage(k.id);
    }

    return top;
  }

  private scoreKnowledgeRelevance(knowledge: AgentKnowledge, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    if (knowledge.title.toLowerCase().includes(queryLower)) {
      score += 0.4;
    }
    if (knowledge.content.toLowerCase().includes(queryLower)) {
      score += 0.2;
    }
    for (const tag of knowledge.tags || []) {
      if (queryLower.includes(tag.toLowerCase())) {
        score += 0.1;
      }
    }

    score += (knowledge.effectiveness_score || 0.5) * 0.2;
    score += Math.min(0.2, knowledge.usage_count / 50);

    return score;
  }

  async logInteraction(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      toolName?: string;
      toolResult?: Record<string, unknown>;
      tokensUsed?: number;
      modelUsed?: string;
      latencyMs?: number;
    }
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession('chat', `Quick session ${new Date().toLocaleTimeString()}`);
    }

    await addMessage(
      this.currentSession!.id,
      role,
      content,
      metadata
    );
  }

  async getSessionHistory(sessionId?: string): Promise<{ role: string; content: string }[]> {
    const id = sessionId || this.currentSession?.id;
    if (!id) return [];

    const messages = await getSessionMessages(id);
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  async getRecentSessionHistory(limit = 5): Promise<{ role: string; content: string }[]> {
    if (!this.currentSession) return [];

    const messages = await getSessionMessages(this.currentSession.id, limit);
    return messages.slice(-limit).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
}

export const learningEngine = new LearningEngine();
