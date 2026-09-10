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

  return (
    <ul className={cn("grid gap-1.5 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-medium transition-colors",
            item.passed ? "text-emerald-600" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "grid h-4 w-4 shrink-0 place-items-center rounded-full",
              item.passed ? "bg-emerald-500/15" : "bg-muted",
            )}
          >
            {item.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
