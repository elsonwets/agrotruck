import { describe, expect, it } from "vitest";
import { createOutbox, memoryStorage, OutboxRejected, type Sender } from "./outbox";

const action = { kind: "loaded" as const, label: "Chargé", args: { missionId: "m1", at: 1790000000000 } };
const offline: Sender = async () => { throw new Error("WebSocket closed"); };

function recorder(outcomes: ("ok" | "offline" | string)[]) {
  const calls: unknown[] = [];
  const send: Sender = async (item) => {
    calls.push(item.args);
    const next = outcomes.shift() ?? "ok";
    if (next === "offline") throw new Error("WebSocket closed");
    if (next !== "ok") throw new OutboxRejected(next);
    return { ok: true };
  };
  return { calls, send };
}

describe("outbox", () => {
  it("sends right away when online", async () => {
    const { calls, send } = recorder(["ok"]);
    const outbox = createOutbox(memoryStorage(), send, () => true);
    expect((await outbox.submit(action)).status).toBe("sent");
    expect(calls).toEqual([action.args]);
    expect(await outbox.list()).toEqual([]);
  });

  it("queues without trying the network when the phone is offline", async () => {
    const { calls, send } = recorder([]);
    const outbox = createOutbox(memoryStorage(), send, () => false);
    expect((await outbox.submit(action)).status).toBe("queued");
    expect(calls).toHaveLength(0);
    expect(await outbox.list()).toHaveLength(1);
  });

  it("queues when the connection drops during the send", async () => {
    const result = await createOutbox(memoryStorage(), offline, () => true).submit(action);
    expect(result.status === "queued" && result.item.queuedAt).toBeTruthy();
  });

  it("reports a server refusal without queuing it", async () => {
    const { send } = recorder(["already_taken"]);
    const outbox = createOutbox(memoryStorage(), send, () => true);
    expect(await outbox.submit(action)).toEqual({ status: "rejected", code: "already_taken" });
    expect(await outbox.list()).toEqual([]);
  });

  it("replays queued actions in order when the network returns", async () => {
    const storage = memoryStorage();
    await createOutbox(storage, offline, () => false).submit({ ...action, label: "1" });
    await createOutbox(storage, offline, () => false).submit({ ...action, label: "2", args: { missionId: "m2" } });
    const { calls, send } = recorder(["ok", "ok"]);
    const report = await createOutbox(storage, send, () => true).flush();
    expect(calls).toEqual([action.args, { missionId: "m2" }]);
    expect(report.sent.map((item) => item.label)).toEqual(["1", "2"]);
    expect(report.remaining).toBe(0);
  });

  it("stops and keeps the rest when the network drops during a replay", async () => {
    const storage = memoryStorage();
    for (const label of ["1", "2", "3"]) await createOutbox(storage, offline, () => false).submit({ ...action, label });
    const report = await createOutbox(storage, recorder(["ok", "offline"]).send, () => true).flush();
    expect(report.sent.map((item) => item.label)).toEqual(["1"]);
    expect(report.remaining).toBe(2);
    expect(await storage.all()).toHaveLength(2);
  });

  it("drops and reports a refused action, then continues", async () => {
    const storage = memoryStorage();
    for (const label of ["refused", "ok"]) await createOutbox(storage, offline, () => false).submit({ ...action, label });
    const report = await createOutbox(storage, recorder(["not_to_load", "ok"]).send, () => true).flush();
    expect(report.rejected).toEqual([{ item: expect.objectContaining({ label: "refused" }), code: "not_to_load" }]);
    expect(report.sent.map((item) => item.label)).toEqual(["ok"]);
    expect(await storage.all()).toEqual([]);
  });

  it("does nothing while offline", async () => {
    const storage = memoryStorage();
    await createOutbox(storage, offline, () => false).submit(action);
    const { calls, send } = recorder([]);
    expect((await createOutbox(storage, send, () => false).flush()).remaining).toBe(1);
    expect(calls).toHaveLength(0);
  });
});
