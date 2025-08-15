import MobileController from "@/components/mobile-controller"

export default function ControllerPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Mobile Remote Controller</h1>
          <p className="text-slate-300 text-sm">Control your driving simulator remotely</p>
        </div>
        <MobileController />
      </div>
    </main>
  )
}
