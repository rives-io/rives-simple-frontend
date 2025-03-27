import {
  fromHex,
  isHex,
  sha256,
  keccak256,
  parseAbiParameters,
  encodeAbiParameters,
  toHex,
  toFunctionSelector,
} from "viem";
import "viem/window";
import { Parser } from "expr-eval";

//
// General Consts
//
export const RIVES_NODE_URL = "https://app.rives.io";

//
// Models
//
export interface RulesOutput {
  data: RuleInfo[];
  total: number;
  page: number;
}

export interface RuleInfo {
  id: string;
  name: string;
  description: string;
  cartridge_id: string;
  created_by: string;
  created_at: number;
  input_index?: number;
  args: string;
  in_card: string;
  score_function: string;
  start?: number;
  end?: number;
  tags: string[];
  allow_tapes?: boolean;
  allow_in_card?: boolean;
  save_tapes?: boolean;
  save_out_cards?: boolean;
  tapes?: string[];
  deactivated?: boolean;
}

export interface GameplayData {
  outcard: Uint8Array;
  outhash: string;
  tape: Uint8Array;
  rivemuOnFinish: boolean;
}

//
// Utils
//
const RULE_ID_BYTES = 20;
const TRUNCATED_TAPE_ID_BYTES = 12;

export function truncateTapeHash(id: string): string {
  return id.startsWith("0x")
    ? id.slice(2, 2 + 2 * TRUNCATED_TAPE_ID_BYTES)
    : id.slice(0, 2 * TRUNCATED_TAPE_ID_BYTES);
}

export function ruleIdFromBytes(id: string): string {
  return id.startsWith("0x")
    ? id.slice(2, 2 + 2 * RULE_ID_BYTES)
    : id.slice(0, 2 * RULE_ID_BYTES);
}

export function calculateTapeId(ruleId: string, log: Uint8Array): string {
  return `${ruleIdFromBytes(ruleId)}${truncateTapeHash(keccak256(log))}`;
}

export function formatRuleIdToBytes(id: string): string {
  return `0x${ruleIdFromBytes(id)}${"0".repeat(2 * (32 - RULE_ID_BYTES))}`;
}

export function generateEntropy(userAddress: string, ruleId: string): string {
  if (userAddress.length != 42 || !isHex(userAddress) || ruleId.length != 40) {
    return "";
  }
  return sha256(`${userAddress}${ruleId}`).slice(2);
}

export function calculateScore(
  scoreFunction: string,
  outcard: Uint8Array,
): number {
  const parser = new Parser();
  const scoreFunctionEvaluator = parser.parse(scoreFunction);
  const decoder = new TextDecoder("utf-8");
  if (scoreFunctionEvaluator && decoder.decode(outcard.slice(0, 4)) == "JSON") {
    const outcard_str = decoder.decode(outcard);
    const outcard_json = JSON.parse(outcard_str.substring(4));
    return scoreFunctionEvaluator.evaluate(outcard_json);
  }
  return 0;
}

const verificationFunctionName = "core.register_external_verification";
// const verificationFunctionName = "core.verify";
const verificationParameters = "bytes32,bytes32,bytes,int,bytes32[],bytes";

export function processGameplay(
  ruleInfo: RuleInfo,
  gameplayResult: GameplayData,
): `0x${string}` {
  if (!gameplayResult.rivemuOnFinish) return "0x";
  if (!ruleInfo) return "0x";

  const score = calculateScore(ruleInfo.score_function, gameplayResult.outcard);

  const inputPayload = encodeAbiParameters(
    parseAbiParameters(verificationParameters), // 'bytes32,bytes32,bytes,int,bytes32[],bytes'
    [
      formatRuleIdToBytes(ruleInfo.id) as `0x${string}`,
      `0x${gameplayResult.outhash}`,
      toHex(gameplayResult.tape),
      BigInt(score),
      [] as `0x${string}`[],
      "0x",
    ],
  );

  const selector = toFunctionSelector(
    `${verificationFunctionName}(${verificationParameters})`,
  );
  const payload: `0x${string}` = `0x${selector.replace("0x", "")}${inputPayload.replace("0x", "")}`;

  return payload;
}

//
// Fetchers
//
export async function getRule(ruleId: string): Promise<RuleInfo | null> {
  const res = await fetch(`${RIVES_NODE_URL}/inspect/core/rules?id=${ruleId}`);
  const outJson = await res.json();

  if (outJson["status"] != "Accepted" || outJson["reports"].length == 0) {
    return null;
  }

  const out: RulesOutput = JSON.parse(
    fromHex(outJson["reports"][0].payload, "string"),
  );
  return out["data"][0];
}
