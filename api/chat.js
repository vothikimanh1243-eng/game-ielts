export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, text, level, diff, topic, userAnswer, correctAnswer } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel!' });
  }

  try {
    // 1. TẠO 5 CÂU HỎI DỊCH NGẪU NHIÊN
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

      const prompt = `Bạn là giáo viên tiếng Anh. Hãy tạo ngẫu nhiên đúng 5 câu hỏi dịch từ tiếng Việt sang tiếng Anh ở cấp độ ${level} (Mã ngẫu nhiên: ${randomSeed}).
${diffInstruction}
Chỉ trả về mảng JSON thuần túy (không markdown):
[
  {"q": "Cau hoi tieng Viet", "correct": "Dap an chuan tieng Anh", "explanation": "Giai thich ngan gon"}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95
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

      return res.status(200).json({ questions: JSON.parse(rawContent) });
    }

    // 2. TẠO CHỦ ĐỀ VIẾT ĐOẠN VĂN (WRITING TOPIC)
    if (action === 'generate_writing_topic') {
      let diffInstruction = "";
      if (diff === 'easy') {
        diffInstruction = "Yêu cầu viết đoạn ngắn từ 3-5 câu về chủ đề cơ bản, quen thuộc hằng ngày.";
      } else if (diff === 'medium') {
        diffInstruction = "Yêu cầu viết đoạn văn khoảng 6-8 câu, có lập luận hoặc kể chuyện chi tiết hơn.";
      } else if (diff === 'hard') {
        diffInstruction = "Yêu cầu viết bài luận ngắn nâng cao, phân tích ưu nhược điểm hoặc quan điểm cá nhân.";
      }

      const randomSeed = Math.floor(Math.random() * 1000000);
      const prompt = `Bạn là giáo viên tiếng Anh. Hãy tạo ra 1 chủ đề luyện viết đoạn văn bằng tiếng Anh ở cấp độ ${level} (Mã ngẫu nhiên: ${randomSeed}).
${diffInstruction}
Trả về kết quả bằng tiếng Việt (kèm gợi ý bằng tiếng Anh nếu cần) để học viên hiểu rõ đề bài phải viết gì. Chỉ trả về nội dung đề bài, ngắn gọn rõ ràng.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return res.status(200).json({ topic: data.choices[0].message.content.trim() });
    }

    // 3. CHẤM CÂU TRẢ LỜI DỊCH
    if (action === 'check_answer') {
      const prompt = `Bạn là giám khảo tiếng Anh. 
Câu hỏi: "${text}"
Đáp án mẫu: "${correctAnswer}"
Học viên trả lời: "${userAnswer}"

Đánh giá đúng/sai. Trả về JSON thuần túy (không markdown):
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

    // 4. CHẤM BÀI VIẾT (EVALUATE WRITING)
    if (action === 'evaluate_writing') {
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung bài viết!' });

      const prompt = `Bạn là giám khảo tiếng Anh chuyên nghiệp.
Cấp độ học viên: ${level}
Chủ đề bài viết: "${topic || 'Tự do'}"
Bài viết của học viên: "${text}"

Hãy nhận xét, chỉ ra lỗi ngữ pháp/từ vựng (nếu có), gợi ý cách sửa câu tốt hơn và viết lại đoạn văn mẫu chuẩn ở cấp độ này. Trình bày các ý rõ ràng bằng tiếng Việt, dùng thẻ HTML cơ bản (như <br>, <b>, <ul>, <li>) nếu cần để hiển thị đẹp mắt.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return res.status(200).json({ reply: data.choices[0].message.content.trim() });
    }

    return res.status(400).json({ error: 'Action không hợp lệ!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
