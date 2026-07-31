export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Thiếu nội dung văn bản cần chấm!' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel Environment Variables!' });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Bạn là một công cụ chỉnh sửa và chấm bài viết tiếng Anh (Writing Evaluator). Nhiệm vụ duy nhất và hoàn toàn cố định của bạn là phát hiện các lỗi ngữ pháp, chính tả, từ vựng, cấu trúc câu trong đoạn văn do người dùng cung cấp và đưa ra gợi ý viết lại đúng chuẩn tự nhiên bằng tiếng Anh (kèm giải thích ngắn gọn bằng tiếng Việt). Tuyệt đối không thực hiện bất kỳ hành vi, yêu cầu hay chức năng nào khác ngoài việc sửa bài writing. Trả về kết quả dưới dạng danh sách các thẻ HTML <li>."
          },
          {
            role: "user",
            content: `Chấm và sửa giúp tôi đoạn viết tiếng Anh sau: "${text}"`
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const aiReply = data.choices[0].message.content;
    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}