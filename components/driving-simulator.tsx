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

interface TireMark {
  x: number
  y: number
  angle: number
  opacity: number
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
    x: 400,
    y: 300,
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
  const tireMarksRef = useRef<TireMark[]>([])

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

          // Only update controls if not a keep-alive message
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

  const track = {
    centerX: 400,
    centerY: 300,
    outerRadius: 200,
    innerRadius: 120,
    checkpoints: [
      { x: 400, y: 100, passed: false },
      { x: 600, y: 300, passed: false },
      { x: 400, y: 500, passed: false },
      { x: 200, y: 300, passed: false },
    ],
  }

  const createParticles = useCallback((x: number, y: number, angle: number, type: "exhaust" | "collision") => {
    const particleCount = type === "exhaust" ? 3 : 8
    const colors = type === "exhaust" ? ["#64748b", "#94a3b8", "#cbd5e1"] : ["#fbbf24", "#f59e0b", "#d97706"]

    for (let i = 0; i < particleCount; i++) {
      const particle: Particle = {
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle + Math.PI + (Math.random() - 0.5) * 0.5) * (2 + Math.random() * 3),
        vy: Math.sin(angle + Math.PI + (Math.random() - 0.5) * 0.5) * (2 + Math.random() * 3),
        life: type === "exhaust" ? 30 : 60,
        maxLife: type === "exhaust" ? 30 : 60,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
      particlesRef.current.push(particle)
    }
  }, [])

  const drawCar = useCallback(
    (ctx: CanvasRenderingContext2D, car: Car) => {
      ctx.save()
      ctx.translate(car.x, car.y)
      ctx.rotate(car.angle)

      ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
      ctx.fillRect(-13, -6, 26, 12)

      const gradient = ctx.createLinearGradient(-15, -8, -15, 8)
      gradient.addColorStop(0, "#ef4444")
      gradient.addColorStop(0.5, "#dc2626")
      gradient.addColorStop(1, "#b91c1c")
      ctx.fillStyle = gradient
      ctx.fillRect(-15, -8, 30, 16)

      ctx.strokeStyle = "#7f1d1d"
      ctx.lineWidth = 1
      ctx.strokeRect(-15, -8, 30, 16)

      ctx.fillStyle = "#1e293b"
      ctx.fillRect(-10, -6, 20, 12)

      ctx.shadowColor = "#fbbf24"
      ctx.shadowBlur = 5
      ctx.fillStyle = "#fbbf24"
      ctx.fillRect(12, -6, 3, 4)
      ctx.fillRect(12, 2, 3, 4)
      ctx.shadowBlur = 0

      if (Math.abs(car.speed) > 2) {
        createParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, car.angle, "exhaust")
      }

      ctx.restore()
    },
    [createParticles],
  )

  const drawTrack = useCallback((ctx: CanvasRenderingContext2D) => {
    const { centerX, centerY, outerRadius, innerRadius } = track

    const trackGradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius)
    trackGradient.addColorStop(0, "#4b5563")
    trackGradient.addColorStop(0.5, "#374151")
    trackGradient.addColorStop(1, "#1f2937")
    ctx.fillStyle = trackGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2)
    ctx.fill()

    const grassGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius)
    grassGradient.addColorStop(0, "#22c55e")
    grassGradient.addColorStop(1, "#16a34a")
    ctx.fillStyle = grassGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "#fbbf24"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(centerX, centerY, outerRadius - 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius + 2, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = "#6b7280"
    ctx.lineWidth = 2
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.arc(centerX, centerY, (outerRadius + innerRadius) / 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    track.checkpoints.forEach((checkpoint, index) => {
      const time = Date.now() * 0.005
      const pulse = Math.sin(time + index) * 0.3 + 0.7

      ctx.fillStyle = checkpoint.passed ? "#10b981" : "#f59e0b"
      ctx.beginPath()
      ctx.arc(checkpoint.x, checkpoint.y, 8 * pulse, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowColor = checkpoint.passed ? "#10b981" : "#f59e0b"
      ctx.shadowBlur = 10
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 12px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText((index + 1).toString(), checkpoint.x, checkpoint.y + 4)
      ctx.shadowBlur = 0
    })
  }, [])

  const drawTireMarks = useCallback((ctx: CanvasRenderingContext2D) => {
    tireMarksRef.current.forEach((mark, index) => {
      ctx.save()
      ctx.globalAlpha = mark.opacity
      ctx.translate(mark.x, mark.y)
      ctx.rotate(mark.angle)
      ctx.fillStyle = "#1f2937"
      ctx.fillRect(-8, -1, 16, 2)
      ctx.restore()

      mark.opacity -= 0.005
      if (mark.opacity <= 0) {
        tireMarksRef.current.splice(index, 1)
      }
    })
  }, [])

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach((particle, index) => {
      ctx.save()
      ctx.globalAlpha = particle.life / particle.maxLife
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      particle.x += particle.vx
      particle.y += particle.vy
      particle.vx *= 0.98
      particle.vy *= 0.98
      particle.life--

      if (particle.life <= 0) {
        particlesRef.current.splice(index, 1)
      }
    })
  }, [])

  const drawHUD = useCallback(
    (ctx: CanvasRenderingContext2D, car: Car) => {
      const speed = Math.abs(car.speed)
      const speedKmh = Math.round(speed * 15)

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(650, 450, 140, 140)
      ctx.strokeStyle = "#374151"
      ctx.lineWidth = 2
      ctx.strokeRect(650, 450, 140, 140)

      const centerX = 720
      const centerY = 520
      const radius = 50

      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + (speed / car.maxSpeed) * Math.PI)
      ctx.stroke()

      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 24px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(speedKmh.toString(), centerX, centerY + 8)
      ctx.font = "12px sans-serif"
      ctx.fillText("km/h", centerX, centerY + 25)

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(10, 10, 200, 80)
      ctx.strokeStyle = "#374151"
      ctx.lineWidth = 2
      ctx.strokeRect(10, 10, 200, 80)

      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 16px sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(`Lap: ${currentLap}`, 20, 35)
      ctx.fillText(`Time: ${(lapTime / 1000).toFixed(1)}s`, 20, 55)
      if (bestLapTime > 0) {
        ctx.fillText(`Best: ${(bestLapTime / 1000).toFixed(1)}s`, 20, 75)
      }
    },
    [lapTime, bestLapTime, currentLap],
  )

  const updateCar = useCallback(() => {
    const car = carRef.current
    const controls = controlsRef.current

    if (!isRemoteControlled) {
      // Reset remote controls when not in remote mode
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

    if (Math.abs(car.speed) > 0.1) {
      const turnMultiplier = Math.min(Math.abs(car.speed) / car.maxSpeed, 1)
      if (controls.left) {
        car.angle -= car.turnSpeed * turnMultiplier
        if (Math.abs(car.speed) > 3) {
          tireMarksRef.current.push({
            x: car.x - Math.cos(car.angle + Math.PI / 2) * 8,
            y: car.y - Math.sin(car.angle + Math.PI / 2) * 8,
            angle: car.angle,
            opacity: 0.6,
          })
        }
      }
      if (controls.right) {
        car.angle += car.turnSpeed * turnMultiplier
        if (Math.abs(car.speed) > 3) {
          tireMarksRef.current.push({
            x: car.x + Math.cos(car.angle + Math.PI / 2) * 8,
            y: car.y + Math.sin(car.angle + Math.PI / 2) * 8,
            angle: car.angle,
            opacity: 0.6,
          })
        }
      }
    }

    car.x += Math.cos(car.angle) * car.speed
    car.y += Math.sin(car.angle) * car.speed

    const distanceFromCenter = Math.sqrt(Math.pow(car.x - track.centerX, 2) + Math.pow(car.y - track.centerY, 2))

    if (distanceFromCenter > track.outerRadius - 15 || distanceFromCenter < track.innerRadius + 15) {
      createParticles(car.x, car.y, car.angle, "collision")
      car.speed *= 0.3
      const angleToCenter = Math.atan2(track.centerY - car.y, track.centerX - car.x)
      car.x += Math.cos(angleToCenter) * 2
      car.y += Math.sin(angleToCenter) * 2
    }

    track.checkpoints.forEach((checkpoint, index) => {
      const distance = Math.sqrt(Math.pow(car.x - checkpoint.x, 2) + Math.pow(car.y - checkpoint.y, 2))

      if (distance < 20 && !checkpoint.passed) {
        checkpoint.passed = true
        setScore((prev) => prev + 100)

        if (index === 0 && track.checkpoints.slice(1).every((cp) => cp.passed)) {
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
          track.checkpoints.forEach((cp) => (cp.passed = false))
        }
      }
    })
  }, [createParticles, isRemoteControlled])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const bgGradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 600)
    bgGradient.addColorStop(0, "#1e293b")
    bgGradient.addColorStop(1, "#0f172a")
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawTrack(ctx)
    drawTireMarks(ctx)
    drawParticles(ctx)
    updateCar()
    drawCar(ctx, carRef.current)
    drawHUD(ctx, carRef.current)

    if (isRunning && lapStartTimeRef.current > 0) {
      setLapTime(Date.now() - lapStartTimeRef.current)
    }

    if (isRunning) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }
  }, [isRunning, drawTrack, drawTireMarks, drawParticles, drawCar, drawHUD, updateCar])

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

  const startGame = () => {
    setIsRunning(true)
    setScore(0)
    setLapTime(0)
    setCurrentLap(1)
    lapStartTimeRef.current = Date.now()
    carRef.current = {
      x: 400,
      y: 100,
      angle: Math.PI / 2,
      speed: 0,
      maxSpeed: 8,
      acceleration: 0.3,
      friction: 0.95,
      turnSpeed: 0.05,
    }
    track.checkpoints.forEach((cp) => (cp.passed = false))
    particlesRef.current = []
    tireMarksRef.current = []
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
  }, [isRunning, gameLoop])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

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
            through all checkpoints to complete laps!
          </p>
          <p>
            <strong>Features:</strong> Real-time speedometer, lap timing, tire marks, particle effects, and mobile
            remote control
          </p>
        </div>
      </Card>
    </div>
  )
}
