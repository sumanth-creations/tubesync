// src/lib/videoRenderer.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface Slide { text: string; }
export interface RenderProgress {
  stage: 'preparing' | 'downloading' | 'rendering' | 'finalizing' | 'done';
  slideIndex: number;
  totalSlides: number;
  percent?: number;
}
export interface RenderInput {
  sourceURL: string;
  hookStartTime: string;
  script: string;
  title: string;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

export function trimScriptToDuration(script: string, targetSeconds = 21): string {
  const wordsPerSecond = 2.3;
  const maxWords = Math.round(targetSeconds * wordsPerSecond);
  const words = script.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length <= maxWords) return script;
  const trimmed = words.slice(0, maxWords).join(' ');
  const lastSentenceEnd = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
  return lastSentenceEnd > trimmed.length * 0.5? trimmed.slice(0, lastSentenceEnd + 1) : trimmed + '.';
}

export function scriptToSlides(script: string, maxCharsPerSlide = 140): Slide[] {
  const sentences = script.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const slides: Slide[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if ((buffer + ' ' + sentence).trim().length > maxCharsPerSlide && buffer) {
      slides.push({ text: buffer.trim() });
      buffer = sentence;
    } else {
      buffer = (buffer + ' ' + sentence).trim();
    }
  }
  if (buffer) slides.push({ text: buffer.trim() });
  return slides.length > 0? slides : [{ text: script.slice(0, maxCharsPerSlide) }];
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
}

function speakText(text: string): Promise<Blob> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(new Blob([], { type: 'audio/webm' }));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    
    const audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(dest.stream);
    const chunks: BlobPart[] = [];
    
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));
    
    utterance.onstart = () => mediaRecorder.start();
    utterance.onend = () => setTimeout(() => mediaRecorder.stop(), 500);
    utterance.onerror = () => resolve(new Blob([]));
    
    speechSynthesis.speak(utterance);
  });
}

export async function renderShortFromSource(
  input: RenderInput,
  onProgress?: (p: RenderProgress) => void
): Promise<{ blob: Blob; hasAudio: boolean }> {
  onProgress?.({ stage: 'preparing', slideIndex: 0, totalSlides: 1, percent: 0 });

  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  onProgress?.({ stage: 'downloading', slideIndex: 0, totalSlides: 1, percent: 10 });

  const hookBlob = await downloadYouTubeClip(input.sourceURL, input.hookStartTime, 3);
  await ffmpeg.writeFile('hook.mp4', await fetchFile(hookBlob));

  onProgress?.({ stage: 'rendering', slideIndex: 0, totalSlides: 1, percent: 30 });

  const voiceBlob = await speakText(input.script);
  await ffmpeg.writeFile('voice.webm', await fetchFile(voiceBlob));

  const slides = scriptToSlides(input.script);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const canvasStream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
  const chunks: BlobPart[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  
  mediaRecorder.start();
  
  for (let i = 0; i < slides.length; i++) {
    drawSlide(ctx, slides[i], i + 1, slides.length, input.title);
    await new Promise(r => setTimeout(r, 21000 / slides.length));
    onProgress?.({ stage: 'rendering', slideIndex: i, totalSlides: slides.length, percent: 30 + (i / slides.length) * 40 });
  }
  
  mediaRecorder.stop();
  await new Promise<void>(r => mediaRecorder.onstop = () => r());
  const slidesBlob = new Blob(chunks, { type: 'video/webm' });
  await ffmpeg.writeFile('slides.webm', await fetchFile(slidesBlob));

  onProgress?.({ stage: 'finalizing', slideIndex: 1, totalSlides: 1, percent: 80 });

  await ffmpeg.exec([
    '-i', 'hook.mp4',
    '-i', 'slides.webm',
    '-i', 'voice.webm',
    '-filter_complex', '[1:v][2:a]concat=n=1:v=1:a=1[slides];[0:v][0:a][slides]concat=n=2:v=1:a=1',
    '-c:v', 'libvpx-vp9',
    '-c:a', 'libopus',
    'output.webm'
  ]);

  onProgress?.({ stage: 'done', slideIndex: 1, totalSlides: 1, percent: 100 });

  const data = await ffmpeg.readFile('output.webm');
  const uint8Array = new Uint8Array(data as ArrayBuffer);
  return { blob: new Blob([uint8Array], { type: 'video/webm' }), hasAudio: true };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSlide(ctx: CanvasRenderingContext2D, slide: Slide, slideNumber: number, totalSlides: number, title: string) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, CANVAS_HEIGHT - 12, CANVAS_WIDTH, 12);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title.toUpperCase(), 60, 80);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 28px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber}/${totalSlides}`, CANVAS_WIDTH - 60, 80);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 64px sans-serif';
  ctx.textAlign = 'center';
  const maxWidth = CANVAS_WIDTH - 200;
  const lines = wrapText(ctx, slide.text, maxWidth);
  const lineHeight = 80;
  const startY = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineHeight);
  });
}

async function downloadYouTubeClip(url: string, startTime: string, duration: number): Promise<Blob> {
  console.warn('downloadYouTubeClip: Implement backend download');
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start();
  await new Promise(r => setTimeout(r, 3000));
  recorder.stop();
  await new Promise<void>(r => recorder.onstop = () => r());
  return new Blob(chunks, { type: 'video/webm' });
}

export async function renderSlideshowVideo(
  slides: Slide[],
  title: string,
  onProgress?: (p: RenderProgress) => void
): Promise<{ blob: Blob; hasAudio: boolean }> {
  onProgress?.({ stage: 'preparing', slideIndex: 0, totalSlides: slides.length });

  if ('speechSynthesis' in window && speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      speechSynthesis.onvoiceschanged = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const canvasStream = canvas.captureStream(30);
  let audioTrack: MediaStreamTrack | null = null;
  let hasAudio = false;
  
  try {
    if ('getDisplayMedia' in navigator.mediaDevices) {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const tracks = displayStream.getAudioTracks();
      if (tracks.length > 0) {
        audioTrack = tracks[0];
        hasAudio = true;
      }
      displayStream.getVideoTracks().forEach((t) => t.stop());
    }
  } catch {
    hasAudio = false;
  }

  const videoTracks = canvasStream.getVideoTracks();
  const audioTracks = audioTrack? [audioTrack] : [];
  const combinedStream = new MediaStream([...videoTracks,...audioTracks]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(250);

  for (let i = 0; i < slides.length; i++) {
    onProgress?.({ stage: 'rendering', slideIndex: i, totalSlides: slides.length });
    drawSlide(ctx, slides[i], i + 1, slides.length, title);
    await speakSlide(slides[i].text);
    await new Promise((r) => setTimeout(r, 400));
  }

  onProgress?.({ stage: 'finalizing', slideIndex: slides.length, totalSlides: slides.length });
  recorder.stop();
  await recordingDone;
  audioTrack?.stop();

  onProgress?.({ stage: 'done', slideIndex: slides.length, totalSlides: slides.length });
  return { blob: new Blob(chunks, { type: 'video/webm' }), hasAudio };
}

function speakSlide(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      setTimeout(resolve, Math.max(1800, text.length * 60));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}