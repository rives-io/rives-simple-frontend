import {
  CARTRIDGE_ID,
  CARTRIDGES_URL,
  EMULATOR_URL,
  TAPE_ID,
  TAPES_URL,
  CONTEST_ID,
  CHAIN_ID,
} from "./consts.js";
import { connectWalletClient, submitGameplay } from "./lib/onchain.js";
import { generateEntropy, getRule, processGameplay } from "./lib/rives.js";

interface EmulatorParams {
  cartridgeId: string;
  simple?: boolean;
  autoplay?: boolean;
  tapeId?: string;
  args?: string;
  incardUrl?: string;
  entropy?: string;
}

function setEmulatorUrl(params: EmulatorParams) {
  const emulator = document.getElementById(
    "emulator-iframe",
  ) as HTMLIFrameElement;
  if (emulator) {
    let fullSrc = `${EMULATOR_URL}/#cartridge=${CARTRIDGES_URL}/${params.cartridgeId}`;
    if (params.simple) {
      fullSrc += `&simple=${params.simple}`;
    }
    if (params.autoplay) {
      fullSrc += `&autoplay=${params.autoplay}`;
    }
    if (params.tapeId) {
      fullSrc += `&fullTape=${TAPES_URL}/${params.tapeId}`;
    }
    if (params.args) {
      fullSrc += `&args=${params.args}`;
    }
    if (params.incardUrl) {
      fullSrc += `&incard=${params.incardUrl}`;
    }
    if (params.entropy) {
      fullSrc += `&entropy=${params.entropy}`;
    }
    emulator.src = fullSrc;
  }
}

export function setupPlay() {
  setEmulatorUrl({
    cartridgeId: CARTRIDGE_ID,
    simple: true,
  });
}

export function setupReplay() {
  setEmulatorUrl({
    cartridgeId: CARTRIDGE_ID,
    tapeId: TAPE_ID,
    autoplay: true,
  });
}

export async function setupSubmit() {
  const msgDiv = document.getElementById("connect-msg");
  const rule = await getRule(CONTEST_ID);
  if (!rule) {
    console.error("Error loading contest");
    return;
  }
  let client;
  let userAddress: string;
  try {
    client = await connectWalletClient(CHAIN_ID);
    if (!client) throw new Error("Error connecting wallet");
    const [address] = await client.requestAddresses();
    userAddress = address;
  } catch (error) {
    const msg = error.message;
    console.error();
    if (msgDiv) msgDiv.innerHTML = msg;
    return;
  }
  if (msgDiv)
    msgDiv.innerHTML = `Connected with ${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4, userAddress.length)} on ${client.chain.name}`;
  const entropy = generateEntropy(userAddress, rule.id);
  window.addEventListener(
    "message",
    (e) => {
      const params = e.data;
      if (params.rivemuOnFinish) {
        const submitMsgDiv = document.getElementById("submit-msg");
        if (submitMsgDiv) submitMsgDiv.innerHTML = "";
        const gameplayPayload = processGameplay(rule, params);
        submitGameplay(client, gameplayPayload)
          .then(() => {
            if (submitMsgDiv) submitMsgDiv.innerHTML = "Gameplay submitted;";
          })
          .catch((error) => {
            console.log(error);
            if (submitMsgDiv) submitMsgDiv.innerHTML = error.message;
          });
      }
    },
    false,
  );
  setEmulatorUrl({
    cartridgeId: CARTRIDGE_ID,
    simple: true,
    args: rule.args,
    entropy: entropy,
  });
}
