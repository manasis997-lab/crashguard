import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  MapPin,
  Send,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { AccidentRecord } from "../backend.d";
import { useAllAccidents } from "../hooks/useQueries";

type Filter = "all" | "sent" | "cancelled";

function parseTimestamp(id: string): string {
  const ts = id.replace("ACC-", "");
  const num = Number.parseInt(ts, 10);
  if (Number.isNaN(num)) return id;
  return new Date(num).toLocaleString();
}

function truncatePrincipal(p: unknown): string {
  const s = String(p);
  if (s.length <= 14) return s;
  return `${s.slice(0, 7)}...${s.slice(-5)}`;
}

interface FlatRecord extends AccidentRecord {
  principal: string;
}

export default function AdminPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: allAccidents = [], isLoading } = useAllAccidents();

  const flat: FlatRecord[] = allAccidents.flatMap(([principal, records]) =>
    records.map((r) => ({ ...r, principal: String(principal) })),
  );

  const filtered =
    filter === "all" ? flat : flat.filter((r) => r.status === filter);

  const sent = flat.filter((r) => r.status === "sent").length;
  const cancelled = flat.filter((r) => r.status === "cancelled").length;

  return (
    <main className="flex flex-col min-h-[calc(100dvh-80px)] pb-24 px-4 pt-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="font-display text-2xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          All system accident reports
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 size={16} className="text-muted-foreground" />
            </div>
            <p className="font-display font-bold text-xl text-foreground">
              {flat.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Send size={16} className="text-green-400" />
            </div>
            <p className="font-display font-bold text-xl text-green-400">
              {sent}
            </p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card className="border-accent/20">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <XCircle size={16} className="text-accent" />
            </div>
            <p className="font-display font-bold text-xl text-accent">
              {cancelled}
            </p>
            <p className="text-[10px] text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
      </motion.div>

      {isLoading ? (
        <div
          data-ocid="admin.loading_state"
          className="flex items-center justify-center py-16"
        >
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="flex-1"
        >
          <TabsList data-ocid="admin.filter.tab" className="w-full mb-4">
            <TabsTrigger value="all" className="flex-1 text-xs">
              All ({flat.length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1 text-xs">
              Sent ({sent})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex-1 text-xs">
              Cancelled ({cancelled})
            </TabsTrigger>
          </TabsList>

          {(["all", "sent", "cancelled"] as Filter[]).map((tab) => (
            <TabsContent key={tab} value={tab}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Users size={28} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    No records found
                  </p>
                </div>
              ) : (
                <div data-ocid="admin.table" className="space-y-2">
                  {filtered.map((record, i) => (
                    <Card
                      key={`${record.principal}-${record.id}`}
                      data-ocid={`admin.item.${i + 1}`}
                      className="border-border/40 hover:border-border transition-colors"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Users
                              size={12}
                              className="text-muted-foreground"
                            />
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {truncatePrincipal(record.principal)}
                            </span>
                          </div>
                          {record.status === "sent" ? (
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 gap-1 text-[10px]">
                              <Send size={8} /> Sent
                            </Badge>
                          ) : record.status === "cancelled" ? (
                            <Badge className="bg-accent/10 text-accent border-accent/20 gap-1 text-[10px]">
                              <XCircle size={8} /> Cancelled
                            </Badge>
                          ) : (
                            <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px]">
                              <AlertCircle size={8} /> {record.status}
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground mb-1">
                          {parseTimestamp(record.id)}
                        </p>

                        {record.location && record.location !== "unknown" && (
                          <a
                            href={`https://maps.google.com/maps?q=${record.location}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            <MapPin size={10} />
                            {record.location}
                          </a>
                        )}

                        {record.videoUrl && (
                          <a
                            href={record.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-accent hover:underline mt-1"
                          >
                            <Video size={10} />
                            Evidence
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </main>
  );
}
