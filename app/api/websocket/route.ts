import type { NextRequest } from "next/server"
import { upgradeWebSocket } from "https://deno.land/std@0.168.0/ws/mod.ts"

// Store active WebSocket connections
const connections = new Set<WebSocket>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const upgrade = request.headers.get("upgrade")

  if (upgrade !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 })
  }

  // Create WebSocket connection
  const { socket, response } = upgradeWebSocket(request)

  socket.onopen = () => {
    console.log("WebSocket connection opened")
    connections.add(socket)
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      // Broadcast control data to all connected clients
      connections.forEach((conn) => {
        if (conn !== socket && conn.readyState === WebSocket.OPEN) {
          conn.send(JSON.stringify(data))
        }
      })
    } catch (error) {
      console.error("Error parsing WebSocket message:", error)
    }
  }

  socket.onclose = () => {
    console.log("WebSocket connection closed")
    connections.delete(socket)
  }

  socket.onerror = (error) => {
    console.error("WebSocket error:", error)
    connections.delete(socket)
  }

  return response
}
