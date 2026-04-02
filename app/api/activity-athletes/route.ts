export async function GET(request: Request) {
  const token = process.env.CATAPULT_TOKEN;
  const { searchParams } = new URL(request.url);
  const activityIds = searchParams.getAll("activityIds");

  if (activityIds.length === 0) {
    return Response.json([]);
  }

  const results = await Promise.all(
    activityIds.map(async (activityId) => {
      const res = await fetch(
        `https://eu.catapultsports.com/api/v6/activities/${activityId}/athletes`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((athlete: any) => ({
        activity_id: activityId,
        athlete_name: [athlete.first_name, athlete.last_name].filter(Boolean).join(" "),
        position: athlete.position_name || athlete.position || null,
      }));
    })
  );

  return Response.json(results.flat());
}
