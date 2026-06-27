import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface AgentState {
  id: string;
  agent_name: string;
  status: string;
  is_active: boolean;
}

export default function AIHome() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'listening'>('listening');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize only the required agent
  const initializeAgent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('agent_states').upsert({
      user_id: user.id,
      agent_name: 'YouTube Intelligence',
      agent_type: 'youtube_intelligence',
      status: 'idle',
      is_active: true,
    }, { onConflict: 'user_id,agent_name' });
  };

  useEffect(() => {
    initializeAgent();
    setMessages([{ role: 'assistant', content: "Hello! I am your YouTube Intelligence manager. How can I help you grow your channel today?" }]);
  }, []);

  // 2. Chat Logic with simple error handling
  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);
    setOrbState('thinking');

    try {
      // Fetch user settings to get API Key
      const { data: settings } = await supabase.from('user_settings').select('gemini_api_key').maybeSingle();
      
      if (!settings?.gemini_api_key) {
        throw new Error("API Key missing. Please add it in Settings.");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userMessage }] }]
        }),
      });

      if (response.status === 429) {
        throw new Error("Rate limit hit. Please wait a moment.");
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
      setOrbState('listening');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white p-4">
      <div className="flex-1 overflow-y-auto space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-cyan-900 ml-auto' : 'bg-slate-800'}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="max-w-2xl mx-auto w-full flex gap-2 mt-4">
        <input 
          className="flex-1 bg-slate-800 p-3 rounded"
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={handleSubmit} disabled={isProcessing} className="bg-cyan-600 px-6 rounded">Send</button>
      </div>
    </div>
  );
}