import express from 'express'
import { z } from 'zod'
import { User } from '../models.js'
import { asyncRoute, audit, safeUser } from '../lib.js'
import { requireRole } from '../middleware.js'

const router = express.Router()

router.get('/', requireRole('patient'), (req, res) => res.json({ user: safeUser(req.user) }))

router.patch('/', requireRole('patient'), asyncRoute(async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a name between 2 and 120 characters' })
  const oldName = req.user.name
  req.user.name = parsed.data.name
  await req.user.save()
  try { await audit(req, { action: 'profile.updated', resourceType: 'User', resourceId: req.user._id, patientId: req.user._id, metadata: { fields: ['name'] } }) }
  catch (error) { req.user.name = oldName; await req.user.save(); throw error }
  res.json({ user: safeUser(req.user) })
}))

export default router
