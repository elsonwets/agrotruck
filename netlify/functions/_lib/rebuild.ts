export function triggerRebuild(): void {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    console.warn("NETLIFY_BUILD_HOOK_URL is not set; skipping rebuild trigger");
    return;
  }
  fetch(hookUrl, { method: "POST" }).catch((error) => console.error("Failed to trigger Netlify rebuild", error));
}
