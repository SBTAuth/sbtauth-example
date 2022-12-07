import { LoginType, SbtAuth } from '@sbtauth/sbtauth'
import { Chain } from '@sbtauth/types'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { ethers } from 'ethers'
import QRCode from 'qrcode'
import './style.css'

let deviceName: string
// Initialize sbtauth
const sbtauth = new SbtAuth({
	clientId: 'Demo',
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
const recoverDeviceModal = document.querySelector('#recover-device-modal') as HTMLElement
const loginButton = document.querySelector(
	'#login-button',
) as HTMLButtonElement
const backupButton = document.querySelector('#backup-button')
const recoverButton = document.querySelector('#recover-button')

sbtauth.onAuthRequest((device: string) => {
	deviceName = device
	approveModal.style.display = 'flex'
})

connectButton?.addEventListener('click', async () => {
	loginModal.style.display = 'flex'
})

const whitelistButton = document.querySelector('#whitelist') as HTMLInputElement
whitelistButton?.addEventListener('click', async () => {
	const checked = whitelistButton.checked
	await sbtauth.api.toogleWhitelist({ whitelistSwitch: checked, email: sbtauth.user!.username!, authCode: '121212' })
	await sbtauth.getUserInfo()
	whitelistButton.checked = sbtauth.user?.userWhitelist ?? false
})

connectWithQrcodeButton?.addEventListener('click', async () => {
	const { qrCode, result } = await sbtauth.getLoginQrCode()
	const canvas = document.querySelector('#qrcode') as HTMLCanvasElement
	const input = document.querySelector('#login-email-input') as HTMLInputElement
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
	await sbtauth.sendBackupPrivateKey(password, sbtauth.user!.username!, '121212')
	backupModal.style.display = 'none'
})

recoverButton?.addEventListener('click', async () => {
	const privateKey = (
		document.querySelector('#recover-backup-input') as HTMLInputElement
	)?.value
	const password = (
		document.querySelector('#recover-password-input') as HTMLInputElement
	)?.value
	await sbtauth.recoverWidthBackup(privateKey, password)
	recoverModal.style.display = 'none'
})

const approveButton = document.querySelector('#approve-button')
approveButton?.addEventListener('click', async () => {
	const verifyCode = await sbtauth.approveAuthRequest(deviceName)
	console.log(verifyCode)
	;(document.querySelector('#approve-code') as HTMLElement).innerHTML = verifyCode
})

const recoverDeviceButton = document.querySelector('#recover-device-button')
recoverDeviceButton?.addEventListener('click', async () => {
	const verifyCode = (document.querySelector('#recover-code-input') as HTMLInputElement).value
	await sbtauth.recoverWithDevice(verifyCode)
	recoverDeviceModal.style.display = 'none'
})

const requestDeviceButton = document.querySelector('#request-device-button')
requestDeviceButton?.addEventListener('click', async () => {
	const devices = await sbtauth.api.getUserDeviceList()
	await sbtauth.api.sendAuthRequest(devices[0])
})

async function login(loginType: LoginType, email = '') {
	try {
		await sbtauth.login(loginType, { email, code: '121212' })
		const user = sbtauth.user
		loginModal.style.display = 'none'
		if (user?.backupPrivateKey) {
			backupModal.style.display = 'flex'
		}
		if (!sbtauth.provider) {
			loginModal.style.display = 'none'
			recoverDeviceModal.style.display = 'flex'
		}
		whitelistButton.checked = sbtauth.user?.userWhitelist ?? false
	} catch (error) {
		if (error instanceof Error) {
			console.log(error.message)
		}
	}
}

async function loginWithToken() {
	const queryString = window.location.search
	const parameters = new URLSearchParams(queryString)
	const token = parameters.get('token')
	if (!token) return
	await sbtauth.loginWithToken(token)
	const user = sbtauth.user
	loginModal.style.display = 'none'
	if (user?.backupPrivateKey) {
		backupModal.style.display = 'flex'
	}
	if (!sbtauth.provider) {
		loginModal.style.display = 'none'
		recoverDeviceModal.style.display = 'flex'
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
	window.alert(address.toLowerCase() === verifyAddress.toLowerCase() ? 'Verified' : 'Error')
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
		value: '0',
	})
	window.alert(signature)
})

const getSolanaAccountButton = document.querySelector('#getSolanaAccount')
getSolanaAccountButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) {
		await sbtauth.init(Chain.solana)
		await sbtauth.getUserInfo()
		const solanaAddress = sbtauth.solanaProvider!.publicKey?.toBase58()
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
	const signature = await sbtauth.solanaProvider!.signMessage(
		'Hello world',
	)
	window.alert(signature)
})

const signSoalanaTransactionButton = document.querySelector('#signSolanaTransaction')
signSoalanaTransactionButton?.addEventListener('click', async () => {
	if (!sbtauth.solanaProvider) {
		await sbtauth.init(Chain.solana)
	}
	const transaction = new Transaction().add(
		SystemProgram.transfer({
			fromPubkey: sbtauth.solanaProvider!.publicKey!,
			toPubkey: new PublicKey('Bzq4zZ7KX9q4zZ7KX9q4zZ7KX9q4zZ7KX9q4zZ7KX9q'),
			lamports: 1_000_000,
		}),
	)
	const signature = await sbtauth.solanaProvider!.sendTransaction(transaction)
	window.alert(signature)
})
