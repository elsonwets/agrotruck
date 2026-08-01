export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export function isAdminUser(user: { email: string; role?: string | null }) {
  return user.role === "admin" || isAdminEmail(user.email);
}
