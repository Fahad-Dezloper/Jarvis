// Shared contract for the voice action engine, the command bar and the apps.
// Window keys are the keys of WINDOW_CONFIG in src/constants/window.js
// (finder, terminal, notes, safari, chrome, music, settings, calculator, ...).

/**
 * @typedef {{type:"open", window:string}
 *  | {type:"close", window:string}
 *  | {type:"minimize", window:string}
 *  | {type:"maximize", window:string}
 *  | {type:"restore", window:string}
 *  | {type:"focus", window:string}
 *  | {type:"move", window:string, x:number, y:number}
 *  | {type:"resize", window:string, width:number, height:number}
 *  | {type:"tile", layout:"grid"|"columns"|"rows"|"cascade", windows?:string[]}
 *  | {type:"click", window:string, target:string}
 *  | {type:"type", window:string, target?:string, text:string, submit?:boolean}
 *  | {type:"invoke", app:string, name:string, args?:Record<string,unknown>}
 *  | {type:"say", text:string}} Action
 */

/**
 * @typedef {Object} PlanResult
 * @property {Action[]} actions
 * @property {string} reply  One short sentence for the command bar.
 * @property {"model"|"rules"} source
 * @property {string=} note  E.g. why the model path was skipped.
 */

/**
 * Events emitted while a command runs; the command bar renders them.
 * @typedef {{type:"plan", actions:Action[], reply:string, source:"model"|"rules", note?:string}
 *  | {type:"step", index:number, action:Action, status:"start"|"ok"|"fail", message?:string,
 *      rect?:{x:number,y:number,width:number,height:number}}
 *  | {type:"done", reply:string, ok:boolean}} EngineEvent
 */

/**
 * The only function the UI needs from the engine
 * (implemented in src/deskhand/engine/index.js).
 * @typedef {(text:string, opts?:{history?:{command:string,reply:string}[], onEvent?:(e:EngineEvent)=>void, signal?:AbortSignal}) => Promise<{reply:string, source:"model"|"rules", ok:boolean}>} RunCommand
 */

export const CONTRACT_VERSION = 1;

/**
 * Handlers return { ok, message, data? }. `data` is optional text (for example
 * the contents of a file or a list of search results) that the engine feeds back
 * to the planner as an observation so multi-step tasks can use it. Keep it under
 * about 6000 characters.
 * @typedef {{ok:boolean, message:string, data?:string}} HandlerResult
 */
