import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  Chain,
  fromHex,
  isHex,
  WalletClient,
  parseAbi,
  Transport,
} from "viem";
import "viem/window";
import { anvil, base, baseSepolia } from "viem/chains";

//
// Consts
//
const WORLD_ADDRESS = "0x04969e1d36d43515cc6493a286021b44b0fce6f2";
const APP_ADDRESS = "0xECB28678045a94F8b96EdE1c8203aDEa81F8AAe3";

const humanWorldInputBoxAbi = [
  "function addInput(address _app, bytes payload) payable",
];

const worldInputBoxAbi = parseAbi(humanWorldInputBoxAbi);

//
// Utils
//
const chains: Record<number, Chain> = {};
chains[baseSepolia.id] = baseSepolia;
chains[base.id] = base;
chains[anvil.id] = anvil;

export function getChain(chainId: number | string): Chain {
  if (typeof chainId === "string") {
    if (!isHex(chainId)) throw new Error("Chain not found");
    chainId = fromHex(chainId, "number");
  }

  const chain = chains[chainId];
  if (!chain) throw new Error("Chain not found");

  return chain;
}

export async function connectWalletClient(chainId: number | string) {
  const eth: any = window.ethereum;
  if (!eth) {
    const errorMessage =
      "MetaMask or another web3 wallet is not installed. Please install one to proceed.";
    throw new Error(errorMessage);
  }
  const transport: any = custom(eth);

  const walletClient = createWalletClient({
    chain: getChain(chainId),
    transport: transport,
  });

  if (!eth.chainId || fromHex(eth.chainId, "number") != walletClient.chain.id)
    throw new Error("Wallet on wrong chain");

  return walletClient;
}

//
// Submit
//
export async function submitGameplay(
  walletClient: WalletClient,
  payload: `0x${string}`,
) {
  if (!walletClient || !walletClient.chain)
    throw new Error("No connected wallet");
  const eth: any = window.ethereum;
  if (!eth.chainId || fromHex(eth.chainId, "number") != walletClient.chain.id)
    throw new Error("Wallet on wrong chain");

  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: http(),
  });
  const [address] = await walletClient.requestAddresses();

  const { request } = await publicClient.simulateContract({
    account: address,
    address: WORLD_ADDRESS as `0x${string}`,
    abi: worldInputBoxAbi,
    functionName: "addInput",
    args: [APP_ADDRESS, payload],
    value: BigInt(0),
  });
  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}
