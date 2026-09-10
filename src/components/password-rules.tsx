import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const PASSWORD_SPECIAL_RE = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/;

export type PasswordCheck = { label: string; passed: boolean };

export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "One uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "One number", passed: /[0-9]/.test(password) },
    { label: "One special character", passed: PASSWORD_SPECIAL_RE.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.passed);
}

/** First failing rule message, or null when the password satisfies every rule. */
export function firstPasswordError(password: string): string | null {
  const failed = getPasswordChecks(password).find((c) => !c.passed);
  return failed ? `Password must have: ${failed.label.toLowerCase()}.` : null;
}

/**
 * Live rule matrix. Each rule turns green the moment the typed password
 * satisfies it — no submit required.
 */
export function PasswordChecklist({
  password,
  confirmPassword,
  className,
}: {
  password: string;
  confirmPassword?: string;
  className?: string;
}) {
  const checks = getPasswordChecks(password);
  const items: PasswordCheck[] =
    confirmPassword === undefined
      ? checks
      : [
          ...checks,
          {
            label: "Passwords match",
            passed: password.length > 0 && password === confirmPassword,
          },
        ];

  const passedCount = items.filter((i) => i.passed).length;
  const pct = Math.round((passedCount / items.length) * 100);
  const allPassed = passedCount === items.length;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-muted/30 p-3 transition-colors",
        allPassed && "border-emerald-500/40 bg-emerald-500/5",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Password requirements
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            allPassed ? "text-emerald-600" : "text-muted-foreground",
          )}
        >
          {passedCount}/{items.length}
        </span>
      </div>

      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            allPassed ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              item.passed
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-transparent bg-background/60 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors",
                item.passed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground/70",
              )}
            >
              {item.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
