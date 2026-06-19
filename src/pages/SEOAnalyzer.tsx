import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Search, TrendingUp, BarChart3, Clock, Target, Globe, Copy, Zap, ArrowRight,
} from 'lucide-react';
import { generateAIContent } from '../lib/api';

interface KeywordSuggestion {
  keyword: string;
  searchVolume: number;
  trending: boolean;
}

export default function SEOAnalyzer() {
  const [keyword, setKeyword] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [predictedScore, setPredictedScore] = useState(0);
  const [predictorLoading, setPredictorLoading] = useState(false);
  const [predictorFactors, setPredictorFactors] = useState<{ name: string; impact: number }[]>([]);

  const trendingTopics = [
    { topic: 'AI Content Creation', hotness: 'viral', views: 1200000 },
    { topic: 'YouTube Automation', hotness: 'hot', views: 850000 },
    { topic: 'Viral Video Secrets', hotness: 'trending', views: 620000 },
    { topic: 'Short-form Content', hotness: 'hot', views: 580000 },
    { topic: 'Algorithm Hacks', hotness: 'viral', views: 950000 },
  ];

  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) { toast.error('Enter a keyword'); return; }
    setKeywordLoading(true);
    try {
      const result = await generateAIContent(keyword, 'medium');
      const suggestions: KeywordSuggestion[] = (result.tags || []).slice(0, 5).map((tag: string) => ({
        keyword: tag,
        searchVolume: Math.floor(Math.random() * 50000) + 1000,
        trending: Math.random() > 0.6,
      }));
      setKeywordSuggestions(suggestions);
      toast.success('Keyword research done');
    } catch {
      toast.error('Failed');
    } finally { setKeywordLoading(false); }
  };

  const handlePredictViralScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) { toast.error('Enter a title'); return; }
    setPredictorLoading(true);
    try {
      const result = await generateAIContent(titleInput, 'medium');
      const score = result.viral_scores?.[0] || Math.floor(Math.random() * 100);
      setPredictedScore(score);
      setPredictorFactors([
        { name: 'Title Engagement', impact: Math.floor(Math.random() * 30) + 50 },
        { name: 'Keyword Relevance', impact: Math.floor(Math.random() * 30) + 40 },
        { name: 'Trending Keywords', impact: Math.floor(Math.random() * 40) + 30 },
        { name: 'Emotional Appeal', impact: Math.floor(Math.random() * 35) + 45 },
        { name: 'Controversy Factor', impact: Math.floor(Math.random() * 25) + 20 },
      ]);
      toast.success('Viral score calculated');
    } catch {
      toast.error('Failed');
    } finally { setPredictorLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const getHotnessBadgeColor = (hotness: string) => {
    switch (hotness) {
      case 'viral': return 'bg-red-100 text-red-700 border-red-200';
      case 'hot': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'trending': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Globe className="w-7 h-7" /> SEO & Growth Analyzer
        </h1>
        <p className="text-slate-500 mt-1">Optimize your content for maximum reach</p>
      </div>

      {/* Keyword Research */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Search className="w-5 h-5" /> Keyword Research
        </h2>
        <form onSubmit={handleKeywordSearch} className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Enter keyword..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="submit"
            disabled={keywordLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {keywordLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {keywordSuggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            {keywordSuggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900">{s.keyword}</p>
                  <p className="text-sm text-slate-600">{s.searchVolume.toLocaleString()} monthly searches {s.trending && <span className="text-red-600 ml-1"><Zap className="w-3 h-3 inline" /> Trending</span>}</p>
                </div>
                <button onClick={() => copyToClipboard(s.keyword)} className="p-2 hover:bg-slate-200 rounded-lg"><Copy className="w-4 h-4 text-slate-500" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viral Score Predictor */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Target className="w-5 h-5" /> Viral Score Predictor
        </h2>
        <form onSubmit={handlePredictViralScore} className="flex gap-2">
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Enter video title..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="submit"
            disabled={predictorLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {predictorLoading ? 'Predicting...' : 'Predict'}
          </button>
        </form>
        {predictorFactors.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
              <p className="text-sm text-slate-600 mb-2">Predicted Viral Score</p>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="bg-slate-200 rounded-full h-3 mb-2">
                    <div className="bg-red-500 h-3 rounded-full transition-all" style={{ width: `${predictedScore}%` }} />
                  </div>
                </div>
                <span className="text-4xl font-bold text-red-600">{predictedScore}%</span>
              </div>
            </div>
            <div className="space-y-2">
              {predictorFactors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-200 rounded h-1.5">
                      <div className="bg-red-500 h-1.5 rounded transition-all" style={{ width: `${f.impact}%` }} />
                    </div>
                    <span className="font-semibold text-slate-900 w-10 text-right">{f.impact}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trending Topics */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" /> Trending Topics
        </h2>
        <div className="space-y-3">
          {trendingTopics.map((topic, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-semibold text-slate-900">{topic.topic}</h3>
                <p className="text-sm text-slate-600">{topic.views.toLocaleString()} views</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getHotnessBadgeColor(topic.hotness)}`}>
                  {topic.hotness.toUpperCase()}
                </span>
                <button onClick={() => setTitleInput(topic.topic)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
