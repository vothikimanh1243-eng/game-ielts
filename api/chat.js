export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, text, level, diff, userAnswer, correctAnswer } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel!' });
  }

  try {
    // 1. TẠO 5 CÂU HỎI NGẪU NHIÊN THEO CẤP ĐỘ VÀ ĐỘ KHÓ
    if (action === 'generate_questions') {
      let diffInstruction = "";
      if (diff === 'easy') {
        diffInstruction = "Độ khó: Dễ. Dùng các câu đơn ngắn gọn, thì cơ bản (hiện tại đơn, quá khứ đơn), từ vựng thông dụng.";
      } else if (diff === 'medium') {
        diffInstruction = "Độ khó: Trung bình. Dùng câu ghép, mệnh đề quan hệ, thì phức tạp hơn.";
      } else if (diff === 'hard') {
        diffInstruction = "Độ khó: Khó. BẮT BUỘC dùng cấu trúc nâng cao như câu điều kiện loại 2/3, đảo ngữ, câu bị động nâng cao.";
      }

      const randomSeed = Math.floor(Math.random() * 1000000);

      const prompt = `Bạn là một giáo viên tiếng Anh sáng tạo. Hãy tạo ra ngẫu nhiên hoàn toàn mới đúng 5 câu hỏi dịch câu từ tiếng Việt sang tiếng Anh ở cấp độ ${level} (Mã ngẫu nhiên: ${randomSeed}).
${diffInstruction}
Yêu cầu: 
- Lựa chọn các chủ đề ngẫu nhiên khác nhau cho mỗi câu (gia đình, công nghệ, du lịch, công sở, cuộc sống hằng ngày...).
- Tuyệt đối không lặp lại câu cũ.

QUAN TRỌNG: Chỉ trả về một mảng JSON thuần túy gồm đúng 5 object với cấu trúc chính xác sau, KHÔNG dùng markdown:
[
  {"q": "Cau hoi tieng Viet", "correct": "Dap an chuan tieng Anh", "explanation": "Giai thich ngan gon"}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95 // Đảm bảo tính ngẫu nhiên cao nhất
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const firstBracket = rawContent.indexOf('[');
      const lastBracket = rawContent.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        rawContent = rawContent.substring(firstBracket, lastBracket + 1);
      }

      let parsedData;
      try {
        parsedData = JSON.parse(rawContent);
      } catch (err) {
        console.error("JSON Parse Error:", err, rawContent);
        throw new Error("AI tạo định dạng lỗi, vui lòng thử lại.");
      }

      const questionsArray = parsedData.map(item => ({
        q: item.q,
        correctAnswer: item.correct || item.correctAnswer,
        explanation: item.explanation
      }));

      return res.status(200).json({ questions: questionsArray });
    }

    // 2. CHẤM CÂU TRẢ LỜI
    if (action === 'check_answer') {
      const prompt = `Bạn là giám khảo tiếng Anh. 
Câu hỏi: "${text}"
Đáp án mẫu: "${correctAnswer}"
Học viên trả lời: "${userAnswer}"

Đánh giá đúng/sai (chấp nhận từ đồng nghĩa hoặc biến thể hợp lý).
Trả về JSON thuần túy (không markdown):
{"isCorrect": true, "feedback": "Nhận xét ngắn gọn bằng tiếng Việt"}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawContent = rawContent.substring(firstBrace, lastBrace + 1);
      }

      return res.status(200).json(JSON.parse(rawContent));
    }

    return res.status(400).json({ error: 'Action không hợp lệ!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
