import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, ArrowRight, ArrowLeft, Check, Loader as Loader2, Type, Hash, Calendar, Clock, Eye, Upload, Wand as Wand2, FileVideo, X } from 'lucide-react';
import { createVideo, queueForUpload, generateAIContent, generateAIContentReal, updateVideo, logActivity, uploadVideoFile, pushVideoToYouTube, getYouTubeChannels } from '../lib/api';
import { supabase } from '../lib/supabase';
import { scriptToSlides, renderSlideshowVideo, type RenderProgress } from '../lib/videoRenderer';
import type { Video, AIContent, YouTubeChannel } from '../types';

type Step = 'details' | 'content' | 'preview' | 'upload';

const steps = [
  { id: 'details' as Step, label: 'Video Details', icon: Type },
  { id: 'content' as Step, label: 'AI Content', icon: Sparkles },
  { id: 'preview' as Step, label: 'Preview', icon: Eye },
  { id: 'upload' as Step, label: 'Upload', icon: Upload },
];

export default function GeneratePage() {
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'short' | 'medium' | 'long'>('short');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('private');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [category, setCategory] = useState('Entertainment');

  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedDescription, setSelectedDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const [createdVideo, setCreatedVideo] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fileUploadStage, setFileUploadStage] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [pushStage, setPushStage] = useState<'idle' | 'pushing' | 'done' | 'failed'>('idle');
  const [resultUrl, setResultUrl] = useState('');
  const [autoRendering, setAutoRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);

  useEffect(() => {
    getYouTubeChannels()
      .then((list) => {
        setChannels(list);
        if (list[0]) setSelectedChannelId(list[0].youtube_channel_id);
      })
      .catch(() => {});
  }, []);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleGenerateAIContent = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title first');
      return;
    }
    setGenerating(true);
    try {
      let content;
      try {
        content = await generateAIContentReal(title, format);
      } catch (err) {
        if (err instanceof Error && err.message === 'NO_API_KEY') {
          toast('No Gemini API key set — using basic templates. Add a free key in Settings for real AI content.', { duration: 6000 });
          content = await generateAIContent(title, format);
        } else {
          throw err;
        }
      }
      setAiContent(content);
      setSelectedTitle(content.titles[0] || title);
      setSelectedDescription(content.descriptions[0] || '');
      setSelectedTags(content.tags.slice(0, 5));
      setSelectedHashtags(content.hashtags.slice(0, 5));
      toast.success('AI content generated!');
    } catch (error) {
      toast.error('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleCreateVideo = async () => {
    setLoading(true);
    try {
      const scheduledAt = scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : null;

      const video = await createVideo({
        title: selectedTitle || title || 'Untitled Video',
        description: selectedDescription,
        tags: selectedTags,
        hashtags: selectedHashtags,
        privacy_status: privacy,
        category_id: category,
        is_short: format === 'short',
        status: 'ready',
        scheduled_publish_at: scheduledAt,
      });
      setCreatedVideo(video);
      await logActivity({
        type: 'video_created',
        title: 'Video created',
        description: video.title,
        video_id: video.id,
      }).catch(() => {});
      handleNext();
    } catch (error) {
      toast.error('Failed to create video');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }
    const maxBytes = 500 * 1024 * 1024; // 500MB soft cap for edge-function-based upload
    if (file.size > maxBytes) {
      toast.error('File too large for direct upload (max 500MB). Try a smaller export.');
      return;
    }
    setVideoFile(file);
  };

  const handleUploadFile = async () => {
    if (!createdVideo || !videoFile) return;
    setFileUploadStage('uploading');
    try {
      await uploadVideoFile(createdVideo.id, videoFile);
      setFileUploadStage('done');
      toast.success('Video file uploaded!');
    } catch (error) {
      setFileUploadStage('idle');
      toast.error(error instanceof Error ? error.message : 'File upload failed');
    }
  };

  const handlePushToYouTube = async () => {
    if (!createdVideo) return;
    if (!selectedChannelId) {
      toast.error('Connect and select a YouTube channel first (Settings page)');
      return;
    }
    setPushStage('pushing');
    try {
      await pushVideoToYouTube(createdVideo.id, selectedChannelId);
      // Poll briefly for the final status since the edge function runs synchronously
      // and returns once the YouTube upload finishes (or fails).
      const { data } = await supabase
        .from('videos')
        .select('status, youtube_video_url, error_message')
        .eq('id', createdVideo.id)
        .single();
      if (data?.status === 'uploaded' && data.youtube_video_url) {
        setResultUrl(data.youtube_video_url);
        setPushStage('done');
        toast.success('Uploaded to YouTube!');
      } else if (data?.status === 'failed') {
        setPushStage('failed');
        toast.error(data.error_message || 'Upload to YouTube failed');
      } else {
        setPushStage('done');
        toast.success('Upload started — check Videos page for status');
      }
      setUploadComplete(true);
    } catch (error) {
      setPushStage('failed');
      toast.error(error instanceof Error ? error.message : 'Failed to push to YouTube');
    }
  };

  const handleAutoCreate = async () => {
    if (!createdVideo) return;
    if (!selectedChannelId) {
      toast.error('Connect and select a YouTube channel first (Settings page)');
      return;
    }

    const scriptText = aiContent?.scripts?.[0] || selectedDescription || selectedTitle;
    if (!scriptText) {
      toast.error('No script available to narrate. Go back and generate AI content first.');
      return;
    }

    setAutoRendering(true);
    setRenderProgress(null);
    try {
      const slides = scriptToSlides(scriptText);
      toast('A browser prompt may appear asking to share this tab\'s audio — allow it for voiceover, or skip for a silent slideshow.', { duration: 6000 });

      const { blob, hasAudio } = await renderSlideshowVideo(slides, selectedTitle || title, (p) => setRenderProgress(p));

      if (!hasAudio) {
        toast('Created without voiceover audio (silent slideshow). You can still publish it.', { duration: 5000 });
      }

      setFileUploadStage('uploading');
      await uploadVideoFile(createdVideo.id, blob, undefined, `${createdVideo.id}.webm`);
      setFileUploadStage('done');

      setPushStage('pushing');
      await pushVideoToYouTube(createdVideo.id, selectedChannelId);
      const { data } = await supabase
        .from('videos')
        .select('status, youtube_video_url, error_message')
        .eq('id', createdVideo.id)
        .single();

      if (data?.status === 'uploaded' && data.youtube_video_url) {
        setResultUrl(data.youtube_video_url);
        setPushStage('done');
        toast.success('Video created and uploaded to YouTube!');
      } else if (data?.status === 'failed') {
        setPushStage('failed');
        toast.error(data.error_message || 'Upload to YouTube failed');
      } else {
        setPushStage('done');
        toast.success('Upload started — check Videos page for status');
      }
      setUploadComplete(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auto-create failed');
      setPushStage('failed');
    } finally {
      setAutoRendering(false);
      setRenderProgress(null);
    }
  };

  const handleQueueOnly = async () => {
    if (!createdVideo) return;
    setUploading(true);
    try {
      await updateVideo(createdVideo.id, { status: 'queued' });
      await queueForUpload(createdVideo.id);
      await logActivity({
        type: 'upload_queued',
        title: 'Video queued for upload',
        description: createdVideo.title,
        video_id: createdVideo.id,
      }).catch(() => {});
      setUploadComplete(true);
      toast.success('Video added to upload queue!');
    } catch (error) {
      toast.error('Failed to queue upload');
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = () => {
    navigate('/videos');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'details':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Video Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your video"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Video Format</label>
              <div className="grid grid-cols-3 gap-3">
                {(['short', 'medium', 'long'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      format === f ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 capitalize">{f}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {f === 'short' ? '15-60 sec' : f === 'medium' ? '1-5 min' : '5+ min'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Privacy</label>
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as 'public' | 'unlisted' | 'private')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none bg-white"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none bg-white"
                >
                  <option value="Entertainment">Entertainment</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Music">Music</option>
                  <option value="Education">Education</option>
                  <option value="Tech">Tech</option>
                  <option value="Lifestyle">Lifestyle</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Schedule Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Schedule Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                />
              </div>
            </div>
          </div>
        );

      case 'content':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">AI-Generated Content</h3>
              <button
                onClick={handleGenerateAIContent}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? 'Generating...' : 'Generate Content'}
              </button>
            </div>

            {aiContent ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Title</label>
                  <div className="space-y-2">
                    {aiContent.titles.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedTitle(t)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedTitle === t ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{t}</span>
                          <span className="text-xs text-slate-500">Score: {aiContent.viral_scores[i]}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <div className="space-y-2">
                    {aiContent.descriptions.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedDescription(d)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                          selectedDescription === d ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {aiContent.tags.map((tag, i) => (
                      <button
                        key={i}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedTags.includes(tag) ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Hashtags</label>
                  <div className="flex flex-wrap gap-2">
                    {aiContent.hashtags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Click &quot;Generate Content&quot; to create AI-powered titles, descriptions, and tags</p>
              </div>
            )}
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">Video Preview</h3>
            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Title</span>
                <p className="text-lg font-semibold text-slate-900">{selectedTitle || title || 'Untitled'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Description</span>
                <p className="text-sm text-slate-700 mt-1">{selectedDescription || 'No description'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-slate-200">
                <div><span className="text-slate-500">Format:</span> <span className="font-medium capitalize">{format}</span></div>
                <div><span className="text-slate-500">Privacy:</span> <span className="font-medium capitalize">{privacy}</span></div>
                <div><span className="text-slate-500">Category:</span> <span className="font-medium">{category}</span></div>
                {scheduleDate && (
                  <div><span className="text-slate-500">Scheduled:</span> <span className="font-medium">{scheduleDate} {scheduleTime}</span></div>
                )}
              </div>
            </div>
          </div>
        );

      case 'upload':
        return (
          <div className="max-w-lg mx-auto py-6">
            {uploadComplete ? (
              <div className="text-center">
                {pushStage === 'failed' ? (
                  <>
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-6">
                      <X className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Failed</h2>
                    <p className="text-slate-500 mb-8">Check the Videos page for the error message, fix it, and retry.</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6">
                      <Check className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {resultUrl ? 'Uploaded to YouTube!' : 'Video Queued!'}
                    </h2>
                    {resultUrl ? (
                      <a
                        href={resultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-600 underline break-all mb-8 inline-block"
                      >
                        {resultUrl}
                      </a>
                    ) : (
                      <p className="text-slate-500 mb-8">Your video has been added to the upload queue.</p>
                    )}
                  </>
                )}
                <div>
                  <button
                    onClick={handleFinish}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    View My Videos
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Upload Your Video</h2>
                  <p className="text-slate-500 text-sm">Attach the video file and publish it to YouTube</p>
                </div>

                {/* One-click auto-create: AI script -> voiceover slideshow -> upload */}
                <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-5 h-5 text-red-600" />
                    <h3 className="font-semibold text-slate-800">Auto-Create Video (Free)</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Generates a narrated slideshow video from your script automatically and publishes it — no file needed.
                  </p>
                  {autoRendering ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {renderProgress
                          ? `${renderProgress.stage === 'rendering' ? `Rendering slide ${renderProgress.slideIndex + 1}/${renderProgress.totalSlides}` : renderProgress.stage}`
                          : 'Starting...'}
                      </div>
                      <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all"
                          style={{
                            width: renderProgress
                              ? `${Math.round(((renderProgress.slideIndex + 1) / renderProgress.totalSlides) * 100)}%`
                              : '5%',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleAutoCreate}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                    >
                      <Wand2 className="w-5 h-5" />
                      Auto-Create &amp; Publish
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 uppercase">or upload your own file</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* File picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Video File</label>
                  {videoFile ? (
                    <div className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileVideo className="w-6 h-6 text-red-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{videoFile.name}</p>
                          <p className="text-xs text-slate-500">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                      </div>
                      {fileUploadStage !== 'uploading' && (
                        <button
                          onClick={() => { setVideoFile(null); setFileUploadStage('idle'); }}
                          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 cursor-pointer transition-colors">
                      <FileVideo className="w-10 h-10 text-slate-300 mb-2" />
                      <span className="text-sm text-slate-500">Click to select a video file (max 500MB)</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>

                {videoFile && fileUploadStage !== 'done' && (
                  <button
                    onClick={handleUploadFile}
                    disabled={fileUploadStage === 'uploading'}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
                  >
                    {fileUploadStage === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {fileUploadStage === 'uploading' ? 'Uploading file...' : 'Upload File to Storage'}
                  </button>
                )}

                {fileUploadStage === 'done' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">YouTube Channel</label>
                      {channels.length === 0 ? (
                        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                          No YouTube channel connected. Go to Settings to connect one, then come back.
                        </p>
                      ) : (
                        <select
                          value={selectedChannelId}
                          onChange={(e) => setSelectedChannelId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none bg-white"
                        >
                          {channels.map((c) => (
                            <option key={c.id} value={c.youtube_channel_id}>{c.channel_title}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      onClick={handlePushToYouTube}
                      disabled={pushStage === 'pushing' || channels.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {pushStage === 'pushing' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {pushStage === 'pushing' ? 'Publishing to YouTube...' : 'Publish to YouTube Now'}
                    </button>
                  </>
                )}

                <div className="text-center">
                  <button
                    onClick={handleQueueOnly}
                    disabled={uploading}
                    className="text-sm text-slate-400 hover:text-slate-600 underline"
                  >
                    {uploading ? 'Adding to queue...' : "Skip file upload, just save to queue for later"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Generate Video</h1>
        <p className="text-slate-500">Create and publish video content with AI assistance</p>
      </div>

      {/* Step Progress */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  currentStep === step.id ? 'bg-red-600 text-white' :
                  index < currentStepIndex ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {index < currentStepIndex ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-1 font-medium ${
                  index <= currentStepIndex ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 lg:w-20 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      {currentStep !== 'upload' && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              currentStepIndex === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep === 'preview' ? (
            <button
              onClick={handleCreateVideo}
              disabled={loading || !selectedTitle}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating...' : 'Create Video'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={currentStep === 'content' && !aiContent}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:bg-slate-300 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
