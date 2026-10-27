import mongoose from 'mongoose'
import { config } from './config.js'
import { Organization } from './models.js'

const demoOrganizations = [
  { name: 'MediVault Demo Clinic', type: 'clinic' },
  { name: 'MediVault Demo Diagnostics', type: 'diagnostic_centre' },
  { name: 'MediVault Demo Imaging Centre', type: 'hospital' },
]
let connectionPromise

async function seedDemoOrganizations() {
  if (config.NODE_ENV !== 'development') return
  for (const organization of demoOrganizations) {
    await Organization.updateOne(
      { name: organization.name, isDemo: true },
      { $setOnInsert: { ...organization, status: 'verified', isDemo: true } },
      { upsert: true },
    )
  }
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return
  if (!connectionPromise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    mongoose.set('strictQuery', true)
    connectionPromise = mongoose.connect(config.MONGO_URI)
      .then(async () => {
        console.info('Connected to MongoDB')
        await seedDemoOrganizations()
      })
      .catch((error) => {
        connectionPromise = undefined
        throw error
      })
  }
  await connectionPromise
}
