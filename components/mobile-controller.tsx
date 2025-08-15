"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ControlState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export default function MobileController() {
  const [isConnected, setIsConnected] = useState(false)
  const [controls, setControls] = useState<ControlState>({
    up: false,
    down: false,
    left: false,
    right: false,
  })

  const touchTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connectEventSource = useCallback(() => {
    try {
      eventSourceRef.current = new EventSource("/api/controls")

      eventSourceRef.current.onopen = () => {
        console.log("EventSource connected")
        setIsConnected(true)
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
      }

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Update local state to reflect server state
          if (!data.keepAlive) {
            setControls(data)
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error)
        }
      }

      eventSourceRef.current.onerror = () => {
        console.log("EventSource disconnected")
        setIsConnected(false)
        eventSourceRef.current?.close()
        eventSourceRef.current = null

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isConnected) {
            connectEventSource()
          }
        }, 3000)
      }
    } catch (error) {
      console.error("Failed to connect EventSource:", error)
      setIsConnected(false)
    }
  }, [isConnected])

  const disconnectEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    setIsConnected(false)
  }, [])

  const sendControlUpdate = useCallback(async (newControls: ControlState) => {
    try {
      await fetch("/api/controls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newControls),
      })
    } catch (error) {
      console.error("Failed to send control update:", error)
    }
  }, [])

  const handleControlStart = useCallback(
    (control: keyof ControlState) => {
      const newControls = { ...controls, [control]: true }
      setControls(newControls)
      sendControlUpdate(newControls)

      // Clear any existing timeout for this control
      if (touchTimeouts.current[control]) {
        clearTimeout(touchTimeouts.current[control])
      }
    },
    [controls, sendControlUpdate],
  )

  const handleControlEnd = useCallback(
    (control: keyof ControlState) => {
      // Add a small delay before releasing to prevent accidental releases
      touchTimeouts.current[control] = setTimeout(() => {
        const newControls = { ...controls, [control]: false }
        setControls(newControls)
        sendControlUpdate(newControls)
      }, 50)
    },
    [controls, sendControlUpdate],
  )

  const handleConnect = () => {
    if (isConnected) {
      disconnectEventSource()
    } else {
      connectEventSource()
    }
  }

  useEffect(() => {
    connectEventSource()

    return () => {
      disconnectEventSource()
    }
  }, [])

  return (
    <div className="max-w-md mx-auto">
      {/* Connection Status */}
      <Card className="p-4 mb-6 bg-slate-800 border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-white font-medium">{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
          <Button
            onClick={handleConnect}
            className={isConnected ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {isConnected ? "Ready to control simulator" : "Attempting to connect..."}
        </div>
      </Card>

      {/* Control Interface */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <div className="space-y-8">
          {/* Acceleration/Braking Controls */}
          <div className="text-center">
            <h3 className="text-white font-semibold mb-4">Speed Control</h3>
            <div className="flex flex-col gap-4">
              {/* Accelerate Button */}
              <Button
                className={`h-20 text-xl font-bold transition-all duration-150 ${
                  controls.up ? "bg-green-600 scale-95 shadow-inner" : "bg-green-500 hover:bg-green-600 shadow-lg"
                }`}
                onTouchStart={() => handleControlStart("up")}
                onTouchEnd={() => handleControlEnd("up")}
                onMouseDown={() => handleControlStart("up")}
                onMouseUp={() => handleControlEnd("up")}
                onMouseLeave={() => handleControlEnd("up")}
              >
                ACCELERATE
              </Button>

              {/* Brake Button */}
              <Button
                className={`h-20 text-xl font-bold transition-all duration-150 ${
                  controls.down ? "bg-red-600 scale-95 shadow-inner" : "bg-red-500 hover:bg-red-600 shadow-lg"
                }`}
                onTouchStart={() => handleControlStart("down")}
                onTouchEnd={() => handleControlEnd("down")}
                onMouseDown={() => handleControlStart("down")}
                onMouseUp={() => handleControlEnd("down")}
                onMouseLeave={() => handleControlEnd("down")}
              >
                BRAKE
              </Button>
            </div>
          </div>

          {/* Steering Controls */}
          <div className="text-center">
            <h3 className="text-white font-semibold mb-4">Steering</h3>
            <div className="flex gap-4">
              {/* Left Turn Button */}
              <Button
                className={`flex-1 h-20 text-xl font-bold transition-all duration-150 ${
                  controls.left ? "bg-blue-600 scale-95 shadow-inner" : "bg-blue-500 hover:bg-blue-600 shadow-lg"
                }`}
                onTouchStart={() => handleControlStart("left")}
                onTouchEnd={() => handleControlEnd("left")}
                onMouseDown={() => handleControlStart("left")}
                onMouseUp={() => handleControlEnd("left")}
                onMouseLeave={() => handleControlEnd("left")}
              >
                ← LEFT
              </Button>

              {/* Right Turn Button */}
              <Button
                className={`flex-1 h-20 text-xl font-bold transition-all duration-150 ${
                  controls.right ? "bg-blue-600 scale-95 shadow-inner" : "bg-blue-500 hover:bg-blue-600 shadow-lg"
                }`}
                onTouchStart={() => handleControlStart("right")}
                onTouchEnd={() => handleControlEnd("right")}
                onMouseDown={() => handleControlStart("right")}
                onMouseUp={() => handleControlEnd("right")}
                onMouseLeave={() => handleControlEnd("right")}
              >
                RIGHT →
              </Button>
            </div>
          </div>

          {/* Control Status Display */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 text-center">Control Status</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div
                className={`p-2 rounded text-center font-medium ${
                  controls.up ? "bg-green-600 text-white" : "bg-slate-600 text-slate-300"
                }`}
              >
                Accelerate: {controls.up ? "ON" : "OFF"}
              </div>
              <div
                className={`p-2 rounded text-center font-medium ${
                  controls.down ? "bg-red-600 text-white" : "bg-slate-600 text-slate-300"
                }`}
              >
                Brake: {controls.down ? "ON" : "OFF"}
              </div>
              <div
                className={`p-2 rounded text-center font-medium ${
                  controls.left ? "bg-blue-600 text-white" : "bg-slate-600 text-slate-300"
                }`}
              >
                Left: {controls.left ? "ON" : "OFF"}
              </div>
              <div
                className={`p-2 rounded text-center font-medium ${
                  controls.right ? "bg-blue-600 text-white" : "bg-slate-600 text-slate-300"
                }`}
              >
                Right: {controls.right ? "ON" : "OFF"}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center text-slate-400 text-sm">
            <p>Hold buttons to control the car</p>
            <p className="mt-1">Visit the main simulator on your computer</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
