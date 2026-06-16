import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json({ limit: "50mb" }));

// Lazy initialization of Gemini Client to prevent startup crashes when API key is missing
let geminiAi: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiAi) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. AI Studio 비밀번호 설정 메뉴를 확인 프로젝트에 등록해 주세요.");
    }
    geminiAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiAi;
}

// AI Scoring Endpoint
app.post("/api/grade", async (req, res) => {
  try {
    const { studentName, studentNumber, subject, essayText, rubric } = req.body;

    if (!essayText) {
      return res.status(400).json({ error: "학생 답안이 비어 있습니다." });
    }

    if (!rubric) {
      return res.status(400).json({ error: "채점 기준표가 전달되지 않았습니다." });
    }

    const sysInstruction = `당신은 대한민국 고등학교 교사를 돕는 전문 AI 채점관이자 교육 피드백 전문가입니다.
대구미래역량 교육과정 각론의 일반적 채점 기준표를 기준으로, 학생의 서·논술형/쓰기 답안을 매우 정교하고 공정하게 채점하고 상세한 피드백을 한글로 작성해 주세요.

[채점 가이드라인]
1. 전달받은 교과별 세부 채점 기준표(루브릭)의 각 영역별 성취 수준('매우 높음', '높음', '보통', '낮음' 및 각 점수 대역)을 꼼꼼하게 대조하여 객관적으로 점수를 매기세요.
2. 각론에 정의된 평가 영역과 기준에 맞지 않는 자의적인 점수 부여나 모호한 채점을 피하세요.
3. 최종 결과는 반드시 제공되는 JSON 스키마 규격으로 정교하게 응답해야 합니다.
4. "피드백" 영역에는 학생의 배움과 성장을 격려하는 따뜻한 교사 어조로 단점 보완법, 잘한 점, 성취 수준에 알맞은 구체적인 조언(학습 방향)을 글자크기가 가독성 있고 일목요연해지도록 3~4개의 구체적인 단락이나 불릿 포인트로 상세히 적어주세요. 주입식 피드백이 아닌 성찰 중심의 정교한 컨설팅을 작성하십시오.`;

    const prompt = `
[학생 정보]
- 이름: ${studentName || "미입력"}
- 번호: ${studentNumber || "미입력"}
- 교과: ${subject}

[채점 기준표 (루브릭)]
${JSON.stringify(rubric, null, 2)}

[학생 서·논술형 답안 텍스트]
"""
${essayText}
"""

[요청 사항]
위의 학생 답안을 교과의 '채점 기준표'에 비추어 채점하고, 각 평가 영역별 획득 점수와 세부 판단 근거를 작성하세요.
그리고 최종 총점(모든 영역의 총점 합산), 학생을 위한 개별 피드백, 그리고 "학교생활기록부의 세부능력 및 특기사항(세특)"을 위한 맞춤식 추천 문구를 생성하세요.

*세특 추천 문구 가이드라인:
1. 실제 관찰 가능한 구체적 활동 과정(학생의 답안 텍스트에 드러난 내용과 역량)을 상세히 언급할 것.
2. 학생의 활동 속에서 배어 나오는 탐구 역량, 분석 능력, 창의성, 문제해결력 등 미래사회의 핵심 교과 전문 역량을 구체적으로 추출할 것.
3. 학교생활기록부 교정 규정에 맞는 단정하고 객관적인 한글 교사 톤(~함, ~를 보임, ~가 탁월함 등 명사형 또는 정갈한 공문서 어조)으로 200~300자 내외로 완벽히 정제된 한 개의 유기적인 단락을 작성할 것.

반드시 아래 JSON 형식으로 응답하세요:
{
  "totalScore": 총합산점수(숫자),
  "maxScore": 만점점수(숫자),
  "detailedGrades": [
    {
      "criteriaName": "평가 영역명 (예: 내용 및 구성)",
      "score": 획득점수(숫자),
      "maxScore": 영역별 만점(숫자),
      "level": "성취 수준 (예: 매우 높음, 높음, 보통, 낮음)",
      "reason": "해당 수준과 점수를 부여한 정교한 판단 근거"
    }
  ],
  "feedback": "학생에게 전달할 성찰 및 성장 중심의 구체적이고 따뜻한 교사용 조언 및 피드백 (마크다운 사용 가능)",
  "seTeuk": "학교생활기록부 교과세특 기입용 추천 문구 (~함 톤이며, 학생의 구체적 활동 양상과 이에 따라 파악되는 교과 역량이 드러나는 200~300자 정제된 텍스트)"
}
`;

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalScore: {
              type: Type.NUMBER,
              description: "모든 평가 영역별 획득 점수의 총합산 점수",
            },
            maxScore: {
              type: Type.NUMBER,
              description: "전체 평가 영역들의 만점 합산 점수",
            },
            detailedGrades: {
              type: Type.ARRAY,
              description: "평가 영역별 세부 채점 내역 리스트",
              items: {
                type: Type.OBJECT,
                properties: {
                  criteriaName: {
                    type: Type.STRING,
                    description: "평가 영역 기준명 (루브릭에 지정된 name을 그대로 사용)",
                  },
                  score: {
                    type: Type.NUMBER,
                    description: "이 영역에서 획득한 수치 점수",
                  },
                  maxScore: {
                    type: Type.NUMBER,
                    description: "이 영역의 만점 기준 수치 점수",
                  },
                  level: {
                    type: Type.STRING,
                    description: "성취 수준 단계 (예: 매우 높음, 높음, 보통, 낮음)",
                  },
                  reason: {
                    type: Type.STRING,
                    description: "해당 영역에서 그 성취수준 및 점수를 부여한 명확하고 자세한 근거 설명",
                  },
                },
                required: ["criteriaName", "score", "maxScore", "level", "reason"],
              },
            },
            feedback: {
              type: Type.STRING,
              description: "학생의 성장과 성찰을 권장하는 따뜻하고 구체적인 피드백 조언 문구 (마크다운 포맷 가능)",
            },
            seTeuk: {
              type: Type.STRING,
              description: "정중하고 교무 행정 규격에 맞는 한글 교사 톤의 학교생활기록부 교과세특 기입 추천 문구",
            },
          },
          required: ["totalScore", "maxScore", "detailedGrades", "feedback", "seTeuk"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini API가 빈 응답을 반환했습니다.");
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error("JSON parsing initial failure. Parsing content was:", resultText);
      // Attempt manual extraction if there's arbitrary text around/inside the output
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
        } catch (matchError) {
          throw new Error("AI 응답의 JSON 형식이 올바르지 않아 채점을 실패하였습니다. 다시 시도해 주세요.");
        }
      } else {
        throw new Error("AI 응답에서 유효한 채점 데이터를 찾을 수 없습니다. 다시 시도해 주세요.");
      }
    }

    // Coerce data types into integers/numbers to guarantee strict validation conformity
    if (parsedResult) {
      if (parsedResult.totalScore !== undefined) {
        parsedResult.totalScore = Number(parsedResult.totalScore) || 0;
      }
      if (parsedResult.maxScore !== undefined) {
        parsedResult.maxScore = Number(parsedResult.maxScore) || 0;
      }
      if (Array.isArray(parsedResult.detailedGrades)) {
        parsedResult.detailedGrades = parsedResult.detailedGrades.map((grade: any) => ({
          criteriaName: String(grade.criteriaName || ""),
          score: Number(grade.score) || 0,
          maxScore: Number(grade.maxScore) || 0,
          level: String(grade.level || ""),
          reason: String(grade.reason || ""),
        }));
      }
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error("Scoring error:", error);
    res.status(500).json({ error: error.message || "서버 채점 중 오류가 발생했습니다." });
  }
});

// PDF OCR / Extraction Endpoint using Gemini
app.post("/api/parse-pdf", async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF 파일 데이터가 제공되지 않았습니다." });
    }

    const client = getGeminiClient();
    
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64
          }
        },
        "이 PDF 파일은 본문이 이미지로 되어있거나 복사가 불가능한 형식입니다. PDF의 모든 페이지에서 한글 및 텍스트를 정확하게 추출(OCR)하여 원본의 단락과 내용을 최대한 훼손하지 않고 텍스트 형태로만 전부 변환해 주세요. 부가적인 설명이나 생각은 제외하고, 오로지 추출된 학생 답안 텍스트만 그대로 반환하세요."
      ]
    });

    const parsedText = response.text || "";
    res.json({ text: parsedText });
  } catch (error: any) {
    console.error("PDF Parsing Server Error:", error);
    res.status(500).json({ error: error.message || "서버에서 PDF를 분석하는 도중 에러가 발생했습니다." });
  }
});

// Configure Vite or Serve static build files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
