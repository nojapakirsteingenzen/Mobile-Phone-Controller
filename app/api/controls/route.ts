let controlsState = {
  up: false,
  down: false,
  left: false,
  right: false,
  timestamp: Date.now(),
}

const clients = new Set()
let controller: ReadableStreamDefaultController

const stream = new ReadableStream({
  start(_controller) {
    controller = _controller
    clients.add(controller)

    // Send initial state
    controller.enqueue(`data: ${JSON.stringify(controlsState)}\n\n`)

    // Keep connection alive
    const keepAlive = setInterval(() => {
      try {
        controller.enqueue(`data: ${JSON.stringify({ ...controlsState, keepAlive: true })}\n\n`)
      } catch (error) {
        clearInterval(keepAlive)
        clients.delete(controller)
      }
    }, 30000)

    // Cleanup on close
    return () => {
      clearInterval(keepAlive)
      clients.delete(controller)
    }
  },
  cancel() {
    clients.delete(controller)
  },
})

export async function GET() {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(request: Request) {
  try {
    const newControls = await request.json()
    controlsState = {
      ...newControls,
      timestamp: Date.now(),
    }

    // Broadcast to all connected clients
    const message = `data: ${JSON.stringify(controlsState)}\n\n`
    clients.forEach((clientController) => {
      try {
        clientController.enqueue(message)
      } catch (error) {
        clients.delete(clientController)
      }
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: "Failed to update controls" }, { status: 500 })
  }
}
