import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Badge, Card, PageTitle, Tabs } from "~/components/ui/card";
import { FormMessage, Input } from "~/components/ui/form";
import { errorMessage } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";
import type { Role } from "~/shared/domain";
import { zoneLabels } from "~/shared/zones";

export const Route = createFileRoute("/$lang/admin/users")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["admin"]}><Users /></SessionGate>,
});

type Filter = "all" | Role;

function Users() {
  const t = useT();
  const token = useToken();
  const users = useQuery(api.users.list, { token });
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const visible = users?.filter((user) => filter === "all" || user.role === filter);

  return <>
    <PageTitle title={t.admin.usersTitle} intro={users ? String(users.length) : undefined} />
    <div className="mt-6 overflow-x-auto"><Tabs label={t.admin.usersTitle} value={filter} onChange={setFilter}
      options={[["all", t.common.all], ["transporter", t.roles.transporter], ["producer", t.roles.producer], ["admin", t.roles.admin]]} /></div>
    {message && <div className="mt-4"><FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage></div>}
    <div className="mt-5 grid gap-3">
      {visible?.map((user) => <UserRow key={user._id} user={user} onDone={setMessage} />)}
      {users === undefined && <p className="text-muted">{t.common.loading}</p>}
    </div>
  </>;
}

type User = NonNullable<ReturnType<typeof useQuery<typeof api.users.list>>>[number];

function UserRow({ user, onDone }: { user: User; onDone: (message: { ok: boolean; text: string }) => void }) {
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const setDisabled = useMutation(api.users.setDisabled);
  const resetPin = useMutation(api.users.resetPin);
  const [pin, setPin] = useState<string | null>(null);
  const isMe = user._id === session?.userId;
  const details = user.role === "transporter"
    ? [user.vehicleCategories.map((category) => t.categories[category].label).join(", "), user.workZones.map((zone) => zoneLabels[zone]).join(", ")]
    : user.role === "producer" ? [user.mainLocation, user.mainZone && zoneLabels[user.mainZone]] : [];

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); onDone({ ok: true, text: success }); return true; }
    catch (error) { onDone({ ok: false, text: errorMessage(error, t) }); return false; }
  };

  return <Card className={user.disabled ? "border-flag-500/30 p-5" : "p-5"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{user.displayName}{user.companyName ? ` · ${user.companyName}` : ""} {isMe && <span className="font-normal text-muted">{t.admin.you}</span>}</p>
        <p className="text-sm text-muted">{user.phone} · {t.common.date(user.createdAt)}</p>
        {details.filter(Boolean).length > 0 && <p className="mt-1 text-xs text-muted">{details.filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="brand">{t.roles[user.role]}</Badge>
        {user.disabled && <Badge tone="danger">{t.admin.blocked}</Badge>}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {!isMe && <Button size="sm" variant={user.disabled ? "primary" : "secondary"}
        onClick={() => void run(() => setDisabled({ token, userId: user._id as Id<"users">, disabled: !user.disabled }), user.disabled ? t.admin.unblock : t.admin.block)}>
        {user.disabled ? t.admin.unblock : t.admin.block}
      </Button>}
      {pin === null
        ? <Button size="sm" variant="ghost" onClick={() => setPin("")}>{t.admin.resetPin}</Button>
        : <form className="flex flex-wrap items-center gap-2" onSubmit={async (event) => {
            event.preventDefault();
            if (await run(() => resetPin({ token, userId: user._id as Id<"users">, pin }), t.admin.pinSaved(user.displayName))) setPin(null);
          }}>
            <Input aria-label={t.admin.newPin} placeholder={t.admin.newPin} inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} className="min-h-10 w-36" required />
            <Button size="sm" type="submit">{t.common.save}</Button>
            <Button size="sm" variant="ghost" onClick={() => setPin(null)}>{t.common.cancel}</Button>
          </form>}
    </div>
  </Card>;
}
