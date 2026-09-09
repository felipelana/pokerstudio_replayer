import { jsPDF } from 'jspdf';
import { formatScore } from '@pokerstudio/shared';
import { scoreOf } from './assessment';
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { handHeadline, type ReportData } from './buildReport';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const A4 = { w: 595, h: 842, margin: 48 };

/** Client-side PDF (L4). */
export interface ReportLabels {
  notes: string;
  tags: string;
  rating: string;
  summary: string;
  score: string;
  coverage: string;
  leaks: string;
  coach: string;
  noScore: string;
  noCoverage: string;
}

/** The numbers as one line each, the same in both file formats. */
function summaryLines(report: ReportData, labels: ReportLabels): string[] {
  const pct = (v: number | null) => (v === null ? labels.noCoverage : `${Math.round(v)}%`);
  const lines = [
    `${labels.score}: ${formatScore(report.summary.score) ?? labels.noScore}`,
    `${labels.coverage}: ${pct(report.summary.coverage.percent)} (${report.summary.coverage.reviewed}/${report.summary.coverage.total})`,
  ];
  if (report.summary.leaks.length) {
    lines.push(`${labels.leaks}: ${report.summary.leaks.slice(0, 8).map((l) => `${l.tag} (${l.hands})`).join(', ')}`);
  }
  for (const coach of report.coaches) {
    lines.push(`${coach.name}: ${formatScore(coach.summary.score.value) ?? labels.noScore} · ${labels.coverage} ${pct(coach.summary.coverage.percent)}`);
  }
  return lines;
}

export function exportPdf(report: ReportData, labels: ReportLabels) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = A4.margin;

  const line = (text: string, size: number, bold = false, gap = 6) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    for (const part of doc.splitTextToSize(text, A4.w - A4.margin * 2) as string[]) {
      if (y > A4.h - A4.margin) {
        doc.addPage();
        y = A4.margin;
      }
      doc.text(part, A4.margin, y);
      y += size + gap * 0.4;
    }
    y += gap;
  };

  line(report.title, 18, true, 4);
  line(report.generatedAt.toLocaleString(), 9, false, 8);

  line(labels.summary, 11, true, 2);
  for (const text of summaryLines(report, labels)) line(text, 9, false, 2);
  y += 8;

  for (const item of report.items) {
    if (y > A4.h - A4.margin - 60) {
      doc.addPage();
      y = A4.margin;
    }
    line(handHeadline(item), 12, true, 2);
    if (item.tags.length) line(`${labels.tags}: ${item.tags.map((t) => t.label).join(', ')}`, 9, false, 2);
    const own = scoreOf(item.review);
    if (own !== undefined) line(`${labels.rating}: ${own}/100`, 9, false, 2);
    if (item.image) {
      const w = A4.w - A4.margin * 2;
      const h = w * 0.64;
      if (y + h > A4.h - A4.margin) {
        doc.addPage();
        y = A4.margin;
      }
      doc.addImage(item.image, 'PNG', A4.margin, y, w, h);
      y += h + 10;
    }
    if (item.review.notes.trim()) line(item.review.notes.trim(), 10, false, 4);
    for (const c of item.coaches) {
      const head = [`${labels.coach} · ${c.name}`, typeof c.reading.score === 'number' ? `${c.reading.score}/100` : '']
        .filter(Boolean)
        .join(': ');
      line(head, 9, true, 2);
      if (c.reading.comment) line(c.reading.comment, 9, false, 2);
    }
    for (const [street, note] of Object.entries(item.review.streetNotes ?? {})) {
      if (note?.trim()) line(`${street}: ${note.trim()}`, 9, false, 2);
    }
    y += 10;
  }

  download(doc.output('blob'), `${slug(report.title)}.pdf`);
}

/** Client-side DOCX (L4). */
export async function exportDocx(report: ReportData, labels: ReportLabels) {
  const children: Paragraph[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: report.generatedAt.toLocaleString(), size: 18, color: '666666' })] }),
    new Paragraph({ text: labels.summary, heading: HeadingLevel.HEADING_2 }),
    ...summaryLines(report, labels).map((text) => new Paragraph({ children: [new TextRun({ text, size: 18 })] })),
  ];

  for (const item of report.items) {
    children.push(new Paragraph({ text: handHeadline(item), heading: HeadingLevel.HEADING_2 }));
    if (item.tags.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${labels.tags}: ${item.tags.map((t) => t.label).join(', ')}`, italics: true, size: 18 })] }));
    }
    const own = scoreOf(item.review);
    if (own !== undefined) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${labels.rating}: ${own}/100`, size: 18 })] }));
    }
    if (item.image) {
      const data = Uint8Array.from(atob(item.image.split(',')[1]), (c) => c.charCodeAt(0));
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data, transformation: { width: 520, height: 333 }, type: 'png' })],
        }),
      );
    }
    if (item.review.notes.trim()) children.push(new Paragraph({ text: item.review.notes.trim() }));
    for (const c of item.coaches) {
      const head = [`${labels.coach} · ${c.name}`, typeof c.reading.score === 'number' ? `${c.reading.score}/100` : '']
        .filter(Boolean)
        .join(': ');
      children.push(new Paragraph({ children: [new TextRun({ text: head, bold: true, size: 18 })] }));
      if (c.reading.comment) children.push(new Paragraph({ children: [new TextRun({ text: c.reading.comment, size: 18 })] }));
    }
    for (const [street, note] of Object.entries(item.review.streetNotes ?? {})) {
      if (note?.trim()) children.push(new Paragraph({ children: [new TextRun({ text: `${street}: ${note.trim()}`, size: 18 })] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  download(await Packer.toBlob(doc), `${slug(report.title)}.docx`);
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'report'
  );
}
