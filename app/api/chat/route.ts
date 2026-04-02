import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { messages, context } = await request.json();

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const systemPrompt = `You are Hamish, a sports science analyst assistant embedded in a performance dashboard for Scottish Rugby.
You have access to the following data that is currently loaded in the dashboard:

${context}

Answer questions about this data concisely and accurately. When referencing numbers, be specific.
If asked something that cannot be answered from the data provided, say so clearly.
Keep responses brief and to the point — this is a dashboard assistant, not a report generator.`;

    const response = await client.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "No response received.";
    return Response.json({ reply });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return Response.json(
      { reply: `Error: ${err?.message ?? "Unknown error from OpenRouter."}` },
      { status: 500 }
    );
  }
}
