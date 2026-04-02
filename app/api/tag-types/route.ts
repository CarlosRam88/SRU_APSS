export async function GET() {
  const token = process.env.CATAPULT_TOKEN;

  const response = await fetch("https://eu.catapultsports.com/api/v6/tagtype", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  return Response.json(data);
}