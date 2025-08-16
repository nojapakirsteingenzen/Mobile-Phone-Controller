"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Car {
  x: number
  y: number
  angle: number
  speed: number
  maxSpeed: number
  acceleration: number
  friction: number
  turnSpeed: number
}

interface Controls {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

interface RoadSegment {
  x: number
  y: number
  z: number
  curve: number
  width: number
}

export default function DrivingSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [isRunning, setIsRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [isRemoteControlled, setIsRemoteControlled] = useState(false)
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [lapTime, setLapTime] = useState(0)
  const [bestLapTime, setBestLapTime] = useState(0)
  const [currentLap, setCurrentLap] = useState(1)
  const lapStartTimeRef = useRef<number>(0)

  const carRef = useRef<Car>({
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 8,
    acceleration: 0.3,
    friction: 0.95,
    turnSpeed: 0.05,
  })

  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
  })

  const particlesRef = useRef<Particle[]>([])
  const roadPositionRef = useRef(0)
  const roadCurveRef = useRef(0)
  const checkpointDistanceRef = useRef(0)

  const eventSourceRef = useRef<EventSource | null>(null)

  const connectEventSource = useCallback(() => {
    try {
      eventSourceRef.current = new EventSource("/api/controls")

      eventSourceRef.current.onopen = () => {
        console.log("Simulator EventSource connected")
        setRemoteConnected(true)
      }

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (!data.keepAlive) {
            controlsRef.current = {
              up: data.up || false,
              down: data.down || false,
              left: data.left || false,
              right: data.right || false,
            }
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error)
        }
      }

      eventSourceRef.current.onerror = () => {
        console.log("Simulator EventSource disconnected")
        setRemoteConnected(false)
        eventSourceRef.current?.close()
        eventSourceRef.current = null
      }
    } catch (error) {
      console.error("Failed to connect simulator EventSource:", error)
      setRemoteConnected(false)
    }
  }, [])

  const drawRoad = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height

    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6)
    skyGradient.addColorStop(0, "#87CEEB")
    skyGradient.addColorStop(0.7, "#98D8E8")
    skyGradient.addColorStop(1, "#B0E0E6")
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, width, height * 0.6)

    const groundGradient = ctx.createLinearGradient(0, height * 0.6, 0, height)
    groundGradient.addColorStop(0, "#228B22")
    groundGradient.addColorStop(1, "#006400")
    ctx.fillStyle = groundGradient
    ctx.fillRect(0, height * 0.6, width, height * 0.4)

    const roadSegments = 100
    const segmentLength = 200

    for (let i = 0; i < roadSegments; i++) {
      const z = i * segmentLength
      const roadZ = roadPositionRef.current + z

      let curve = 0
      const curveFreq = 0.002
      curve = Math.sin(roadZ * curveFreq) * 0.5 + Math.sin(roadZ * curveFreq * 2) * 0.3

      const perspective = 300 / (z + 300)
      const roadWidth = 200 * perspective
      const roadHeight = 20 * perspective

      const roadCenter = width / 2 + (curve - roadCurveRef.current) * perspective * 300

      ctx.fillStyle = i % 2 === 0 ? "#404040" : "#383838"
      const roadY = height * 0.6 + height * 0.4 * (1 - perspective)

      ctx.fillRect(roadCenter - roadWidth / 2, roadY, roadWidth, roadHeight)

      if (i % 3 === 0 && perspective > 0.1) {
        ctx.fillStyle = "#FFFF00"
        const markingWidth = 4 * perspective
        ctx.fillRect(roadCenter - markingWidth / 2, roadY + roadHeight / 2, markingWidth, roadHeight / 4)
      }

      ctx.fillStyle = "#FF0000"
      ctx.fillRect(roadCenter - roadWidth / 2 - 10 * perspective, roadY, 5 * perspective, roadHeight)
      ctx.fillRect(roadCenter + roadWidth / 2 + 5 * perspective, roadY, 5 * perspective, roadHeight)
    }
  }, [])

  const drawCar = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const carX = canvas.width / 2
    const carY = canvas.height * 0.85
    const carWidth = 80
    const carHeight = 120

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.fillRect(carX - carWidth / 2 + 5, carY - carHeight + 5, carWidth, carHeight)

    const carGradient = ctx.createLinearGradient(carX - carWidth / 2, carY - carHeight, carX + carWidth / 2, carY)
    carGradient.addColorStop(0, "#FF4500")
    carGradient.addColorStop(0.5, "#FF6347")
    carGradient.addColorStop(1, "#FF4500")
    ctx.fillStyle = carGradient

    ctx.beginPath()
    ctx.moveTo(carX - carWidth / 2, carY)
    ctx.lineTo(carX - carWidth / 3, carY - carHeight * 0.8)
    ctx.lineTo(carX + carWidth / 3, carY - carHeight * 0.8)
    ctx.lineTo(carX + carWidth / 2, carY)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#FF6347"
    ctx.fillRect(carX - carWidth / 3, carY - carHeight * 0.8, (carWidth * 2) / 3, carHeight * 0.3)

    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(carX - carWidth / 4, carY - carHeight * 0.75, carWidth / 2, carHeight * 0.2)

    ctx.fillStyle = "#FF0000"
    ctx.fillRect(carX - carWidth / 2 + 5, carY - 15, 15, 10)
    ctx.fillRect(carX + carWidth / 2 - 20, carY - 15, 15, 10)

    if (controlsRef.current.up && carRef.current.speed > 1) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(100, 100, 100, ${0.3 - i * 0.1})`
        ctx.beginPath()
        ctx.arc(carX + (Math.random() - 0.5) * 20, carY + 10 + i * 15, 5 + i * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  const drawHUD = useCallback(
    (ctx: CanvasRenderingContext2D, car: Car) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const speed = Math.abs(car.speed)
      const speedKmh = Math.round(speed * 20)

      const speedometerX = canvas.width - 120
      const speedometerY = canvas.height - 120
      const radius = 50

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.beginPath()
      ctx.arc(speedometerX, speedometerY, radius + 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = "#00FF00"
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(speedometerX, speedometerY, radius, -Math.PI / 2, -Math.PI / 2 + (speed / car.maxSpeed) * Math.PI * 1.5)
      ctx.stroke()

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "bold 20px Arial"
      ctx.textAlign = "center"
      ctx.fillText(speedKmh.toString(), speedometerX, speedometerY + 5)
      ctx.font = "12px Arial"
      ctx.fillText("KM/H", speedometerX, speedometerY + 20)

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(20, 20, 200, 80)

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "bold 16px Arial"
      ctx.textAlign = "left"
      ctx.fillText(`LAP: ${currentLap}`, 30, 45)
      ctx.fillText(`TIME: ${(lapTime / 1000).toFixed(1)}s`, 30, 65)
      if (bestLapTime > 0) {
        ctx.fillText(`BEST: ${(bestLapTime / 1000).toFixed(1)}s`, 30, 85)
      }

      const checkpointProgress = (checkpointDistanceRef.current % 1000) / 1000
      ctx.fillStyle = "rgba(255, 255, 0, 0.8)"
      ctx.fillRect(canvas.width / 2 - 50, 30, 100 * checkpointProgress, 10)
      ctx.strokeStyle = "#FFFFFF"
      ctx.strokeRect(canvas.width / 2 - 50, 30, 100, 10)

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText("CHECKPOINT", canvas.width / 2, 55)
    },
    [lapTime, bestLapTime, currentLap],
  )

  const updateCar = useCallback(() => {
    const car = carRef.current
    const controls = controlsRef.current

    if (!isRemoteControlled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setRemoteConnected(false)
      }
    }

    if (controls.up) {
      car.speed = Math.min(car.speed + car.acceleration, car.maxSpeed)
    } else if (controls.down) {
      car.speed = Math.max(car.speed - car.acceleration * 1.5, -car.maxSpeed * 0.5)
    } else {
      car.speed *= car.friction
    }

    roadPositionRef.current += car.speed * 10

    if (Math.abs(car.speed) > 0.1) {
      if (controls.left) {
        roadCurveRef.current -= 0.02 * Math.abs(car.speed)
      }
      if (controls.right) {
        roadCurveRef.current += 0.02 * Math.abs(car.speed)
      }
    }

    checkpointDistanceRef.current += Math.abs(car.speed) * 10

    if (checkpointDistanceRef.current > 1000) {
      checkpointDistanceRef.current = 0
      setScore((prev) => prev + 100)

      if (Math.floor(roadPositionRef.current / 1000) % 4 === 0 && roadPositionRef.current > 0) {
        const currentTime = Date.now()
        const lapTimeMs = currentTime - lapStartTimeRef.current

        if (lapStartTimeRef.current > 0) {
          setLapTime(lapTimeMs)
          if (bestLapTime === 0 || lapTimeMs < bestLapTime) {
            setBestLapTime(lapTimeMs)
          }
          setCurrentLap((prev) => prev + 1)
          setScore((prev) => prev + 1000)
        }

        lapStartTimeRef.current = currentTime
      }
    }
  }, [isRemoteControlled, bestLapTime])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawRoad(ctx)
    drawCar(ctx)
    drawHUD(ctx, carRef.current)

    updateCar()

    if (isRunning && lapStartTimeRef.current > 0) {
      setLapTime(Date.now() - lapStartTimeRef.current)
    }

    if (isRunning) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }
  }, [isRunning, drawRoad, drawCar, drawHUD, updateCar])

  const startGame = () => {
    setIsRunning(true)
    setScore(0)
    setLapTime(0)
    setCurrentLap(1)
    lapStartTimeRef.current = Date.now()

    carRef.current = {
      x: 0,
      y: 0,
      angle: 0,
      speed: 0,
      maxSpeed: 8,
      acceleration: 0.3,
      friction: 0.95,
      turnSpeed: 0.05,
    }

    roadPositionRef.current = 0
    roadCurveRef.current = 0
    checkpointDistanceRef.current = 0
    particlesRef.current = []
  }

  const stopGame = () => {
    setIsRunning(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  const toggleRemoteControl = () => {
    setIsRemoteControlled(!isRemoteControlled)
    if (!isRemoteControlled && !eventSourceRef.current) {
      connectEventSource()
    }
  }

  useEffect(() => {
    if (isRemoteControlled && !eventSourceRef.current) {
      connectEventSource()
    }

    return () => {
      if (eventSourceRef.current && !isRemoteControlled) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [isRemoteControlled])

  useEffect(() => {
    if (isRunning) {
      gameLoop()
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        controlsRef.current.up = true
        break
      case "ArrowDown":
      case "s":
      case "S":
        controlsRef.current.down = true
        break
      case "ArrowLeft":
      case "a":
      case "A":
        controlsRef.current.left = true
        break
      case "ArrowRight":
      case "d":
      case "D":
        controlsRef.current.right = true
        break
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        controlsRef.current.up = false
        break
      case "ArrowDown":
      case "s":
      case "S":
        controlsRef.current.down = false
        break
      case "ArrowLeft":
      case "a":
      case "A":
        controlsRef.current.left = false
        break
      case "ArrowRight":
      case "d":
      case "D":
        controlsRef.current.right = false
        break
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6 bg-slate-800 border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4">
            <Button onClick={startGame} disabled={isRunning} className="bg-green-600 hover:bg-green-700">
              Start Game
            </Button>
            <Button onClick={stopGame} disabled={!isRunning} variant="destructive">
              Stop Game
            </Button>
            <Button
              onClick={toggleRemoteControl}
              className={isRemoteControlled ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-600 hover:bg-slate-700"}
            >
              {isRemoteControlled ? "Remote ON" : "Remote OFF"}
            </Button>
          </div>
          <div className="text-white font-bold text-xl">Score: {score}</div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-white font-bold text-lg">{currentLap}</div>
            <div className="text-slate-300 text-sm">Current Lap</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-white font-bold text-lg">{(lapTime / 1000).toFixed(1)}s</div>
            <div className="text-slate-300 text-sm">Lap Time</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="text-white font-bold text-lg">
              {bestLapTime > 0 ? `${(bestLapTime / 1000).toFixed(1)}s` : "--"}
            </div>
            <div className="text-slate-300 text-sm">Best Lap</div>
          </div>
        </div>

        {isRemoteControlled && (
          <div className="mb-4 p-3 bg-blue-900 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${remoteConnected ? "bg-green-400" : "bg-red-400"}`} />
              <span className="text-white text-sm">
                Remote Control: {remoteConnected ? "Connected" : "Waiting for connection..."}
              </span>
            </div>
            <p className="text-blue-200 text-xs mt-1">Use your mobile device at /controller to control the car</p>
          </div>
        )}

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-slate-600 rounded-lg bg-slate-900 w-full max-w-full"
            style={{ aspectRatio: "4/3" }}
          />

          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="text-center text-white">
                <h3 className="text-2xl font-bold mb-2">Ready to Drive?</h3>
                <p className="mb-4">Use WASD or Arrow Keys to control your car</p>
                <Button onClick={startGame} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Start Driving
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-slate-300 text-sm">
          <p>
            <strong>Controls:</strong> {isRemoteControlled ? "Use mobile controller" : "WASD or Arrow Keys"} - Drive
            forward and steer left/right!
          </p>
          <p>
            <strong>Features:</strong> 3D perspective view, realistic speedometer, lap timing, and mobile remote control
          </p>
        </div>
      </Card>
    </div>
  )
}
