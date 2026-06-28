import { useState, useRef } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { getUserSettings } from '../lib/api';

export default function AIAgentPage() {
  const [messages, setMessages] = useState([{ id: '1', role: 'assistant', content: 'Hello! I am ready to help. What do you need?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    const userMsg = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const settings = await getUserSettings();
      if (!settings?.gemini_api_key) throw new Error("API Key ledhu! Settings lo add cheyyi.");

      // Kotha structure (1.5-flash)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: input }] }]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Something went wrong");
      }

      const aiText = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: "Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-y-auto mb-4">
        {messages.map(m => (
          <div key={m.id} className={`p-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className="p-2 bg-gray-200 rounded">{m.content}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} className="border p-2 flex-1" />
        <button onClick={handleSend} disabled={loading} className="bg-blue-600 text-white p-2">
          {loading ? <Loader2 className="animate-spin" /> : <Send />}
        </button>
      </div>
    </div>
  );
}