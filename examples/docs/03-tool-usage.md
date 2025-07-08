# 🛠️ Tool Usage

This guide explains how to use tools with models that support them. Tools allow you to extend the capabilities of the model by letting it call external functions.

## ⚙️ How it works

1.  **Define a tool:** Create a `ToolDefinition` object that describes the tool's name, description, and parameters.
2.  **Send a request with the tool:** Include the tool definition in the `tools` array of your completion request.
3.  **Handle the tool call:** If the model decides to use the tool, the response will contain a `toolCalls` array.
4.  **Execute the tool and send back the result:** Execute your function with the arguments provided by the model, and then send the result back in a new completion request.

The following example demonstrates how to use a `get_current_weather` tool with the OpenAI provider.

```typescript
import { ModelManager, OpenAIProvider, ToolDefinition } from "kepler-ai-sdk";

// A simple, hardcoded function to simulate getting the weather.
function getCurrentWeather(city: string, unit: "celsius" | "fahrenheit") {
  const temperature = Math.floor(Math.random() * 20 + 10);
  return {
    city,
    temperature,
    unit,
    forecast: "Sunny with a chance of clouds",
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is not set.");
    return;
  }

  const modelManager = new ModelManager();
  const openai = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
  });
  modelManager.addProvider(openai);

  const getWeatherTool: ToolDefinition = {
    name: "get_current_weather",
    description: "Get the current weather for a specific city.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "The city name, e.g., San Francisco",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "The unit of temperature.",
        },
      },
      required: ["city"],
    },
  };

  const initialRequest = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user" as const,
        content: "What's the weather like in Boston today in Fahrenheit?",
      },
    ],
    tools: [getWeatherTool],
    toolChoice: "auto" as const,
  };

  const response = await openai.generateCompletion(initialRequest);

  if (response.toolCalls && response.toolCalls.length > 0) {
    const toolCall = response.toolCalls[0];
    const { city, unit } = toolCall.arguments as {
      city: string;
      unit: "celsius" | "fahrenheit";
    };
    const weather = getCurrentWeather(city, unit);

    const toolResultRequest = {
      model: "gpt-4o-mini",
      messages: [
        ...initialRequest.messages,
        {
          role: "assistant" as const,
          content: "",
          toolCalls: response.toolCalls,
        },
        {
          role: "tool" as const,
          toolCallId: toolCall.id,
          content: JSON.stringify(weather),
        },
      ],
    };

    const finalResponse = await openai.generateCompletion(toolResultRequest);
    console.log(finalResponse.content);
  } else {
    console.log(response.content);
  }
}

main();
```

> [!TIP]
> To run this example, you need to have your OpenAI API key set as an environment variable. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/03-tool-usage.ts
> ```

## ⏭️ What's next

The next page teaches you how to work with multimodal models.

Continue: [🖼️ Multimodality](04-multimodality.md)
