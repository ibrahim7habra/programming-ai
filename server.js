const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.5-flash-lite"
];

const SYSTEM_PROMPT = `
أنت مساعد ذكاء اصطناعي ذكي ومفيد اسمه Programming AI.
- تجيب عن أسئلة البرمجة بدقة مع شرح مبسط وأمثلة كود واضحة.
- تجيب عن الأسئلة العامة بوضوح وموضوعية.
- تتحدث بلغة المستخدم بلهجة واضحة ومفيدة.
`;

async function callGemini(model, apiKey, message) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: String(message).trim() }] }]
    })
  });
  const data = await response.json();
  return { response, data };
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: "من فضلك اكتب سؤالك أولاً." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "مفتاح GEMINI_API_KEY غير مضبوط على السيرفر." });
    }

    let lastError = "حدث خطأ من خدمة Gemini API.";
    let lastStatus = 500;

    for (const model of MODELS) {
      const { response, data } = await callGemini(model, apiKey, message);

      if (response.ok) {
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const reply = parts.map((p) => p.text || "").join("").trim() || "لم أتمكن من إنشاء رد.";
        return res.json({ reply });
      }

      lastStatus = response.status;
      lastError = data?.error?.message || lastError;

      const shouldFallback =
        response.status === 503 ||
        response.status === 429 ||
        response.status === 404 ||
        /high demand|overloaded|unavailable|no longer available/i.test(lastError);

      if (!shouldFallback) {
        break;
      }
    }

    return res.status(lastStatus).json({ reply: lastError });
  } catch (error) {
    return res.status(500).json({ reply: `خطأ في السيرفر: ${error.message || "تعذر الاتصال"}` });
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Programming AI running on port ${PORT}`);
  });
}

module.exports = app;
