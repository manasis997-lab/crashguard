// Re-export from DashcamContext for backward compatibility
export type { CrashClip } from "./DashcamContext";
export { DashcamProvider as CrashRecordingProvider } from "./DashcamContext";
export { useDashcam as useCrashRecording } from "./DashcamContext";
