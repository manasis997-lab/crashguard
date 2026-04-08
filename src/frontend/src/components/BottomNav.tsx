import { BarChart3, Clock, Shield, Users, Video } from "lucide-react";
import { motion } from "motion/react";

type Tab = "home" | "contacts" | "record" | "history" | "admin";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  showAdmin: boolean;
}

const tabs = [
  { id: "home" as Tab, label: "Guard", icon: Shield },
  { id: "contacts" as Tab, label: "Contacts", icon: Users },
  { id: "record" as Tab, label: "Record", icon: Video },
  { id: "history" as Tab, label: "History", icon: Clock },
];

export default function BottomNav({ active, onChange, showAdmin }: Props) {
  const visibleTabs = showAdmin
    ? [...tabs, { id: "admin" as Tab, label: "Admin", icon: BarChart3 }]
    : tabs;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
      <div className="glass-card border-t border-border/30 px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                data-ocid={`nav.${tab.id}.link`}
                onClick={() => onChange(tab.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary/10 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
