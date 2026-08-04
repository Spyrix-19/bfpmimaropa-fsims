import * as React from "react";
import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchKeyProps = {
  /** Committed search value (only updated on Enter or Clear). */
  value: string;
  /** Called when the user commits the search (Enter pressed or input cleared). */
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  widthClass?: string;
};

/**
 * SearchKey
 * - Typing only updates the local draft (no filter trigger).
 * - Pressing Enter commits the draft via onChange.
 * - Clicking the clear (X) button commits an empty string.
 */
export default function SearchKey({
  value,
  onChange,
  placeholder = "Search",
  className,
  widthClass = "w-full md:w-90",
}: SearchKeyProps) {
  const [draft, setDraft] = React.useState(value);

  // Keep local draft in sync when parent resets the committed value
  // (e.g. clearing filters from elsewhere).
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const nameRef = React.useRef<string>(`searchkey-${Math.random().toString(36).slice(2, 9)}`);

  const commit = (v: string) => {
    setDraft(v);
    onChange(v);
  };

  return (
    <div className={cn("relative", widthClass, className)}>
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onChange(draft);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        name={nameRef.current}
        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-10 text-sm transition-colors hover:border-primary focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-primary"
        aria-label={placeholder}
      />

      {draft && draft.length > 0 ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => commit("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted/20"
        >
          <XIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
