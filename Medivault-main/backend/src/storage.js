import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'

const extensionByType = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const encryptedFileHeader = Buffer.from('MV1')
const encryptionKey = Buffer.from(config.STORAGE_ENCRYPTION_KEY, 'hex')

export function validFileSignature(buffer, mimeType) {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-'
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  return false
}

export async function storePrivateBuffer(buffer, mimeType) {
  await fs.mkdir(config.storagePath, { recursive: true, mode: 0o700 })
  const storageKey = `${crypto.randomUUID()}${extensionByType[mimeType]}`
  const fullPath = path.join(config.storagePath, storageKey)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const stored = Buffer.concat([encryptedFileHeader, iv, cipher.getAuthTag(), encrypted])
  await fs.writeFile(fullPath, stored, { flag: 'wx', mode: 0o600 })
  return storageKey
}

export async function removePrivateFile(storageKey) {
  if (!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/i.test(storageKey)) return
  await fs.rm(path.join(config.storagePath, storageKey), { force: true })
}

export function privateFilePath(storageKey) {
  if (!/^[a-f0-9-]+\.(pdf|jpg|png|webp)$/i.test(storageKey)) throw new Error('Invalid private storage key')
  return path.join(config.storagePath, storageKey)
}

export async function readPrivateBuffer(key) {
  const stored = await fs.readFile(privateFilePath(key))
  if (stored.length < 31 || !stored.subarray(0, 3).equals(encryptedFileHeader)) throw new Error('Stored document is invalid')
  const iv = stored.subarray(3, 15)
  const authTag = stored.subarray(15, 31)
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(stored.subarray(31)), decipher.final()])
}
