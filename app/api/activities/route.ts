export async function GET(request: Request) {
  const token = process.env.CATAPULT_TOKEN;
  const { searchParams } = new URL(request.url);

  const params = new URLSearchParams();
  params.set("page_size", "25");
  params.set("sort", "-start_time");

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const teamIds = searchParams.getAll("teamIds");
  const page = searchParams.get("page") ?? "1";

  if (startDate) params.set("start_time", String(Math.floor(new Date(startDate).getTime() / 1000)));
  if (endDate) params.set("end_time", String(Math.floor(new Date(endDate).getTime() / 1000)));
  teamIds.forEach((id) => params.append("team_ids", id));
  params.set("page", page);

  const response = await fetch(
    `https://eu.catapultsports.com/api/v6/activities?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  const activities = Array.isArray(data) ? data : data.activities ?? [];

  const enriched = await Promise.all(
    activities.map(async (activity: any) => {
      const tagRes = await fetch(
        `https://eu.catapultsports.com/api/v6/activities/${activity.id}/tags`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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
