// 文件路径: api/llm_proxy.js
export default async function handler(req, res) {
  // 允许跨域请求
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 从 Vercel 后台环境变量读取你的 API Key（前端用户绝对看不到）
  const apiKey = process.env.OWNER_API_KEY;
  const baseUrl = process.env.OWNER_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.OWNER_MODEL || "deepseek-chat";

  if (!apiKey) {
    return res.status(500).json({ error: "OWNER_API_KEY is not configured in Vercel Environment Variables." });
  }

  try {
    const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const {
      system_prompt,
      user_prompt,
      expect_json = true,
      temperature = 0.25
    } = bodyData;

    const payload = {
      model: model,
      temperature: temperature,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt }
      ]
    };

    // DeepSeek / OpenAI / Qwen 开启原生 JSON 输出模式
    if (expect_json && (baseUrl.includes("deepseek") || baseUrl.includes("openai.com") || baseUrl.includes("dashscope") || baseUrl.includes("siliconflow"))) {
      payload.response_format = { type: "json_object" };
    }

    const llmResp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text();
      return res.status(llmResp.status).json({ error: `LLM API Error: ${errText}` });
    }

    const data = await llmResp.json();
    const content = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ content, model_used: model });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
