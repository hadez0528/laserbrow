"use client";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as bitcoin from "bitcoinjs-lib";
import {
  getLeatherNetwork,
  getNetworkForUnisat,
  getNetworkForXverse,
  getUnisatNetwork,
  getXverseNetwork,
  LEATHER,
  MAINNET,
  OYL,
  P2TR,
  P2WPKH,
  PHANTOM,
  REGTEST,
  TESTNET,
  UNISAT,
  XVERSE,
  XVERSE_NETWORK,
} from "../consts/wallets";
import { getAddress, GetAddressOptions, signTransaction } from "sats-connect";
import {
  Config,
  LaserEyesContextType,
  LeatherAddress,
  LeatherRequestAddressResponse,
  LeatherRequestSignResponse,
  LeatherRPCResponse,
} from "../types";
import { LOCAL_STORAGE_DEFAULT_WALLET, NETWORK } from "../consts/settings";
import { fromOutputScript } from "bitcoinjs-lib/src/address";
import { useLocalStorage } from "usehooks-ts";
import {
  findOrdinalsAddress,
  findPaymentAddress,
  getBitcoinNetwork,
} from "../lib/helpers";

const initialWalletContext = {
  hasOyl: false,
  hasUnisat: false,
  hasXverse: false,
  hasLeather: false,
  connected: false,
  isConnecting: false,
  publicKey: "",
  address: "",
  paymentAddress: "",
  paymentPublicKey: "",
  balance: {
    confirmed: 0,
    unconfirmed: 0,
    total: 0,
  },
  network: MAINNET as typeof MAINNET | typeof TESTNET | typeof REGTEST,
  library: null,
  provider: null,
  accounts: [],
  connect: async (
    walletName: typeof OYL | typeof UNISAT | typeof XVERSE | typeof LEATHER
  ) => {},
  disconnect: () => {},
  requestAccounts: async () => [],
  getNetwork: async () => MAINNET,
  switchNetwork: async (
    network: typeof MAINNET | typeof TESTNET | typeof REGTEST
  ) => {},
  getPublicKey: async () => "",
  getBalance: async () => "",
  sendBTC: async (to: string, amount: number) => "",
  signMessage: async (message: string) => "",
  signPsbt: async (tx: string) => {
    return {
      signedPsbtHex: "",
      signedPsbtBase64: "",
      txId: "",
    };
  },
  pushPsbt: async (tx: string) => {
    return "";
  },
};

const LaserEyesContext =
  createContext<LaserEyesContextType>(initialWalletContext);

const useLaserEyes = (): LaserEyesContextType => {
  return useContext(LaserEyesContext);
};

const LaserEyesProvider = ({
  children,
  config,
}: {
  children: ReactNode;
  config: Config;
}) => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [publicKey, setPublicKey] = useState<string>("");
  const [paymentPublicKey, setPaymentPublicKey] = useState<string>("");
  const [address, setAddress] = useState("");
  const [paymentAddress, setPaymentAddress] = useState("");
  const [balance, setBalance] = useState({
    confirmed: 0,
    unconfirmed: 0,
    total: 0,
  });

  const [network, setNetwork] = useLocalStorage<
    typeof MAINNET | typeof TESTNET | typeof REGTEST
  >("network", config.network ?? NETWORK);
  const [library, setLibrary] = useState<any>(null);
  const [provider, setProvider] = useState<
    | typeof OYL
    | typeof UNISAT
    | typeof XVERSE
    | typeof LEATHER
    | typeof PHANTOM
    | string
  >("");

  const [hasOyl, setHasOyl] = useState(false);
  const [hasUnisat, setHasUnisat] = useState(false);
  const [hasXverse, setHasXverse] = useState(false);
  const [hasLeather, setHasLeather] = useState(false);

  useEffect(() => {
    if (config) {
      setNetwork(config.network);
    } else {
      setNetwork(MAINNET);
    }
  }, [config]);

  useEffect(() => {
    const oylLib = (window as any)?.oyl;
    setHasOyl(!!oylLib);
  }, []);

  useEffect(() => {
    const unisatLib = (window as any)?.unisat;
    setHasUnisat(!!unisatLib);
  }, []);

  useEffect(() => {
    const xverseLib = (window as any)?.XverseProviders?.BitcoinProvider;
    setHasXverse(!!xverseLib);
  }, []);

  useEffect(() => {
    const leatherLib = (window as any)?.LeatherProvider;
    setHasLeather(!!leatherLib);
  }, []);

  const selfRef = useRef<{ accounts: string[] }>({
    accounts: [],
  });

  const self = selfRef.current;

  const connectOyl = async () => {
    try {
      localStorage?.setItem(LOCAL_STORAGE_DEFAULT_WALLET, OYL);
      const lib = (window as any).oyl;
      const result = await lib.requestAccounts();

      setAccounts(result);
      setAddress(result[0]);
      setPaymentAddress(result[0]);
      setLibrary(lib);
      setProvider(OYL);
      handleAccountsChanged(result);
      setConnected(true);
    } catch (error) {
      throw new Error(`Can't lasereyes to ${OYL} wallet`);
    }
  };

  const connectUnisat = async () => {
    try {
      localStorage?.setItem(LOCAL_STORAGE_DEFAULT_WALLET, UNISAT);
      const lib = (window as any).unisat;
      // @ts-ignore
      const result = await lib.requestAccounts();
      setAccounts(result);
      setAddress(result[0]);
      setPaymentAddress(result[0]);
      setLibrary(lib);
      setProvider(UNISAT);
      handleAccountsChanged(result);
      setConnected(true);
      await getNetwork().then((network) => {
        const foundNetwork = getNetworkForUnisat(String(network));
        setNetwork(foundNetwork);
      });
    } catch (error) {
      throw new Error(`Can't lasereyes to ${UNISAT} wallet`);
    }
  };

  const connectXverse = async () => {
    try {
      localStorage?.setItem(LOCAL_STORAGE_DEFAULT_WALLET, XVERSE);
      let xverseNetwork = getXverseNetwork(NETWORK);
      const getAddressOptions = {
        payload: {
          purposes: ["ordinals", "payment"],
          message: "Address for receiving Ordinals and payments",
          network: {
            type: xverseNetwork,
          },
        },
        onFinish: (response: any) => {
          setPublicKey(String(response.addresses[0].publicKey));
          setPaymentPublicKey(String(response.addresses[1].publicKey));
          const foundAddress = findOrdinalsAddress(response.addresses);
          const foundPaymentAddress = findPaymentAddress(response.addresses);
          if (foundAddress && foundPaymentAddress) {
            setAddress(foundAddress.address);
            setPaymentAddress(foundPaymentAddress.address);
            setProvider(XVERSE);
            setLibrary((window as any).BitcoinProvider);
          }
        },
      };
      await getAddress(getAddressOptions as GetAddressOptions);
      setConnected(true);
    } catch (error) {
      throw new Error(`Can't lasereyes to ${XVERSE} wallet`);
    }
  };

  const connectLeather = async () => {
    try {
      localStorage?.setItem(LOCAL_STORAGE_DEFAULT_WALLET, LEATHER);

      const lib = (window as any).LeatherProvider;
      // @ts-ignore
      const getAddressesResponse: LeatherRPCResponse = await lib.request(
        "getAddresses"
      );

      const addressesResponse =
        getAddressesResponse.result as LeatherRequestAddressResponse;

      const addresses: LeatherAddress[] = addressesResponse.addresses;

      const leatherAccountsParsed = addresses.map(
        (address: LeatherAddress) => address.address
      );

      const taprootAddress = addresses.find(
        (address: LeatherAddress) => address.type === P2TR
      );

      const segwitAddress = addresses.find(
        (address: LeatherAddress) => address.type === P2WPKH
      );

      setAccounts(leatherAccountsParsed);
      setAddress(String(taprootAddress?.address));
      setPaymentAddress(String(segwitAddress?.address));
      setLibrary(lib);
      setProvider(LEATHER);
      handleAccountsChanged(leatherAccountsParsed);
      setConnected(true);
      await getNetwork().then((network) => {
        // const foundNetwork = getNe(String(network))
        if (!network) {
          setNetwork(MAINNET);
        } else {
          setNetwork(network);
        }
      });
      setConnected(true);
    } catch (error) {
      throw new Error(`Can't lasereyes to ${LEATHER} wallet`);
    }
  };

  const handleAccountsChanged = (_accounts: string[]) => {
    // @ts-ignore
    if (self.accounts[0] === _accounts[0]) {
      return;
    }

    self.accounts = _accounts;
    // @ts-ignore
    if (_accounts.length > 0) {
      setAccounts(_accounts);
      setConnected(true);
      // @ts-ignore
      setAddress(_accounts[0]);
      setPaymentAddress(_accounts[0]);
      getBasicInfo();
    } else {
      setConnected(false);
    }
  };

  useEffect(() => {
    // TODO: do for OYL
    if (provider !== UNISAT) {
      return;
    }

    // @ts-ignore
    library.getAccounts().then((accounts: string[]) => {
      handleAccountsChanged(accounts);
    });
    // @ts-ignore
    library.on("accountsChanged", handleAccountsChanged);
    // @ts-ignore
    library.on("networkChanged", handleNetworkChanged);
    return () => {
      // @ts-ignore
      library.removeListener("accountsChanged", handleAccountsChanged);
      // @ts-ignore
      library.removeListener("networkChanged", handleNetworkChanged);
    };
  }, [library]);

  useEffect(() => {
    const defaultWallet = localStorage?.getItem(
      LOCAL_STORAGE_DEFAULT_WALLET
    ) as typeof OYL | typeof UNISAT | typeof XVERSE | undefined;
    if (defaultWallet) {
      setProvider(defaultWallet);
      connect(defaultWallet);
    }
  }, []);

  // @ts-ignore
  const getBasicInfo = async () => {
    if (provider !== UNISAT) return;
    // @ts-ignore
    // const [address] = await library?.getAccounts()
    // setAddress(address)
    // @ts-ignore
    const publicKey = await library?.getPublicKey();
    setPublicKey(String(publicKey));
    // @ts-ignore
    const balance = await library?.getBalance();
    // @ts-ignore
    setBalance(balance);
    // @ts-ignore
    const network = await library?.getNetwork();
    if (network) {
      // @ts-ignore
      setNetwork(network);
    }
  };

  const handleNetworkChanged = (
    network: typeof MAINNET | typeof TESTNET | typeof REGTEST
  ) => {
    let foundNetwork: typeof MAINNET | typeof TESTNET | typeof REGTEST =
      MAINNET;
    if (provider === UNISAT) {
      foundNetwork = getNetworkForUnisat(network);
    }
    if (provider === XVERSE) {
      foundNetwork = getNetworkForXverse(network);
    }
    if (provider === LEATHER) {
      foundNetwork = getLeatherNetwork(network);
    }
    setNetwork(foundNetwork);
    getBasicInfo();
  };

  const connect = async (
    walletName: typeof OYL | typeof UNISAT | typeof XVERSE
  ) => {
    setIsConnecting(true);
    try {
      if (!walletName) throw new Error("No wallet provided");
      if (walletName === OYL) {
        await connectOyl();
      } else if (walletName === UNISAT) {
        await connectUnisat();
      } else if (walletName === XVERSE) {
        await connectXverse();
      } else if (walletName === LEATHER) {
        await connectLeather();
      } else {
        throw new Error("Wallet not found!");
      }
      setConnected(true);
    } catch (error) {
      setIsConnecting(false);
      disconnect();
      throw new Error("Can't lasereyes to wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress("");
    setAccounts([]);
    setProvider("");
    setLibrary(null);
    setConnected(false);
    localStorage?.removeItem(LOCAL_STORAGE_DEFAULT_WALLET);
  };

  const requestAccounts = async () => {
    try {
      if (!library) return;
      if (provider === OYL) {
        return await library.requestAccounts();
      } else if (provider === UNISAT) {
        return await library.requestAccounts();
      } else if (provider === XVERSE) {
        const getAddressOptions = {
          payload: {
            // @ts-ignore
            purposes: ["ordinals", "payment"],
            message: "Address for receiving Ordinals and payments",
            network: {
              type: XVERSE_NETWORK,
            },
          },
          onFinish: async (response: any) => {
            const foundAddress = findOrdinalsAddress(response.addresses);
            setAddress(foundAddress.address);
            const foundPaymentAddress = findPaymentAddress(response.addresses);
            setPaymentAddress(foundPaymentAddress);
            setPublicKey(String(response.addresses[0].publicKey));
            setPaymentPublicKey(String(response.addresses[1].publicKey));
          },
          onCancel: () => {
            throw new Error("User cancelled");
          },
        };
        return [address];
      }
    } catch (error) {
      throw error;
    }
  };

  const getNetwork = async () => {
    try {
      if (!library) return;
      if (provider === OYL) {
        throw new Error("Not implemented");
      } else if (provider === UNISAT) {
        const unisatNetwork = await library?.getNetwork();
        const foundNetwork = getNetworkForUnisat(unisatNetwork) as
          | typeof MAINNET
          | typeof TESTNET;
        setNetwork(foundNetwork);
        return foundNetwork;
      } else if (provider === XVERSE) {
        throw new Error("Not implemented");
      } else if (provider === LEATHER) {
        throw new Error("Not implemented");
      }
    } catch (error) {
      throw error;
    }
  };

  const switchNetwork = async (
    network: typeof MAINNET | typeof TESTNET | typeof REGTEST
  ) => {
    try {
      if (!library) return;
      if (provider === OYL) {
        throw new Error("Not implemented");
      } else if (provider === UNISAT) {
        const wantedNetwork = getUnisatNetwork(network);
        await library?.switchNetwork(wantedNetwork);
        setNetwork(network);
      } else if (provider === XVERSE) {
        throw new Error("Not implemented");
      }
    } catch (error) {
      throw error;
    }
  };

  const getPublicKey = async () => {
    try {
      if (!library) return;
      if (provider === OYL) {
        return await library?.getPublicKey();
      } else if (provider === UNISAT) {
        return await library?.getPublicKey();
      } else if (provider === XVERSE) {
        throw new Error("Not implemented");
      } else if (provider === LEATHER) {
        throw new Error("Not implemented");
      }
    } catch (error) {
      console.error("error", error);
      throw error;
    }
  };

  const getBalance = async () => {
    try {
      if (!library) return;
      if (provider === OYL) {
        return await library.getBalance();
      } else if (provider === UNISAT) {
        return await library.getBalance();
      } else if (provider === XVERSE) {
        throw new Error("Not implemented");
      }
    } catch (error) {
      throw error;
    }
  };

  const getInscriptions = async () => {
    try {
      if (!library) return;
      if (provider === OYL) {
        return await library.getInscriptions(0, 10);
      } else if (provider === UNISAT) {
        return await library.getInscriptions(0, 10);
      } else if (provider === XVERSE) {
        throw new Error("Not implemented");
      } else if (provider === LEATHER) {
        throw new Error("Not implemented");
      }
    } catch (error) {
      throw error;
    }
  };

  const sendBTC = async (to: string, amount: number) => {
    try {
      // if (!library) return;
      if (provider === OYL) {
        new Error("Not implemented");
      } else if (provider === UNISAT) {
        return await library?.sendBitcoin(to, amount);
      } else if (provider === XVERSE) {
        new Error("Not implemented");
      } else if (provider === LEATHER) {
        return await library?.request("sendTransfer", {
          address: to,
          amount: amount.toString(),
        });
      }
    } catch (error) {
      console.error("error", error);
    }
  };

  const signMessage = async (message: string) => {
    try {
      if (!library) return;
      if (provider === OYL) {
        new Error("Not implemented");
      } else if (provider === UNISAT) {
        return await library?.signMessage(message);
      } else if (provider === XVERSE) {
        new Error("Not implemented");
      } else if (provider === LEATHER) {
        return await library?.request("signMessage", {
          message: message,
          paymentType: P2TR,
        });
      }
    } catch (error) {
      console.error("error", error);
    }
  };

  const signPsbt = async (psbt: string, finalize = false, broadcast = true) => {
    try {
      if (!library) return;
      if (provider === OYL) {
        const response = (await library?.signPsbt(psbt)) as {
          signedPsbtHex: string;
          signedPsbtBase64: string;
        };
        return response;
      } else if (provider === UNISAT) {
        const txHex = await library?.signPsbt(psbt, {
          autoFinalized: finalize,
        });
        const signedPsbt = bitcoin.Psbt.fromHex(txHex);
        return {
          signedPsbtHex: signedPsbt.toHex(),
          signedPsbtBase64: signedPsbt.toBase64(),
        };
      } else if (provider === XVERSE) {
        const toSignPsbt = bitcoin.Psbt.fromBase64(String(psbt), {
          network: getBitcoinNetwork(network),
        });

        const inputs = toSignPsbt.data.inputs;
        const inputsToSign = [];
        const ordinalAddressData = {
          address: address,
          signingIndexes: [] as number[],
        };
        const paymentsAddressData = {
          address: paymentAddress,
          signingIndexes: [] as number[],
        };

        let counter = 0;
        for await (let input of inputs) {
          const { script } = input.witnessUtxo!;
          const addressFromScript = fromOutputScript(
            script,
            getBitcoinNetwork(network)
          );

          if (addressFromScript === paymentAddress) {
            paymentsAddressData.signingIndexes.push(Number(counter));
          } else if (addressFromScript === address) {
            ordinalAddressData.signingIndexes.push(Number(counter));
          }
          counter++;
        }

        if (ordinalAddressData.signingIndexes.length > 0) {
          inputsToSign.push(ordinalAddressData);
        }

        if (paymentsAddressData.signingIndexes.length > 0) {
          inputsToSign.push(paymentsAddressData);
        }

        let txId = "";
        let signedPsbtHex, signedPsbtBase64;

        const xverseNetwork = getXverseNetwork(network);

        const signPsbtOptions = {
          payload: {
            network: {
              type: xverseNetwork,
            },
            message: "Sign Transaction",
            psbtBase64: toSignPsbt.toBase64(),
            broadcast: broadcast,
            inputsToSign: inputsToSign,
          },
          onFinish: (response: { psbtBase64: string; txId: string }) => {
            if (response.txId) {
              txId = response.txId;
            } else if (response.psbtBase64) {
              const signedPsbt = bitcoin.Psbt.fromBase64(
                String(response.psbtBase64),
                {
                  network: getBitcoinNetwork(network),
                }
              );

              signedPsbtHex = signedPsbt.toHex();
              signedPsbtBase64 = signedPsbt.toBase64();
            }
          },
          onCancel: () => console.log("Canceled"),
        };

        // @ts-ignore
        await signTransaction(signPsbtOptions);
        return {
          signedPsbtHex: signedPsbtHex,
          signedPsbtBase64: signedPsbtBase64,
          txId: txId,
        };
      }
    } catch (error) {
      console.error("error", error);
      throw error;
    }
  };

  const pushPsbt = async (psbt: string, finalize = false) => {
    try {
      if (!library) return;
      if (provider === OYL) {
        return (await library?.pushPsbt(psbt)) as string;
      } else if (provider === UNISAT) {
        return (await library?.pushPsbt(psbt)) as string;
      } else if (provider === XVERSE) {
        const signPsbtOptions = {
          payload: {
            network: {
              type: NETWORK,
            },
            message: "Sign Transaction",
            psbtBase64: `cHNidP8BAJwCAmO+JvQJxhVDDpm3tV5PmPfzvJOSL4GOdjEOpAAAAAAnrAAA==`,
            broadcast: false,
            inputsToSign: [
              {
                address: "33TKH4kkiFPyTLDNmdNsLggyLeAYre57Qm",
                signingIndexes: [1],
              },
            ],
          },
          onFinish: (response: { psbtBase64: any }) => {
            // alert(response.psbtBase64)
          },
          onCancel: () => console.log("Canceled"),
        };

        // @ts-ignore
        await signTransaction(signPsbtOptions);
      }
    } catch (error) {
      console.error("error", error);
    }
  };

  return (
    <LaserEyesContext.Provider
      value={{
        library,
        accounts,
        publicKey,
        address,
        paymentAddress,
        paymentPublicKey,
        provider,
        balance,
        network,
        connected,
        isConnecting,
        hasOyl,
        hasUnisat,
        hasXverse,
        hasLeather,

        // functions
        connect,
        disconnect,
        requestAccounts,
        getNetwork,
        switchNetwork,
        getPublicKey,
        getBalance,
        sendBTC,
        signPsbt,
        pushPsbt,
        signMessage,
      }}
    >
      {children}
    </LaserEyesContext.Provider>
  );
};

export { LaserEyesProvider, useLaserEyes };
