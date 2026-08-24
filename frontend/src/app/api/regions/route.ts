import { NextResponse } from "next/server";

/** Mirrors config/regions/ pack ids — keep in sync when adding packs. */
const REGIONS = [
  { id: "dubai", label: "Dubai / UAE" },
  { id: "usa", label: "USA" },
  { id: "india", label: "India" },
  { id: "bangalore", label: "Bangalore" },
  { id: "lucknow", label: "Lucknow" },
  { id: "alberta", label: "Alberta" },
  { id: "washington", label: "Washington" },
  { id: "warsaw", label: "Warsaw" },
  { id: "remote", label: "Remote" },
  { id: "worldwide", label: "Worldwide" },
];

export async function GET() {
  return NextResponse.json({
    regions: REGIONS,
    source: "config/regions/",
    note: "Static list for the product site. CLI loads YAML packs from disk.",
  });
}
