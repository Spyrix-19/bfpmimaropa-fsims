/**
 * The single, audited place where raw HTML may reach the DOM.
 *
 * Everything else in the app renders values through JSX curly braces, which
 * React escapes automatically. When a string genuinely has to be rendered as
 * markup, it goes through DOMPurify here first, so script tags, event handler
 * attributes and `javascript:` URLs are stripped before the browser ever sees
 * them.
 *
 * The ESLint config forbids `dangerouslySetInnerHTML` everywhere except this
 * file (and the chart stylesheet, which emits a colour allowlist only).
 */
import * as React from "react";
import DOMPurify from "dompurify";

/** Tags/attributes allowed in rich text. Deliberately small. */
const PROFILE = {
  ALLOWED_TAGS: [
    "a",
    "b",
    "br",
    "code",
    "em",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "u",
    "ul",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "title"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "svg", "math"],
  FORBID_ATTR: ["style", "srcset", "formaction", "xlink:href"],
};

let hooked = false;
function ensureHooks() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  // Any link that survives sanitisation opens safely.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof Element && node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/** Sanitize an untrusted HTML string down to the allowlist above. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  ensureHooks();
  return DOMPurify.sanitize(String(dirty), { ...PROFILE }) as unknown as string;
}

/** Strip every tag and return plain text — the safest option when in doubt. */
export function toPlainText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) as string;
}

type SafeHtmlProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "dangerouslySetInnerHTML"
> & {
  html: string | null | undefined;
  /** Element to render. Defaults to a <span>. */
  as?: keyof React.JSX.IntrinsicElements;
};

/** Renders sanitized rich text. The only sanctioned way to render raw HTML. */
export function SafeHtml({ html, as: Tag = "span", ...rest }: SafeHtmlProps) {
  const clean = React.useMemo(() => sanitizeHtml(html), [html]);
  // eslint-disable-next-line no-restricted-syntax -- sanitized directly above
  return React.createElement(Tag, { ...rest, dangerouslySetInnerHTML: { __html: clean } });
}
