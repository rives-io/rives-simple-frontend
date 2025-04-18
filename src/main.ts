import {
  CARTRIDGE_ID,
  CARTRIDGES_URL,
  EMULATOR_URL,
  TAPE_ID,
  TAPES_URL,
  RULE_ID,
  CHAIN_ID,
  RULES_PARAMS_URL,
} from "./consts.js";
import { connectWalletClient, submitGameplay } from "./lib/onchain.js";
import { getRule, generateEntropy, processGameplay, getRuleLeaderboard } from "./lib/rives.js";

interface EmulatorParams {
  cartridgeId?: string;
  simple?: boolean;
  autoplay?: boolean;
  tapeId?: string;
  ruleId?: string;
  args?: string;
  incardUrl?: string;
  entropy?: string;
  extra?: string;
}

export function setEmulatorUrl(params: EmulatorParams) {
  const emulator = document.getElementById(
    "emulator-iframe",
  ) as HTMLIFrameElement;
  if (emulator) {
    let fullSrc = `${EMULATOR_URL}/#light=100`;
    if (params.cartridgeId) {
      fullSrc += `&cartridge=${CARTRIDGES_URL}/${params.cartridgeId}`;
    }
    if (params.simple) {
      fullSrc += `&simple=${params.simple}`;
    }
    if (params.autoplay) {
      fullSrc += `&autoplay=${params.autoplay}`;
    }
    if (params.ruleId) {
      fullSrc += `&fullTape=${RULES_PARAMS_URL}/${params.ruleId}`;
    }
    if (params.tapeId) {
      fullSrc += `&fullTape=${TAPES_URL}/${params.tapeId}`;
    }
    if (params.args) {
      fullSrc += `&args=${encodeURIComponent(params.args)}`;
    }
    if (params.incardUrl) {
      fullSrc += `&incard=${params.incardUrl}`;
    }
    if (params.entropy) {
      fullSrc += `&entropy=${params.entropy}`;
    }
    if (params.extra) {
      fullSrc += `&${params.extra}`;
    }
    emulator.src = fullSrc;
  }
}

export function setupPlay() {
  setEmulatorUrl({
    cartridgeId: CARTRIDGE_ID,
    ruleId: RULE_ID,
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
  // get rule
  const rule = await getRule(RULE_ID);
  if (!rule) {
    const msg = "Error loading rule";
    console.error(msg);
    const submitMsgDiv = document.getElementById("submit-msg");
    if (submitMsgDiv) submitMsgDiv.innerHTML = "";
    const msgDiv = document.getElementById("connect-msg");
    if (msgDiv) msgDiv.innerHTML = `${msg} (Demo Version)`;
    setEmulatorUrl({cartridgeId: CARTRIDGE_ID, simple: true});
    return;
  }

  // connected wallet func
  const getConnectedClient = async () => {
    const msgDiv = document.getElementById("connect-msg");
    const submitMsgDiv = document.getElementById("submit-msg");
    if (submitMsgDiv) submitMsgDiv.innerHTML = "";
    try {
      const currClient = await connectWalletClient(CHAIN_ID);

      if (!currClient) throw new Error("Error connecting wallet");
      const [address] = await currClient.requestAddresses();

      if (msgDiv)
        msgDiv.innerHTML = `Connected with ` +
          `${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)} ` +
          `on ${currClient.chain.name}`;

      return {client:currClient,address:address}
    } catch (error) {
      console.log(error);
      let msg = "Error connecting wallet";
      if (error instanceof Error) {
        const indexDot = error.message.indexOf(".");
        msg =
          indexDot >= 0 ? error.message.substring(0, indexDot) : error.message;
      }
      if (msgDiv) msgDiv.innerHTML = `${msg} (Demo Version)`;
      setEmulatorUrl({cartridgeId: CARTRIDGE_ID, simple: true, ruleId: rule.id});
      return {client:null,address:null};
    }
  }

  // connection vars
  let client: any | null;
  let userAddress: string | null;

  // Set wallet event listeners
  if (window.ethereum) {
    window.ethereum.on("chainChanged", async () => {
      const connetedClient = await getConnectedClient();
      client = connetedClient.client;
      userAddress = connetedClient.address;
    });
    window.ethereum.on("accountsChanged", async () => {
      const connetedClient = await getConnectedClient();
      client = connetedClient.client;
      userAddress = connetedClient.address;
    });
  }

  // get connected wallet
  const connetedClient = await getConnectedClient();
  client = connetedClient.client;
  userAddress = connetedClient.address;
  if (!client || !userAddress) {
    return;
  }

  // set submit listener
  window.addEventListener(
    "message",
    (e) => {
      if (!client || !userAddress || !rule ) return;
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
            let msg = "Error submitting";
            if (error instanceof Error) {
              const indexDot = error.message.indexOf(".");
              msg =
                indexDot >= 0 ? error.message.substring(0, indexDot) : error.message;
            }
            console.log(error);
            if (submitMsgDiv) submitMsgDiv.innerHTML = msg;
          });
      }
    },
    false,
  );

  // set entropy
  const entropy = generateEntropy(userAddress, rule.id);

  // config emulator with all parameters
  setEmulatorUrl({
    cartridgeId: CARTRIDGE_ID,
    simple: true,
    ruleId: rule.id,
    entropy: entropy,
  });
}

export function timeToDateUTCString(time: number) {
  const date = new Date(Number(time) * 1000);
  return formatDate(date);
}

export function formatDate(date: Date) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  };

  const dateString = date.toLocaleDateString("en-US", options);
  const [month_day, year, time] = dateString.split(",");
  const [month, day] = month_day.split(" ");
  const finalYear = year.substring(1);

  return `${month}/${day}/${finalYear}, ${time}`;
}

export async function renderLeaderboard() {
  const table: HTMLTableElement = <HTMLTableElement> document.getElementById("leaderboard");
  const tapesOut = await getRuleLeaderboard(RULE_ID);
  if (!tapesOut || tapesOut.total < 1) {
    const row = table.insertRow();
    row.innerHTML = "No tapes";
    return;
  }
  let rank = 1;
  for (const tape of tapesOut.data) {
    const row = table.insertRow();
    row.insertCell().innerHTML = `${rank++}`;
    row.insertCell().innerHTML = tape.user_address;
    row.insertCell().innerHTML = timeToDateUTCString(tape.timestamp);
    row.insertCell().innerHTML = `${tape.score ? tape.score : ''}`;
  }
}
