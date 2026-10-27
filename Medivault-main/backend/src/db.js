import mongoose from 'mongoose'
import { config } from './config.js'
import { Organization } from './models.js'

const demoOrganizations = [
  { name: 'MediVault Demo Clinic', type: 'clinic' },
  { name: 'MediVault Demo Diagnostics', type: 'diagnostic_centre' },
  { name: 'MediVault Demo Imaging Centre', type: 'hospital' },
]

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
  mongoose.set('strictQuery', true)
  await mongoose.connect(config.MONGO_URI)
  console.info('Connected to MongoDB')
  await seedDemoOrganizations()
}
