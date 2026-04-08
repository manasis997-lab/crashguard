import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronRight,
  Shield,
  User,
  VideoOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CountdownModal from "../components/CountdownModal";
import { useDashcam } from "../context/DashcamContext";
import { useEmergencyContacts, useUserProfile } from "../hooks/useQueries";

interface Props {
  onGoToContacts: () => void;
}

const CRASH_THRESHOLD = 25;
const DEBOUNCE_MS = 5000;

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function HomePage({ onGoToContacts }: Props) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [gForce, setGForce] = useState(9.8);
  const [crashDetected, setCrashDetected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);
  const lastCrashRef = useRef(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  const { data: profile } = useUserProfile();
  const { data: contacts = [] } = useEmergencyContacts();
  const {
    startDashcam,
    stopDashcam,
    dashcamStream,
    isRecording,
    bufferBlobs,
    cameraError,
  } = useDashcam();

  const profileComplete = profile?.userName && profile.phoneNumber;

  // Attach stream to live preview video element
  useEffect(() => {
    if (liveVideoRef.current && dashcamStream) {
      liveVideoRef.current.srcObject = dashcamStream;
    }
  }, [dashcamStream]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Geolocation
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(() => resolve(), reject, {
          timeout: 5000,
        });
      });
    } catch {
      toast.error("Location permission needed for GPS alerts");
    }

    // DeviceMotion (iOS 13+)
    if (
      typeof (
        DeviceMotionEvent as unknown as {
          requestPermission?: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const result = await (
          DeviceMotionEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (result !== "granted") {
          toast.error("Motion sensor permission denied");
          return false;
        }
      } catch {
        toast.error("Could not request motion permission");
        return false;
      }
    }

    return true;
  }, []);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (!g) return;
    const total = Math.sqrt(
      (g.x ?? 0) ** 2 + (g.y ?? 0) ** 2 + (g.z ?? 0) ** 2,
    );
    setGForce(Math.round(total * 10) / 10);

    const now = Date.now();
    if (total > CRASH_THRESHOLD && now - lastCrashRef.current > DEBOUNCE_MS) {
      lastCrashRef.current = now;
      setCrashDetected(true);
    }
  }, []);

  useEffect(() => {
    if (!isMonitoring) return;
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [isMonitoring, handleMotion]);

  const toggleMonitoring = useCallback(async () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      stopDashcam();
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      setElapsed(0);
      toast.info("Monitoring stopped");
      return;
    }
    const granted = await requestPermissions();
    if (!granted) return;

    try {
      await startDashcam();
      // Only set monitoring active if camera started successfully
      setIsMonitoring(true);
      startTimeRef.current = Date.now();
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 1000);
      toast.success("CrashGuard is now monitoring");
    } catch {
      // error is shown via cameraError in UI
    }
  }, [isMonitoring, requestPermissions, startDashcam, stopDashcam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  return (
    <main className="flex flex-col min-h-[calc(100dvh-80px)] pb-24 px-4 pt-6">
      {/* Header */}
      <motion.div
        className="flex flex-col items-center gap-3 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative">
          <img
            src="/assets/generated/crashguard-shield-transparent.dim_200x200.png"
            alt="CrashGuard"
            className="w-20 h-20 object-contain"
          />
          {isMonitoring && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background animate-pulse-dot" />
          )}
        </div>
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            CrashGuard
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Smart Accident Protection
          </p>
        </div>
      </motion.div>

      {/* Profile incomplete warning */}
      {!profileComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <button
            type="button"
            onClick={onGoToContacts}
            className="w-full glass-card rounded-xl p-4 flex items-center gap-3 border border-accent/30 hover:border-accent/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-accent" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-accent">
                Set up your profile
              </p>
              <p className="text-xs text-muted-foreground">
                Name & phone required for alerts
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </motion.div>
      )}

      {/* Camera permission denied banner (shown when NOT monitoring and there's a camera error) */}
      {!isMonitoring && cameraError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
          data-ocid="home.error_state"
        >
          <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10">
            <VideoOff size={20} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                Camera access denied
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {cameraError}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                To enable camera access: tap the lock icon in your browser's
                address bar → Permissions → Camera → Allow, then try again.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-4"
      >
        <Card
          className={`relative overflow-hidden border ${
            isMonitoring ? "border-green-500/30" : "border-border/50"
          }`}
        >
          {isMonitoring && <div className="absolute inset-0 bg-green-500/5" />}
          <CardContent className="relative p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isMonitoring ? "bg-green-500" : "bg-muted-foreground"
                      }`}
                    />
                    {isMonitoring && (
                      <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse-ring" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      isMonitoring ? "text-green-400" : "text-muted-foreground"
                    }`}
                  >
                    {isMonitoring ? "Monitoring Active" : "Monitoring Inactive"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isMonitoring
                    ? `Watching for impacts > ${CRASH_THRESHOLD} m/s²`
                    : "Tap Start to begin protection"}
                </p>
              </div>
              <Shield
                size={36}
                className={
                  isMonitoring ? "text-green-400" : "text-muted-foreground/30"
                }
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* G-Force Meter */}
      {isMonitoring && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-accent" />
                  <span className="text-sm text-muted-foreground">
                    Live Acceleration
                  </span>
                </div>
                <span className="font-display font-bold text-foreground">
                  {gForce} m/s²
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (gForce / 40) * 100)}%`,
                    background:
                      gForce > CRASH_THRESHOLD
                        ? "oklch(0.58 0.24 25)"
                        : gForce > 15
                          ? "oklch(0.72 0.18 55)"
                          : "oklch(0.65 0.15 150)",
                  }}
                  animate={{ width: `${Math.min(100, (gForce / 40) * 100)}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0</span>
                <span className="text-[10px] text-primary">
                  Threshold: {CRASH_THRESHOLD}
                </span>
                <span className="text-[10px] text-muted-foreground">40+</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Live Dashcam Preview */}
      {isMonitoring && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4"
        >
          {cameraError ? (
            <div className="glass-card rounded-2xl p-5 flex flex-col items-center gap-3 text-center border border-destructive/20">
              <VideoOff size={28} className="text-destructive/60" />
              <p className="text-xs text-muted-foreground">{cameraError}</p>
            </div>
          ) : (
            <div
              className="relative glass-card rounded-2xl overflow-hidden"
              style={{ aspectRatio: "16/9", maxHeight: 200 }}
            >
              {/* biome-ignore lint/a11y/useMediaCaption: live dashcam feed */}
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* REC badge */}
              {isRecording && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
                  <span className="text-[11px] font-mono font-bold text-red-400">
                    REC
                  </span>
                  <span className="text-[11px] font-mono text-white/80">
                    {formatElapsed(elapsed)}
                  </span>
                </div>
              )}

              {/* Camera icon while stream initializing */}
              {!dashcamStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Camera size={28} className="text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    Starting camera…
                  </span>
                </div>
              )}

              {/* Buffer info overlay */}
              {bufferBlobs.length > 0 && (
                <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <span className="text-[10px] font-mono text-white/70">
                    {bufferBlobs.length}/{3} seg · ~{bufferBlobs.length * 60}s
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Buffer segments info */}
          <p className="text-[11px] text-muted-foreground/60 text-center mt-1.5">
            {isRecording
              ? `${bufferBlobs.length} segment${
                  bufferBlobs.length !== 1 ? "s" : ""
                } buffered (~${bufferBlobs.length * 60}s)`
              : "Starting dashcam…"}
          </p>
        </motion.div>
      )}

      {/* No contacts warning */}
      {isMonitoring && contacts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <div className="flex items-start gap-3 p-4 rounded-xl border border-accent/30 bg-accent/5">
            <AlertTriangle size={18} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-accent">
                No emergency contacts
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add contacts so alerts can be sent on crash detection.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main CTA */}
      <motion.div
        className="mt-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Button
          data-ocid="home.primary_button"
          size="lg"
          className={`w-full py-8 text-xl font-display font-bold tracking-wide transition-all duration-300 ${
            isMonitoring
              ? "bg-muted hover:bg-muted/80 text-foreground border border-border animate-glow-pulse"
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
          }`}
          onClick={toggleMonitoring}
        >
          {isMonitoring ? (
            <>
              <div className="w-3 h-3 rounded-full bg-green-500 mr-3 animate-pulse-dot" />
              Stop Driving Mode
            </>
          ) : (
            <>
              <Shield className="mr-3 w-6 h-6" />
              Start Driving Mode
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {isMonitoring
            ? "Dashcam recording + crash detection active"
            : "Activate to record and detect crashes automatically"}
        </p>
      </motion.div>

      {/* Crash Modal */}
      <CountdownModal
        open={crashDetected}
        onCancel={() => setCrashDetected(false)}
        onDone={() => setCrashDetected(false)}
        contacts={contacts}
        userName={profile?.userName ?? "User"}
      />
    </main>
  );
}
