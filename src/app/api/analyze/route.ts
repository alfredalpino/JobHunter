import { NextResponse } from "next/server";
import { analyzeResumeText } from "@/lib/resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let name = "";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      name = String(form.get("name") || "").trim();
      text = String(form.get("text") || "").trim();
      const file = form.get("file");
      if (file && typeof file !== "string" && "arrayBuffer" in file) {
        const blob = file as File;
        if (blob.size > MAX_BYTES) {
          return NextResponse.json(
            { ok: false, error: "File too large (max 4MB)." },
            { status: 400 },
          );
        }
        const fname = (blob.name || "").toLowerCase();
        const buf = Buffer.from(await blob.arrayBuffer());
        if (fname.endsWith(".txt") || fname.endsWith(".md") || blob.type.startsWith("text/")) {
          text = buf.toString("utf8");
        } else if (fname.endsWith(".pdf") || blob.type === "application/pdf") {
          text = await extractPdfText(buf);
        } else if (fname.endsWith(".docx")) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "DOCX is not supported in the web app yet. Paste text or upload PDF/TXT.",
            },
            { status: 400 },
          );
        } else if (!text) {
          return NextResponse.json(
            { ok: false, error: "Unsupported file. Use PDF, TXT, or paste resume text." },
            { status: 400 },
          );
        }
      }
    } else {
      const body = await request.json();
      name = typeof body?.name === "string" ? body.name.trim() : "";
      text = typeof body?.text === "string" ? body.text.trim() : "";
    }

    if (!text || text.length < 40) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Need resume text (paste at least a short CV, or upload a PDF/TXT).",
        },
        { status: 400 },
      );
    }

    const profile = analyzeResumeText(text, name);
    return NextResponse.json({
      ok: true,
      stub: false,
      profile,
      message: `Analyzed resume for ${profile.candidate.name}. Review region and preferences, then run a hunt.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Analyze failed",
      },
      { status: 500 },
    );
  }
}

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const result = await extractText(pdf, { mergePages: true });
    const raw = result.text;
    const text = Array.isArray(raw) ? raw.join("\n") : String(raw ?? "");
    if (!text.trim()) {
      throw new Error("PDF had no extractable text (it may be a scanned image).");
    }
    return text;
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `PDF extract failed: ${err.message}. Paste text instead.`
        : "PDF extract failed. Paste text instead.",
    );
  }
}

/** Readiness probe — does not parse resumes. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ready: true,
    method: "POST",
    note: "POST multipart/text to analyze a resume. GET is readiness only.",
  });
}
