/**
 * AI Agent System - Module Index
 *
 * Central export for all agent subsystems.
 */

// Phase 1 Agents
export { IntelligenceCore, getAIClient, intelligenceCore } from './intelligence-core';
export { LearningEngine, learningEngine } from './learning-engine';
export { SEOAnalyzer, seoAnalyzer } from './seo-analyzer';
export { ChannelIntelligence, channelIntelligence } from './channel-history';
export { GrowthHub, growthHub } from './growth-intelligence';
export { CopyrightMonitor, copyrightMonitor } from './copyright-monitor';
export { SmartQueue, smartQueue } from './smart-queue';
export { AgentOrchestrator, agentOrchestrator } from './orchestrator';

// Phase 2 Agents
export { YouTubeIntelligence, youtubeIntelligence } from './youtube-intelligence';
export { TrendResearch, trendResearch } from './trend-research';
export { CompetitorIntel, competitorIntel } from './competitor-intelligence';
export { ThumbnailIntel, thumbnailIntel } from './thumbnail-intelligence';
export { ShortsFactory, shortsFactory } from './shorts-factory';

// Phase 1 API
export * from './api';

// Phase 2 Extended API
export * from './extended-api';
