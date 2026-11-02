// 文件路径: api/health.js
export default function handler(req, res) {
  const hasKey = Boolean(process.env.OWNER_API_KEY);
  const model = process.env.OWNER_MODEL || "deepseek-chat";
  return res.status(200).json({
    status: "ok",
    hosted_llm_ready: hasKey,
    default_model: model
  });
}