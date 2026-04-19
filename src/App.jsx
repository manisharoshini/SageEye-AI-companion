import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function App() {
  const [inputText, setInputText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [outputMode, setOutputMode] = useState("text");
  const [speaking, setSpeaking] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [output]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setInputText("");
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice not supported. Please use Chrome!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      setInputText(e.results[0][0].transcript);
      setImageFile(null);
      setImagePreview(null);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const analyzeInput = async () => {
    if (!inputText.trim() && !imageFile) return;
    setLoading(true);
    setOutput(null);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are a helpful AI assistant for elderly people.
Analyze the given content and detect what type it is.

Respond ONLY in this JSON format (no markdown, no backticks):
{
  "type": "electricity_bill" | "medical_bill" | "shopping_bill" | "general",
  "summary": "Simple 2-3 sentence explanation in very easy words",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "medicineInfo": ["medicine: what it does"] (only if medical bill, else empty array),
  "actionNeeded": "What the person should do next in one simple sentence"
}`;

      let result;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        result = await model.generateContent([
          prompt,
          { inlineData: { mimeType: imageFile.type, data: base64 } },
        ]);
      } else {
        result = await model.generateContent(
          `${prompt}\n\nContent: ${inputText}`
        );
      }

      const text = result.response.text();
      const parsed = JSON.parse(text);
      setOutput(parsed);

      if (outputMode === "voice") speakOutput(parsed);
    } catch (err) {
      setOutput({
        type: "error",
        summary: "Something went wrong. Please try again.",
      });
    }

    setLoading(false);
  };

  const speakOutput = (data) => {
    if (!data?.summary) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const text = `${data.summary}. ${data.keyPoints?.join(". ")}. ${data.actionNeeded || ""}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const clearAll = () => {
    setInputText("");
    setImageFile(null);
    setImagePreview(null);
    setOutput(null);
    setSpeaking(false);
    window.speechSynthesis.cancel();
  };

  const typeThemes = {
    electricity_bill: {
      card: "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200",
      accent: "text-amber-700",
      badge: "bg-amber-100 text-amber-800 border border-amber-200",
      icon: "⚡",
      label: "Electricity Bill",
      iconBox: "bg-gradient-to-br from-amber-400 to-yellow-500",
      infoBorder: "border-amber-200",
    },
    medical_bill: {
      card: "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200",
      accent: "text-rose-700",
      badge: "bg-rose-100 text-rose-800 border border-rose-200",
      icon: "💊",
      label: "Medical Bill",
      iconBox: "bg-gradient-to-br from-rose-400 to-pink-500",
      infoBorder: "border-rose-200",
    },
    shopping_bill: {
      card: "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200",
      accent: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      icon: "🛒",
      label: "Shopping Bill",
      iconBox: "bg-gradient-to-br from-emerald-400 to-green-500",
      infoBorder: "border-emerald-200",
    },
    general: {
      card: "bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200",
      accent: "text-indigo-700",
      badge: "bg-indigo-100 text-indigo-800 border border-indigo-200",
      icon: "📄",
      label: "Document",
      iconBox: "bg-gradient-to-br from-indigo-400 to-blue-500",
      infoBorder: "border-indigo-200",
    },
    error: {
      card: "bg-gradient-to-br from-red-50 to-orange-50 border-red-200",
      accent: "text-red-700",
      badge: "bg-red-100 text-red-800 border border-red-200",
      icon: "⚠️",
      label: "Error",
      iconBox: "bg-gradient-to-br from-red-400 to-orange-500",
      infoBorder: "border-red-200",
    },
  };

  const theme = output ? typeThemes[output.type] || typeThemes.general : null;
  const hasInput = inputText.trim() || imageFile;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Orbs */}
      <div className="bg-orb" style={{ width: 400, height: 400, background: '#c7d2fe', top: -120, left: -120 }} />
      <div className="bg-orb" style={{ width: 350, height: 350, background: '#e9d5ff', top: '40%', right: -100 }} />
      <div className="bg-orb" style={{ width: 300, height: 300, background: '#fde68a', bottom: -80, left: '30%' }} />

      {/* Main Content */}
      <div className="relative z-10 px-4 py-8 md:py-12 flex flex-col items-center min-h-screen">

        {/* ===== HEADER ===== */}
        <header className="text-center mb-10 animate-fadein">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg animate-float"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <span className="text-3xl">👁️</span>
            </div>
            <div className="text-left">
              <h1
                className="text-3xl md:text-4xl font-extrabold leading-tight"
                style={{
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  background: 'linear-gradient(135deg, #4338ca, #7c3aed, #4338ca)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SageEye
              </h1>
              <p className="text-sm font-medium text-indigo-400 -mt-0.5">
                AI Companion for You
              </p>
            </div>
          </div>
          <p className="text-gray-500 text-base max-w-md mx-auto mt-2 leading-relaxed">
            Snap a photo, upload a file, speak, or type — I'll read and explain
            any document for you.
          </p>
        </header>

        <div className="w-full max-w-xl space-y-6">

          {/* ===== INPUT CARD ===== */}
          <div
            className="rounded-3xl p-6 md:p-8 animate-slideup"
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">
              How would you like to share?
            </p>

            {/* 4 Input Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Camera */}
              <button
                id="btn-camera"
                onClick={() => cameraInputRef.current.click()}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 cursor-pointer select-none transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-400 active:scale-95"
              >
                <span className="text-3xl transition-transform duration-300 hover:scale-110">📸</span>
                <span className="text-sm font-semibold text-blue-700 tracking-wide">Take Photo</span>
              </button>

              {/* Upload */}
              <button
                id="btn-upload"
                onClick={() => fileInputRef.current.click()}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 cursor-pointer select-none transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-violet-400 active:scale-95"
              >
                <span className="text-3xl transition-transform duration-300 hover:scale-110">📁</span>
                <span className="text-sm font-semibold text-violet-700 tracking-wide">Upload File</span>
              </button>

              {/* Voice */}
              <button
                id="btn-voice"
                onClick={startListening}
                className={`flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 cursor-pointer select-none transition-all duration-300 active:scale-95 ${
                  listening
                    ? "bg-red-50 border-red-400 mic-active"
                    : "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-400"
                }`}
              >
                <span className="text-3xl transition-transform duration-300">{listening ? "🔴" : "🎤"}</span>
                <span className={`text-sm font-semibold tracking-wide ${listening ? "text-red-600" : "text-emerald-700"}`}>
                  {listening ? "Listening..." : "Speak"}
                </span>
              </button>

              {/* Type */}
              <button
                id="btn-type"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 cursor-pointer select-none transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-orange-400 active:scale-95"
              >
                <span className="text-3xl transition-transform duration-300 hover:scale-110">⌨️</span>
                <span className="text-sm font-semibold text-orange-700 tracking-wide">Type Text</span>
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleImageUpload} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />

            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-5 relative group animate-fadein">
                <img
                  src={imagePreview}
                  alt="Uploaded document"
                  className="w-full rounded-2xl border-2 border-indigo-200 max-h-56 object-cover"
                  style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-2xl transition-all duration-300" />
                <button
                  onClick={clearAll}
                  className="absolute top-3 right-3 bg-white/90 text-red-500 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-500 hover:text-white transition-all duration-200"
                  style={{ backdropFilter: 'blur(8px)' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Text Input */}
            {!imagePreview && (
              <textarea
                id="text-input"
                rows={3}
                placeholder="Paste your bill text, describe what you need, or speak..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl p-4 text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 resize-none transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                }}
              />
            )}

            {/* Output Mode Toggle */}
            <div className="flex items-center gap-3 mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Output:
              </p>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                <button
                  id="mode-text"
                  onClick={() => setOutputMode("text")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 ${
                    outputMode === "text"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📄 Text
                </button>
                <button
                  id="mode-voice"
                  onClick={() => setOutputMode("voice")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 ${
                    outputMode === "voice"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🔊 Voice
                </button>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              id="btn-analyze"
              onClick={analyzeInput}
              disabled={loading || !hasInput}
              className="mt-6 w-full py-4 rounded-2xl text-lg font-bold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: hasInput && !loading
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)'
                  : 'linear-gradient(135deg, #9ca3af 0%, #9ca3af 100%)',
                boxShadow: hasInput && !loading
                  ? '0 4px 20px rgba(99,102,241,0.35)'
                  : 'none',
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "✨ Analyze Document"
              )}
            </button>
          </div>

          {/* ===== LOADING SKELETON ===== */}
          {loading && (
            <div
              className="rounded-3xl p-6 space-y-4"
              style={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl shimmer" />
                <div className="h-5 w-32 shimmer" />
              </div>
              <div className="h-4 shimmer w-full" />
              <div className="h-4 shimmer w-4/5" />
              <div className="h-4 shimmer w-3/5" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="h-16 rounded-xl shimmer" />
                <div className="h-16 rounded-xl shimmer" />
              </div>
            </div>
          )}

          {/* ===== OUTPUT CARD ===== */}
          {output && !loading && (
            <div
              ref={outputRef}
              className={`rounded-3xl p-6 border-2 animate-slideup ${theme.card}`}
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl ${theme.iconBox} flex items-center justify-center shadow-sm`}>
                    <span className="text-xl">{theme.icon}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badge}`}>
                    {theme.label}
                  </span>
                </div>
                <button
                  id="btn-read-aloud"
                  onClick={() => (speaking ? stopSpeaking() : speakOutput(output))}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 bg-white/80 hover:bg-white ${theme.accent}`}
                  style={{ borderColor: 'inherit' }}
                >
                  {speaking ? "⏹ Stop" : "🔊 Read Aloud"}
                </button>
              </div>

              {/* Summary */}
              <p className="text-gray-800 text-base leading-relaxed mb-5 font-medium">
                {output.summary}
              </p>

              {/* Key Points */}
              {output.keyPoints?.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                    📌 Key Points
                  </p>
                  <div className="space-y-2">
                    {output.keyPoints.map((pt, i) => (
                      <div
                        key={i}
                        className="flex gap-3 items-start bg-white/60 rounded-xl p-3 border border-gray-100"
                        style={{
                          animation: `slideUp 0.4s ease-out ${i * 100}ms forwards`,
                          opacity: 0,
                        }}
                      >
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-gray-700 text-sm leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medicine Info */}
              {output.medicineInfo?.length > 0 && (
                <div className={`mb-5 bg-white/70 rounded-2xl p-5 border ${theme.infoBorder}`}>
                  <p className="text-sm font-bold text-rose-700 mb-3 flex items-center gap-1.5">
                    💊 Medicine Information
                  </p>
                  <div className="space-y-2">
                    {output.medicineInfo.map((med, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-rose-50/50 rounded-lg p-2.5">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{med}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Needed */}
              {output.actionNeeded && (
                <div className="bg-white/70 rounded-2xl p-4 border border-gray-200 flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #a855f7)' }}
                  >
                    <span className="text-sm text-white">👉</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">What to do next</p>
                    <p className="text-gray-800 text-sm font-medium leading-relaxed">{output.actionNeeded}</p>
                  </div>
                </div>
              )}

              {/* Clear */}
              <button
                id="btn-clear"
                onClick={clearAll}
                className="mt-5 w-full py-3 rounded-2xl text-sm font-semibold bg-white/80 border-2 border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300 hover:text-gray-700 transition-all duration-200"
              >
                🗑️ Clear & Start Over
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-auto pt-10 pb-6 text-center">
          <p className="text-gray-400 text-sm font-medium">
            Built with ❤️ for elderly people —{" "}
            <span className="text-indigo-400 font-semibold">Pixel Hackathon</span>
          </p>
        </footer>
      </div>
    </div>
  );
}