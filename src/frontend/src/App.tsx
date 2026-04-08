import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, LogIn } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import BottomNav from "./components/BottomNav";
import { DashcamProvider } from "./context/DashcamContext";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useIsAdmin } from "./hooks/useQueries";
import AdminPage from "./pages/Admin";
import ContactsPage from "./pages/Contacts";
import HistoryPage from "./pages/History";
import HomePage from "./pages/Home";
import RecordPage from "./pages/Record";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

type Tab = "home" | "contacts" | "record" | "history" | "admin";

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { login, loginStatus, identity, isInitializing } =
    useInternetIdentity();
  const { data: isAdmin = false } = useIsAdmin();

  const isLoggingIn = loginStatus === "logging-in";

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading CrashGuard…</p>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-8">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/generated/crashguard-shield-transparent.dim_200x200.png"
            alt="CrashGuard"
            className="w-24 h-24 object-contain"
          />
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-foreground">
              CrashGuard
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              Smart Accident Alert & Evidence System
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <div className="glass-card rounded-xl p-4 space-y-2">
            {[
              "🚗 Crash detection via accelerometer",
              "📍 GPS location in emergency alerts",
              "📹 Automatic dashcam loop recording",
              "🔔 Instant SMS to emergency contacts",
            ].map((f) => (
              <p key={f} className="text-sm text-muted-foreground">
                {f}
              </p>
            ))}
          </div>

          <Button
            data-ocid="auth.primary_button"
            className="w-full py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold text-base"
            onClick={login}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="mr-2 w-5 h-5" />
            )}
            {isLoggingIn ? "Signing in…" : "Sign In to Continue"}
          </Button>
        </div>

        <footer className="absolute bottom-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="hover:text-muted-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container noise-bg">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "home" && (
            <HomePage onGoToContacts={() => setActiveTab("contacts")} />
          )}
          {activeTab === "contacts" && <ContactsPage />}
          {activeTab === "record" && <RecordPage />}
          {activeTab === "history" && <HistoryPage />}
          {activeTab === "admin" && isAdmin && <AdminPage />}
        </motion.div>
      </AnimatePresence>

      <BottomNav
        active={activeTab}
        onChange={(tab) => {
          if (tab === "admin" && !isAdmin) return;
          setActiveTab(tab);
        }}
        showAdmin={isAdmin}
      />

      <footer className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-[430px] text-center py-1 z-30">
        <p className="text-[9px] text-muted-foreground/30">
          © {new Date().getFullYear()}{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground/60"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashcamProvider>
        <AppContent />
      </DashcamProvider>
    </QueryClientProvider>
  );
}
