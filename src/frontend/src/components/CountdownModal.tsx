import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalBlob } from "../backend";
import type { EmergencyContact } from "../backend.d";
import { useDashcam } from "../context/DashcamContext";
import { useReportAccident, useSendSms } from "../hooks/useQueries";

interface Props {
  open: boolean;
  onCancel: () => void;
  onDone: () => void;
  contacts: EmergencyContact[];
  userName: string;
}

type Phase = "countdown" | "sending" | "done" | "cancelled";

export default function CountdownModal({
  open,
  onCancel,
  onDone,
  contacts,
  userName,
}: Props) {
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [statusMsg, setStatusMsg] = useState("");
  const [key, setKey] = useState(0);
  const cancelledRef = useRef(false);
  const firedRef = useRef(false);
  const reportAccident = useReportAccident();
  const sendSms = useSendSms();
  const { addCrashClip, freezeEvidence } = useDashcam();

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setPhase("cancelled");
    const id = `ACC-${Date.now()}`;
    reportAccident.mutate({
      id,
      status: "cancelled",
      videoUrl: "",
      location: "",
    });
    setTimeout(() => {
      onCancel();
      setPhase("countdown");
      setCount(10);
      cancelledRef.current = false;
    }, 1500);
  }, [onCancel, reportAccident]);

  const executeAlert = useCallback(async () => {
    setPhase("sending");
    const id = `ACC-${Date.now()}`;
    let locationStr = "unknown";
    let lat = 0;
    let lon = 0;
    let videoUrl = "";

    // 1. Get GPS
    setStatusMsg("Getting your location…");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          enableHighAccuracy: true,
        });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      locationStr = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    } catch {
      locationStr = "location unavailable";
    }

    // 2. Freeze dashcam evidence (pre-crash buffer + 10s post-crash)
    setStatusMsg("Securing evidence…");
    let evidenceBlob: Blob | null = null;
    try {
      evidenceBlob = await freezeEvidence();
    } catch {
      // fallback: no evidence
    }

    if (evidenceBlob && evidenceBlob.size > 0) {
      const localUrl = URL.createObjectURL(evidenceBlob);
      addCrashClip({
        url: localUrl,
        timestamp: new Date(),
        durationMs: evidenceBlob.size, // size as proxy for duration
        location: locationStr,
      });
      try {
        const bytes = new Uint8Array(await evidenceBlob.arrayBuffer());
        const exBlob = ExternalBlob.fromBytes(bytes);
        videoUrl = exBlob.getDirectURL();
      } catch {
        // upload failed, local clip still saved
      }
    }

    // 3. Send SMS
    if (contacts.length > 0) {
      setStatusMsg(`Alerting ${contacts.length} contact(s)…`);
      const mapsLink =
        lat !== 0
          ? `https://maps.google.com/maps?q=${lat},${lon}`
          : "Location unavailable";
      const message = `🚨 EMERGENCY: ${
        userName || "Someone"
      } may have been in an accident. Location: ${mapsLink}`;
      await Promise.all(
        contacts.map((c) =>
          sendSms.mutateAsync({ phone: c.phone, message }).catch(() => {}),
        ),
      );
    }

    // 4. Report
    setStatusMsg("Saving report…");
    await reportAccident
      .mutateAsync({ id, status: "sent", videoUrl, location: locationStr })
      .catch(() => {});

    setPhase("done");
    setTimeout(() => {
      onDone();
      setPhase("countdown");
      setCount(10);
      setKey((k) => k + 1);
      cancelledRef.current = false;
    }, 2500);
  }, [
    contacts,
    userName,
    sendSms,
    reportAccident,
    onDone,
    addCrashClip,
    freezeEvidence,
  ]);

  // Keep a stable ref to executeAlert so the countdown effect doesn't need it as a dependency
  const executeAlertRef = useRef(executeAlert);
  useEffect(() => {
    executeAlertRef.current = executeAlert;
  }, [executeAlert]);

  // Reset state when modal opens
  useEffect(() => {
    if (!open) {
      firedRef.current = false;
      return;
    }
    cancelledRef.current = false;
    firedRef.current = false;
    setPhase("countdown");
    setCount(10);
    setKey((k) => k + 1);
  }, [open]);

  // Countdown tick — executeAlert deliberately excluded from deps via ref
  useEffect(() => {
    if (!open || phase !== "countdown") return;
    if (count <= 0) {
      if (!cancelledRef.current && !firedRef.current) {
        firedRef.current = true;
        executeAlertRef.current();
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, count]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-ocid="countdown.modal"
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/95" />

        {/* Red pulse bg */}
        {phase === "countdown" && (
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
              style={{
                background: `radial-gradient(circle, oklch(0.58 0.24 25 / ${
                  0.05 + (10 - count) * 0.01
                }) 0%, transparent 70%)`,
              }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center max-w-sm w-full">
          {phase === "countdown" && (
            <>
              <motion.div
                className="flex items-center gap-3"
                animate={{ x: [-2, 2, -2, 2, 0] }}
                transition={{
                  duration: 0.4,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: 1.5,
                }}
              >
                <AlertTriangle className="text-primary w-10 h-10" />
                <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
                  ACCIDENT DETECTED
                </h1>
                <AlertTriangle className="text-primary w-10 h-10" />
              </motion.div>

              <p className="text-muted-foreground text-sm">
                Alert will be sent automatically in
              </p>

              <AnimatePresence mode="wait">
                <motion.div
                  key={key + count}
                  className="font-display font-black leading-none"
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontSize: "min(40vw, 180px)",
                    color: `oklch(${Math.max(0.45, 0.7 - (10 - count) * 0.025)} 0.24 25)`,
                    textShadow: `0 0 ${20 + (10 - count) * 5}px oklch(0.58 0.24 25 / 0.5)`,
                  }}
                >
                  {count}
                </motion.div>
              </AnimatePresence>

              <p className="text-muted-foreground text-xs">
                Emergency contacts will be notified
              </p>

              <Button
                data-ocid="countdown.cancel_button"
                size="lg"
                variant="outline"
                className="w-full border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-display font-bold text-lg py-6 transition-all duration-200"
                onClick={handleCancel}
              >
                <XCircle className="mr-2 w-5 h-5" />
                CANCEL ALERT
              </Button>
            </>
          )}

          {phase === "sending" && (
            <>
              <Loader2 className="w-16 h-16 text-accent animate-spin" />
              <h2 className="font-display text-xl font-bold text-foreground">
                Sending Alert…
              </h2>
              <p className="text-muted-foreground text-sm">{statusMsg}</p>
            </>
          )}

          {phase === "done" && (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <CheckCircle2 className="w-20 h-20 text-green-500" />
              <h2 className="font-display text-2xl font-bold text-foreground">
                Alert Sent!
              </h2>
              <p className="text-muted-foreground text-sm">
                Emergency contacts have been notified with your location.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Dashcam evidence saved to Record tab.
              </p>
            </motion.div>
          )}

          {phase === "cancelled" && (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <XCircle className="w-20 h-20 text-muted-foreground" />
              <h2 className="font-display text-2xl font-bold text-foreground">
                Alert Cancelled
              </h2>
              <p className="text-muted-foreground text-sm">
                False alarm logged.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
