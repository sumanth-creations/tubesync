import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader as Loader2, Wand as Wand2, Video, Upload, TrendingUp } from 'lucide-react';
import { chatWithAgent, logActivity } from '../lib/api';

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
      content: 'Hey! I\'m your AI assistant — ask me anything about your channel, video ideas, scripts, titles, or just chat. I understand Telugu, English, or a mix of both. What\'s on your mind?',
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

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const replyText = await chatWithAgent(input, historyForApi);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: replyText },
      ]);
      await logActivity({
        type: 'ai_generated',
        title: 'AI Agent chat',
        description: input.substring(0, 100),
      }).catch(() => {});
    } catch (error) {
      const isNoKey = error instanceof Error && error.message === 'NO_API_KEY';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isNoKey
            ? 'I need a free Gemini API key to chat properly. Head to Settings and paste in a key (it only takes a minute and it\'s free) — then come back and ask me anything!'
            : 'Sorry, I ran into an error talking to the AI service. Please try again in a moment.',
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
        <p className="text-slate-600">
          Your intelligent assistant for YouTube growth and automation. Powered by your own free{' '}
          <Link to="/settings" className="text-purple-600 underline">Gemini API key</Link>.
        </p>
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
