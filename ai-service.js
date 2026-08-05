// Groq AI Servisi - LinguaPrime entegrasyonu
// ai-bridge.js tarafından import edilir; runGroqAi, setGroqKey, getMockAiResponse dışa aktarır.
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

let apiKey = null;

export function setGroqKey(key) {
    apiKey = key || null;
}

export async function runGroqAi(prompt, system = null, temperature = 0.5) {
    if (!apiKey) {
        return getMockAiResponse(prompt);
    }
    try {
        const res = await fetch(GROQ_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [
                    ...(system ? [{ role: "system", content: system }] : []),
                    { role: "user", content: prompt }
                ],
                temperature,
                max_tokens: 2048
            })
        });

        if (!res.ok) {
            let detail = "";
            try {
                const err = await res.json();
                detail = err.error?.message || "";
            } catch (_) {}
            throw new Error(`Groq API ${res.status}: ${detail}`.trim());
        }

        const data = await res.json();
        return (data.choices?.[0]?.message?.content || "").trim();
    } catch (e) {
        console.error("Groq AI isteği başarısız:", e);
        return getMockAiResponse(prompt);
    }
}

export function getMockAiResponse(prompt) {
    // Anahtar tanımlı değilken veya API hatası durumunda çalışan yerel demo yanıtı.
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return `[Demo yanıtı ${time}] AI servisine bağlanılamadı veya API anahtarı tanımlı değil. Uygulamayı yenileyip Groq API anahtarınızı (gsk_...) girin ve tekrar deneyin.`;
}
