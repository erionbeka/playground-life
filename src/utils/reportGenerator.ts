import { AuditEntry, Child, GameResult, HomeworkAssignment } from "@/context/AppContext";
import { getCatalogGameById } from "@/lib/customCatalog";
import { analyzeMonthlyPlanWeekOutcome } from "@/lib/personalization";
import jsPDF from "jspdf";

interface ReportData {
  childName: string;
  filterType: string;
  assignments: HomeworkAssignment[];
  children: Child[];
  allResults: GameResult[];
  auditLog?: AuditEntry[];
  metrics: {
    avgScore: number;
    avgAttention: number | null;
    avgPrompts: string | null;
    avgEmotionReg: number | null;
    avgComm: number | null;
    totalFrustration: number;
    avgIndependence: number | null;
    totalPlayTime: number;
  };
}

export function generateReport(data: ReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const addText = (text: string, x: number, yPos: number, opts?: { fontSize?: number; fontStyle?: string; color?: [number, number, number] }) => {
    doc.setFontSize(opts?.fontSize || 10);
    doc.setFont("helvetica", opts?.fontStyle || "normal");
    doc.setTextColor(...(opts?.color || [50, 50, 50]));
    doc.text(text, x, yPos);
  };

  const addLine = (yPos: number) => {
    doc.setDrawColor(210, 210, 210);
    doc.line(15, yPos, pageWidth - 15, yPos);
  };

  const checkPage = () => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  };

  addText("Playground Life", 15, y, { fontSize: 22, fontStyle: "bold", color: [80, 120, 200] });
  y += 8;
  addText("Clinical Progress Report", 15, y, { fontSize: 14, fontStyle: "bold" });
  y += 7;
  addText(`Generated: ${new Date().toLocaleDateString()} | Child: ${data.childName} | Type: ${data.filterType}`, 15, y, { fontSize: 9, color: [120, 120, 120] });
  y += 5;
  addLine(y);
  y += 10;

  addText("EXECUTIVE SUMMARY", 15, y, { fontSize: 12, fontStyle: "bold", color: [80, 120, 200] });
  y += 8;
  [
    `Total assignments: ${data.assignments.length}`,
    `Games completed: ${data.allResults.length}`,
    `Average task score: ${data.metrics.avgScore}/100`,
    `Total play time: ${data.metrics.totalPlayTime} minutes`,
  ].forEach((item) => {
    addText(`- ${item}`, 20, y);
    y += 6;
  });
  y += 4;

  checkPage();
  addText("CLINICAL METRICS", 15, y, { fontSize: 12, fontStyle: "bold", color: [80, 120, 200] });
  y += 8;

  const metricRows: [string, string, string][] = [
    ["Metric", "Value", "Clinical Significance"],
    ["Task Performance Score", `${data.metrics.avgScore}/100`, data.metrics.avgScore >= 80 ? "Above expectations" : data.metrics.avgScore >= 60 ? "Meeting expectations" : "Needs support"],
    ["Frustration Events", `${data.metrics.totalFrustration} total`, data.metrics.totalFrustration <= 2 ? "Low frustration pattern" : "Monitor triggers closely"],
  ];

  if (data.metrics.avgAttention != null) metricRows.push(["Attention Span", `${data.metrics.avgAttention}/10`, data.metrics.avgAttention >= 7 ? "Sustained attention" : "Attention support needed"]);
  if (data.metrics.avgPrompts != null) metricRows.push(["Prompts Needed", `${data.metrics.avgPrompts} avg`, parseFloat(data.metrics.avgPrompts) <= 2 ? "High independence" : "Prompting still needed"]);
  if (data.metrics.avgEmotionReg != null) metricRows.push(["Emotional Regulation", `${data.metrics.avgEmotionReg}/10`, data.metrics.avgEmotionReg >= 7 ? "Strong self-regulation" : "Regulation supports advised"]);
  if (data.metrics.avgComm != null) metricRows.push(["Communication Attempts", `${data.metrics.avgComm} avg/session`, data.metrics.avgComm >= 8 ? "Active communicator" : "Communication opportunities needed"]);
  if (data.metrics.avgIndependence != null) metricRows.push(["Independence Level", `${data.metrics.avgIndependence}/10`, data.metrics.avgIndependence >= 7 ? "Working independently" : "Scaffolding recommended"]);

  const colWidths = [55, 35, 90];
  metricRows.forEach((row, rowIndex) => {
    checkPage();
    const bgColor: [number, number, number] = rowIndex === 0 ? [80, 120, 200] : rowIndex % 2 === 0 ? [245, 245, 250] : [255, 255, 255];
    doc.setFillColor(...bgColor);
    doc.rect(15, y - 4, pageWidth - 30, 7, "F");
    row.forEach((cell, cellIndex) => {
      const x = 17 + colWidths.slice(0, cellIndex).reduce((sum, width) => sum + width, 0);
      addText(cell, x, y, { fontSize: 8, fontStyle: rowIndex === 0 ? "bold" : "normal", color: rowIndex === 0 ? [255, 255, 255] : [50, 50, 50] });
    });
    y += 7;
  });
  y += 6;

  checkPage();
  addText("ASSIGNMENT DETAILS", 15, y, { fontSize: 12, fontStyle: "bold", color: [80, 120, 200] });
  y += 8;

  data.assignments.forEach((assignment) => {
    checkPage();
    const child = data.children.find((entry) => entry.id === assignment.childId);
    const progress = assignment.gameIds.length > 0 ? Math.round((assignment.completedGames.length / assignment.gameIds.length) * 100) : 0;

    addText(`${child?.name || "Unknown"} - ${assignment.type} (${assignment.status})`, 17, y, { fontSize: 9, fontStyle: "bold" });
    y += 5;
    addText(`Due: ${assignment.dueDate} | Progress: ${progress}% | Mode: ${assignment.mode} | Difficulty: ${assignment.difficulty}`, 20, y, { fontSize: 8, color: [100, 100, 100] });
    y += 5;
    addText(`Approval: ${assignment.therapistApproval} | Skill focus: ${assignment.skillFocus.join(", ")}`, 20, y, { fontSize: 8, color: [100, 100, 100] });
    y += 5;
    if (assignment.monthlyPlan) {
      const monthlyReview = analyzeMonthlyPlanWeekOutcome(assignment);
      addText(
        `Monthly plan week ${assignment.monthlyPlan.weekNumber}: ${assignment.monthlyPlan.objective} | ${assignment.monthlyPlan.supportLevel} support | ${assignment.monthlyPlan.progressionDecision}`,
        20,
        y,
        { fontSize: 8, color: [100, 100, 100] }
      );
      y += 5;
      if (monthlyReview) {
        addText(`Outcome recommendation: ${monthlyReview.recommendation} | ${monthlyReview.summary}`, 20, y, { fontSize: 8, color: [100, 100, 100] });
        y += 5;
      }
    }

    const gameNames = assignment.gameIds.map((gameId) => {
      const game = getCatalogGameById(gameId);
      const done = assignment.completedGames.includes(gameId);
      return `${done ? "[x]" : "[ ]"} ${game?.name || gameId}`;
    });
    addText(`Games: ${gameNames.join(", ")}`, 20, y, { fontSize: 8 });
    y += 5;

    if (assignment.notes) {
      addText(`Notes: ${assignment.notes}`, 20, y, { fontSize: 8, fontStyle: "italic", color: [100, 100, 100] });
      y += 5;
    }

    assignment.results.forEach((result) => {
      checkPage();
      const game = getCatalogGameById(result.gameId);
      const detailLine = [
        `${game?.name || result.gameId}: Score ${result.score}`,
        `${result.interactions} interactions`,
        `${Math.round(result.durationSeconds / 60)}m`,
        result.attentionSpan != null ? `Attention ${result.attentionSpan}/10` : null,
        result.emotionalRegulation != null ? `Emotion ${result.emotionalRegulation}/10` : null,
        result.promptsNeeded != null ? `${result.promptsNeeded} prompts` : null,
      ].filter(Boolean).join(", ");
      addText(detailLine, 22, y, { fontSize: 7 });
      y += 4;
    });

    y += 3;
    addLine(y);
    y += 5;
  });

  if (data.auditLog && data.auditLog.length > 0) {
    checkPage();
    addText("AUDIT SNAPSHOT", 15, y, { fontSize: 12, fontStyle: "bold", color: [80, 120, 200] });
    y += 8;
    data.auditLog.slice(0, 6).forEach((entry) => {
      checkPage();
      addText(`- ${entry.action.replace(/_/g, " ")} | ${new Date(entry.createdAt).toLocaleString()} | ${entry.details}`, 20, y, { fontSize: 8 });
      y += 6;
    });
    y += 4;
  }

  checkPage();
  addText("CLINICAL OBSERVATIONS & RECOMMENDATIONS", 15, y, { fontSize: 12, fontStyle: "bold", color: [80, 120, 200] });
  y += 8;

  const recommendations: string[] = [];
  if (data.metrics.avgScore < 60) recommendations.push("Task scores below expectations - consider reducing difficulty or adding more scaffolding.");
  if (data.metrics.avgAttention != null && data.metrics.avgAttention < 6) recommendations.push("Attention span is trending low - use shorter activities and stronger transition cues.");
  if (data.metrics.avgPrompts != null && parseFloat(data.metrics.avgPrompts) > 3) recommendations.push("Prompting remains high - continue fading prompts with visual supports.");
  if (data.metrics.avgEmotionReg != null && data.metrics.avgEmotionReg < 6) recommendations.push("Emotional regulation support is still needed before challenging tasks.");
  if (data.metrics.totalFrustration > 3) recommendations.push("Multiple frustration events were observed - review triggers and coping supports.");
  if (data.metrics.avgIndependence != null && data.metrics.avgIndependence < 6) recommendations.push("Independence levels suggest continued scaffolding with gradual release.");
  if (data.metrics.avgComm != null && data.metrics.avgComm < 5) recommendations.push("Communication attempts are limited - add higher-interest shared activities.");
  if (recommendations.length === 0) recommendations.push("Overall performance is within the expected range. Continue the current intervention plan.");
  recommendations.push("Continue monitoring progress by skill domain and adjust assignments with therapist approval.");

  recommendations.forEach((entry) => {
    checkPage();
    addText(`- ${entry}`, 20, y, { fontSize: 9 });
    y += 7;
  });

  y += 8;
  checkPage();
  addLine(y);
  y += 5;
  addText("This report is auto-generated by Playground Life. Clinical decisions should be made in consultation with qualified professionals.", 15, y, { fontSize: 7, color: [150, 150, 150] });

  doc.save(`PlaygroundLife_Report_${data.childName.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
