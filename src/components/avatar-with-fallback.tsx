import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarSrc, getInitials } from "@/lib/utils";

type Props = {
  entity?: any;
  name?: string;
  className?: string;
  alt?: string;
  /** Optional explicit src override. If omitted, src is resolved from `entity`. */
  src?: string | null;
};

/**
 * Centralized avatar renderer.
 *
 * Resolves the image source from `src` (when provided) or from the `entity`
 * via `getAvatarSrc` (which prefers the uploaded `profileurl`).
 *
 * Behaves exactly like the standard Radix Avatar: AvatarFallback (initials)
 * is shown until the image successfully loads, and remains shown when the
 * image errors (404, invalid URL, decoding failure, network error). When no
 * src is available we don't render <AvatarImage> at all so the fallback is
 * displayed immediately.
 */
export default function AvatarWithFallback({ entity, name, className, alt, src }: Props) {
  const resolvedSrc = React.useMemo(() => {
    try {
      const raw = src !== undefined ? src : getAvatarSrc(entity);
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      return trimmed ? trimmed : null;
    } catch {
      return null;
    }
  }, [src, entity]);

  // Track errors so we can permanently suppress a broken image and keep the
  // initials fallback visible. Reset whenever the source changes.
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => {
    setErrored(false);
  }, [resolvedSrc]);

  const displayName = name ?? entity?.fullname ?? entity?.name ?? "";
  const initials = getInitials(displayName, 2, true);

  return (
    <Avatar className={className}>
      {resolvedSrc && !errored ? (
        <AvatarImage
          src={resolvedSrc}
          alt={alt ?? displayName ?? "avatar"}
          onLoadingStatusChange={(s) => {
            if (s === "error") setErrored(true);
          }}
        />
      ) : null}
      <AvatarFallback className="font-semibold">{initials}</AvatarFallback>
    </Avatar>
  );
}
