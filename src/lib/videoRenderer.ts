// src/lib/videoRenderer.ts
//
// 100% free, client-side video generation:
//   1. Splits the script into slides (sentences/chunks)
//   2. Draws each slide as a styled text card on a <canvas>
//   3. Narrates each slide using the browser's built-in Web Speech API
//      (speechSynthesis) — no paid TTS service required
//   4. Captures the canvas as a video stream (canvas.captureStream)
//      and records it with MediaRecorder, producing a .webm file
//
// Limitations (real, worth knowing):
//   - Voice quality is robotic (browser TTS), not human-like
//   - Output is a slideshow of text cards, not cinematic footage
//   - Must run with the tab open/focused on most browsers
//   - Output format is .webm (YouTube accepts this format directly)

export interface Slide {
  text: string;
}

export interface RenderProgress {
  stage: 'preparing' | 'rendering' | 'finalizing' | 'done';
  slideIndex: number;
  totalSlides: number;
}

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Trims a script to roughly fit a target spoken duration, assuming an
// average speaking rate of ~150 words/minute (2.5 words/sec) for the
// browser TTS voice at the rate we use (0.95x).
export function trimScriptToDuration(script: string, targetSeconds = 45): string {
  const wordsPerSecond = 2.3; // conservative estimate including slide pauses
  const maxWords = Math.round(targetSeconds * wordsPerSecond);
  const words = script.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length <= maxWords) return script;

  // Trim at the last full sentence boundary within the word budget
  const trimmed = words.slice(0, maxWords).join(' ');
  const lastSentenceEnd = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
  return lastSentenceEnd > trimmed.length * 0.5 ? trimmed.slice(0, lastSentenceEnd + 1) : trimmed + '.';
}

// Splits a script into readable slide-sized chunks (roughly one sentence
// or short group of sentences per slide).
export function scriptToSlides(script: string, maxCharsPerSlide = 140): Slide[] {
  const sentences = script
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

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

  return slides.length > 0 ? slides : [{ text: script.slice(0, maxCharsPerSlide) }];
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
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
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Accent bar
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, CANVAS_HEIGHT - 12, CANVAS_WIDTH, 12);

  // Title (small, top)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title.toUpperCase(), 60, 70);

  // Progress indicator
  ctx.fillStyle = '#64748b';
  ctx.font = '400 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${slideNumber} / ${totalSlides}`, CANVAS_WIDTH - 60, 70);

  // Main slide text, centered, wrapped
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 52px sans-serif';
  ctx.textAlign = 'center';
  const maxWidth = CANVAS_WIDTH - 200;
  const lines = wrapText(ctx, slide.text, maxWidth);
  const lineHeight = 68;
  const startY = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineHeight);
  });
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
}

function speakSlide(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      // No TTS available — just wait a fixed duration based on text length
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

// Renders the slides into a .webm video Blob, narrating each slide with
// the browser's speech synthesis and capturing both canvas + audio.
//
// IMPORTANT REAL LIMITATION: Browsers do not provide a reliable, universal
// way to capture Web Speech API (speechSynthesis) audio into a
// MediaStream/MediaRecorder — that audio plays through the OS audio
// output, not through a capturable Web Audio node. Some Chromium browsers
// allow capturing tab audio via getDisplayMedia({audio: true}) during a
// user-initiated screen/tab-share prompt, which DOES work and produces a
// real narrated video — so we use that when available, and fall back to
// a silent (video-only, on-screen text) export otherwise so the feature
// still works everywhere.
export async function renderSlideshowVideo(
  slides: Slide[],
  title: string,
  onProgress?: (p: RenderProgress) => void
): Promise<{ blob: Blob; hasAudio: boolean }> {
  onProgress?.({ stage: 'preparing', slideIndex: 0, totalSlides: slides.length });

  // Ensure voices are loaded (some browsers load them async)
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
  if (!ctx) throw new Error('Canvas not supported in this browser');

  const canvasStream = (canvas as HTMLCanvasElement).captureStream(30);

  // Try to get real narration audio via tab-capture (user must pick
  // "this tab" and check "share audio" in the browser prompt). This is
  // the only reliable cross-browser way to capture speechSynthesis audio.
  let audioTrack: MediaStreamTrack | null = null;
  let hasAudio = false;
  try {
    if ('getDisplayMedia' in navigator.mediaDevices) {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // required by spec even though we discard it
        audio: true,
      });
      const tracks = displayStream.getAudioTracks();
      if (tracks.length > 0) {
        audioTrack = tracks[0];
        hasAudio = true;
      }
      // Stop the video track from the display capture — we only wanted audio
      displayStream.getVideoTracks().forEach((t) => t.stop());
    }
  } catch {
    // User declined or browser doesn't support it — proceed without audio
    hasAudio = false;
  }

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioTrack ? [audioTrack] : []),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

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
    // Small pause between slides
    await new Promise((r) => setTimeout(r, 400));
  }

  onProgress?.({ stage: 'finalizing', slideIndex: slides.length, totalSlides: slides.length });
  recorder.stop();
  await recordingDone;
  audioTrack?.stop();

  onProgress?.({ stage: 'done', slideIndex: slides.length, totalSlides: slides.length });
  return { blob: new Blob(chunks, { type: 'video/webm' }), hasAudio };
}
