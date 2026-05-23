export interface SpeechRecognitionResult {
  text: string
  isFinal: boolean
}

interface SpeechRecognizerOptions {
  lang?: string
  continuous?: boolean
  onResult: (result: SpeechRecognitionResult) => void
  onError: (error: string) => void
  onEnd: () => void
}

function getRecognitionConstructor(): (new () => any) | null {
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionConstructor() !== null
}

export function createSpeechRecognizer(options: SpeechRecognizerOptions) {
  const Ctor = getRecognitionConstructor()
  if (!Ctor) {
    throw new Error('SpeechRecognition is not supported in this browser')
  }

  const recognition = new Ctor()
  recognition.lang = options.lang ?? 'zh-CN'
  recognition.continuous = options.continuous ?? true
  recognition.interimResults = true

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      options.onResult({
        text: result[0].transcript,
        isFinal: result.isFinal,
      })
    }
  }

  recognition.onerror = (event: any) => {
    options.onError(event.error)
  }

  recognition.onend = () => {
    options.onEnd()
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  }
}
