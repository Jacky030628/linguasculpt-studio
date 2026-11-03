// 文件路径: api/llm_proxy.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OWNER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OWNER_API_KEY is not configured in Vercel Environment Variables." });
  }

  try {
    const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const {
      system_prompt,
      user_prompt,
      model: reqModel,
      base_url: reqBaseUrl,
      expect_json = true,
      temperature = 0.25
    } = bodyData;

    // 默认直接调用最强的 DeepSeek-R1 满血推理模型 (deepseek-reasoner)
    const baseUrl = (process.env.OWNER_BASE_URL || reqBaseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "");
    const model = process.env.OWNER_MODEL || reqModel || "deepseek-reasoner";
    const isReasoner = model.includes("reasoner") || model.toLowerCase().includes("deepseek-r1");

    const payload = {
      model: model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt }
      ]
    };

    // 注意：deepseek-reasoner 不支持传入 temperature 或 response_format，仅对非 reasoner 模型附加这两个参数
    if (!isReasoner) {
      payload.temperature = temperature;
      if (expect_json && (baseUrl.includes("deepseek") || baseUrl.includes("openai.com") || baseUrl.includes("dashscope") || baseUrl.includes("siliconflow"))) {
        payload.response_format = { type: "json_object" };
      }
    }

    const llmResp = await fetch(`${baseUrl}/chat/completions`, {
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
    let content = data.choices?.[0]?.message?.content || "";
    // 若模型输出了 <think>...</think> 思考过程，自动剥离只保留最终 JSON 结果
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    return res.status(200).json({ content, model_used: model });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
