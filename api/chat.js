export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, text, level, diff } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel!' });
  }

  try {
    if (action === 'generate_questions') {
      const prompt = `Bạn là một giáo viên tiếng Anh. Hãy tạo ra đúng 5 câu hỏi tự luận tiếng Anh ở cấp độ ${level}, độ khó ${diff}.
Yêu cầu bao gồm các dạng: Dịch câu từ tiếng Việt sang tiếng Anh (ví dụ: "Tên bạn là gì?", "Mẹ tôi nấu ăn",...) và sắp xếp/ghép từ thành câu hoàn chỉnh.

Mỗi câu hỏi phải có cấu trúc JSON dạng mảng gồm các object với các trường sau:
- "q": Nội dung câu hỏi (bằng tiếng Việt yêu cầu dịch hoặc yêu cầu sắp xếp từ).
- "correct": Đáp án tiếng Anh chính xác mẫu mà người dùng phải gõ vào.
- "explanation": Giải thích ngắn gọn bằng tiếng Việt.

YÊU CẦU ĐỊNH DẠNG TUYỆT ĐỐI: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm đúng 5 object, tuyệt đối không kèm markdown code block (không dùng \`\`\`json). Ví dụ format:
[
  {"q": "Hãy dịch câu sau sang tiếng Anh: 'Tên bạn là gì?'", "correct": "What is your name?", "explanation": "Câu hỏi danh tính cơ bản."}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsedData = JSON.parse(rawContent);
      // Đổi tên trường cho khớp với code giao diện (correctAnswer)
      const questionsArray = parsedData.map(item => ({
        q: item.q,
        correctAnswer: item.correct || item.correctAnswer,
        explanation: item.explanation
      }));

      return res.status(200).json({ questions: questionsArray });
    }

    if (action === 'evaluate_writing' || !action) {
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung!' });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Bạn là trợ lý chấm bài viết tiếng Anh. Trả về kết quả dạng thẻ <li>." },
            { role: "user", content: `Chấm và sửa giúp tôi: "${text}"` }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return res.status(200).json({ reply: data.choices[0].message.content });
    }

    return res.status(400).json({ error: 'Action không hợp lệ!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
