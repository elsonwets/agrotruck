export type AccountRole = "admin" | "partner";

export interface Account {
  id: string;
  phone: string;
  passwordHash: string;
  role: AccountRole;
  displayName: string;
  createdAt: string;
}

export type PublicAccount = Omit<Account, "passwordHash">;
