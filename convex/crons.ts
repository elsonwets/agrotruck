import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sessions expirées et vieux compteurs de tentatives : supprimés toutes les heures.
crons.interval("purge expired sessions", { hours: 1 }, internal.auth.purgeExpired, {});

export default crons;
