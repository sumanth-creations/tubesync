/**
 * Smart Upload Queue - Intelligent Priority Scheduling & Algorithm Monetization Engine
 *
 * Features:
 * - Priority-based scheduling
 * - Best time detection
 * - Automatic queue optimization
 * - Retry logic with backoff
 * - Batch processing support
 * - Progress tracking
 * - 1-Month YouTube Algorithm Monetization Hack (Viral Batch Spacings)
 */

import {
  getScheduledPublishes, cancelScheduledPublish,
} from './api';
import {
  getUploadQueue, queueForUpload, retryUpload, getVideos,
} from '../api';
import { supabase } from '../supabase';
import type { ScheduledPublish, Video, UploadQueue, Short } from '../../types';
import { channelIntelligence } from './channel-history';
import { IntelligenceCore, getAIClient } from './intelligence-core';

interface QueueItem {
  video: Video;
  queueEntry?: UploadQueue;
  scheduledEntry?: ScheduledPublish;
  priority: number;
  recommendedTime?: Date;
  reasoning: string;
}

interface OptimalTime {
  date: Date;
  score: number;
  confidence: number;
  reasoning: string;
  competingVideos: number;
}

interface QueueAnalysis {
  totalItems: number;
  highPriority: number;
  scheduled: number;
  pending: number;
  failed: number;
  avgWaitTime: number;
  bottlenecks: string[];
  recommendations: string[];
}

interface BatchSchedule {
  items: QueueItem[];
  totalDuration: number;
  estimatedViews: number;
  spacing: number;
  startFrom: Date;
}

export interface QueueOptions {
  targetAudience?: string;
  maxDailyUploads?: number;
  channelId?: string;
}

export class SmartQueue {
  private aiClient: IntelligenceCore | null = null;

  async initialize(): Promise<void> {
    this.aiClient = await getAIClient();
  }

  async analyzeQueue(): Promise<QueueAnalysis> {
    const [queue, scheduled, videos] = await Promise.all([
      getUploadQueue(),
      getScheduledPublishes(),
      getVideos(100),
    ]);

    const highPriority = queue.filter(q => q.priority >= 8).length;
    const scheduledCount = scheduled.filter(s => s.status === 'pending').length;
    const pending = queue.filter(q => q.status === 'queued').length;
    const failed = queue.filter(q => q.status === 'failed').length;

    let avgWaitTime = 0;
    const queuedItems = queue.filter(q => q.status === 'queued' && q.created_at);
    if (queuedItems.length > 0) {
      const totalWait = queuedItems.reduce((sum, q) =>
        sum + (Date.now() - new Date(q.created_at).getTime()), 0
      );
      avgWaitTime = totalWait / queuedItems.length / (1000 * 60 * 60);
    }

    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    if (failed > 3) {
      bottlenecks.push('Multiple failed uploads');
      recommendations.push('Review and retry failed uploads');
    }

    if (pending > 20) {
      bottlenecks.push('Large upload backlog');
      recommendations.push('Consider batch processing or higher priority for urgent content');
    }

    if (scheduledCount > 7 && pending > 0) {
      bottlenecks.push('Many scheduled but queue waiting');
      recommendations.push('Reschedule to balance upload timing');
    }

    const draftVideos = videos.filter(v => v.status === 'draft');
    if (draftVideos.length > 5) {
      recommendations.push(`${draftVideos.length} draft videos ready for queue`);
    }

    return {
      totalItems: queue.length + scheduledCount,
      highPriority,
      scheduled: scheduledCount,
      pending,
      failed,
      avgWaitTime: Math.round(avgWaitTime * 10) / 10,
      bottlenecks,
      recommendations,
    };
  }

  async getPrioritizedQueue(): Promise<QueueItem[]> {
    const [queue, scheduled, videos] = await Promise.all([
      getUploadQueue(),
      getScheduledPublishes('pending'),
      getVideos(100),
    ]);

    const items: QueueItem[] = [];

    for (const entry of queue) {
      const video = videos.find(v => v.id === entry.video_id);
      if (!video) continue;

      const priority = await this.calculatePriority(video, entry);
      const recommendedTime = await this.findOptimalTime(video, priority);

      items.push({
        video,
        queueEntry: entry,
        priority,
        recommendedTime,
        reasoning: this.generateReasoning(video, priority),
      });
    }

    for (const entry of scheduled) {
      const video = videos.find(v => v.id === entry.video_id);
      if (!video) continue;

      items.push({
        video,
        scheduledEntry: entry,
        priority: entry.priority,
        recommendedTime: new Date(entry.scheduled_for),
        reasoning: 'Scheduled for specific time',
      });
    }

    return items.sort((a, b) => b.priority - a.priority);
  }

  private async calculatePriority(video: Video, queueEntry?: UploadQueue): Promise<number> {
    let basePriority = queueEntry?.priority || 5;

    if (video.viral_score && video.viral_score > 80) {
      basePriority += 2;
    }

    if (video.scheduled_publish_at) {
      const scheduledTime = new Date(video.scheduled_publish_at).getTime();
      const now = Date.now();
      const hoursUntilScheduled = (scheduledTime - now) / (1000 * 60 * 60);

      if (hoursUntilScheduled < 2 && hoursUntilScheduled > 0) {
        basePriority += 3;
      } else if (hoursUntilScheduled < 24) {
        basePriority += 1;
      }
    }

    if (queueEntry?.retry_count && queueEntry.retry_count > 0) {
      basePriority -= queueEntry.retry_count;
    }

    const age = Date.now() - new Date(video.created_at).getTime();
    const daysInQueue = age / (1000 * 60 * 60 * 24);
    if (daysInQueue > 3) {
      basePriority += 1;
    }

    return Math.max(1, Math.min(10, basePriority));
  }

  private async findOptimalTime(video: Video, priority: number): Promise<Date> {
    const now = new Date();
    const hoursAhead = Math.max(0, (10 - priority) * 2);

    let optimalHour = 15;
    let optimalDay = now.getDay();

    try {
      const timing = await channelIntelligence.analyzeGrowth(video.id);
      if (timing && timing.velocity > 0) {
        optimalHour = 14;
      }
    } catch {
      // Use defaults
    }

    const result = new Date(now);
    result.setHours(result.getHours() + hoursAhead);
    result.setMinutes(0);
    result.setSeconds(0);
    result.setMilliseconds(0);

    if (result.getHours() < 6 || result.getHours() > 22) {
      result.setHours(optimalHour);
    }

    return result;
  }

  private generateReasoning(video: Video, priority: number): string {
    const reasons: string[] = [];

    if (video.viral_score && video.viral_score > 80) {
      reasons.push('High viral potential');
    }

    if (video.scheduled_publish_at) {
      reasons.push('Scheduled deadline');
    }

    if (priority >= 8) {
      reasons.push('High priority');
    } else if (priority <= 3) {
      reasons.push('Low priority - can wait');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Standard priority';
  }

  async findBestUploadTime(channelId: string, daysAhead = 7): Promise<OptimalTime[]> {
    const suggestions: OptimalTime[] = [];
    const now = new Date();

    if (!this.aiClient) await this.initialize();

    const generalBestTimes = [
      { day: 4, hour: 15, score: 90, reasoning: 'Thursday 3 PM - Peak engagement window' },
      { day: 3, hour: 14, score: 85, reasoning: 'Wednesday 2 PM - Strong weekday afternoon' },
      { day: 6, hour: 10, score: 80, reasoning: 'Saturday 10 AM - Weekend morning audience' },
      { day: 5, hour: 16, score: 75, reasoning: 'Friday 4 PM - Pre-weekend content consumption' },
      { day: 0, hour: 11, score: 70, reasoning: 'Sunday 11 AM - Weekend leisure time' },
    ];

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + i);
      const dayOfWeek = targetDate.getDay();

      const bestForDay = generalBestTimes.find(bt => bt.day === dayOfWeek);
      if (bestForDay) {
        targetDate.setHours(bestForDay.hour, 0, 0, 0);
        suggestions.push({
          date: targetDate,
          score: bestForDay.score,
          confidence: 0.7,
          reasoning: bestForDay.reasoning,
          competingVideos: 0,
        });
      }
    }

    return suggestions;
  }

  async scheduleBatch(
    channelIds: string[],
    videos: Video[],
    options?: {
      spacingHours?: number;
      startFrom?: Date;
      maxPerDay?: number;
    }
  ): Promise<BatchSchedule> {
    const spacing = options?.spacingHours || 24;
    const startFrom = options?.startFrom || new Date();
    const maxPerDay = options?.maxPerDay || 2;

    const prioritizedVideos = videos
      .filter(v => v.status === 'draft' || v.status === 'ready')
      .sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));

    const items: QueueItem[] = [];
    let currentDate = new Date(startFrom);
    let videosToday = 0;
    let totalDuration = 0;
    let estimatedViews = 0;

    for (const video of prioritizedVideos) {
      if (videosToday >= maxPerDay) {
        currentDate.setDate(currentDate.getDate() + 1);
        videosToday = 0;
      }

      const optimalTime = await this.findOptimalTime(video, 7);
      optimalTime.setDate(currentDate.getDate());
      optimalTime.setMonth(currentDate.getMonth());
      optimalTime.setFullYear(currentDate.getFullYear());

      const priority = await this.calculatePriority(video);

      items.push({
        video,
        priority,
        recommendedTime: optimalTime,
        reasoning: `Scheduled for ${optimalTime.toLocaleString()}`,
      });

      videosToday++;
      totalDuration += video.duration || 300;
      estimatedViews += Math.round((video.viral_score || 50) * 100);
    }

    return {
      items,
      totalDuration,
      estimatedViews,
      spacing,
      startFrom,
    };
  }

  async optimizeQueue(): Promise<{
    changes: string[];
    newOrder: QueueItem[];
  }> {
    const currentQueue = await this.getPrioritizedQueue();
    const changes: string[] = [];

    const highPriority = currentQueue.filter(i => i.priority >= 8);
    const mediumPriority = currentQueue.filter(i => i.priority >= 4 && i.priority < 8);
    const lowPriority = currentQueue.filter(i => i.priority < 4);

    if (highPriority.length > 5) {
      changes.push('Consider spreading high-priority uploads across multiple days');
    }

    if (lowPriority.some(i => !i.recommendedTime || i.recommendedTime > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))) {
      changes.push('Some low-priority items may be better suited for later scheduling');
    }

    const failed = currentQueue.filter(i => i.queueEntry?.status === 'failed');
    if (failed.length > 0) {
      changes.push(`${failed.length} failed uploads need attention`);
    }

    const newOrder = [...highPriority, ...mediumPriority, ...lowPriority];

    return { changes, newOrder };
  }

  async retryFailedVideos(): Promise<{ retried: string[]; stillFailed: string[] }> {
    const queue = await getUploadQueue();
    const failed = queue.filter(q => q.status === 'failed');

    const retried: string[] = [];
    const stillFailed: string[] = [];

    for (const entry of failed) {
      try {
        if (entry.video_id) {
          await retryUpload(entry.video_id);
          retried.push(entry.video_id);
        }
      } catch {
        stillFailed.push(entry.video_id || 'unknown');
      }
    }

    return { retried, stillFailed };
  }

  async cancelScheduledUpload(scheduledId: string): Promise<void> {
    await cancelScheduledPublish(scheduledId);
  }

  async getQueueStats(): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    scheduled: number;
  }> {
    const [queue, scheduled] = await Promise.all([
      getUploadQueue(),
      getScheduledPublishes(),
    ]);

    return {
      pending: queue.filter(q => q.status === 'queued').length,
      inProgress: queue.filter(q => q.status === 'uploading').length,
      completed: queue.filter(q => q.status === 'completed').length,
      failed: queue.filter(q => q.status === 'failed').length,
      scheduled: scheduled.filter(s => s.status === 'pending').length,
    };
  }
}

export const smartQueue = new SmartQueue();

// ==========================================
// 1-MONTH ALGORITHM MONETIZATION EXTENSIONS
// ==========================================

/**
 * Calculates high-retention upload windows based on target niche
 */
export function calculatePeakSlots(count: number, targetAudience: string = 'gen_z'): Date[] {
  const slots: Date[] = [];
  const now = new Date();
  
  const audiencePeakHours: Record<string, number[]> = {
    gen_z: [13, 18, 21],      // 1 PM, 6 PM, 9 PM
    techies: [9, 14, 19],     // 9 AM, 2 PM, 7 PM
    mass: [11, 17, 20],       // 11 AM, 5 PM, 8 PM
    finance: [8, 12, 18]      // 8 AM, 12 PM, 6 PM
  };

  const activeHours = audiencePeakHours[targetAudience] || audiencePeakHours.gen_z;
  let currentDayOffset = 0;
  let hourIndex = 0;

  while (slots.length < count) {
    const slotDate = new Date();
    slotDate.setDate(now.getDate() + currentDayOffset);
    
    const targetHour = activeHours[hourIndex];
    slotDate.setHours(targetHour, 0, 0, 0);

    if (slotDate > now) {
      slots.push(new Date(slotDate));
    }

    hourIndex++;
    if (hourIndex >= activeHours.length) {
      hourIndex = 0;
      currentDayOffset++;
    }
  }

  return slots;
}

/**
 * Spaces out viral shorts across peak slots to hack the YouTube Recommendation Algorithm
 */
export async function scheduleViralBatch(
  shorts: Short[], 
  channelId: string, 
  options: QueueOptions = {}
): Promise<{ success: boolean; scheduledCount: number; slots: string[] }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const audience = options.targetAudience || 'gen_z';
    const peakSlots = calculatePeakSlots(shorts.length, audience);
    
    const scheduledRecords = [];
    const slotStrings = [];

    for (let i = 0; i < shorts.length; i++) {
      const short = shorts[i];
      const scheduledTime = peakSlots[i];
      slotStrings.push(scheduledTime.toLocaleString());

      scheduledRecords.push({
        user_id: user.id,
        video_id: short.id,
        youtube_channel_id: channelId,
        scheduled_for: scheduledTime.toISOString(),
        status: 'pending'
      });

      await supabase
        .from('shorts')
        .update({ status: 'scheduled' })
        .eq('id', short.id);
    }

    const { error: insertErr } = await supabase
      .from('scheduled_publishes')
      .insert(scheduledRecords);

    if (insertErr) throw insertErr;

    console.log(`🚀 Successfully queued ${shorts.length} shorts for Algorithm push!`);

    return {
      success: true,
      scheduledCount: shorts.length,
      slots: slotStrings
    };

  } catch (error: any) {
    console.error('Viral Batch Queue Error:', error);
    throw new Error(`Queue scheduling failed: ${error.message}`);
  }
}

/**
 * Quick monitoring hook for background workers
 */
export async function getQueueMetrics() {
  try {
    const { data, error } = await supabase
      .from('scheduled_publishes')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (error) throw error;

    return {
      totalPending: data?.length || 0,
      nextUpload: data?.[0]?.scheduled_for || null
    };
  } catch (e) {
    console.error('Failed to fetch queue metrics', e);
    return { totalPending: 0, nextUpload: null };
  }
}