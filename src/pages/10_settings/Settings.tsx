import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Palette, Info, Settings as SettingsIcon } from "lucide-react";
import { REGION_NAME } from "@/lib/fsims-constants";

const PREF_KEY = "fsims_prefs";

/**
 * FSIMS-only settings. Kept intentionally lean — the app is a monitoring
 * system, not a general-purpose platform, so we only expose what's needed:
 * appearance, dashboard notifications and the About panel.
 */
interface Prefs {
  theme: "light" | "dark" | "system";
  dashboardAlerts: boolean;
  weeklyDigest: boolean;
  dueReminders: boolean;
}

const DEFAULTS: Prefs = {
  theme: "system",
  dashboardAlerts: true,
  weeklyDigest: true,
  dueReminders: true,
};

export default function Settings({ onClose }: { onClose?: () => void } = {}) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* noop */
    }
  }, []);

  const update = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  const save = () => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    toast.success("Settings saved");
  };

  const reset = () => {
    setPrefs(DEFAULTS);
    localStorage.removeItem(PREF_KEY);
    toast.info("Restored default settings");
  };

  // Keep mobile behavior unchanged; on large screens allow inner scroll instead of forcing a very tall modal
  const tabContentClass = "mt-4 space-y-4 h-64 overflow-auto lg:max-h-[68vh] lg:overflow-auto";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            Settings
          </h1>
          <p className="text-xs text-muted-foreground">System preferences for FSIMS — {REGION_NAME}.</p>
        </div>
        {onClose ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="mr-2 h-4 w-4" />
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className={tabContentClass}>
          <Section title="Look & Feel" description="Theme preferences.">
            <Row label="Theme">
              <Select
                value={prefs.theme}
                onValueChange={(v) => update("theme", v as Prefs["theme"])}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">Match system</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>
        </TabsContent>

        <TabsContent value="notifications" className={tabContentClass}>
          <Section
            title="Dashboard Notifications"
            description="Choose which inspection alerts to receive."
          >
            <Toggle
              label="In-app dashboard alerts"
              description="Show pop-ups when inspections are encoded or updated."
              checked={prefs.dashboardAlerts}
              onChange={(v) => update("dashboardAlerts", v)}
            />
            <Toggle
              label="Weekly accomplishment digest"
              description="Summary of provincial accomplishments every Monday."
              checked={prefs.weeklyDigest}
              onChange={(v) => update("weeklyDigest", v)}
            />
            <Toggle
              label="Due-date reminders"
              description="Reminders for pending FSIC / NTC actions."
              checked={prefs.dueReminders}
              onChange={(v) => update("dueReminders", v)}
            />
          </Section>
        </TabsContent>

        <TabsContent value="about" className={tabContentClass}>
          <Section title="About FSIMS" description="System information.">
            <InfoRow label="Application" value="Fire Safety Inspection Monitoring System" />
            <InfoRow label="Version" value="1.0.0" />
            <InfoRow label="Region" value={REGION_NAME} />
            <InfoRow label="Build" value={new Date().toISOString().slice(0, 10)} />
            <InfoRow label="Support" value="ict@bfpmimaropa.gov.ph" />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
