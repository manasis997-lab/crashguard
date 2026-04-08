import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export interface CrashClip {
  id: number;
  url: string;
  timestamp: Date;
  durationMs: number;
  location: string;
}

interface DashcamContextValue {
  startDashcam: () => Promise<void>;
  stopDashcam: () => void;
  freezeEvidence: () => Promise<Blob>;
  dashcamStream: MediaStream | null;
  isRecording: boolean;
  bufferBlobs: Blob[];
  crashClips: CrashClip[];
  addCrashClip: (clip: Omit<CrashClip, "id">) => void;
  cameraError: string | null;
}

const DashcamContext = createContext<DashcamContextValue>({
  startDashcam: async () => {},
  stopDashcam: () => {},
  freezeEvidence: async () => new Blob(),
  dashcamStream: null,
  isRecording: false,
  bufferBlobs: [],
  crashClips: [],
  addCrashClip: () => {},
  cameraError: null,
});

const SEGMENT_MS = 60_000; // 60s segments
const MAX_BUFFER = 3; // rolling 3-segment buffer

export function DashcamProvider({ children }: { children: React.ReactNode }) {
  const [dashcamStream, setDashcamStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [bufferBlobs, setBufferBlobs] = useState<Blob[]>([]);
  const [crashClips, setCrashClips] = useState<CrashClip[]>([]);
  const [idCounter, setIdCounter] = useState(1);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopActiveRef = useRef(false);

  const stopCurrentSegment = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        chunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const startSegment = useCallback(() => {
    if (!streamRef.current || !loopActiveRef.current) return;

    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      chunksRef.current = [];
      setBufferBlobs((prev) => {
        const next = [...prev, blob];
        if (next.length > MAX_BUFFER) {
          return next.slice(next.length - MAX_BUFFER);
        }
        return next;
      });
      // Start next segment if loop still active
      if (loopActiveRef.current) {
        startSegment();
      }
    };

    mr.start(1000);
    recorderRef.current = mr;

    // Auto-stop after SEGMENT_MS
    segmentTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    }, SEGMENT_MS);
  }, []);

  const startDashcam = useCallback(async () => {
    if (isRecording) return;
    setCameraError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      const msg =
        e.name === "NotAllowedError"
          ? "Camera access denied. Allow camera permissions and try again."
          : `Camera unavailable: ${e.message ?? "unknown error"}`;
      setCameraError(msg);
      throw new Error(msg);
    }

    streamRef.current = stream;
    setDashcamStream(stream);
    setBufferBlobs([]);
    loopActiveRef.current = true;
    setIsRecording(true);
    startSegment();
  }, [isRecording, startSegment]);

  const stopDashcam = useCallback(() => {
    loopActiveRef.current = false;
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setDashcamStream(null);
    setIsRecording(false);
    setBufferBlobs([]);
  }, []);

  const freezeEvidence = useCallback(async (): Promise<Blob> => {
    // Stop current segment timer
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    // Flush current segment
    const currentBlob = await stopCurrentSegment();
    const allBlobs = currentBlob
      ? [...bufferBlobs, currentBlob]
      : [...bufferBlobs];

    // Capture 10s post-crash footage if stream is still live
    let postCrashBlob: Blob | null = null;
    if (streamRef.current && loopActiveRef.current) {
      postCrashBlob = await new Promise<Blob>((resolve) => {
        if (!streamRef.current) {
          resolve(new Blob());
          return;
        }
        const chunks: BlobPart[] = [];
        const mr = new MediaRecorder(streamRef.current, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : "video/webm",
        });
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mr.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
        mr.start(500);
        setTimeout(() => {
          if (mr.state !== "inactive") mr.stop();
        }, 10_000);
      });
    }

    // Combine all evidence blobs
    const evidenceBlobs = postCrashBlob
      ? [...allBlobs, postCrashBlob]
      : allBlobs;

    const merged = new Blob(evidenceBlobs, { type: "video/webm" });

    // Resume loop recording after evidence is captured
    if (loopActiveRef.current && streamRef.current) {
      startSegment();
    }

    return merged;
  }, [bufferBlobs, stopCurrentSegment, startSegment]);

  const addCrashClip = useCallback(
    (clip: Omit<CrashClip, "id">) => {
      setCrashClips((prev) => [{ ...clip, id: idCounter }, ...prev]);
      setIdCounter((c) => c + 1);
    },
    [idCounter],
  );

  return (
    <DashcamContext.Provider
      value={{
        startDashcam,
        stopDashcam,
        freezeEvidence,
        dashcamStream,
        isRecording,
        bufferBlobs,
        crashClips,
        addCrashClip,
        cameraError,
      }}
    >
      {children}
    </DashcamContext.Provider>
  );
}

export function useDashcam() {
  return useContext(DashcamContext);
}
