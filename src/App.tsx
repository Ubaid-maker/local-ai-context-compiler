import { useState, useEffect, useCallback, useRef } from 'react'

interface DroppedFile {
  name: string
  content: string
}

// --- localStorage helpers ---
function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

// --- Scrubber regex patterns ---
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const IPV6_RE = /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g
// Common API key patterns: sk-..., key-..., AKIA..., long base64/hex strings prefixed with known labels
const API_KEY_RE =
  /\b(?:sk-[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9\-]{10,}|AIza[a-zA-Z0-9_\-]{35})\b/g

function scrub(text: string): string {
  return text
    .replace(EMAIL_RE, '[REDACTED]')
    .replace(IPV4_RE, '[REDACTED]')
    .replace(IPV6_RE, '[REDACTED]')
    .replace(API_KEY_RE, '[REDACTED]')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// --- Components ---

function DropZone({
  onFiles,
  darkMode,
}: {
  onFiles: (files: DroppedFile[]) => void
  darkMode: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const results: DroppedFile[] = []
      for (const file of Array.from(fileList)) {
        const text = await file.text()
        results.push({ name: file.name, content: text })
      }
      onFiles(results)
    },
    [onFiles],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center
        transition-all duration-200
        ${dragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
          : darkMode
            ? 'border-gray-600 hover:border-gray-400 bg-gray-800/50'
            : 'border-gray-300 hover:border-gray-500 bg-white/60'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.js,.jsx,.ts,.tsx,.json,.css,.html,.py,.rs,.go,.java,.c,.cpp,.h,.rb,.sh,.yml,.yaml,.toml,.xml,.csv,.sql,.env,.cfg,.ini,.log,.svg"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div className="text-4xl mb-3">📂</div>
      <p className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        Drop files here or click to browse
      </p>
      <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Accepts text &amp; code files — everything stays in your browser
      </p>
    </div>
  )
}

function FileChip({
  file,
  onRemove,
  darkMode,
}: {
  file: DroppedFile
  onRemove: () => void
  darkMode: boolean
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium
        ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}
      `}
    >
      {file.name}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-red-500 transition-colors leading-none"
        aria-label={`Remove ${file.name}`}
      >
        ×
      </button>
    </span>
  )
}

// --- Main App ---

export default function App() {
  const [darkMode, setDarkMode] = useState(() => loadBool('ctx-dark', true))
  const [scrubEnabled, setScrubEnabled] = useState(() => loadBool('ctx-scrub', false))
  const [files, setFiles] = useState<DroppedFile[]>([])
  const [copied, setCopied] = useState(false)

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('ctx-dark', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('ctx-scrub', String(scrubEnabled))
  }, [scrubEnabled])

  // Build merged output
  const rawMerged = files
    .map((f) => `## ${f.name}\n\n${f.content}`)
    .join('\n\n---\n\n')

  const output = scrubEnabled ? scrub(rawMerged) : rawMerged
  const tokens = estimateTokens(output)

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setFiles([])
    setCopied(false)
  }

  const addFiles = (newFiles: DroppedFile[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      const deduped = newFiles.filter((f) => !existing.has(f.name))
      return [...prev, ...deduped]
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const bg = darkMode
    ? 'bg-gray-950 text-gray-100'
    : 'bg-gray-50 text-gray-900'

  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const mutedText = darkMode ? 'text-gray-400' : 'text-gray-500'

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bg}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md border-b border-inherit">
        <div className={`max-w-5xl mx-auto flex items-center justify-between px-6 py-4 ${darkMode ? 'bg-gray-950/80' : 'bg-gray-50/80'}`}>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-blue-500">⚡</span> Local AI Context Compiler
            </h1>
            <p className={`text-xs ${mutedText}`}>100% client-side — nothing leaves your browser</p>
          </div>

          <button
            onClick={() => setDarkMode((d) => !d)}
            className={`
              rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
              ${darkMode
                ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
            `}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Drop Zone */}
        <section>
          <DropZone onFiles={addFiles} darkMode={darkMode} />
        </section>

        {/* File Chips */}
        {files.length > 0 && (
          <section className="flex flex-wrap gap-2 items-center">
            <span className={`text-sm font-medium ${mutedText} mr-1`}>
              {files.length} file{files.length !== 1 && 's'}:
            </span>
            {files.map((f, i) => (
              <FileChip
                key={f.name}
                file={f}
                onRemove={() => removeFile(i)}
                darkMode={darkMode}
              />
            ))}
            <button
              onClick={handleClear}
              className="ml-auto text-sm text-red-500 hover:text-red-400 font-medium transition-colors"
            >
              Clear all
            </button>
          </section>
        )}

        {/* Controls Bar */}
        {files.length > 0 && (
          <section
            className={`
              flex flex-wrap items-center gap-6 rounded-xl border p-4
              ${cardBg}
            `}
          >
            {/* Token Estimator */}
            <div className="flex items-center gap-2">
              <span className={`text-sm ${mutedText}`}>Estimated tokens:</span>
              <span className="text-lg font-bold tabular-nums text-blue-500">
                {tokens.toLocaleString()}
              </span>
              <span className={`text-xs ${mutedText}`}>({output.length.toLocaleString()} chars)</span>
            </div>

            {/* Scrubber Toggle */}
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setScrubEnabled((v) => !v)}
            >
              <div
                className={`
                  relative w-11 h-6 rounded-full transition-colors duration-200
                  ${scrubEnabled ? 'bg-blue-500' : darkMode ? 'bg-gray-700' : 'bg-gray-300'}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                    transition-transform duration-200
                    ${scrubEnabled ? 'translate-x-5' : ''}
                  `}
                />
              </div>
              <span className="text-sm font-medium">
                🔒 Scrub PII
              </span>
              <span className={`text-xs ${mutedText}`}>(emails, IPs, API keys)</span>
            </label>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`
                ml-auto rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200
                ${copied
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                }
              `}
            >
              {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
            </button>
          </section>
        )}

        {/* Output Preview */}
        {output && (
          <section>
            <h2 className={`text-sm font-semibold mb-2 uppercase tracking-wide ${mutedText}`}>
              Compiled Output
            </h2>
            <pre
              className={`
                rounded-xl border p-5 text-sm leading-relaxed overflow-auto max-h-[60vh]
                whitespace-pre-wrap break-words font-mono
                ${cardBg}
              `}
            >
              {output}
            </pre>
          </section>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <section className={`text-center py-16 ${mutedText}`}>
            <div className="text-6xl mb-4 opacity-30">🧩</div>
            <p className="text-lg font-medium">Drop some files to compile your AI context</p>
            <p className="text-sm mt-1">
              Merge multiple files into a single prompt-ready text block
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className={`text-center py-6 text-xs ${mutedText}`}>
        Everything runs locally in your browser. No data is sent anywhere.
      </footer>
    </div>
  )
}
