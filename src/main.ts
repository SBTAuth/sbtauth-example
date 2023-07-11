import { createSendBTC, createSendMultiOrds, createSendOrd, inscribeWithOneStep } from '@safematrix/ord-utils'
import { Chain } from '@sbtauth/common'
import { LoginType, SbtAuth } from '@sbtauth/sbtauth'
import {
	createAssociatedTokenAccountInstruction,
	createTransferInstruction,
	getAssociatedTokenAddress,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import * as bitcoin from 'bitcoinjs-lib-mpc'
import { ethers } from 'ethers'
import QRCode from 'qrcode'
import { Account, ec, hash, json, Provider, stark } from 'starknet'
import './style.css'

let deviceName: string
let keyType: Chain

// Initialize sbtauth
const sbtauth = new SbtAuth({
	clientId: 'SBT',
	developMode: true,
	defaultChainId: '0x13881',
	targetUrl: 'https://test-connect.sbtauth.io',
	wasmUrl: 'http://localhost:5173/mpc_wasm_bg.wasm',
})

const connectButton = document.querySelector('#connect')
const connectWithQrcodeButton = document.querySelector('#login-with-qrcode')
const loginModal = document.querySelector('#login-modal') as HTMLElement
const backupModal = document.querySelector('#backup-modal') as HTMLElement
const recoverModal = document.querySelector('#recover-modal') as HTMLElement
const approveModal = document.querySelector('#approve-modal') as HTMLElement
const recoverDeviceModal = document.querySelector(
	'#recover-device-modal',
) as HTMLElement
const loginButton = document.querySelector(
	'#login-button',
) as HTMLButtonElement
const backupButton = document.querySelector('#backup-button')
const recoverButton = document.querySelector('#recover-button')

sbtauth.onAuthRequest((device: string, _: string, chain: Chain) => {
	deviceName = device
	keyType = chain
	approveModal.style.display = 'flex'
})

connectButton?.addEventListener('click', async () => {
	loginModal.style.display = 'flex'
})

const whitelistButton = document.querySelector(
	'#whitelist',
) as HTMLInputElement
whitelistButton?.addEventListener('click', async () => {
	const checked = whitelistButton.checked
	await sbtauth.api.toogleWhitelist({
		whitelistSwitch: checked,
		email: '121212@gmail.com',
		authCode: '121212',
		googleCode: '',
	})
	await sbtauth.getUserInfo()
	whitelistButton.checked = sbtauth.user?.userWhitelist ?? false
	// sbtauth.api.addUserWhitelist({
	// 	network: 'solana_devnet',
	// 	email: '121212@gmail.com',
	// 	authCode: '121212',
	// 	name: 'test',
	// 	address: 'Bzq4zZ7KX9q4zZ7KX9q4zZ7KX9q4zZ7KX9q4zZ7KX9q',
	// 	googleCode: '',
	// })
	sbtauth.api.addUserWhitelist({
		network: 'starknet_goerli',
		email: '121212@gmail.com',
		authCode: '121212',
		name: 'test',
		address: '0x42315dc7fd40527179fdee0d79ca40250b86525e219a2f93fb59a5d6f68fdf2',
		googleCode: '',
	})
})

const batchBackupButton = document.querySelector('#backup') as HTMLInputElement
batchBackupButton?.addEventListener('click', async () => {
	backupModal.hidden = false
	try {
		await sbtauth.batchSendBackupPrivateKey(
			'121212',
			'121212@gmail.com',
			'121212',
			'',
		)
	} catch (error) {
		if (error instanceof Error) {
			console.log(error.message)
		}
	}
})

connectWithQrcodeButton?.addEventListener('click', async () => {
	const { qrCode, result } = await sbtauth.getLoginQrCode()
	const canvas = document.querySelector('#qrcode') as HTMLCanvasElement
	const input = document.querySelector(
		'#login-email-input',
	) as HTMLInputElement
	canvas.hidden = false
	input.hidden = false
	QRCode.toCanvas(canvas, qrCode, function(error) {
		if (error) console.error(error)
		console.log('success!')
	})
	result.onConfirm(() => {
		window.alert('Login successfully')
		canvas.hidden = true
		input.hidden = false
		loginModal.style.display = 'none'
	})
})

backupButton?.addEventListener('click', async () => {
	const password = (
		document.querySelector('#backup-password-input') as HTMLInputElement
	)?.value
	console.log(password)
	await sbtauth.sendBackupPrivateKey(
		password,
		sbtauth.user!.username!,
		'121212',
	)
	backupModal.style.display = 'none'
})

recoverButton?.addEventListener('click', async () => {
	const privateKey = (
		document.querySelector('#recover-backup-input') as HTMLInputElement
	)?.value
	const password = (
		document.querySelector('#recover-password-input') as HTMLInputElement
	)?.value
	await sbtauth.recoverWithBackup(privateKey, password)
	recoverModal.style.display = 'none'
})

const approveButton = document.querySelector('#approve-button')
approveButton?.addEventListener('click', async () => {
	const verifyCode = await sbtauth.approveAuthRequest(deviceName, keyType)
	console.log(verifyCode)
	;(document.querySelector('#approve-code') as HTMLElement).innerHTML = verifyCode
})

const recoverDeviceButton = document.querySelector('#recover-device-button')
recoverDeviceButton?.addEventListener('click', async () => {
	const verifyCode = (
		document.querySelector('#recover-code-input') as HTMLInputElement
	).value
	await sbtauth.recoverWithDevice(verifyCode)
	recoverDeviceModal.style.display = 'none'
})

const requestDeviceButton = document.querySelector('#request-device-button')
requestDeviceButton?.addEventListener('click', async () => {
	const devices = await sbtauth.api.getUserDeviceList()
	await sbtauth.api.sendAuthRequest(devices[0])
})

const requestSolanaDeviceButton = document.querySelector(
	'#request-solana-device-button',
)
requestSolanaDeviceButton?.addEventListener('click', async () => {
	const device = await sbtauth.api.getUserDeviceList()
	await sbtauth.api.sendAuthRequest(device[0], Chain.solana)
})

const recoverSolanaDeviceButton = document.querySelector(
	'#recover-solana-device-button',
)
recoverSolanaDeviceButton?.addEventListener('click', async () => {
	const verifyCode = (
		document.querySelector('#recover-code-input') as HTMLInputElement
	).value
	await sbtauth.recoverWithDevice(verifyCode, Chain.solana)
	console.log('solana recover')

	recoverDeviceModal.style.display = 'none'
})

async function login(loginType: LoginType, email = '') {
	try {
		await sbtauth.login(loginType, {
			emailLoginParameters: { email, code: '121212' },
		})
		const user = sbtauth.user
		loginModal.style.display = 'none'
		if (user?.backupPrivateKey) {
			backupModal.style.display = 'flex'
		}
		if (!sbtauth.provider) {
			loginModal.style.display = 'none'
			recoverModal.style.display = 'flex'
		}
		whitelistButton.checked = sbtauth.user?.userWhitelist ?? false
	} catch (error) {
		if (error instanceof Error) {
			console.log(error.message)
		}
	}
}

loginButton?.addEventListener('click', async () => {
	const email = (
		document.querySelector('#login-email-input') as HTMLInputElement
	).value
	console.log(email)
	if (email) {
		login('email', email)
	}
})

const loginWithGoogleButton = document.querySelector('#login-google-button')
loginWithGoogleButton?.addEventListener('click', async (event) => {
	event.preventDefault()
	login('google')
})

const loginWithTwitterButton = document.querySelector('#login-twitter-button')
loginWithTwitterButton?.addEventListener('click', async (event) => {
	event.preventDefault()
	login('twitter')
})

const loginWithFacebookButton = document.querySelector(
	'#login-facebook-button',
)
loginWithFacebookButton?.addEventListener('click', async (event) => {
	event.preventDefault()
	login('facebook')
})

const logoutButton = document.querySelector('#logout')
const logoutLoading = document.querySelector('#logout-loading') as HTMLElement
logoutButton?.addEventListener('click', async () => {
	logoutLoading.hidden = false
	await sbtauth.logout()
	logoutLoading.hidden = true
})

const getUserInfoButton = document.querySelector('#getUserInfo')
getUserInfoButton?.addEventListener('click', async () => {
	const user = await sbtauth.getUserInfo()
	window.alert(JSON.stringify(user))
})

const getAccountButton = document.querySelector('#getAccount')
getAccountButton?.addEventListener('click', () => {
	if (!sbtauth) return
	const address = sbtauth.provider?.accounts[0]
	window.alert(address)
})

const getBalanceButton = document.querySelector('#getBalance')
getBalanceButton?.addEventListener('click', async () => {
	console.log(sbtauth.provider)
	if (!sbtauth.provider) return
	const provider = new ethers.providers.Web3Provider(sbtauth.provider)
	const address = sbtauth.provider.accounts[0]
	const balance = await provider.getBalance(address)
	window.alert(balance)
})

const signMessageButton = document.querySelector('#signMessage')
signMessageButton?.addEventListener('click', async () => {
	console.log(sbtauth)
	if (!sbtauth.provider) return
	const provider = new ethers.providers.Web3Provider(sbtauth.provider)
	const signer = provider.getSigner()
	const address = await signer.getAddress()
	console.log(address)
	const signature = await signer.signMessage('Test messsage')
	console.log(signature)
	window.alert(signature)
	const verifyAddress = ethers.utils.verifyMessage('Test messsage', signature)
	console.log(verifyAddress)
	window.alert(
		address.toLowerCase() === verifyAddress.toLowerCase() ? 'Verified' : 'Error',
	)
})

const signTransactionButton = document.querySelector('#signTransaction')
signTransactionButton?.addEventListener('click', async () => {
	console.log(sbtauth)
	if (!sbtauth.provider) return
	const provider = new ethers.providers.Web3Provider(sbtauth.provider)
	const signer = provider.getSigner()
	const address = await signer.getAddress()
	console.log(address)
	const signature = await signer.sendTransaction({
		to: '0x8316E9B2789A7CC3e61C80B6bab9A6E1735701B2',
		value: 1000,
	})
	window.alert(signature)
})

const getSolanaAccountButton = document.querySelector('#getSolanaAccount')
getSolanaAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) {
		await sbtauth.init(Chain.solana)
		await sbtauth.getUserInfo()
		const solanaAddress = sbtauth.solanaProvider!.publicKey?.toBase58()
		console.log(solanaAddress)

		window.alert(solanaAddress)
	}
})

const getSolanaBalanceButton = document.querySelector('#getSolanaBalance')
getSolanaBalanceButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) return
	const value = await sbtauth.solanaProvider.getBalance()
	window.alert(value)
})
const signSolanaMessageButton = document.querySelector('#signSolanaMessage')
signSolanaMessageButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) {
		await sbtauth.init(Chain.solana)
	}
	const signature = await sbtauth.solanaProvider!.signMessage('Hello world')
	window.alert(signature)
})

const signSoalanaTransactionButton = document.querySelector(
	'#signSolanaTransaction',
)
signSoalanaTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) {
		await sbtauth.init(Chain.solana)
	}
	const transaction = new Transaction().add(
		SystemProgram.transfer({
			fromPubkey: sbtauth.solanaProvider!.publicKey!,
			toPubkey: new PublicKey('5U3bH5b6XtG99aVWLqwVzYPVpQiFHytBD68Rz2eFPZd7'),
			lamports: 1_000_000,
		}),
	)
	const signature = await sbtauth.solanaProvider!.sendTransaction(transaction)
	window.alert(signature)
})

const addSolanaToken = document.querySelector('#addSolanaToken')
addSolanaToken?.addEventListener('click', async () => {
	await sbtauth.api.checkAndAddToken(
		'solana_devenet',
		'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
	)
})

async function findAssociatedTokenAddress(
	walletAddress: PublicKey,
	tokenAddress: PublicKey,
) {
	const provider = sbtauth.solanaProvider!
	const reuslt = await provider.connection?.getTokenAccountsByOwner(
		walletAddress,
		{ mint: tokenAddress },
	)
	return reuslt?.value[0]?.pubkey
}

const sendSolanaToken = document.querySelector('#sendSolanaToken')
sendSolanaToken?.addEventListener('click', async () => {
	const provider = sbtauth.solanaProvider!
	const from = provider.publicKey!
	const to = new PublicKey('7U3WxfMKFzoEetvJUAyea139aGnv2kkrTS8s6SovXuix')
	const tokenAddress = new PublicKey(
		'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
	)
	const fromToken = await findAssociatedTokenAddress(from!, tokenAddress)
	let toToken = await findAssociatedTokenAddress(to!, tokenAddress)

	if (!fromToken) return
	const transaction = new Transaction()
	if (!toToken) {
		const account = await getAssociatedTokenAddress(
			tokenAddress, // mint
			to, // owner
			false, // allow owner off curve
		)
		console.log('account', account)
		transaction.add(
			createAssociatedTokenAccountInstruction(from, account, to, tokenAddress),
		)
		toToken = await findAssociatedTokenAddress(to!, tokenAddress)
	}
	console.log('fromToken', fromToken)
	transaction.add(
		createTransferInstruction(fromToken, toToken!, from, BigInt('100'), [from]),
	)

	const signature = await sbtauth.solanaProvider!.sendTransaction(transaction)
	window.alert(signature)
})

const getBitcoinAccountButton = document.querySelector('#getBitcoinAccount')
getBitcoinAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.bitcoinProvider) {
		await sbtauth.init(Chain.bitcoin)
		await sbtauth.getUserInfo()
	}
	const bitcoinAddress = sbtauth.bitcoinProvider!.accounts[0]
	window.alert(bitcoinAddress)
})

const getBitcoinBalanceButton = document.querySelector('#getBitcoinBalance')
getBitcoinBalanceButton?.addEventListener('click', async () => {
	if (!sbtauth.bitcoinProvider) return
	const value = await sbtauth.bitcoinProvider.getBalance()
	window.alert(value)
})

const signBitcoinTransactionButton = document.querySelector(
	'#signBitcoinTransaction',
)

signBitcoinTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.bitcoinProvider) {
		await sbtauth.init(Chain.bitcoin)
	}
	const provider = sbtauth.bitcoinProvider!
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	// const privateKey = provider?.signer.getPrivateKey()
	const publicKey = provider?.signer?.publicKey
	const brc20Api = sbtauth.bitcoinProvider?.brc20Api
	if (!brc20Api) return
	const address = provider.accounts[0]
	const pubkey = provider.signer!.publicKey.toString('hex')

	if (!address) return
	const utxos = await brc20Api.getAddressUtxo(address!)
	const transferableTokens = await brc20Api.getAddressInscriptions(
		address!,
		0,
		10,
	)
	const inscriptionUtxos = await brc20Api.getInscriptionUtxos(
		transferableTokens.list.map((t: any) => t.inscriptionId),
	)
	const parameters = {
		utxos: [...utxos, ...inscriptionUtxos].map((v) => {
			return {
				txId: v.txId,
				outputIndex: v.outputIndex,
				satoshis: v.satoshis,
				scriptPk: v.scriptPk,
				addressType: v.addressType,
				address,
				ords: v.inscriptions ?? [],
			}
		}),
		toAddress: 'tb1pvkd8uz46k78yqcf83v6fk20h3xm8en2rywp52dpq0dajr7ldk7qs4wedka',
		toOrdId: transferableTokens.list[0].inscriptionId,
		outputValue: 500,
		wallet: provider,
		changeAddress: address,
		receiverToPayFee: false,
		pubkey,
		feeRate: 2,
		dump: true,
		network: bitcoin.networks.testnet,
		txInfo: {
			to: 'tb1pvkd8uz46k78yqcf83v6fk20h3xm8en2rywp52dpq0dajr7ldk7qs4wedka',
			amount: '100',
		},
	}

	const psbt = await createSendOrd(parameters)

	try {
		const hash = await provider.pushPsbt(psbt.toHex())
		window.alert(hash)
	} catch (error) {
		window.alert(error)
	}
})

const getDogecoinAccountButton = document.querySelector('#getDogecoinAccount')
getDogecoinAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.dogecoinProvider) {
		await sbtauth.init(Chain.dogecoin)
		await sbtauth.getUserInfo()
	}
	const dogecoinAddress = sbtauth.dogecoinProvider!.accounts[0]
	window.alert(dogecoinAddress)
})

const getDogecoinBalanceButton = document.querySelector('#getDogecoinBalance')
getDogecoinBalanceButton?.addEventListener('click', async () => {
	if (!sbtauth.dogecoinProvider) return
	const value = await sbtauth.dogecoinProvider.getBalance()
	window.alert(value)
})

const signDogecoinTransactionButton = document.querySelector(
	'#signDogecoinTransaction',
)
signDogecoinTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.dogecoinProvider) {
		await sbtauth.init(Chain.dogecoin)
	}
	const transaction = {
		to: 'D6UYeFRWrTVxMKdL8eeFM4UQqvCiYWG4np',
		value: 1_000_000,
		feeRate: 10_000,
	}
	try {
		const signature = await sbtauth.dogecoinProvider!.sendTransaction(
			transaction,
		)
		window.alert(signature)
	} catch (error) {
		window.alert(error)
	}
})

const getAptosAccountButton = document.querySelector('#getAptosAccount')
getAptosAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.aptosProvider) {
		await sbtauth.init(Chain.aptos)
		await sbtauth.getUserInfo()
	}
	const aptosAccount = await sbtauth.aptosProvider!.account()
	window.alert(aptosAccount.address)
})

const getAptosBalanceButton = document.querySelector('#getAptosBalance')
getAptosBalanceButton?.addEventListener('click', async () => {
	if (!sbtauth.aptosProvider) return
	const value = await sbtauth.aptosProvider.getBalance()
	window.alert(value)
})

const signAptosTransactionButton = document.querySelector(
	'#signAptosTransaction',
)

signAptosTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.aptosProvider) {
		await sbtauth.init(Chain.aptos)
	}
	const account = await sbtauth.aptosProvider!.account()
	const toAddress = '0xf742c6a66e9d53a94012cf48f13de653e7fee6491527fe37cc74a436284c89bf'
	const client = sbtauth.aptosProvider!.client

	const rawTxn = await client.generateTransaction(account.address, {
		function: '0x1::coin::transfer',
		type_arguments: ['0x1::aptos_coin::AptosCoin'],
		arguments: [toAddress, 10],
	})
	try {
		const hash = await sbtauth.aptosProvider!.signAndSubmitTransaction(rawTxn, {
			transaction: {
				to: toAddress,
				amount: 10,
				nonce: Number(rawTxn.sequence_number),
			},
		})
		if ('hash' in hash) {
			await sbtauth.aptosProvider!.client.waitForTransaction(hash.hash)
		}
		window.alert(hash)
	} catch (error) {
		window.alert(error)
	}
})

const signAptosTokenTransactionButton = document.querySelector(
	'#signAptosTokenTransaction',
)

signAptosTokenTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.aptosProvider) {
		await sbtauth.init(Chain.aptos)
	}
	const tokenAddress = '0x43417434fd869edee76cca2a4d2301e528a1551b1d719b75c350c3c97d15b8b9'
	const toAddress = '0xf742c6a66e9d53a94012cf48f13de653e7fee6491527fe37cc74a436284c89bf'
	const account = await sbtauth.aptosProvider!.account()
	const client = sbtauth.aptosProvider!.client
	const maxGas = await client.estimateGasPrice()

	// const rawTxn = await client.generateTransaction(account.address, {
	// 	function: "0x1::managed_coin::register",
	// 	type_arguments: [`${tokenAddress}::coins::USDT`],
	// 	arguments: [],
	//   }, {
	// 	gas_unit_price: maxGas.gas_estimate
	//   });
	const rawTxn = await client.generateTransaction(
		account.address,
		{
			function: '0x1::aptos_account::transfer',
			type_arguments: [`${tokenAddress}::coins::USDT`],
			arguments: [toAddress, 100],
		},
		{
			gas_unit_price: maxGas.gas_estimate.toString(),
			max_gas_amount: (maxGas.gas_estimate * 2).toString(),
		},
	)

	try {
		const hash = await sbtauth.aptosProvider!.signAndSubmitTransaction(rawTxn)
		if ('hash' in hash) {
			await sbtauth.aptosProvider!.client.waitForTransaction(hash.hash)
		}
		window.alert(hash)
	} catch (error) {
		window.alert(error)
	}
})

const getStarknetAccountButton = document.querySelector('#getStarknetAccount')
getStarknetAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.starknetProvider) {
		await sbtauth.init(Chain.starknet)
		await sbtauth.getUserInfo()
	}
	const address = await sbtauth.starknetProvider?.account()
	window.alert(address)
})

const deployStarknetAccountButton = document.querySelector(
	'#deployStarknetAccount',
)
deployStarknetAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.starknetProvider) {
		await sbtauth.init(Chain.starknet)
		await sbtauth.getUserInfo()
	}
	const hash = await sbtauth.starknetProvider?.deployNewAccount()
	window.alert(hash)
})

const getStarkneBalanceButton = document.querySelector(
	'#getStarknetBalance',
)
getStarkneBalanceButton?.addEventListener('click', async () => {
	if (!sbtauth.starknetProvider) {
		await sbtauth.init(Chain.starknet)
		await sbtauth.getUserInfo()
	}
	const hash = await sbtauth.starknetProvider?.getBalance()
	window.alert(hash)
})

const signStarknetTransactionButton = document.querySelector(
	'#signStarknetTransaction',
)
signStarknetTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.starknetProvider) {
		await sbtauth.init(Chain.starknet)
		await sbtauth.getUserInfo()
	}
	const hash = await sbtauth.starknetProvider?.transferToken(
		{
			recipient: '0x42315dc7fd40527179fdee0d79ca40250b86525e219a2f93fb59a5d6f68fdf2',
			value: '10',
			confirm: false
		},
	)
	window.alert(hash)
})
