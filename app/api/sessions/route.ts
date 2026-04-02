export async function GET(request: Request) {
  const token = process.env.CATAPULT_TOKEN;

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");

  if (!activityId) {
    return Response.json({ error: "Missing activityId" }, { status: 400 });
  }

  const response = await fetch(
    "https://eu.catapultsports.com/api/v6/stats?requested_only=TRUE",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        parameters: [
          "athlete_name",
          "total_distance",
          "total_player_load",
          "velocity_band4_total_distance",
          "velocity_band5_total_distance",
          "velocity_band6_total_distance",
          "velocity_band7_total_distance",
          "velocity_band8_total_distance",
        ],
        group_by: ["athlete"],
        filters: [
          {
            name: "activity_id",
            comparison: "=",
            values: [activityId],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  const result = data.map((row: any) => {
    const hsd =
      (row.velocity_band4_total_distance || 0) +
      (row.velocity_band5_total_distance || 0) +
      (row.velocity_band6_total_distance || 0) +
      (row.velocity_band7_total_distance || 0) +
      (row.velocity_band8_total_distance || 0);

    const hsdPercentage =
      row.total_distance > 0 ? (hsd / row.total_distance) * 100 : 0;

    return {
      athlete_name: row.athlete_name,
      total_distance: row.total_distance,
      high_speed_distance: hsd,
      high_speed_percentage: hsdPercentage,
      total_player_load: row.total_player_load,
    };
  });

  return Response.json(result);
}