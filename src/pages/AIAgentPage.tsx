import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader as Loader2, Wand as Wand2, Video, Upload, TrendingUp } from 'lucide-react';
import { generateAIContent, createVideo, logActivity } from '../lib/api';
import type { AIContent } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your YouTube Automation Agent. I can help you with:\n\n• Generate video ideas and scripts\n• Create SEO-optimized titles and descriptions\n• Suggest trending topics\n• Optimize your content strategy\n• Schedule uploads\n\nWhat would you like to work on today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const lowerInput = input.toLowerCase();
      let response: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      if (lowerInput.includes('idea') || lowerInput.includes('topic') || lowerInput.includes('trending')) {
        const aiContent = await generateAIContent(input.replace(/(ideas?|topics?|trending)/gi, '').trim() || 'YouTube content', 'medium');
        response.content = `Here are some trending content ideas for you:\n\n${aiContent.video_ideas.map((idea, i) => `${i + 1}. ${idea}`).join('\n')}\n\nTrending topics:\n${aiContent.trending_topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
        response.suggestions = aiContent.video_ideas.slice(0, 3);
      } else if (lowerInput.includes('title') || lowerInput.includes('seo')) {
        const aiContent = await generateAIContent(input.replace(/(titles?|seo)/gi, '').trim() || 'YouTube video', 'medium');
        response.content = `Here are SEO-optimized title suggestions:\n\n${aiContent.titles.map((title, i) => `${i + 1}. ${title} (Viral Score: ${aiContent.viral_scores[i]}%)`).join('\n')}\n\nSEO Keywords: ${aiContent.seo_keywords.join(', ')}`;
        response.suggestions = aiContent.titles.slice(0, 3);
      } else if (lowerInput.includes('script') || lowerInput.includes('description')) {
        const aiContent = await generateAIContent(input.replace(/(scripts?|descriptions?)/gi, '').trim() || 'YouTube video', 'medium');
        response.content = `Here are script suggestions:\n\n${aiContent.scripts.map((script, i) => `Script ${i + 1}:\n${script}`).join('\n\n')}\n\nDescriptions:\n${aiContent.descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
      } else if (lowerInput.includes('hashtag') || lowerInput.includes('tag')) {
        const aiContent = await generateAIContent(input.replace(/(hashtags?|tags?)/gi, '').trim() || 'YouTube video', 'medium');
        response.content = `Recommended tags: ${aiContent.tags.join(', ')}\n\nHashtags: ${aiContent.hashtags.join(' ')}\n\nSEO Keywords: ${aiContent.seo_keywords.join(', ')}`;
      } else if (lowerInput.includes('thumbnail')) {
        const aiContent = await generateAIContent(input.replace(/(thumbnails?)/gi, '').trim() || 'YouTube video', 'medium');
        response.content = `Thumbnail ideas:\n\n${aiContent.thumbnail_ideas.map((idea, i) => `${i + 1}. ${idea}`).join('\n')}`;
      } else if (lowerInput.includes('schedule') || lowerInput.includes('upload')) {
        response.content = 'I can help you schedule uploads! Go to the Calendar page to set up your content schedule, or use the Upload Queue to manage pending uploads.\n\nYou can:\n• Schedule daily uploads\n• Set custom frequencies\n• Bulk upload videos\n• Auto-publish at optimal times';
      } else if (lowerInput.includes('short')) {
        response.content = 'I can help you create Shorts from your long-form videos! Go to the Shorts Generator page to:\n\n• Extract viral moments\n• Auto-generate captions\n• Create 9:16 vertical format\n• Generate multiple variations';
      } else if (lowerInput.includes('analytics') || lowerInput.includes('growth') || lowerInput.includes('performance')) {
        response.content = 'Check your Dashboard for growth insights! I track:\n\n• Subscriber growth\n• View trends\n• Upload success rates\n• Best performing content\n• Audience engagement metrics';
      } else {
        const aiContent = await generateAIContent(input, 'medium');
        response.content = `Here's what I found for "${input}":\n\n**Titles:**\n${aiContent.titles.slice(0, 3).join('\n')}\n\n**Tags:** ${aiContent.tags.slice(0, 5).join(', ')}\n\n**Hashtags:** ${aiContent.hashtags.slice(0, 4).join(' ')}\n\n**Trending Topics:**\n${aiContent.trending_topics.slice(0, 3).join('\n')}\n\nWould you like me to generate a full script or schedule this content?`;
      }

      setMessages((prev) => [...prev, response]);
      await logActivity({
        type: 'ai_generated',
        title: 'AI Agent generated content',
        description: input.substring(0, 100),
      }).catch(() => {});
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  const quickActions = [
    { icon: Sparkles, label: 'Generate Ideas', prompt: 'Generate video ideas for my channel' },
    { icon: Wand2, label: 'Create Titles', prompt: 'Create SEO-optimized titles' },
    { icon: Video, label: 'Write Script', prompt: 'Write a video script' },
    { icon: Upload, label: 'Schedule Upload', prompt: 'Help me schedule uploads' },
    { icon: TrendingUp, label: 'Trending Topics', prompt: 'What are trending topics?' },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" /> AI YouTube Agent
        </h1>
        <p className="text-slate-600">Your intelligent assistant for YouTube growth and automation</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.prompt)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm whitespace-nowrap"
          >
            <action.icon className="w-4 h-4 text-purple-600" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant' ? 'bg-purple-100' : 'bg-red-100'
              }`}>
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-purple-600" />
                ) : (
                  <User className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'assistant'
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-red-600 text-white'
              }`}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                {message.suggestions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickAction(`Use this idea: ${suggestion}`)}
                        className="px-3 py-1 bg-white/20 rounded-full text-xs hover:bg-white/30 transition-colors"
                      >
                        {suggestion.substring(0, 40)}...
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything about YouTube automation..."
          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
}
