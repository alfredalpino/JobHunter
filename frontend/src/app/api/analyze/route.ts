import { NextResponse } from "next/server";

/**
 * Stub: future bridge to JobHunter profile builder / run.sh easy.
 * Does not parse resumes yet — keeps the Python CLI as the real path.
 */
export async function POST(request: Request) {
  let name = "aspirant";
  try {
    const body = await request.json();
    if (typeof body?.name === "string" && body.name.trim()) {
      name = body.name.trim();
    }
  } catch {
    /* empty body is fine for stub */
  }

  return NextResponse.json(
    {
      ok: true,
      stub: true,
      message: `Got it, ${name}. Resume analysis still runs locally via ./run.sh easy (or the Streamlit UI). Next: host a secure API that shells out to the same profile builder — without auto-apply.`,
      nextSteps: [
        "Run ./setup-once.sh once on your machine",
        './run.sh easy --resume "uploads/cv.pdf" --name "' + name + '" --region dubai',
        "Edit aspirants/<id>/preferences.yaml",
        "./run.sh easy-hunt --id <id>",
      ],
    },
    { status: 202 },
  );
}
