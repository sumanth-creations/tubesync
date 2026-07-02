import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Scissors, Sparkles, Play, TrendingUp, Upload, Loader as Loader2, Check, Video as VideoIcon } from 'lucide-react';
import { getVideos, generateShorts, getShorts } from '../lib/api';
import type { Video, Short } from '../types';

export default function ShortsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [shortCount, setShortCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadVideos();
    loadShorts();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await getVideos();
      setVideos(data);
      if (data.length > 0) setSelectedVideoId(data[0].id);
    } catch (error) {
      toast.error('Failed to load videos');
    }
  };

  const loadShorts = async () => {
    try {
      const data = await getShorts();
      setShorts(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateShorts = async () => {
    if (!selectedVideoId) {
      toast.error('Please select a video');
      return;
    }
    setGenerating(true);
    try {
      await generateShorts(selectedVideoId, shortCount);
      toast.success(`Generated ${shortCount} shorts`);
      await loadShorts();
    } catch (error) {
      toast.error('Failed to generate shorts');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Scissors className="w-7 h-7" /> Shorts Generator
        </h1>
        <p className="text-slate-500 mt-1">Generate viral shorts from your long-form videos</p>
      </div>

      {/* Generator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Shorts</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Source Video</label>
            {videos.length > 0 ? (
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            ) : (
              <p className="text-slate-500">No videos available. Create one first.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Number of Shorts</label>
              <span className="text-xl font-bold text-red-500">{shortCount}</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              value={shortCount}
              onChange={(e) => setShortCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>3</span>
              <span>20</span>
            </div>
          </div>

          <button
            onClick={handleGenerateShorts}
            disabled={generating || !selectedVideoId}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {generating ? 'Generating...' : 'Generate Shorts'}
          </button>
        </div>
      </div>

      {/* Results */}
      {shorts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Generated Shorts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shorts.map((short) => (
              <div key={short.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative bg-slate-900 aspect-[9/16] flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                  <Play className="w-12 h-12 text-white opacity-50 relative z-10" />
                  {short.viral_score && (
                    <div className="absolute top-3 right-3 z-20 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-semibold">
                      <TrendingUp className="w-4 h-4" />
                      {short.viral_score}%
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-20 bg-slate-900/70 text-white px-3 py-1 rounded-full text-xs font-semibold capitalize">
                    {short.status}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 line-clamp-2 mb-1">{short.title}</h3>
                  <p className="text-xs text-slate-500 mb-3">Duration: {short.duration}s</p>
                  {short.captions && (
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 mb-3">
                      <p className="text-xs text-slate-600 line-clamp-2">{short.captions.join(', ')}</p>
                    </div>
                  )}
                  <button
                    disabled={short.status === 'uploaded'}
                    className={`w-full font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      short.status === 'uploaded'
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {short.status === 'uploaded' ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {short.status === 'uploaded' ? 'Uploaded' : 'Upload'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!generating && shorts.length === 0 && videos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Scissors className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Shorts Generated</h3>
          <p className="text-slate-600">Select a video and click &quot;Generate Shorts&quot; to get started</p>
        </div>
      )}
    </div>
  );
}
