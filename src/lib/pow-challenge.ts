// Free proof-of-work challenge — a Turnstile/CAPTCHA alternative
// that requires zero external infrastructure and zero paid plans.
//
// How it works:
// 1. Server generates a challenge (random nonce + difficulty prefix)
// 2. Client must find a hash that starts with N zero characters
// 3. Client submits the solution → server verifies
// 4. This takes ~100-500ms of CPU on the client, proving it's a real browser
// 5. Rate-limited endpoints can require this PoW token after N requests
//
// This is completely free, privacy-preserving (no third-party tracking),
// and works without any external service.

import crypto from 'crypto'

const CHALLENGE_TTL = 5 * 60 * 1000 // 5 minutes
const challenges = new Map<string, { prefix: string; nonce: string; expiresAt: number; difficulty: number }>()

interface Challenge {
  challengeId: string
  prefix: string
  difficulty: number
}

export function generateChallenge(difficulty = 3): Challenge {
  const challengeId = crypto.randomBytes(16).toString('hex')
  const prefix = crypto.randomBytes(4).toString('hex')
  const expiresAt = Date.now() + CHALLENGE_TTL
  challenges.set(challengeId, { prefix, nonce: '', expiresAt, difficulty })
  // Cleanup old challenges
  if (challenges.size > 1000) {
    for (const [id, c] of challenges.entries()) {
      if (c.expiresAt < Date.now()) challenges.delete(id)
    }
  }
  return { challengeId, prefix, difficulty }
}

export function verifyChallenge(challengeId: string, solution: string): boolean {
  const challenge = challenges.get(challengeId)
  if (!challenge) return false
  if (challenge.expiresAt < Date.now()) {
    challenges.delete(challengeId)
    return false
  }
  // Verify: hash(prefix + solution) must start with `difficulty` zero chars
  const hash = crypto.createHash('sha256').update(challenge.prefix + solution).digest('hex')
  const requiredPrefix = '0'.repeat(challenge.difficulty)
  const valid = hash.startsWith(requiredPrefix)
  if (valid) {
    challenges.delete(challengeId) // Single-use
  }
  return valid
}

// Client-side solver (runs in browser via Web Crypto API)
export async function solveChallenge(prefix: string, difficulty: number): Promise<string> {
  const requiredPrefix = '0'.repeat(difficulty)
  let solution = 0
  while (true) {
    const data = new TextEncoder().encode(prefix + solution.toString())
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    if (hash.startsWith(requiredPrefix)) {
      return solution.toString()
    }
    solution++
    // Yield to UI thread every 1000 iterations to prevent freezing
    if (solution % 1000 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }
}
