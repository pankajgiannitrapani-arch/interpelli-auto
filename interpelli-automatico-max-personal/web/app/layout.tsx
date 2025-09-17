export default function RootLayout({ children }: any){
  return (
    <html lang="it">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <a href="/" className="text-xl font-semibold">Interpelli Scuole</a>
            <nav className="text-sm flex gap-4">
              <a href="/" className="underline">Attivi</a>
              <a href="/chiusi" className="underline">Chiusi</a>
              <a href="/salvati" className="underline">Salvati ⭐</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
