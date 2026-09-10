import {
  Wrench,
  ShieldCheck,
  Clock,
  LifeBuoy,
  Lock,
  FileBarChart2,
  LayoutGrid,
  PencilLine,
  Link2Off,
  Server,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { brand } from "@/lib/brand";
import logo from "@/assets/bfp-mimaropa.png";

const impacts = [
  { icon: Lock, text: "System login is temporarily unavailable." },
  { icon: LayoutGrid, text: "Existing authenticated sessions cannot access system modules." },
  { icon: Server, text: "Application pages and business modules are temporarily unavailable." },
  { icon: PencilLine, text: "Data entry and record updates are temporarily unavailable." },
  { icon: FileBarChart2, text: "Reports and system services may be temporarily inaccessible." },
  {
    icon: Link2Off,
    text: "Direct access attempts will continue to display this maintenance notice.",
  },
];

const activities = [
  "System improvements",
  "Infrastructure maintenance",
  "Security updates",
  "Performance optimization",
  "Database maintenance",
  "Application updates",
  "Service reliability improvements",
];

export default function Maintenance() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Branding */}
        <header className="flex flex-col items-center gap-3 text-center">
          <img
            src={logo}
            alt={`${brand.organization} official seal`}
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Bureau of Fire Protection
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {brand.region}
            </p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-foreground">
              {brand.organization} {brand.appName}
            </p>
          </div>
        </header>

        {/* Primary notice */}
        <Card className="mt-8 overflow-hidden border-border/60 p-0 shadow-elegant">
          <div className="border-b border-border/60 bg-muted/40 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
              <Wrench className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              System Under Maintenance
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The {brand.organization} {brand.appName} is currently undergoing scheduled system
              maintenance to improve system performance, reliability, security, and overall service
              quality.
            </p>
          </div>

          {/* Status card */}
          <div className="px-6 py-6 sm:px-10">
            <div className="rounded-lg border border-border/60 bg-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                System Status
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary/50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Maintenance in Progress
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {brand.organization} {brand.appName} — access temporarily restricted.
              </p>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Access to the system has been temporarily restricted while maintenance activities are
              in progress. Users will not be able to access system modules, records, reports, or
              other application services during this period. Please try again later once system
              maintenance has been completed.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {activities.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Maintenance activities may include any of the above.
            </p>
          </div>
        </Card>

        {/* What does this mean */}
        <Card className="mt-6 border-border/60 p-6 sm:p-8">
          <h2 className="text-base font-semibold text-foreground">What does this mean?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {impacts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm leading-relaxed text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Assurance + availability */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card className="border-border/60 p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">
                Your information remains protected
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              System maintenance is being performed to support the continued security, stability,
              and reliability of the {brand.organization} {brand.appName}. Access has been
              temporarily restricted as a precaution while maintenance activities are being
              completed.
            </p>
          </Card>

          <Card className="border-border/60 p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">
                When will the system be available?
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              System availability will be restored once the scheduled maintenance activities have
              been completed and the system has been verified to be ready for normal operation.
            </p>
          </Card>
        </div>

        {/* Support */}
        <Card className="mt-6 border-border/60 p-6">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Need assistance?</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If you require assistance or need to report an urgent system-related concern during the
            maintenance period, please coordinate with {brand.supportContact} or the designated{" "}
            {brand.organization} ICT support personnel.
          </p>
        </Card>

        <div className="mt-10 border-t border-border/60 pt-6 text-center">
          <Footer />
        </div>
      </div>
    </main>
  );
}
