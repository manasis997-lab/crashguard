import { Button } from "@/components/ui/button";
import {
  Camera,
  Download,
  Film,
  MapPin,
  Mic,
  MicOff,
  Music2,
  ShieldAlert,
  Video,
  VideoOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashcam } from "../context/DashcamContext";

type Mode = "dashcam" | "video" | "audio";

interface Clip {
  id: number;
  url: string;
  timestamp: Date;
  durationMs: number;
}

interface AudioClip {
  id: number;
  url: string;
  timestamp: Date;
  durationMs: number;
}

export default function RecordPage() {
  const [mode, setMode] = useState<Mode>("dashcam");
  const { crashClips, dashcamStream, isRecording, bufferBlobs } = useDashcam();

  // ── Video state ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const dashcamPreviewRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoStartRef = useRef<number>(0);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [videoPermError, setVideoPermError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [clipIdCounter, setClipIdCounter] = useState(1);

  // ── Audio state ───────────────────────────────────────────────────────────
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioStartRef = useRef<number>(0);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioElapsed, setAudioElapsed] = useState(0);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [audioPermError, setAudioPermError] = useState<string | null>(null);
  const [audioClipIdCounter, setAudioClipIdCounter] = useState(1);

  // Attach dashcam stream to preview
  useEffect(() => {
    if (dashcamPreviewRef.current && dashcamStream) {
      dashcamPreviewRef.current.srcObject = dashcamStream;
    }
  }, [dashcamStream]);

  // ── Video camera init (only for manual Video tab) ─────────────────────────
  useEffect(() => {
    if (mode !== "video") return;
    if (videoStreamRef.current) return;
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: true })
      .then((stream) => {
        if (!mounted) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        videoStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setVideoPermError(
          err.name === "NotAllowedError"
            ? "Camera access denied. Please allow camera permissions and refresh."
            : `Unable to access camera: ${err.message}`,
        );
      });
    return () => {
      mounted = false;
    };
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoStreamRef.current)
        for (const t of videoStreamRef.current.getTracks()) t.stop();
      if (audioStreamRef.current)
        for (const t of audioStreamRef.current.getTracks()) t.stop();
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    };
  }, []);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // ── Video recording ───────────────────────────────────────────────────────
  const startVideoRecording = useCallback(() => {
    if (!videoStreamRef.current) return;
    videoChunksRef.current = [];
    const mr = new MediaRecorder(videoStreamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const durationMs = Date.now() - videoStartRef.current;
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setClips((prev) => [
        { id: clipIdCounter, url, timestamp: new Date(), durationMs },
        ...prev,
      ]);
      setClipIdCounter((c) => c + 1);
    };
    mr.start(500);
    videoRecorderRef.current = mr;
    videoStartRef.current = Date.now();
    setVideoElapsed(0);
    setIsVideoRecording(true);
    videoTimerRef.current = setInterval(
      () => setVideoElapsed(Date.now() - videoStartRef.current),
      500,
    );
  }, [clipIdCounter]);

  const stopVideoRecording = useCallback(() => {
    videoRecorderRef.current?.stop();
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    setIsVideoRecording(false);
  }, []);

  // ── Audio recording ───────────────────────────────────────────────────────
  const startAudioRecording = useCallback(async () => {
    try {
      if (!audioStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        audioStreamRef.current = stream;
      }
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "audio/webm";
      const mr = new MediaRecorder(audioStreamRef.current, { mimeType });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const durationMs = Date.now() - audioStartRef.current;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioClips((prev) => [
          { id: audioClipIdCounter, url, timestamp: new Date(), durationMs },
          ...prev,
        ]);
        setAudioClipIdCounter((c) => c + 1);
      };
      mr.start(500);
      audioRecorderRef.current = mr;
      audioStartRef.current = Date.now();
      setAudioElapsed(0);
      setIsAudioRecording(true);
      audioTimerRef.current = setInterval(
        () => setAudioElapsed(Date.now() - audioStartRef.current),
        500,
      );
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      setAudioPermError(
        error.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone permissions."
          : `Unable to access microphone: ${error.message}`,
      );
    }
  }, [audioClipIdCounter]);

  const stopAudioRecording = useCallback(() => {
    audioRecorderRef.current?.stop();
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setIsAudioRecording(false);
  }, []);

  const downloadClip = (
    clip: Clip | AudioClip | { url: string; id: number },
    ext: string,
    prefix: string,
  ) => {
    const a = document.createElement("a");
    a.href = clip.url;
    a.download = `crashguard-${prefix}-${clip.id}.${ext}`;
    a.click();
  };

  const tabStyle = (active: boolean, color: string) => ({
    background: active
      ? `oklch(${color} / 0.18)`
      : "oklch(0.13 0.005 270 / 0.8)",
    border: active
      ? `1px solid oklch(${color} / 0.5)`
      : "1px solid oklch(0.25 0.01 270 / 0.5)",
    color: active ? `oklch(${color})` : "oklch(0.55 0.01 80)",
  });

  return (
    <div className="min-h-dvh pb-36 pt-4 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Video size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Record
            </h1>
            <p className="text-xs text-muted-foreground">
              Dashcam &amp; evidence capture
            </p>
          </div>
        </div>
      </motion.div>

      {/* Crash Evidence Section */}
      {crashClips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={14} className="text-primary" />
            <h2 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">
              Crash Evidence
            </h2>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {crashClips.length}
            </span>
          </div>
          <div data-ocid="record.crash_list" className="space-y-4">
            <AnimatePresence initial={false}>
              {crashClips.map((clip, index) => (
                <motion.div
                  key={clip.id}
                  data-ocid={`record.crash.item.${index + 1}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="glass-card rounded-2xl overflow-hidden border border-primary/20"
                >
                  {/* biome-ignore lint/a11y/useMediaCaption: crash evidence clip */}
                  <video
                    src={clip.url}
                    controls
                    playsInline
                    className="w-full rounded-t-2xl"
                    style={{ maxHeight: 220 }}
                  />
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-primary" />
                        <p className="text-xs font-semibold text-primary">
                          Crash #{clip.id}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadClip(clip, "webm", "crash")}
                        className="gap-1.5 text-xs"
                      >
                        <Download size={13} />
                        Download
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clip.timestamp.toLocaleTimeString()} &middot;{" "}
                      {formatElapsed(clip.durationMs)}
                    </p>
                    {clip.location &&
                      clip.location !== "unknown" &&
                      clip.location !== "location unavailable" && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin size={10} className="text-muted-foreground" />
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {clip.location}
                          </p>
                        </div>
                      )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="my-5 border-t border-border/40" />
        </motion.div>
      )}

      {/* Mode toggle — 3 tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex gap-2 mb-5"
      >
        <button
          type="button"
          data-ocid="record.dashcam_tab"
          onClick={() => setMode("dashcam")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
          style={tabStyle(mode === "dashcam", "0.65 0.22 140")}
        >
          <Camera size={13} />
          Dashcam
          {isRecording && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-dot ml-0.5" />
          )}
        </button>
        <button
          type="button"
          data-ocid="record.video_tab"
          onClick={() => setMode("video")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
          style={tabStyle(mode === "video", "0.58 0.24 25")}
        >
          <Video size={13} />
          Video
        </button>
        <button
          type="button"
          data-ocid="record.audio_tab"
          onClick={() => setMode("audio")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
          style={tabStyle(mode === "audio", "0.55 0.18 260")}
        >
          <Mic size={13} />
          Audio
        </button>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── Dashcam Tab ── */}
        {mode === "dashcam" && (
          <motion.div
            key="dashcam-mode"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {isRecording && dashcamStream ? (
              <>
                {/* Live dashcam feed */}
                <div
                  className="relative glass-card rounded-2xl overflow-hidden mb-3"
                  style={{ aspectRatio: "16/9" }}
                >
                  {/* biome-ignore lint/a11y/useMediaCaption: live dashcam feed */}
                  <video
                    ref={dashcamPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
                    <span className="text-[11px] font-mono font-bold text-red-400">
                      DASHCAM
                    </span>
                  </div>
                </div>

                {/* Buffer segments */}
                <div className="glass-card rounded-xl p-4 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Rolling Buffer
                  </p>
                  {bufferBlobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">
                      Recording first segment…
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bufferBlobs.map((_, i) => (
                        <div
                          key={`seg-${bufferBlobs.length - i}`}
                          className="flex items-center gap-3"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: "oklch(0.65 0.22 140)" }}
                          />
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width:
                                  i === bufferBlobs.length - 1 ? "60%" : "100%",
                                background: "oklch(0.65 0.22 140 / 0.7)",
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            seg {bufferBlobs.length - i} · ~60s
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    {bufferBlobs.length}/{3} segments · ~
                    {bufferBlobs.length * 60}s pre-crash buffer
                  </p>
                </div>
              </>
            ) : (
              <div
                data-ocid="record.dashcam_empty_state"
                className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              >
                <Camera size={36} className="text-muted-foreground/40" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Dashcam is not running
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Go to Home and tap <strong>Start Driving Mode</strong> to
                  activate the dashcam.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Manual Video Tab ── */}
        {mode === "video" && (
          <motion.div
            key="video-mode"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {/* Camera preview */}
            <div
              className="relative glass-card rounded-2xl overflow-hidden mb-4"
              style={{ aspectRatio: "16/9" }}
            >
              {videoPermError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <VideoOff size={40} className="text-destructive/70" />
                  <p className="text-sm text-muted-foreground">
                    {videoPermError}
                  </p>
                </div>
              ) : (
                <>
                  {/* biome-ignore lint/a11y/useMediaCaption: live camera feed */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  )}
                  <AnimatePresence>
                    {isVideoRecording && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
                        <span className="text-xs font-mono font-bold text-red-400">
                          REC
                        </span>
                        <span className="text-xs font-mono text-white/80">
                          {formatElapsed(videoElapsed)}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Video record button */}
            {!videoPermError && (
              <div className="flex justify-center mb-6">
                <button
                  type="button"
                  data-ocid="record.primary_button"
                  onClick={
                    isVideoRecording ? stopVideoRecording : startVideoRecording
                  }
                  disabled={!cameraReady}
                  className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
                  style={{
                    background: isVideoRecording
                      ? "oklch(0.55 0.22 25)"
                      : "oklch(0.58 0.24 25)",
                    boxShadow: isVideoRecording
                      ? "0 0 0 4px oklch(0.55 0.22 25 / 0.3), 0 0 30px oklch(0.55 0.22 25 / 0.5)"
                      : "0 0 0 4px oklch(0.58 0.24 25 / 0.2), 0 4px 20px oklch(0.58 0.24 25 / 0.3)",
                  }}
                >
                  {isVideoRecording && (
                    <span
                      className="absolute inset-0 rounded-full animate-pulse-ring"
                      style={{ background: "oklch(0.55 0.22 25 / 0.4)" }}
                    />
                  )}
                  {isVideoRecording ? (
                    <span className="w-7 h-7 rounded-md bg-white" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-white/20 border-4 border-white" />
                  )}
                </button>
              </div>
            )}

            {/* Video clips list */}
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Saved Clips
            </h2>
            {clips.length === 0 ? (
              <div
                data-ocid="record.video_empty_state"
                className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              >
                <Film size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No clips recorded yet.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Press the button above to start recording.
                </p>
              </div>
            ) : (
              <div data-ocid="record.video_list" className="space-y-4">
                <AnimatePresence initial={false}>
                  {clips.map((clip, index) => (
                    <motion.div
                      key={clip.id}
                      data-ocid={`record.item.${index + 1}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.25 }}
                      className="glass-card rounded-2xl overflow-hidden"
                    >
                      {/* biome-ignore lint/a11y/useMediaCaption: user-recorded clip */}
                      <video
                        src={clip.url}
                        controls
                        playsInline
                        className="w-full rounded-t-2xl"
                        style={{ maxHeight: 220 }}
                      />
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            Clip #{clip.id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {clip.timestamp.toLocaleTimeString()} &middot;{" "}
                            {formatElapsed(clip.durationMs)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadClip(clip, "webm", "clip")}
                          className="gap-1.5 text-xs"
                        >
                          <Download size={13} />
                          Download
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Audio Tab ── */}
        {mode === "audio" && (
          <motion.div
            key="audio-mode"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25 }}
          >
            {/* Audio visualizer */}
            <div
              className="relative glass-card rounded-2xl overflow-hidden mb-4 flex flex-col items-center justify-center"
              style={{ height: 180 }}
            >
              {audioPermError ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <MicOff size={36} className="text-destructive/70" />
                  <p className="text-sm text-muted-foreground">
                    {audioPermError}
                  </p>
                </div>
              ) : (
                <>
                  {isAudioRecording && (
                    <span
                      className="absolute rounded-full animate-pulse-ring"
                      style={{
                        width: 100,
                        height: 100,
                        background: "oklch(0.55 0.18 260 / 0.35)",
                      }}
                    />
                  )}
                  <div
                    className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center mb-3"
                    style={{
                      background: isAudioRecording
                        ? "oklch(0.55 0.18 260 / 0.25)"
                        : "oklch(0.18 0.01 270)",
                      border: isAudioRecording
                        ? "2px solid oklch(0.55 0.18 260 / 0.6)"
                        : "2px solid oklch(0.25 0.01 270)",
                    }}
                  >
                    <Mic
                      size={28}
                      style={{
                        color: isAudioRecording
                          ? "oklch(0.75 0.15 260)"
                          : "oklch(0.55 0.01 80)",
                      }}
                    />
                  </div>

                  {isAudioRecording ? (
                    <div
                      className="flex items-end gap-1"
                      style={{ height: 32 }}
                    >
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className="w-2 rounded-sm animate-equalizer"
                          style={{
                            background: "oklch(0.65 0.18 260)",
                            animationDelay: `${(i - 1) * 0.12}s`,
                            height: "100%",
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Tap to start recording audio
                    </p>
                  )}

                  {isAudioRecording && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-dot" />
                      <span
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.75 0.15 260)" }}
                      >
                        {formatElapsed(audioElapsed)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Audio record button */}
            {!audioPermError && (
              <div className="flex justify-center mb-6">
                <button
                  type="button"
                  data-ocid="record.audio_primary_button"
                  onClick={
                    isAudioRecording ? stopAudioRecording : startAudioRecording
                  }
                  className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    background: isAudioRecording
                      ? "oklch(0.45 0.18 260)"
                      : "oklch(0.55 0.18 260)",
                    boxShadow: isAudioRecording
                      ? "0 0 0 4px oklch(0.55 0.18 260 / 0.3), 0 0 30px oklch(0.55 0.18 260 / 0.5)"
                      : "0 0 0 4px oklch(0.55 0.18 260 / 0.2), 0 4px 20px oklch(0.55 0.18 260 / 0.3)",
                  }}
                >
                  {isAudioRecording && (
                    <span
                      className="absolute inset-0 rounded-full animate-pulse-ring"
                      style={{ background: "oklch(0.55 0.18 260 / 0.4)" }}
                    />
                  )}
                  {isAudioRecording ? (
                    <span className="w-7 h-7 rounded-md bg-white" />
                  ) : (
                    <Mic size={28} color="white" />
                  )}
                </button>
              </div>
            )}

            {/* Audio recordings list */}
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Saved Recordings
            </h2>
            {audioClips.length === 0 ? (
              <div
                data-ocid="record.audio_empty_state"
                className="glass-card rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              >
                <Music2 size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No audio recordings yet.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Press the button above to start recording.
                </p>
              </div>
            ) : (
              <div data-ocid="record.audio_list" className="space-y-3">
                <AnimatePresence initial={false}>
                  {audioClips.map((clip, index) => (
                    <motion.div
                      key={clip.id}
                      data-ocid={`record.audio_item.${index + 1}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.25 }}
                      className="glass-card rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                              background: "oklch(0.55 0.18 260 / 0.2)",
                              border: "1px solid oklch(0.55 0.18 260 / 0.3)",
                            }}
                          >
                            <Mic
                              size={14}
                              style={{ color: "oklch(0.75 0.15 260)" }}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              Recording #{clip.id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {clip.timestamp.toLocaleTimeString()} &middot;{" "}
                              {formatElapsed(clip.durationMs)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadClip(clip, "webm", "audio")}
                          className="gap-1.5 text-xs"
                        >
                          <Download size={13} />
                          Download
                        </Button>
                      </div>
                      {/* biome-ignore lint/a11y/useMediaCaption: user-recorded audio */}
                      <audio
                        src={clip.url}
                        controls
                        className="w-full"
                        style={{ height: 36 }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
