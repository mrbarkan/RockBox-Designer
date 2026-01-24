import { GoogleGenAI, Type } from "@google/genai";
import { ThemeConfig, LayoutStyle, ThemeFont } from '../types';

export const generateThemeFromPrompt = async (userPrompt: string, currentConfig: ThemeConfig): Promise<Partial<ThemeConfig> | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are an expert design assistant specializing in Dieter Rams and Bauhaus aesthetics.
    Your goal is to configure a Rockbox theme based on the user's description.
    Focus on functionalism, minimal colors, and high legibility.
    
    The layout options are:
    - MINIMAL: Clean, small album art, lots of whitespace.
    - SPLIT: Top/Bottom split between art and text.
    - FULL_ART: Emphasis on visuals.

    The font options are:
    - 14-Nimbus.fnt: Standard Sans-serif, clean.
    - 16-Terminus.fnt: Monospace, technical.
    
    Return ONLY a JSON object compatible with the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            colors: {
              type: Type.OBJECT,
              properties: {
                background: { type: Type.STRING, description: "Hex color" },
                foreground: { type: Type.STRING, description: "Hex color" },
                accent: { type: Type.STRING, description: "Hex color" },
                barBackground: { type: Type.STRING, description: "Hex color" },
                barForeground: { type: Type.STRING, description: "Hex color" },
              },
              required: ["background", "foreground", "accent", "barBackground", "barForeground"]
            },
            font: { type: Type.STRING, enum: [ThemeFont.NIMBUS_14, ThemeFont.TERMINUS_16, ThemeFont.UNIFONT_16] },
            showAlbumArt: { type: Type.BOOLEAN },
            showNextSong: { type: Type.BOOLEAN },
            showVolume: { type: Type.BOOLEAN },
            layout: { type: Type.STRING, enum: [LayoutStyle.MINIMAL, LayoutStyle.SPLIT, LayoutStyle.FULL_ART] },
          },
          required: ["name", "colors", "layout", "font"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed as Partial<ThemeConfig>;
    }
  } catch (error) {
    console.error("Gemini generation failed", error);
  }
  return null;
};