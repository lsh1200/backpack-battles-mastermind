import { NextResponse } from "next/server";
import { listAnalysisFixtures } from "@/lib/fixtures/store";

export async function GET() {
  return NextResponse.json({ data: await listAnalysisFixtures() });
}
