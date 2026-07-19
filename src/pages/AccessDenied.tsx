import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-md overflow-hidden border-border/60 p-0 shadow-elegant">
        <div className="relative bg-gradient-primary px-6 py-8 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 45%), radial-gradient(circle at 85% 60%, rgba(255,255,255,0.25), transparent 40%)",
            }}
          />
          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/40 backdrop-blur">
            <ShieldAlert className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="relative mt-4 text-2xl font-bold tracking-tight text-primary-foreground">
            Access Denied
          </h1>
          <p className="relative mt-1 text-sm text-primary-foreground/85">
            Insufficient permissions
          </p>
        </div>

        <div className="space-y-5 px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            You do not have permission to access this page. If you believe this is a mistake, please
            contact your system administrator.
          </p>

          <Button
            asChild
            className="w-full bg-gradient-primary text-primary-foreground shadow-elegant"
          >
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
