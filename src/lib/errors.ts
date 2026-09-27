import { ConvexError } from "convex/values";
import type { Dict } from "~/i18n";

// Code métier d'une erreur Convex (ex. « already_taken »), sinon null (erreur réseau ou inattendue).
export function errorCode(error: unknown): string | null {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data && "code" in error.data) {
    return String((error.data as { code: unknown }).code);
  }
  return null;
}

export function errorMessage(error: unknown, t: Dict): string {
  const code = errorCode(error);
  return (code && t.errors[code]) || t.common.genericError;
}
