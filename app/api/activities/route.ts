const PAGE_SIZE = 100;
const MAX_ACTIVITIES = 200;

export async function GET(request: Request) {
  const token = process.env.CATAPULT_TOKEN;
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const teamIds = searchParams.getAll("teamIds");

  // Collect all activities via auto-pagination
  const allActivities: any[] = [];
  let page = 1;

  while (allActivities.length < MAX_ACTIVITIES) {
    const params = new URLSearchParams();
    params.set("page_size", String(PAGE_SIZE));
    params.set("sort", "-start_time");
    params.set("page", String(page));

    if (startDate) params.set("start_time", String(Math.floor(new Date(startDate).getTime() / 1000)));
    if (endDate) params.set("end_time", String(Math.floor(new Date(endDate).getTime() / 1000)));
    teamIds.forEach((id) => params.append("team_ids", id));

    const response = await fetch(
      `https://eu.catapultsports.com/api/v6/activities?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await response.json();
    const page_activities = Array.isArray(data) ? data : data.activities ?? [];

    allActivities.push(...page_activities);

    // Stop if this page returned fewer results than page_size (last page)
    if (page_activities.length < PAGE_SIZE) break;
    page++;
  }

  const capped = allActivities.slice(0, MAX_ACTIVITIES);

  const enriched = await Promise.all(
    capped.map(async (activity: any) => {
      const tagRes = await fetch(
        `https://eu.catapultsports.com/api/v6/activities/${activity.id}/tags`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const tags = await tagRes.json();
      const dayCode = Array.isArray(tags)
        ? tags.find((tag: any) => tag.tag_type_name === "DayCode")
        : null;

      return {
        id: activity.id,
        name: activity.name,
        start_time: activity.start_time,
        day_code: dayCode ? dayCode.name : null,
      };
    })
  );

  return Response.json(enriched);
}
