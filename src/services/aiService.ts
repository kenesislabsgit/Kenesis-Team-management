import { GoogleGenAI, Type } from "@google/genai";
import { AttendanceRecord, UserProfile, DailyReport } from '../types';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  role: string;
  totalHours: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  rank: number;
  contributionScore: number;
}

export interface AIAnalysisResult {
  leaderboard: LeaderboardEntry[];
  insights: string;
  topPerformer: string;
  summary: string;
}

export const AIService = {
  analyzePerformance: async (users: UserProfile[], attendance: AttendanceRecord[], reports: DailyReport[]): Promise<AIAnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    // Prepare data for AI
    const userData = users.map(user => {
      const userAttendance = attendance.filter(a => a.uid === user.uid);
      const userReports = reports.filter(r => r.uid === user.uid);
      
      const totalHours = userAttendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
      const totalTasks = userReports.reduce((acc, curr) => acc + (curr.todoList?.length || 0), 0);
      const completedTasks = userReports.reduce((acc, curr) => acc + (curr.todoList?.filter(t => t.completed).length || 0), 0);
      
      return {
        uid: user.uid,
        name: user.name,
        role: user.role,
        totalHours,
        completedTasks,
        totalTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following employee performance data and generate a leaderboard and insights.
      Data: ${JSON.stringify(userData)}
      
      Requirements:
      1. Calculate a "Contribution Score" for each employee based on hours worked and task completion.
      2. Rank them.
      3. Provide a summary of who performed best and why.
      4. Provide general insights for the company.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leaderboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  uid: { type: Type.STRING },
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  totalHours: { type: Type.NUMBER },
                  completedTasks: { type: Type.NUMBER },
                  totalTasks: { type: Type.NUMBER },
                  completionRate: { type: Type.NUMBER },
                  rank: { type: Type.NUMBER },
                  contributionScore: { type: Type.NUMBER }
                },
                required: ["uid", "name", "role", "totalHours", "completedTasks", "totalTasks", "completionRate", "rank", "contributionScore"]
              }
            },
            insights: { type: Type.STRING },
            topPerformer: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["leaderboard", "insights", "topPerformer", "summary"]
        }
      }
    });

    return JSON.parse(response.text);
  }
};
