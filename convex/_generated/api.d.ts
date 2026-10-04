/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as drivers from "../drivers.js";
import type * as lib_attempts from "../lib/attempts.js";
import type * as lib_fleet from "../lib/fleet.js";
import type * as lib_missionView from "../lib/missionView.js";
import type * as lib_security from "../lib/security.js";
import type * as lib_session from "../lib/session.js";
import type * as lib_validators from "../lib/validators.js";
import type * as missions from "../missions.js";
import type * as offers from "../offers.js";
import type * as trucks from "../trucks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  drivers: typeof drivers;
  "lib/attempts": typeof lib_attempts;
  "lib/fleet": typeof lib_fleet;
  "lib/missionView": typeof lib_missionView;
  "lib/security": typeof lib_security;
  "lib/session": typeof lib_session;
  "lib/validators": typeof lib_validators;
  missions: typeof missions;
  offers: typeof offers;
  trucks: typeof trucks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
