import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Video,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { AccidentRecord } from "../backend.d";
import { useUserAccidents } from "../hooks/useQueries";

function parseTimestamp(id: string): string {
  const ts = id.replace("ACC-", "");
  const num = Number.parseInt(ts, 10);
  if (Number.isNaN(num)) return id;
  return new Date(num).toLocaleString();
}

function LocationLink({ location }: { location: string }) {
  if (
    !location ||
    location === "unknown" ||
    location === "location unavailable"
  ) {
    return (
      <span className="text-muted-foreground/60">
        {location || "No location"}
      </span>
    );
  }
  const parts = location.split(",");
  if (parts.length === 2) {
    const url = `https://maps.google.com/maps?q=${location}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-ocid="history.map_marker"
        className="flex items-center gap-1 text-accent hover:text-accent/80 underline-offset-2 hover:underline"
      >
        <MapPin size={10} />
        {Number.parseFloat(parts[0]).toFixed(4)},{" "}
        {Number.parseFloat(parts[1]).toFixed(4)}
      </a>
    );
  }
  return <span className="text-muted-foreground/60">{location}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 gap-1">
        <CheckCircle2 size={10} /> Sent
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge className="bg-accent/10 text-accent border-accent/20 gap-1">
        <XCircle size={10} /> Cancelled
      </Badge>
    );
  }
  return (
    <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
      <AlertCircle size={10} /> {status}
    </Badge>
  );
}

function AccidentCard({
  record,
  index,
}: { record: AccidentRecord; index: number }) {
  return (
    <motion.div
      data-ocid={`history.item.${index + 1}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className="border-border/50 hover:border-border transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock
                size={14}
                className="text-muted-foreground shrink-0 mt-0.5"
              />
              <span className="text-xs text-muted-foreground">
                {parseTimestamp(record.id)}
              </span>
            </div>
            <StatusBadge status={record.status} />
          </div>

          <div className="text-xs text-muted-foreground">
            <LocationLink location={record.location} />
          </div>

          {record.videoUrl && (
            <a
              href={record.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:text-accent/80"
            >
              <Video size={12} />
              View Evidence Video
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function HistoryPage() {
  const { data: accidents = [], isLoading } = useUserAccidents();

  return (
    <main className="flex flex-col min-h-[calc(100dvh-80px)] pb-24 px-4 pt-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="font-display text-2xl font-bold text-foreground">
          Accident History
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {accidents.length} record{accidents.length !== 1 ? "s" : ""} on file
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : accidents.length === 0 ? (
        <motion.div
          data-ocid="history.empty_state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-3"
        >
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Clock size={28} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            No accidents recorded
          </p>
          <p className="text-muted-foreground/60 text-xs text-center max-w-[200px]">
            CrashGuard will log all detected incidents here
          </p>
        </motion.div>
      ) : (
        <div data-ocid="history.list" className="space-y-3">
          <AnimatePresence>
            {accidents.map((acc, i) => (
              <AccidentCard key={acc.id} record={acc} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
