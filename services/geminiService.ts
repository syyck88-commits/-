
import { GoogleGenAI, Type } from "@google/genai";
import { Preset } from "../types";

export const generatePreset = async (prompt: string, fixturesSummary: string): Promise<Preset> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a professional lighting designer controlling an Art-Net rig.
               RIG SETUP:
               ${fixturesSummary}
               
               FIXTURE PROFILES:
               - Dimmer: 1ch (Intensity)
               - LED PAR 36 (6ch): 1:Red, 2:Green, 3:Blue, 4:Macro, 5:Strobe, 6:Speed
               - Spider LM30 (13ch): 1:TiltA, 2:TiltB, 3:Master, 4:Strobe, 5-8:BlockA (RGBW), 9-12:BlockB (RGBW)
               - Cold Spark (2ch): 1:Fire (200-255 is ON), 2:Tech
               - Laser F2750 (8ch): 1-4:Pattern, 5:Color, 6:Rotation, 7:X, 8:Y

               USER REQUEST: "${prompt}"
               
               Return DMX values to create this scene. Coordinate colors across groups (Left, Right, Top, Back).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          channels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ch: { type: Type.INTEGER },
                val: { type: Type.INTEGER }
              },
              required: ["ch", "val"]
            }
          }
        },
        required: ["name", "description", "channels"]
      }
    }
  });

  const resultText = response.text || "{}";
  return JSON.parse(resultText.trim());
};
