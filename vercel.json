const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `
أنت مساعد ذكاء اصطناعي ذكي ومفيد اسمه Programming AI.
- تجيب عن أسئلة البرمجة بدقة مع شرح مبسط وأمثلة كود واضحة.
- تجيب عن الأخبار والأسئلة العامة بوضوح وموضوعية، وتعتمد على البحث عند الحاجة للأحداث الجارية.
- تتحدث بلغة المستخدم بلهجة واضحة ومفيدة.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ reply: "من فضلك اكتب سؤالك أولاً." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "مفتاح GEMINI_API_KEY غير مضبوط على السيرفر." });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        tools: [{ google_search: {} }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        reply: data?.error?.message || "حدث خطأ من خدمة Gemini API."
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const reply = parts.map((p) => p.text || "").join("").trim() || "لم أتمكن من إنشاء رد.";

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ reply: "حصلت مشكلة في الاتصال بالسيرفر." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Programming AI running on port ${PORT}`);
});
