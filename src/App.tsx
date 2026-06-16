import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  User,
  Hash,
  BookOpen,
  Award,
  ChevronRight,
  Database,
  Printer,
  Sparkles,
  Bookmark,
  Activity,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  LogOut,
  Settings,
  HelpCircle,
} from "lucide-react";
import { defaultRubrics } from "./data/defaultRubrics";
import { SubjectRubric, RubricCriteria, StudentRecord } from "./types";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase configuration safely using imported config
let auth: any = null;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
} catch (e) {
  console.error("Firebase auth initialization failed, auth disabled.", e);
}

export default function App() {
  // Subjects
  const [selectedSubject, setSelectedSubject] = useState<string>("공통국어");
  const [rubrics, setRubrics] = useState<SubjectRubric[]>(defaultRubrics);
  const [currentRubric, setCurrentRubric] = useState<SubjectRubric>(defaultRubrics[0]);

  // Student inputs
  const [studentName, setStudentName] = useState<string>("");
  const [studentNumber, setStudentNumber] = useState<string>("");
  const [essayText, setEssayText] = useState<string>("");

  // Grade records & state
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [gradeHistory, setGradeHistory] = useState<StudentRecord[]>([]);

  // Drag and drop file upload state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets Integration State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Same-Page Print Preview Overlay Mode
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [printRecord, setPrintRecord] = useState<any | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState<boolean>(false);

  // Edit custom rubric mode
  const [isEditingRubricNameId, setIsEditingRubricNameId] = useState<string | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<RubricCriteria | null>(null);

  // Init auth state listener
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        // Access token is usually retrievable after signInWithPopup or in session.
        // We'll require login button click to explicitly pull token.
      } else {
        setFirebaseUser(null);
        setAccessToken(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Update current Rubric when selected subject changes
  useEffect(() => {
    const found = rubrics.find((r) => r.subject === selectedSubject);
    if (found) {
      setCurrentRubric(found);
    }
  }, [selectedSubject, rubrics]);

  // Restore state from LocalStorage for loaded grade history
  useEffect(() => {
    const saved = localStorage.getItem("daegu_grade_history");
    if (saved) {
      try {
        setGradeHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Local storage grade history restore error:", e);
      }
    }

    const savedSheetId = localStorage.getItem("daegu_sheet_id");
    if (savedSheetId) {
      setSheetId(savedSheetId);
    }
  }, []);

  const saveHistoryToLocalStorage = (history: StudentRecord[]) => {
    localStorage.setItem("daegu_grade_history", JSON.stringify(history));
  };

  const saveSheetIdToLocalStorage = (id: string) => {
    localStorage.setItem("daegu_sheet_id", id);
  };

  // Google Sheets login handler
  const handleGoogleLogin = async () => {
    if (!auth) {
      alert("Firebase app configuration not found or disabled.");
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/spreadsheets");
    provider.addScope("https://www.googleapis.com/auth/drive.file");

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        setFirebaseUser(result.user);
        setSyncStatus("연동에 성공했습니다! 이제 구글 시트를 만들거나 기존 시트를 지정할 수 있어요.");
      } else {
        alert("구글 Access Token 획득에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("Google Auth error:", error);
      alert("로그인 중 에러가 발생했습니다: " + error.message);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
    }
    setFirebaseUser(null);
    setAccessToken(null);
    setSyncStatus(null);
  };

  // Create Google Spreadsheet in Drive
  const handleCreateSpreadsheet = async () => {
    if (!accessToken) {
      alert("먼저 구글 계정으로 로그인해 주세요.");
      return;
    }
    setIsSyncing(true);
    setSyncStatus("구글 드라이브에 채점 누적 스프레드시트를 생성하는 중...");
    try {
      const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            title: `대구미래역량_AI채점_누적기록_${new Date().toISOString().slice(0, 10)}`,
          },
          sheets: [
            {
              properties: {
                title: "채점결과누적",
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        { userEnteredValue: { stringValue: "기록일시" } },
                        { userEnteredValue: { stringValue: "학생이름" } },
                        { userEnteredValue: { stringValue: "학번" } },
                        { userEnteredValue: { stringValue: "교과명" } },
                        { userEnteredValue: { stringValue: "총점" } },
                        { userEnteredValue: { stringValue: "만점" } },
                        { userEnteredValue: { stringValue: "학생답안" } },
                        { userEnteredValue: { stringValue: "종합피드백" } },
                        { userEnteredValue: { stringValue: "세부채점내역" } },
                        { userEnteredValue: { stringValue: "생기부 교과세특" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || "스프레드시트 생성 실패");
      }

      const sprData = await response.json();
      const newSheetId = sprData.spreadsheetId;
      setSheetId(newSheetId);
      saveSheetIdToLocalStorage(newSheetId);
      setSyncStatus(`구글 시트가 생성되었습니다. ID: ${newSheetId}`);
    } catch (e: any) {
      console.error("Sheets Create Error:", e);
      setSyncStatus(`시트 생성 에러: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Ensure "채점결과누적" tab/sheet exists in target Spreadsheet
  const ensureAccumulationSheetExists = async (customSheetId: string, token: string) => {
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${customSheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json().catch(() => ({}));
      const message = errorData?.error?.message || "";
      if (metaResponse.status === 404) {
        throw new Error(
          "입력하신 구글 스프레드시트 ID 또는 URL을 찾을 수 없습니다. 올바른 스프레드시트 ID인지 확인하시거나, '새로 만들기' 버튼을 사용해 주세요."
        );
      }
      throw new Error(
        message || "스프레드시트를 불러올 수 없습니다. 구글 로그인 및 시트 편집 권한이 있는지 확인해 주세요."
      );
    }

    const data = await metaResponse.json();
    const sheets = data.sheets || [];
    const hasAccumulationSheet = sheets.some(
      (s: any) => s.properties && s.properties.title === "채점결과누적"
    );

    if (!hasAccumulationSheet) {
      setSyncStatus("시트 내에 '채점결과누적' 탭이 발견되지 않아 새로 생성하는 중...");
      const addSheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${customSheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: "채점결과누적",
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        }),
      });

      if (!addSheetResponse.ok) {
        const errorData = await addSheetResponse.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "새로운 자동 누적용 시트 탭('채점결과누적') 생성을 완료하지 못했습니다."
        );
      }

      // Write Headers to the newly created sheet
      const writeHeadersResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${customSheetId}/values/채점결과누적!A1:J1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            range: "채점결과누적!A1:J1",
            majorDimension: "ROWS",
            values: [
              [
                "기록일시",
                "학생이름",
                "학번",
                "교과명",
                "총점",
                "만점",
                "학생답안",
                "종합피드백",
                "세부채점내역",
                "생기부 교과세특",
              ],
            ],
          }),
        }
      );

      if (!writeHeadersResponse.ok) {
        console.warn("Could not write headers to new tab, continuing with auto-appends...");
      }
    }
  };

  // Sync a single record to Google Sheets
  const syncRecordToSheets = async (record: StudentRecord, customSheetId = sheetId) => {
    if (!accessToken || !customSheetId) return;

    try {
      setSyncStatus("구글 스프레드시트 상태를 확인하는 중...");
      await ensureAccumulationSheetExists(customSheetId, accessToken);
      setSyncStatus("구글 스프레드시트에 점수를 전송 및 누적하는 중...");

      const detailSummary = record.detailedGrades
        .map((g) => `[${g.criteriaName}: ${g.score}/${g.maxScore} (${g.level}) - ${g.reason}]`)
        .join("\n");

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${customSheetId}/values/채점결과누적!A:J:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            range: "채점결과누적!A:J",
            majorDimension: "ROWS",
            values: [
              [
                record.timestamp,
                record.studentName,
                record.studentNumber,
                record.subject,
                record.totalScore,
                record.maxScore,
                record.essayText,
                record.feedback,
                detailSummary,
                record.seTeuk || "",
              ],
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sheets Append Error:", errorText);
        setSyncStatus("구글 시트 전송 중 일부 실패가 있었지만, 로컬 저장(웹 브라우저) 및 분석은 정상 완료되었습니다. " + errorText);
      } else {
        setSyncStatus("구글 스프레드시트에 점수가 성공적으로 누적되었습니다.");
      }
    } catch (e: any) {
      console.error("Sheets sync exception:", e);
      setSyncStatus(`구글 시트와 성적 데이터베이스 동기화 중 에러가 발생했습니다: ${e.message}`);
    }
  };

  // Perform AI Grading with Node backend
  const handleAIGrade = async () => {
    if (!essayText.trim()) {
      alert("학생의 답변을 입력하거나 파일을 업로드해 주세요.");
      return;
    }

    setIsGrading(true);
    setEvaluationResult(null);

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentName: studentName || "미입력",
          studentNumber: studentNumber || "미입력",
          subject: selectedSubject,
          essayText: essayText,
          rubric: currentRubric,
        }),
      });

      if (!response.ok) {
        const errInfo = await response.json();
        throw new Error(errInfo.error || "채점 정보 생성에 실패했습니다.");
      }

      const scoreResult = await response.json();

      // Create local StudentRecord item
      const newRec: StudentRecord = {
        timestamp: new Date().toLocaleString(),
        studentName: studentName || "이름 미기입",
        studentNumber: studentNumber || "번호 미기입",
        subject: selectedSubject,
        essayText: essayText,
        detailedGrades: scoreResult.detailedGrades || [],
        totalScore: scoreResult.totalScore || 0,
        maxScore: scoreResult.maxScore || 100,
        feedback: scoreResult.feedback || "피드백을 생성할 수 없습니다.",
        seTeuk: scoreResult.seTeuk || "세특 추천 문구를 생성할 수 없습니다.",
      };

      setEvaluationResult(newRec);

      const updatedHistory = [newRec, ...gradeHistory];
      setGradeHistory(updatedHistory);
      saveHistoryToLocalStorage(updatedHistory);

      // Trigger automatic background Google Sheets write if setup
      if (accessToken && sheetId) {
        await syncRecordToSheets(newRec);
      }
    } catch (e: any) {
      console.error("Evaluation exception:", e);
      alert(`채점 과정에서 에러가 발생했습니다: ${e.message}`);
    } finally {
      setIsGrading(false);
    }
  };

  // Parse uploaded text/PDF file
  const handleFileUpload = (file: File) => {
    setSyncStatus("");
    const fileType = file.name.split('.').pop()?.toLowerCase();

    // Helper to safely convert ArrayBuffer to base64
    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
      }
      return window.btoa(binary);
    };

    if (fileType === 'pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) return;

        const triggerAiOcr = async () => {
          try {
            setSyncStatus("스캔 또는 암호화된 PDF가 감지되어 AI OCR로 자동 분석하는 중입니다... (약 10초 내외 소요)");
            const base64Data = arrayBufferToBase64(arrayBuffer);
            const response = await fetch("/api/parse-pdf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pdfBase64: base64Data }),
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || "AI OCR 서버 요청 중 오류가 발생했습니다.");
            }

            const data = await response.json();
            const aiText = data.text?.trim();
            if (aiText) {
              setEssayText(aiText);
              setSyncStatus(`원고 성공적으로 지능적 수집 완료 (AI OCR): '${file.name}' (${aiText.length}자)`);
            } else {
              throw new Error("AI가 해당 PDF에서 글자를 찾아내지 못했습니다.");
            }
          } catch (ocrErr: any) {
            console.error("AI OCR failed:", ocrErr);
            alert(`[PDF 처리 및 AI OCR 실패 안내]\n\n기본 텍스트 추출 및 AI 지능형 OCR 추출 모두 실패했습니다.\n\n사유: ${ocrErr.message}`);
            setSyncStatus(`원고 자동 로드 보류: ${ocrErr.message.split('\n')[0]}`);
          }
        };

        try {
          setSyncStatus("PDF 파일 텍스트 레이어 검사 중...");
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            throw new Error("PDF 라이브러리를 임포트할 수 없거나 완전하게 로드되지 않았습니다. 인터넷 연결이나 파일 크기를 확인하신 후에 다시 올려주세요.");
          }

          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            let lastY = -1;
            let pageText = "";
            
            for (const item of textContent.items) {
              if (!item || typeof item.str !== 'string') continue;
              
              const currentY = item.transform ? item.transform[5] : -1;
              if (lastY !== -1 && Math.abs(currentY - lastY) > 6) {
                pageText += "\n";
              } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
                pageText += " ";
              }
              pageText += item.str;
              lastY = currentY;
            }
            
            fullText += pageText + "\n";
          }

          const trimmedText = fullText.trim();
          if (trimmedText) {
            setEssayText(trimmedText);
            setSyncStatus(`원고 성공적으로 수집 완료 (PDF 텍스트 레이어): '${file.name}' (${trimmedText.length}자)`);
          } else {
            console.log("No text layer found, resorting to AI OCR fallback.");
            await triggerAiOcr();
          }
        } catch (err: any) {
          console.error("Standard PDF parsing error, trying AI OCR fallback...", err);
          await triggerAiOcr();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setEssayText(text);
          setSyncStatus(`원고 로드 완료: '${file.name}' (${text.length}자)`);
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Reset current inputs
  const handleResetInputs = () => {
    setStudentName("");
    setStudentNumber("");
    setEssayText("");
    setEvaluationResult(null);
  };

  // Delete evaluation record from local history
  const handleDeleteHistory = (index: number) => {
    if (window.confirm("이 채점 기록을 삭제하시겠습니까?")) {
      const updated = [...gradeHistory];
      updated.splice(index, 1);
      setGradeHistory(updated);
      saveHistoryToLocalStorage(updated);
    }
  };

  // Trigger print logic
  const handlePrint = () => {
    if (evaluationResult) {
      const payload = {
        studentName: evaluationResult.studentName || studentName,
        studentNumber: evaluationResult.studentNumber || studentNumber,
        selectedSubject: evaluationResult.subject || selectedSubject,
        essayText: evaluationResult.essayText || essayText,
        evaluationResult: evaluationResult.evaluationResult || evaluationResult,
        timestamp: evaluationResult.timestamp || new Date().toLocaleString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        })
      };
      setPrintRecord(payload);
      setIsPrintPreviewOpen(true);
    } else {
      alert("먼저 채점을 진행해 주십시오.");
    }
  };

  // Generate and download highly formatted client-side PDF file
  const handleDownloadPdf = () => {
    const element = document.getElementById("printable-paper");
    if (!element) {
      alert("인쇄 대상을 찾지 못했습니다.");
      return;
    }

    setIsPdfGenerating(true);

    const name = printRecord?.studentName || studentName || "학생";
    const subjectName = printRecord?.selectedSubject || selectedSubject || "과목";

    const colorToRgb = (colorStr: string): string => {
      if (!colorStr) return colorStr;
      if (!colorStr.includes("oklch") && !colorStr.includes("oklab") && !colorStr.includes("lab") && !colorStr.includes("lch")) {
        return colorStr;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        }
      } catch (e) {
        console.error("Error converting color to rgb:", e);
      }
      return colorStr;
    };

    const convertCssColors = (cssText: string): string => {
      if (!cssText) return cssText;
      return cssText.replace(/(oklch|oklab|lch|lab)\([^)]+\)/g, (match) => {
        try {
          const rgb = colorToRgb(match);
          if (rgb && rgb !== match) {
            return rgb;
          }
        } catch (e) {
          console.error("CSS okl/lab replacement error:", e);
        }
        return "transparent";
      });
    };

    const opt = {
      margin:       10,
      filename:     `AI_채점결과통지표_${name}_(${subjectName}).pdf`,
      image:        { type: "jpeg", quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        onclone: (clonedDoc: Document) => {
          // Clean all stylesheets to avoid html2canvas oklch/oklab parsing crashes
          const styleTags = clonedDoc.getElementsByTagName("style");
          for (let i = 0; i < styleTags.length; i++) {
            const styleTag = styleTags[i];
            if (styleTag.textContent) {
              styleTag.textContent = convertCssColors(styleTag.textContent);
            }
          }

          const originalElement = document.getElementById("printable-paper");
          const clonedElement = clonedDoc.getElementById("printable-paper");
          if (originalElement && clonedElement) {
            const sanitizeElement = (orig: HTMLElement, clone: HTMLElement) => {
              const computed = window.getComputedStyle(orig);
              const colorProps = [
                "color",
                "backgroundColor",
                "borderColor",
                "borderTopColor",
                "borderRightColor",
                "borderBottomColor",
                "borderLeftColor",
                "outlineColor"
              ];
              for (const prop of colorProps) {
                const val = computed[prop as any];
                if (val && (val.includes("oklch") || val.includes("oklab") || val.includes("lab") || val.includes("lch"))) {
                  const rgbVal = colorToRgb(val);
                  clone.style[prop as any] = rgbVal;
                }
              }
            };

            // Sanitize root element and children recursively
            sanitizeElement(originalElement as HTMLElement, clonedElement as HTMLElement);
            const originalDescendants = originalElement.getElementsByTagName("*");
            const clonedDescendants = clonedElement.getElementsByTagName("*");
            for (let i = 0; i < originalDescendants.length; i++) {
              const origChild = originalDescendants[i] as HTMLElement;
              const cloneChild = clonedDescendants[i] as HTMLElement;
              if (origChild && cloneChild) {
                sanitizeElement(origChild, cloneChild);
              }
            }
          }
        }
      },
      jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" }
    };

    const html2pdfLib = (window as any).html2pdf;
    if (html2pdfLib) {
      html2pdfLib()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          setIsPdfGenerating(false);
        })
        .catch((err: any) => {
          console.error("PDF download failed:", err);
          setIsPdfGenerating(false);
          alert("PDF 다운로드 중 문제가 발생했습니다: " + err.message);
        });
    } else {
      setIsPdfGenerating(false);
      alert("PDF 변환 엔진이 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  // Trigger Edit Rubrics Mode
  const startEditCriteria = (criteria: RubricCriteria) => {
    setIsEditingRubricNameId(criteria.id);
    setEditingCriteria(JSON.parse(JSON.stringify(criteria))); // Deep copy
  };

  const saveEditedCriteria = () => {
    if (!editingCriteria) return;

    const updatedRubrics = rubrics.map((subRubric) => {
      if (subRubric.subject === selectedSubject) {
        const uCriterias = subRubric.criterias.map((c) => {
          if (c.id === editingCriteria.id) {
            return editingCriteria;
          }
          return c;
        });
        return { ...subRubric, criterias: uCriterias };
      }
      return subRubric;
    });

    setRubrics(updatedRubrics);
    setIsEditingRubricNameId(null);
    setEditingCriteria(null);
  };

  const handleLevelScoreChange = (lvlIndex: number, newScore: number) => {
    if (!editingCriteria) return;
    const levelClone = [...editingCriteria.levels];
    levelClone[lvlIndex] = { ...levelClone[lvlIndex], score: newScore };
    setEditingCriteria({ ...editingCriteria, levels: levelClone });
  };

  const handleLevelDescChange = (lvlIndex: number, newDesc: string) => {
    if (!editingCriteria) return;
    const levelClone = [...editingCriteria.levels];
    levelClone[lvlIndex] = { ...levelClone[lvlIndex], description: newDesc };
    setEditingCriteria({ ...editingCriteria, levels: levelClone });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0FDF4] via-[#F8FAF6] to-white text-slate-800 font-sans p-4 sm:p-6 md:p-8 antialiased print:p-0 print:bg-white print:text-black">
      <div className="print:hidden">
        {/* Upper Navigation & branding Bar - HIDDEN IN PRINT */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-emerald-100 print:hidden">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100/60 text-emerald-800 mb-2">
            <Sparkles size={13} className="animate-pulse text-emerald-600" />
            대구광역시 미래역량개정 서·논술형 교과평가 각론 수립
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700 sm:text-4xl serif-font flex items-center gap-2">
            슬기로운 AI채점기 <span className="text-sm font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/50 serif-font">교사용 전문가 버전</span>
          </h1>
          <p className="text-slate-600 mt-1 max-w-xl text-xs sm:text-sm">
            교육과정 각론의 성취기준과 대조하여 일치한 일반적 채점기준표를 기준으로 학생들의 논술형과 에세이를 기계적 수준을 넘어 정확하고 정교하게 오토 그레이딩합니다.
          </p>
        </div>

        {/* Auth / Cloud Sync Configuration Container */}
        <div className="w-full md:w-auto bg-white p-4.5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-800/5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Database className="text-emerald-600" size={17} />
              <span className="font-bold text-xs text-slate-700">구글 시트 실시간 연결</span>
            </div>
            {firebaseUser ? (
              <button
                onClick={handleLogout}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title={`${firebaseUser.email} 세션 해제`}
              >
                <LogOut size={13} />
                로그아웃
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-medium">연동 안 됨</span>
            )}
          </div>

          {!accessToken ? (
            <button
              onClick={handleGoogleLogin}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white hover:brightness-105 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.81 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              구글 연동 및 시트 로그인
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="구글 스프레드시트 ID 입력"
                  value={sheetId}
                  onChange={(e) => {
                    setSheetId(e.target.value);
                    saveSheetIdToLocalStorage(e.target.value);
                  }}
                  className="bg-[#F9FBF9] border border-emerald-200 text-xs px-2.5 py-1.5 rounded-lg w-full text-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleCreateSpreadsheet}
                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50 font-bold text-xs rounded-lg whitespace-nowrap transition-colors cursor-pointer"
                  title="새 구글 스프레드를 생성합니다."
                >
                  새로 만들기
                </button>
              </div>
            </div>
          )}

          {syncStatus && <p className="text-[10px] text-slate-500 max-w-xs">{syncStatus}</p>}
        </div>
      </div>

      {/* Main Subject Buttons Header for Teacher - HIDDEN IN PRINT */}
      <div className="max-w-7xl mx-auto mb-6 print:hidden">
        <label className="block text-xs font-extrabold text-emerald-800 uppercase tracking-widest mb-3">
          1단계: 평가를 수행할 고등학교 공통/통합 선택
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-emerald-100/40 p-2 rounded-2xl border border-emerald-100">
          {defaultRubrics.map((rubric) => {
            const isSelected = selectedSubject === rubric.subject;
            return (
              <button
                key={rubric.subject}
                onClick={() => setSelectedSubject(rubric.subject)}
                className={`py-3 px-4 rounded-xl font-bold text-sm tracking-tight transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-800/10 transform -translate-y-0.5"
                    : "text-slate-600 hover:text-emerald-700 hover:bg-white/90"
                }`}
              >
                <BookOpen size={15} className={isSelected ? "text-white" : "text-emerald-600"} />
                {rubric.subject}
              </button>
            );
          })}
        </div>
      </div>

      {/* Print-Only Title page header details */}
      <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-black serif-font">서·논술형 쓰기 학업성취도 AI 채점 결과 통지표</h1>
          <p className="text-sm font-medium mt-1 text-slate-700">대구광역시 미래역량교육과정 각론 기준 정량 채점</p>
        </div>
        <div className="mt-6 grid grid-cols-4 border border-black text-center text-sm">
          <div className="border-r border-black bg-slate-100 p-2 font-bold">평가 교과</div>
          <div className="border-r border-black p-2">{selectedSubject}</div>
          <div className="border-r border-black bg-slate-100 p-2 font-bold">학생이름 / 학번</div>
          <div className="p-2">
            {studentName || "미기입"} / {studentNumber || "미기입"}
          </div>
        </div>
      </div>

      {/* Layout Split: Left: Workspace Panel & Editor. Right: Assessment Results */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side (8 col equivalent) - Inputs column */}
        <div className="lg:col-span-7 flex flex-col gap-8 print:hidden">
          {/* Active Rubric Reference Panel */}
          <div className="bg-white rounded-3xl border border-[#A3B18A]/20 shadow-sm overflow-hidden transition-all duration-300">
            <div className="bg-[#588157] px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="text-[#F0EDE5]" size={18} />
                <h2 className="text-base font-extrabold text-white serif-font">
                  {selectedSubject} 교육과정 각론 일반적 채점기준표
                </h2>
              </div>
              <span className="text-[#F0EDE5]/80 text-xs font-mono">Verbatim Curriculum standards</span>
            </div>

            <div className="p-6 divide-y divide-slate-100">
              {currentRubric.criterias.map((criteria) => (
                <div key={criteria.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-[#3E3B39] text-lg flex items-center gap-2 serif-font">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#588157] inline-block"></span>
                        {criteria.name}
                      </h3>
                      <p className="text-xs text-[#3E3B39]/70 mt-0.5">최대 점수 대역: {criteria.maxScore}점 만점</p>
                    </div>

                    <button
                      onClick={() => startEditCriteria(criteria)}
                      className="px-2.5 py-1 text-xs border border-[#A3B18A]/30 rounded-lg text-[#588157] hover:bg-[#588157]/10 transition-all flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Edit2 size={12} />
                      수정하기
                    </button>
                  </div>

                  {isEditingRubricNameId === criteria.id && editingCriteria ? (
                    <div className="bg-[#FCFAF5] p-4 rounded-2xl border border-[#A3B18A]/30 mt-2 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#588157]">평가 영역명 수정:</span>
                        <input
                          type="text"
                          value={editingCriteria.name}
                          onChange={(e) => setEditingCriteria({ ...editingCriteria, name: e.target.value })}
                          className="bg-white border border-[#A3B18A]/30 px-2.5 py-1 w-48 text-sm rounded-lg text-[#3E3B39] focus:outline-none focus:border-[#588157]"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500">성취 수준 등급 & 배점 수립:</p>
                        {editingCriteria.levels.map((lvl, lIdx) => (
                          <div key={lIdx} className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-2 text-xs font-semibold text-[#3E3B39] text-right pr-2">
                              {lvl.level}
                            </span>
                            <input
                              type="number"
                              value={lvl.score}
                              onChange={(e) => handleLevelScoreChange(lIdx, Number(e.target.value))}
                              className="col-span-2 bg-white border border-[#A3B18A]/25 px-2 py-1 text-xs rounded-lg text-center font-bold text-[#3E3B39]"
                            />
                            <input
                              type="text"
                              value={lvl.description}
                              onChange={(e) => handleLevelDescChange(lIdx, e.target.value)}
                              className="col-span-8 bg-white border border-[#A3B18A]/25 px-2.5 py-1 text-xs rounded-lg text-[#3E3B39]"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-emerald-100">
                        <button
                          onClick={() => setIsEditingRubricNameId(null)}
                          className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-200"
                        >
                          취소
                        </button>
                        <button
                          onClick={saveEditedCriteria}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-emerald-700"
                        >
                          저장 완료
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mt-2">
                      {criteria.levels.map((lvl, lIdx) => (
                        <div key={lIdx} className="bg-[#F8FAF8] border border-emerald-100 rounded-xl p-3 transition-colors hover:bg-emerald-50/20">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-extrabold text-slate-700">{lvl.level}</span>
                            <span className="text-[11px] font-bold text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100">
                              {lvl.score}점
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal line-clamp-3" title={lvl.description}>
                            {lvl.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Student Dossier & Entry Form */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6">
            <h2 className="text-base font-extrabold text-emerald-800 border-b border-emerald-50 pb-3 mb-4.5 flex items-center gap-2 serif-font">
              <User size={18} className="text-emerald-600" />
              2단계: 학생 인적사항 입력 및 답안 업로드
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-600 mb-1.5">학생 이름</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="김철수"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-[#F9FBF9] border border-emerald-200/50 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 mb-1.5">이름/학번 또는 고유번호</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="3학년 1반 12번"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    className="w-full bg-[#F9FBF9] border border-emerald-200/50 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Smart File Dropzone */}
            <div className="mb-4">
              <label className="block text-xs font-extrabold text-slate-600 mb-1.5">학생 원고 업로드</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`upload-zone border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragging ? "border-emerald-500 bg-emerald-50/30" : "border-emerald-200 hover:bg-emerald-50/20 bg-[#F9FBF9]"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".txt,.pdf"
                  className="hidden"
                />
                <svg className="w-10 h-10 text-emerald-600 mx-auto mb-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-base font-bold text-slate-700">논술형 답안 파일을 업로드하세요</p>
                <p className="text-xs text-slate-500 mt-1">한글 텍스트(.txt) 및 PDF(.pdf) 문서를 모두 지원합니다.</p>
              </div>
            </div>

            {/* Handwriting Text Input Field */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-extrabold text-slate-600">학생 답안 내용 직접 입력 또는 붙여넣기</label>
                <span className="text-[11px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-md">{essayText.length} 자</span>
              </div>
              <textarea
                rows={8}
                placeholder="컴퓨터 타자로 정사된 것이나 학생의 수기 고를 복제하여 여기에 내용을 붙여넣으세요..."
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                className="w-full bg-[#F9FBF9] border border-emerald-200/50 rounded-xl p-4 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            {/* Execute Grading Action Bar */}
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={handleResetInputs}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                비우기
              </button>
              <button
                onClick={handleAIGrade}
                disabled={isGrading}
                className={`px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer transition-all ${
                  isGrading ? "opacity-75 cursor-not-allowed" : "hover:shadow-emerald-500/20"
                }`}
              >
                {isGrading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    대구미래역량과 대조하여 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    자동 채점 및 피드백 생성 시작
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side (5/12 or full columns) - Results panel */}
        <div className="lg:col-span-5 flex flex-col gap-8 print:w-full print:border-none">
          {/* Active Result View Card */}
          {evaluationResult ? (
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-md overflow-hidden relative print:border-none print:shadow-none">
              {/* Score Large Badge */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white flex justify-between items-center print:bg-white print:text-black print:border-b print:pb-3 print:px-0">
                <div>
                  <span className="text-xs text-emerald-100 font-mono tracking-wider print:text-slate-500">
                    AI ED-GRADER REPORT
                  </span>
                  <h2 className="text-xl font-extrabold print:text-black serif-font">
                    {studentName || "인적사항 미확인"} <span className="text-emerald-100/70 font-normal serif-font">학적부</span>
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white print:text-black serif-font">
                    {evaluationResult.totalScore} <span className="text-sm font-normal text-emerald-100 print:text-slate-500">/ {evaluationResult.maxScore}점</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6 print:px-0">
                {/* Print action trigger bar - HIDDEN IN PRINT */}
                <div className="flex gap-2.5 print:hidden border-b border-emerald-50 pb-4">
                  <button
                    onClick={handlePrint}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm hover:brightness-105 cursor-pointer transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    PDF 결과 인쇄
                  </button>
                  {accessToken && (
                    <button
                      onClick={() => syncRecordToSheets(evaluationResult)}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm hover:brightness-105 cursor-pointer transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      구글 시트 전송
                    </button>
                  )}
                </div>

                {/* Score breakdown metrics */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider serif-font">
                    평가 항목 영역별 도달 분석
                  </h3>

                  <div className="space-y-3">
                    {evaluationResult.detailedGrades?.map((item: any, grIdx: number) => {
                      const levelColors: Record<string, string> = {
                        "매우 높음": "bg-emerald-50 text-emerald-700 border-emerald-200",
                        높음: "bg-blue-50 text-blue-700 border-blue-200",
                        보통: "bg-amber-50 text-amber-700 border-amber-200",
                        낮음: "bg-rose-50 text-red-700 border-rose-200",
                      };
                      return (
                        <div key={grIdx} className="bg-[#F8FAF8] border border-emerald-100 rounded-xl p-4.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-800 text-sm serif-font">{item.criteriaName}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                                  levelColors[item.level] || "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                {item.level}
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-600">
                                {item.score} / {item.maxScore}점
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-emerald-100/30">
                            {item.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback with various Display Font sizes layout requested */}
                <div className="pt-4 border-t border-emerald-100">
                  <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 serif-font">
                    교사용 개별 첨삭 피드백 및 발전 방향
                  </h3>
                  <div className="bg-[#F8FAF8] border border-emerald-100 rounded-xl p-5 text-slate-800 leading-relaxed font-sans prose prose-emerald max-w-none text-sm space-y-4 shadow-inner">
                    <div className="space-y-2 whitespace-pre-wrap italic font-medium">
                      {evaluationResult.feedback}
                    </div>
                  </div>
                </div>

                {/* School Year Record (세특) Recommendation Panel */}
                <div className="pt-4 border-t border-emerald-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold text-[#115E59] uppercase tracking-wider serif-font">
                      학교생활기록부 교과세특용 추천 문구
                    </h3>
                    <button
                      onClick={() => {
                        if (evaluationResult.seTeuk) {
                          navigator.clipboard.writeText(evaluationResult.seTeuk);
                          alert("세특 추천 문구가 클립보드에 복사되었습니다!");
                        }
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition-all border border-emerald-200/50 cursor-pointer print:hidden"
                    >
                      문구 복사하기
                    </button>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50/40 to-slate-50 border border-emerald-200/40 rounded-xl p-5 text-slate-800 leading-relaxed text-sm shadow-inner relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-100/10 rounded-full blur-2xl pointer-events-none"></div>
                    <p className="whitespace-pre-wrap select-all font-sans antialiased text-slate-800 font-semibold leading-relaxed">
                      {evaluationResult.seTeuk || "세특 상세 내용을 분석 및 생성하고 있습니다."}
                    </p>
                  </div>
                </div>

                {/* Verbatim loaded student paper reference for print integrity */}
                <div className="pt-4 border-t border-emerald-100 print:block">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    제출 답안 원본 기록
                  </h3>
                  <div className="bg-slate-50 border border-slate-200/40 rounded-lg p-4 font-mono text-xs text-slate-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {essayText}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-8 text-center text-slate-400 py-16 print:hidden">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <Award className="text-emerald-500 animate-pulse" size={32} />
              </div>
              <p className="text-sm font-bold text-slate-700">채점 상태창</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                좌측에서 학생 정보를 기입하고 첨삭할 답안을 입력한 후, &quot;자동 채점 및 피드백 생성시작&quot; 버튼을 클릭해 주세요.
              </p>
            </div>
          )}

          {/* Grading history list cumulated locally - HIDDEN IN PRINT */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 print:hidden">
            <div className="flex items-center justify-between border-b border-emerald-50 pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 serif-font">
                <Bookmark size={17} className="text-emerald-600" />
                선생님용 로컬 채점 누적 데이터 ({gradeHistory.length}건)
              </h2>
              {gradeHistory.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("모든 보관 기록을 정리하겠습니까?")) {
                      setGradeHistory([]);
                      localStorage.removeItem("daegu_grade_history");
                    }
                  }}
                  className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                >
                  전체 지우기
                </button>
              )}
            </div>

            {gradeHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">그레이딩이 완료된 성적 내역이 여기에 보관됩니다.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {gradeHistory.map((item, idx) => {
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-[#F8FAF8] border border-emerald-100/60 rounded-xl hover:border-emerald-300 transition-all flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 serif-font">
                            {item.studentName} ({item.studentNumber})
                          </span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/30 font-semibold">
                            {item.subject}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                          <span>{item.timestamp}</span>
                          <span>•</span>
                          <span className="font-extrabold text-emerald-600">
                            {item.totalScore} / {item.maxScore}점
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEvaluationResult(item)}
                          className="px-2.5 py-1 bg-white border border-emerald-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-500 font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          상세보기
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="로컬 기록 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Same-Page Print Preview Overlay Modal */}
      {isPrintPreviewOpen && printRecord && (() => {
        const rec = printRecord;
        const result = rec.evaluationResult;
        return (
          <div className="fixed inset-0 bg-neutral-900/85 backdrop-blur-md z-50 overflow-y-auto p-4 sm:p-8 md:p-12 print:static print:p-0 print:m-0 print:bg-white print:overflow-visible text-slate-900">
            {/* Top Control Bar - HIDDEN IN PRINT */}
            <div className="max-w-4xl mx-auto mb-6 bg-white border border-emerald-150 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Printer size={20} />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-extrabold text-slate-800 serif-font">인쇄 및 PDF 파일 저장 안내</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    실제 프린터로 인쇄하거나 내 컴퓨터로 완성된 PDF 파일 고해상도 사본을 바로 다운로드할 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPdfGenerating ? (
                    <RefreshCw className="animate-spin" size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                  {isPdfGenerating ? "PDF 파일 생성 중..." : "PDF 직접 다운로드"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  프린터 기기 인쇄
                </button>
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* Printable Paper A4 Layout */}
            <div id="printable-paper" className="max-w-4xl mx-auto bg-white border border-slate-300 p-8 sm:p-12 md:p-16 shadow-2xl print:shadow-none print:border-none print:p-0 relative overflow-hidden">
              {/* Header */}
              <div className="text-center pb-6 border-b-2 border-slate-800 relative">
                <span className="text-[10px] font-bold text-emerald-850 border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  대구광역시 미래역량 교육과정 각론 기준
                </span>
                <h1 className="text-3xl font-black mt-4 text-slate-900 tracking-tight serif-font">
                  서·논술형 쓰기 학업성취도 AI 채점 결과 통지표
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium italic">
                  AI Edu-Grader High-Precision Analysis Report
                </p>
                
                {/* Elegant Mock Seal on Top Right for Authenticity */}
                <div className="absolute top-0 right-0 border-2 border-emerald-600 rounded-full w-14 h-14 flex items-center justify-center rotate-12 select-none opacity-80 print:opacity-100">
                  <div className="border border-dashed border-emerald-600 rounded-full w-12 h-12 flex flex-col items-center justify-center text-[8px] font-black leading-tight text-emerald-600">
                    <span>AI 채점</span>
                    <span>검인필</span>
                  </div>
                </div>
              </div>

              {/* Student / Subject Info Table */}
              <div className="mt-8 text-left">
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <tbody>
                    <tr>
                      <td className="border border-slate-400 bg-slate-50 w-24 p-2.5 font-bold text-center text-slate-800">평가 대상 교과</td>
                      <td className="border border-slate-400 p-2.5 text-left font-semibold text-slate-900">{rec.selectedSubject}</td>
                      <td className="border border-slate-400 bg-slate-50 w-24 p-2.5 font-bold text-center text-slate-800">평가 일시</td>
                      <td className="border border-slate-400 p-2.5 text-left text-slate-700 font-mono">{rec.timestamp}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 bg-slate-50 w-24 p-2.5 font-bold text-center text-slate-800">대상 학생이름</td>
                      <td className="border border-slate-400 p-2.5 text-left font-bold text-slate-900 text-sm">{rec.studentName || "미기입"}</td>
                      <td className="border border-slate-400 bg-slate-50 w-24 p-2.5 font-bold text-center text-slate-800 font-mono">학번 / 식별번호</td>
                      <td className="border border-slate-400 p-2.5 text-left text-slate-800 font-mono font-medium">{rec.studentNumber || "미기입"}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-400 bg-slate-50 w-24 p-2.5 font-bold text-center text-slate-800">성취 종합 점수</td>
                      <td colSpan={3} className="border border-slate-400 p-2.5 text-left font-extrabold text-emerald-700 text-base">
                        {result.totalScore}점 <span className="text-xs font-normal text-slate-500">/ 총 만점 {result.maxScore}점</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Scores breakdown metrics table */}
              <div className="mt-8 space-y-3">
                <h3 className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-1.5 border-b border-slate-300 pb-1.5 serif-font text-left">
                  <Award className="text-emerald-700" size={16} />
                  1. 평가 영역 영역별 도달 분석
                </h3>
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-400 p-2.5 font-bold text-center text-slate-800 w-1/4">평가 영역</th>
                      <th className="border border-slate-400 p-2.5 font-bold text-center text-slate-800 w-20">평가 점수</th>
                      <th className="border border-slate-400 p-2.5 font-bold text-center text-slate-800 w-24">도달 등급</th>
                      <th className="border border-slate-400 p-2.5 font-bold text-center text-slate-800">세부 채점 판단 이유 및 분석</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.detailedGrades?.map((item: any, grIdx: number) => (
                      <tr key={grIdx} className="hover:bg-slate-50/40">
                        <td className="border border-slate-400 p-2.5 font-bold text-slate-800 text-center">{item.criteriaName}</td>
                        <td className="border border-slate-400 p-2.5 text-center font-mono font-semibold text-emerald-600">{item.score} / {item.maxScore}점</td>
                        <td className="border border-slate-400 p-2.5 text-center">
                          <span className="inline-block px-2 py-0.5 border border-slate-300 font-bold text-[10px] rounded bg-slate-50 text-slate-800">
                            {item.level}
                          </span>
                        </td>
                        <td className="border border-slate-400 p-2.5 text-left text-slate-700 leading-relaxed whitespace-pre-wrap">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Teacher guidance and Individual commentary feedback */}
              <div className="mt-8 space-y-3 text-left">
                <h3 className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-1.5 border-b border-slate-300 pb-1.5 serif-font">
                  <Sparkles className="text-emerald-700" size={16} />
                  2. 교사용 종합 개별 첨삭 및 피드백 (종합 의견)
                </h3>
                <div className="border border-slate-400 bg-[#FAF9F5] rounded p-5 text-xs text-slate-850 leading-relaxed whitespace-pre-wrap">
                  {result.feedback}
                </div>
              </div>

              {/* School year record string */}
              {result.seTeuk && (
                <div className="mt-8 space-y-3 page-break-inside-avoid text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-1.5 border-b border-slate-300 pb-1.5 serif-font">
                    <Bookmark className="text-emerald-700" size={16} />
                    3. 학교생활기록부 교과 학습발달상황(세특) 기재 추천 예안
                  </h3>
                  <div className="border border-slate-400 bg-slate-50 rounded p-5 text-xs text-slate-850 leading-relaxed font-semibold whitespace-pre-wrap">
                    {result.seTeuk}
                  </div>
                </div>
              )}

              {/* Original answer submission record */}
              {rec.essayText && (
                <div className="mt-8 space-y-3 page-break-inside-avoid text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-1.5 border-b border-slate-300 pb-1.5 serif-font">
                    <FileText className="text-slate-500" size={16} />
                    4. 제출 학생 답안 원본 원고
                  </h3>
                  <div className="border border-slate-300 bg-neutral-50/50 rounded p-4 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {rec.essayText}
                  </div>
                </div>
              )}

              {/* Elegant Footer Credentials */}
              <div className="mt-16 pt-6 border-t border-slate-300 text-center space-y-1 select-none">
                <p className="text-xs font-bold text-slate-700 serif-font">
                  대구광역시 미래역량 교육복지 사업기반 AI 고해상도 교육 채점진단시스템
                </p>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                  Automated AI Essay Evaluation System • Daegu Education Core
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
