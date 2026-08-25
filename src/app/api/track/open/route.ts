// GET /api/track/open?id=<sentMessageId> — Tracking pixel for "Seen" status
//
// Phase 13.4: Returns a 1x1 transparent GIF and records the open event.
// Per GAP-ANALYSIS-V2.md §T2: this is an APPROXIMATE signal based on image
// loading. Recipients who block images will not trigger this endpoint.
// The UI must display the honest disclaimer: "Open tracking is approximate
// and based on image loading. Recipients who block images will not be counted."
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 1x1 transparent GIF (35 bytes)
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // Record the open event (only if this is the first open)
    const sentMessage = await db.sentMessage.findUnique({ where: { id } }).catch(() => null)
    if (sentMessage && !sentMessage.firstOpenedAt) {
      await db.sentMessage.update({
        where: { id },
        data: {
          firstOpenedAt: new Date(),
          openCount: sentMessage.openCount + 1,
        },
      }).catch(() => {})
      console.log(`[track] open recorded for message ${id}`)
    } else if (sentMessage) {
      // Increment open count on subsequent opens
      await db.sentMessage.update({
        where: { id },
        data: { openCount: sentMessage.openCount + 1 },
      }).catch(() => {})
    }
  }

  // Return the tracking pixel
  return new NextResponse(TRACKING_PIXEL as BodyInit, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
