/**
 * Intelligence Core - Multi-Model AI with Fallback Support
 *
 * Provides a unified interface for AI operations with:
 * - Primary: Gemini API (user's own key - free tier available)
 * - Automatic fallback between Gemini models
 * - Retry logic with exponential backoff
 * - Response caching for efficiency
 */

interface AIModelConfig {
  name: string;
  provider: 'gemini';
  priority: number;
  maxRetries: number;
  timeoutMs: number;
}

interface AIResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  cached: boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MODEL_CONFIGS: AIModelConfig[] = [
  { name: 'gemini-2.0-flash', provider: 'gemini', priority: 1, maxRetries: 2, timeoutMs: 30000 },
  { name: 'gemini-1.5-flash', provider: 'gemini', priority: 2, maxRetries: 2, timeoutMs: 30000 },
  { name: 'gemini-1.5-pro', provider: 'gemini', priority: 3, maxRetries: 2, timeoutMs: 45000 },
];

export class IntelligenceCore {
  private apiKey: string | null = null;
  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  private getCacheKey(messages: ChatMessage[], model: string): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    return `${model}:${btoa(content.slice(0, 500))}`;
  }

  private getCached(key: string): AIResponse | null {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return { ...cached.response, cached: true };
    }
    return null;
  }

  private setCached(key: string, response: AIResponse): void {
    this.responseCache.set(key, { response, timestamp: Date.now() });
    if (this.responseCache.size > 100) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) this.responseCache.delete(oldestKey);
    }
  }

  async callWithFallback(
    messages: ChatMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      preferredModel?: string;
    }
  ): Promise<AIResponse> {
    const models = [...MODEL_CONFIGS].sort((a, b) => a.priority - b.priority);

    if (options?.preferredModel) {
      const preferredIdx = models.findIndex(m => m.name === options.preferredModel);
      if (preferredIdx > 0) {
        const [preferred] = models.splice(preferredIdx, 1);
        models.unshift(preferred);
      }
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (const model of models) {
      const cacheKey = this.getCacheKey(messages, model.name);
      const cached = this.getCached(cacheKey);
      if (cached) return cached;

      for (let attempt = 0; attempt < model.maxRetries; attempt++) {
        try {
          const response = await this.callModel(model, messages, options);
          this.setCached(cacheKey, response);
          return response;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < model.maxRetries - 1) {
            await this.backoff(attempt);
          }
        }
      }
    }

    throw lastError || new Error('All models failed');
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async callModel(
    model: AIModelConfig,
    messages: ChatMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    return this.callGemini(model.name, messages, options);
  }

  private async callGemini(
    model: string,
    messages: ChatMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('NO_API_KEY');
    }

    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const conversationHistory = messages.filter(m => m.role !== 'system');

    const contents = conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        content,
        model: `gemini/${model}`,
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        latencyMs: Date.now() - startTime,
        cached: false,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return this.callWithFallback(messages, options);
  }

  async chat(
    history: ChatMessage[],
    newMessage: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...history);
    messages.push({ role: 'user', content: newMessage });
    return this.callWithFallback(messages, options);
  }

  async analyze(
    content: string,
    analysisType: 'sentiment' | 'seo' | 'engagement' | 'viral' | 'content'
  ): Promise<Record<string, unknown>> {
    const systemPrompts: Record<string, string> = {
      sentiment: 'Analyze the sentiment of the following content. Return a JSON object with: sentiment (positive/negative/neutral), confidence (0-1), emotionalTones (array), and keyPhrases (array).',
      seo: 'Analyze the SEO quality of the following content. Return a JSON object with: score (0-100), keywordDensity, readabilityScore, suggestions (array), and optimizationTips (array).',
      engagement: 'Analyze potential engagement of the following content. Return a JSON object with: predictedEngagement (low/medium/high), engagementScore (0-100), hookStrength (0-100), callToActionStrength (0-100), and suggestions (array).',
      viral: 'Analyze viral potential of the following content. Return a JSON object with: viralScore (0-100), shareability (0-100), emotionalImpact (0-100), trendAlignment (0-100), and improvementSuggestions (array).',
      content: 'Analyze the content quality. Return a JSON object with: quality (0-100), clarity (0-100), uniqueness (0-100), valueScore (0-100), strengths (array), and weaknesses (array).',
    };

    const response = await this.generate(content, systemPrompts[analysisType], { temperature: 0.3 });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { raw: response.content };
    } catch {
      return { raw: response.content };
    }
  }

  clearCache(): void {
    this.responseCache.clear();
  }
}

export const intelligenceCore = new IntelligenceCore();

export async function getAIClient(): Promise<IntelligenceCore> {
  const { getUserSettings } = await import('../api');
  const settings = await getUserSettings();

  if (settings?.gemini_api_key) {
    return new IntelligenceCore(settings.gemini_api_key);
  }

  return new IntelligenceCore();
}
