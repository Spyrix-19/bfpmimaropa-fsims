import * as React from "react";
import { subscribe } from "./mockStore";

/**
 * Force a re-render whenever the centralized mock store mutates.
 * Any component that reads request/settings state should call this hook.
 */
export function useRevisionStore() {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => subscribe(() => force()), []);
}