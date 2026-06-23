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
              "velocity_band2_total_distance",
              "velocity_band3_total_distance",
              "velocity_band4_total_distance",
              "velocity_band5_total_distance",
              "velocity_band6_total_distance",
              "velocity_band7_total_distance",
              "velocity_band8_total_distance",
              "total_player_load",
              "rhie_bout_count",
              "contactinvolvement_total_count",
              "percentage_max_velocity",
              "max_vel",
            ],
            group_by: ["athlete"],
            filters: [
              { name: "activity_id", comparison: "=", values: [activityId] },
            ],
          }),
        }
      );

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((row: any) => {
        const hsd =
          (row.velocity_band4_total_distance || 0) +
          (row.velocity_band5_total_distance || 0) +
          (row.velocity_band6_total_distance || 0) +
          (row.velocity_band7_total_distance || 0) +
          (row.velocity_band8_total_distance || 0);

        // Running distance: velocity bands 2–8 (broader than HSD, which is bands 4–8)
        const runningDistance =
          (row.velocity_band2_total_distance || 0) +
          (row.velocity_band3_total_distance || 0) +
          hsd;

        return {
          activity_id: activityId,
          athlete_name: row.athlete_name,
          total_distance: row.total_distance || 0,
          running_distance: runningDistance,
          high_speed_distance: hsd,
          high_speed_percentage:
            row.total_distance > 0 ? (hsd / row.total_distance) * 100 : 0,
          total_player_load: row.total_player_load || 0,
          rhie_bout_count: row.rhie_bout_count || 0,
          contactinvolvement_total_count: row.contactinvolvement_total_count || 0,
          percentage_max_velocity: row.percentage_max_velocity || 0,
          max_vel: row.max_vel || 0,
        };
      });
    })
  );

  return Response.json(results.flat());
}
