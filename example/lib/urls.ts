import { MAINNET, SIGNET, TESTNET, FRACTAL_TESTNET } from '@omnisat/lasereyes'
import { FRACTAL_MAINNET, TESTNET4 } from '../../src'
import {
  MEMPOOL_SPACE_FRACTAL_MAINNET_URL,
  MEMPOOL_SPACE_TESTNET4_URL,
} from '../../src/lib/urls'
export const MEMPOOL_SPACE_URL = 'https://mempool.space'
export const MEMPOOL_SPACE_TESTNET_URL = 'https://mempool.space/testnet4'
export const MEMPOOL_SPACE_SIGNET_URL = 'https://mempool.space/signet'
export const MEMPOOL_SPACE_FRACTAL_TESTNET_URL =
  'https://mempool-testnet.fractalbitcoin.io'

export const getMempoolSpaceUrl = (
  network:
    | typeof MAINNET
    | typeof TESTNET
    | typeof TESTNET4
    | typeof SIGNET
    | typeof FRACTAL_MAINNET
    | typeof FRACTAL_TESTNET
) =>
  network === TESTNET
    ? MEMPOOL_SPACE_TESTNET_URL
    : network === TESTNET4
      ? MEMPOOL_SPACE_TESTNET4_URL
      : network === SIGNET
        ? MEMPOOL_SPACE_SIGNET_URL
        : network === FRACTAL_MAINNET
          ? MEMPOOL_SPACE_FRACTAL_MAINNET_URL
          : network === FRACTAL_TESTNET
            ? MEMPOOL_SPACE_FRACTAL_TESTNET_URL
            : MEMPOOL_SPACE_URL

export const ORDPOOL_SPACE_URL = 'https://ordpool.space'
export const ORDPOOL_SPACE_TESTNET_URL = 'https://ordpool.space/testnet'

export const getOrdpoolSpaceUrl = (network: typeof MAINNET | typeof TESTNET) =>
  network === TESTNET ? ORDPOOL_SPACE_TESTNET_URL : ORDPOOL_SPACE_URL
