import {
  MAGIC_EDEN,
  MAINNET,
  OKX,
  OYL,
  PHANTOM,
  TESTNET,
  UNISAT,
  useLaserEyes,
  WIZZ,
  XVERSE,
  LEATHER,
  useInscriber,
} from '@omnisat/lasereyes'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { createPsbt } from '@/lib/btc'
import useUtxos from '@/hooks/useUtxos'
import { getMempoolSpaceUrl } from '@/lib/urls'
import { clsx } from 'clsx'
import { cn } from '@/lib/utils'

const WalletCard = ({
  walletName,
  setSignature,
  unsignedPsbt,
  setUnsignedPsbt,
  setSignedPsbt,
}: {
  walletName:
    | typeof UNISAT
    | typeof XVERSE
    | typeof OYL
    | typeof MAGIC_EDEN
    | typeof OKX
    | typeof LEATHER
    | typeof PHANTOM
    | typeof WIZZ
  setSignature: (signature: string) => void
  unsignedPsbt: string | undefined
  setUnsignedPsbt: (psbt: string) => void
  setSignedPsbt: (
    psbt:
      | {
          signedPsbtHex: string
          signedPsbtBase64: string
          txId?: string
        }
      | undefined
  ) => void
}) => {
  const {
    connect,
    disconnect,
    connected,
    provider,
    network,
    paymentAddress,
    paymentPublicKey,
    balance,
    hasUnisat,
    hasXverse,
    hasOyl,
    hasMagicEden,
    hasOkx,
    hasLeather,
    hasPhantom,
    hasWizz,
    sendBTC,
    signMessage,
    signPsbt,
    pushPsbt,
    switchNetwork,
  } = useLaserEyes()

  const {
    setContent,
    getCommitPsbt,
    isFetchingCommitPsbt,
    handleSignCommit,
    inscribe,
    isInscribing,
    inscriptionTxId,
    reset,
  } = useInscriber({ inscribeApiUrl: 'https://de-scribe.vercel.app/api' })

  const [finalize, setFinalize] = useState<boolean>(false)
  const [broadcast, setBroadcast] = useState<boolean>(false)
  const [unsigned, setUnsigned] = useState<string | undefined>()
  const [signed, setSigned] = useState<string | undefined>()
  const { utxos, loading, fetch } = useUtxos(
    paymentAddress,
    network as typeof MAINNET | typeof TESTNET
  )

  useEffect(() => {
    setContent('Laser_Eyes')
  }, [])

  const hasWallet = {
    unisat: hasUnisat,
    xverse: hasXverse,
    oyl: hasOyl,
    [MAGIC_EDEN]: hasMagicEden,
    okx: hasOkx,
    leather: hasLeather,
    phantom: hasPhantom,
    wizz: hasWizz,
  }

  const connectWallet = async (
    walletName:
      | typeof UNISAT
      | typeof XVERSE
      | typeof OYL
      | typeof MAGIC_EDEN
      | typeof OKX
      | typeof LEATHER
      | typeof PHANTOM
      | typeof WIZZ
  ) => {
    try {
      // @ts-ignore
      await connect(walletName)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  useEffect(() => {
    if (utxos.length > 0 && connected) {
      const psbt = createPsbt(
        utxos,
        paymentAddress,
        paymentPublicKey,
        network as typeof MAINNET | typeof TESTNET
      )
      if (psbt) {
        setUnsignedPsbt(psbt.toHex())
        setUnsigned(psbt.toHex())
      }
    }
  }, [utxos, connected])

  useEffect(() => {
    setUnsigned(undefined)
  }, [network])

  const send = async () => {
    try {
      if (balance! < 1500) {
        throw new Error('Insufficient funds')
      }

      const txid = await sendBTC(paymentAddress, 1500)
      toast.success(
        <span className={'flex flex-col gap-1 items-center justify-center'}>
          <span className={'font-black'}>View on mempool.space</span>
          <a
            target={'_blank'}
            href={`${getMempoolSpaceUrl(network as typeof MAINNET | typeof TESTNET)}/tx/${txid}`}
            className={'underline text-blue-600 text-xs'}
          >
            {txid}
          </a>
        </span>
      )
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const sign = async (message: string) => {
    setSignature('')
    try {
      const signature = await signMessage(message)
      setSignature(signature)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const signUnsignedPsbt = async () => {
    try {
      if (!unsigned) {
        throw new Error('No unsigned PSBT')
      }

      if (broadcast && balance! < 1500) {
        throw new Error('Insufficient funds')
      }

      const signPsbtResponse = await signPsbt(
        unsignedPsbt!,
        finalize,
        broadcast
      )

      // @ts-ignore
      setSigned(signPsbtResponse?.signedPsbtHex)
      if (!signPsbtResponse) {
        throw new Error('Failed to sign PSBT')
      }

      //@ts-ignore
      setSignedPsbt(signPsbtResponse)

      if (typeof signPsbtResponse === 'string') {
        toast.success('Signed PSBT')
        return
      }

      // @ts-ignore
      if (signPsbtResponse?.txId) {
        setSignedPsbt(undefined)
        toast.success(
          <span className={'flex flex-col gap-1 items-center justify-center'}>
            <span className={'font-black'}>View on mempool.space</span>
            <a
              target={'_blank'}
              // @ts-ignore
              href={`${getMempoolSpaceUrl(network as typeof MAINNET | typeof TESTNET)}/tx/${signPsbtResponse?.txId}`}
              className={'underline text-blue-600 text-xs'}
            >
              {/*@ts-ignore*/}
              {signPsbtResponse?.txId}
            </a>
          </span>
        )
        return
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const push = async () => {
    try {
      if (!signed) {
        throw new Error('No signed PSBT')
      }
      const txid = await pushPsbt(signed)
      setUnsigned(undefined)
      setSignedPsbt(undefined)
      toast.success(
        <span className={'flex flex-col gap-1 items-center justify-center'}>
          <span className={'font-black'}>View on mempool.space</span>
          <a
            target={'_blank'}
            href={`${getMempoolSpaceUrl(network as typeof MAINNET | typeof TESTNET)}/tx/${txid}`}
            className={'underline text-blue-600 text-xs'}
          >
            {txid}
          </a>
        </span>
      )
    } catch (error) {
      setSignedPsbt(undefined)
      // @ts-ignore
      if (error?.message!) {
        // @ts-ignore
        toast.error(error.message!)
      }
    }
  }

  const switchNet = async (desiredNetwork: typeof MAINNET | typeof TESTNET) => {
    try {
      await switchNetwork(desiredNetwork)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const inscribeText = async (text: string) => {
    try {
      setContent(text)
      const commitPsbt = await getCommitPsbt()
      await handleSignCommit(commitPsbt.psbtHex)
      await inscribe()
      toast.success(
        <span className={'flex flex-col gap-1 items-center justify-center'}>
          <span className={'font-black'}>View on mempool.space</span>
          <a
            target={'_blank'}
            href={`${getMempoolSpaceUrl(network as typeof MAINNET | typeof TESTNET)}/tx/${inscriptionTxId}`}
            className={'underline text-blue-600 text-xs'}
          >
            {inscriptionTxId}
          </a>
        </span>
      )
    } catch (e) {
      if (e instanceof Error) {
        console.log(e)
        toast.error(e.message)
      }
    }
  }

  const isConnected = provider === walletName
  const isMissingWallet = !hasWallet[walletName]
  const isMissingOrNotConnected = isMissingWallet || !isConnected

  return (
    <Card
      className={
        'grow max-w-[346px] w-[346px] shadow-xl bg-[#323035] text-[#a7a7a8] border-[#3c393f]'
      }
    >
      <CardHeader>
        <CardTitle className={'uppercase text-white text-center'}>
          {walletName.replace('-', ' ')}
        </CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <div className={'flex flex-col gap-4'}>
          <div className={'flex flex-row space-between items-center gap-6'}>
            <Badge variant={isConnected ? 'success' : 'secondary'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button
              className={'w-full bg-[#232225] '}
              disabled={isMissingWallet}
              variant={'default'}
              onClick={() =>
                isConnected ? disconnect() : connectWallet(walletName)
              }
            >
              {isMissingWallet
                ? 'Missing Wallet'
                : isConnected
                  ? 'Disconnect'
                  : 'Connect'}
            </Button>
          </div>

          <div className={'flex flex-col space-between items-center gap-2'}>
            <Button
              className={'w-full bg-[#232225]'}
              disabled={isMissingWallet || !isConnected}
              variant={!isConnected ? 'secondary' : 'default'}
              onClick={() =>
                !isConnected
                  ? null
                  : switchNet(network === TESTNET ? MAINNET : TESTNET)
              }
            >
              Switch Network
            </Button>
            <Button
              className={'w-full bg-[#232225]'}
              disabled={isMissingWallet || !isConnected}
              variant={!isConnected ? 'secondary' : 'default'}
              onClick={() => (!isConnected ? null : send())}
            >
              Send BTC
            </Button>
            <Button
              className={'w-full bg-[#232225]'}
              disabled={isMissingWallet || !isConnected}
              variant={!isConnected ? 'secondary' : 'default'}
              onClick={() =>
                !isConnected
                  ? null
                  : sign('Laser Eyes - Test Message').then(console.log)
              }
            >
              Sign Message
            </Button>
            <span
              className={
                'w-full flex flex-row items-center justify-center gap-4'
              }
            >
              <Button
                className={'w-full bg-[#232225]'}
                disabled={isMissingWallet || !isConnected || !unsigned}
                variant={!isConnected ? 'secondary' : 'default'}
                onClick={() => (!isConnected ? null : signUnsignedPsbt())}
              >
                Sign{broadcast ? ' & Send' : ''} PSBT
              </Button>
              <Button
                className={clsx(
                  'shrink bg-[#232225] disabled:text-gray-500',
                  finalize ? 'text-white' : 'bg-[#232225]'
                )}
                disabled={isMissingWallet || !isConnected || !unsigned}
                variant={finalize ? 'outline' : 'default'}
                onClick={() => {
                  setFinalize(!finalize)
                  setBroadcast(false)
                }}
              >
                Finalize
              </Button>
              <Button
                className={clsx(
                  finalize || provider !== UNISAT
                    ? 'text-white'
                    : 'bg-[#232225]',
                  'shrink disabled:text-gray-500 disabled'
                )}
                disabled={
                  isMissingWallet ||
                  !isConnected ||
                  (!finalize && provider !== XVERSE) ||
                  !unsigned
                }
                variant={
                  broadcast ? 'destructive' : finalize ? 'ghost' : 'default'
                }
                onClick={() => setBroadcast(!broadcast)}
              >
                Broadcast
              </Button>
            </span>
            <Button
              className={'w-full bg-[#232225]'}
              disabled={isMissingWallet || !isConnected || !signed || !unsigned}
              variant={!isConnected ? 'secondary' : 'default'}
              onClick={() => (!isConnected ? null : push())}
            >
              Push PSBT
            </Button>
            <Button
              disabled={
                isMissingWallet ||
                !isConnected ||
                isFetchingCommitPsbt ||
                isInscribing
              }
              className={'w-full bg-[#232225] gap-1'}
              variant={!isConnected ? 'secondary' : 'default'}
              onClick={() => (!isConnected ? null : inscribeText('Laser_Eyes'))}
            >
              {isInscribing ? (
                'Inscribing...'
              ) : isFetchingCommitPsbt ? (
                ' creating commit psbt'
              ) : (
                <>
                  Inscribe{' '}
                  <span
                    className={cn(
                      ' text-[8px] p-.5 px-1',
                      isConnected ? 'bg-black' : ''
                    )}
                  >
                    Laser_Eyes
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter></CardFooter>
    </Card>
  )
}

export default WalletCard
