import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { z } from "zod";
import type { TemplateEntry } from "./registry";

interface HseReportEmailProps {
  [key: string]: unknown;
  recipientName?: string;
  reportTitle?: string;
  period?: string;
  summary?: string;
}

function HseReportEmail({
  recipientName = "Colleague",
  reportTitle = "HSE Operational Report",
  period = "Current reporting period",
  summary = "Your scheduled HSE report is ready for review in Afrinet HSE360™.",
}: HseReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{reportTitle}</Preview>
      <Body
        style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#0f1b3d" }}
      >
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "32px" }}>
          <Section style={{ borderTop: "6px solid #e85d3a", paddingTop: "24px" }}>
            <Text style={{ fontSize: "12px", letterSpacing: "2px", color: "#5b6475" }}>
              PROSEL LIMITED · AFRINET HSE360™
            </Text>
            <Heading style={{ fontSize: "28px", margin: "12px 0" }}>{reportTitle}</Heading>
            <Text>Hello {recipientName},</Text>
            <Text>{summary}</Text>
            <Text style={{ fontWeight: "bold" }}>Period: {period}</Text>
            <Text style={{ color: "#5b6475", marginTop: "32px" }}>
              Sign in to the secure HSE system to review the full report and supporting evidence.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: HseReportEmail,
  dataSchema: z
    .object({
      recipientName: z.string().trim().min(1).max(120).optional(),
      reportTitle: z.string().trim().min(1).max(200).optional(),
      period: z.string().trim().min(1).max(120).optional(),
      summary: z.string().trim().min(1).max(2000).optional(),
    })
    .strict(),
  subject: (data) => `${String(data.reportTitle ?? "HSE report")} | Prosel Limited`,
  displayName: "Scheduled HSE report",
  previewData: {
    recipientName: "HSE Manager",
    reportTitle: "Weekly HSE Operational Report",
    period: "10–16 June 2026",
  },
} satisfies TemplateEntry;
