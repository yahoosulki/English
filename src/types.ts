export interface RubricLevel {
  level: string; // 매우 높음, 높음, 보통, 낮음 등
  score: number;
  description: string; // 기준 상세 내용
}

export interface RubricCriteria {
  id: string;
  name: string; // 평가 영역명
  maxScore: number;
  levels: RubricLevel[];
}

export interface SubjectRubric {
  subject: string; // 국어, 영어, 통합사회, 한국사, 공통수학, 통합과학
  criterias: RubricCriteria[];
}

export interface StudentRecord {
  id?: string;
  timestamp: string;
  studentName: string;
  studentNumber: string;
  subject: string;
  essayText: string;
  detailedGrades: {
    criteriaName: string;
    score: number;
    maxScore: number;
    level: string;
    reason: string;
  }[];
  totalScore: number;
  maxScore: number;
  feedback: string;
  seTeuk?: string;
}
