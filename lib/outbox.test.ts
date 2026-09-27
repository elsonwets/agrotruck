import { describe, expect, it } from "vitest";
import { createOutbox, memoryStorage, type Fetcher } from "./outbox";

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const refused = (error: string, status = 409) => new Response(JSON.stringify({ error }), { status });
const offline: Fetcher = async () => { throw new TypeError("Failed to fetch"); };

function recorder(responses: (Response | "offline")[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const next = responses.shift() ?? ok();
    if (next === "offline") throw new TypeError("Failed to fetch");
    return next;
  };
  return { calls, fetcher };
}

const action = { url: "/.netlify/functions/orders?id=o1&action=loaded", body: { at: "2026-10-05T08:15:00.000Z" }, kind: "loaded" as const, label: "Chargé" };

describe("outbox", () => {
  it("sends right away when online", async () => {
    const { calls, fetcher } = recorder([ok({ status: "loaded" })]);
    const outbox = createOutbox(memoryStorage(), fetcher, () => true);
    const result = await outbox.submit(action);
    expect(result.status).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(await outbox.list()).toEqual([]);
  });

  it("queues the action when the phone is offline, without trying the network", async () => {
    const { calls, fetcher } = recorder([]);
    const outbox = createOutbox(memoryStorage(), fetcher, () => false);
    expect((await outbox.submit(action)).status).toBe("queued");
    expect(calls).toHaveLength(0);
    expect(await outbox.list()).toHaveLength(1);
  });

  it("queues the action when the request fails on the network", async () => {
    const outbox = createOutbox(memoryStorage(), offline, () => true);
    const result = await outbox.submit(action);
    expect(result.status).toBe("queued");
    expect(result.status === "queued" && result.item.queuedAt).toBeTruthy();
  });

  it("does not queue a request the server refused", async () => {
    const outbox = createOutbox(memoryStorage(), async () => refused("Mission déjà prise"), () => true);
    const result = await outbox.submit(action);
    expect(result.status).toBe("sent");
    expect(result.status === "sent" && result.response.status).toBe(409);
    expect(await outbox.list()).toEqual([]);
  });

  it("replays queued actions in order when the connection comes back", async () => {
    const storage = memoryStorage();
    await createOutbox(storage, offline, () => false).submit({ ...action, label: "1" });
    await createOutbox(storage, offline, () => false).submit({ ...action, url: "/b", label: "2" });
    const { calls, fetcher } = recorder([ok(), ok()]);
    const report = await createOutbox(storage, fetcher, () => true).flush();
    expect(calls.map((call) => call.url)).toEqual([action.url, "/b"]);
    expect(calls[0].body).toEqual(action.body);
    expect(report.sent.map((item) => item.label)).toEqual(["1", "2"]);
    expect(report.remaining).toBe(0);
  });

  it("stops and keeps the rest when the network drops during a replay", async () => {
    const storage = memoryStorage();
    for (const label of ["1", "2", "3"]) await createOutbox(storage, offline, () => false).submit({ ...action, label });
    const { fetcher } = recorder([ok(), "offline"]);
    const report = await createOutbox(storage, fetcher, () => true).flush();
    expect(report.sent.map((item) => item.label)).toEqual(["1"]);
    expect(report.remaining).toBe(2);
  });

  it("drops and reports an action the server refuses, keeps a server error for later", async () => {
    const storage = memoryStorage();
    for (const label of ["refused", "server-error"]) await createOutbox(storage, offline, () => false).submit({ ...action, label });
    const { fetcher } = recorder([refused("La mission n'est pas à charger"), new Response("", { status: 503 })]);
    const report = await createOutbox(storage, fetcher, () => true).flush();
    expect(report.rejected).toEqual([{ item: expect.objectContaining({ label: "refused" }), error: "La mission n'est pas à charger" }]);
    expect((await storage.all()).map((item) => item.label)).toEqual(["server-error"]);
  });

  it("does nothing while offline", async () => {
    const storage = memoryStorage();
    await createOutbox(storage, offline, () => false).submit(action);
    const { calls, fetcher } = recorder([]);
    expect((await createOutbox(storage, fetcher, () => false).flush()).remaining).toBe(1);
    expect(calls).toHaveLength(0);
  });
});
