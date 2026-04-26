import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { buildTourProductAssistantContextText } from "@/lib/tour-product/tourProductAssistantContext";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const bodySchema = z.object({
  tourProductSlug: z.string().min(1).max(120),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(24),
});

const ALLOWED_LOCALES = new Set<TourProductPageLocale>(["en", "ko", "zh", "zh-TW", "es", "ja"]);

function localeFromRequest(req: NextRequest): TourProductPageLocale {
  const raw = req.cookies.get("NEXT_LOCALE")?.value?.trim();
  if (raw === "zh-CN") return "zh";
  if (raw && ALLOWED_LOCALES.has(raw as TourProductPageLocale)) {
    return raw as TourProductPageLocale;
  }
  return "en";
}

/** Default matches `lib/tour-product-match/gemini-match-explanation.ts`. Override with `GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL`. */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "assistant_unconfigured", message: "AI assistant is not configured." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tourProductSlug, messages } = parsed.data;
  if (messages[0]?.role !== "user") {
    return NextResponse.json({ error: "first_message_must_be_user" }, { status: 400 });
  }
  if (!isStaticTourProductBundleRegistered(tourProductSlug)) {
    return NextResponse.json({ error: "unknown_tour" }, { status: 404 });
  }

  const locale = localeFromRequest(req);
  let doc = getStaticTourProductFullPageJson(tourProductSlug, locale);
  if (!doc && locale !== "en") {
    doc = getStaticTourProductFullPageJson(tourProductSlug, "en");
  }
  if (!doc) {
    return NextResponse.json({ error: "bundle_missing" }, { status: 500 });
  }

  const vm = buildTourProductViewModelFromFullPageJson(doc, locale);
  const productContext = buildTourProductAssistantContextText(vm);

  const systemInstruction = [
    "You are a helpful customer assistant for a specific tour on AtoC Korea (atockorea.com).",
    "Answer only using the PRODUCT CONTEXT and polite general travel logic.",
    "Do not invent policies, prices, or included items that are not in the context.",
    "If the user should book or get a definitive answer from staff, say so clearly.",
    "Keep replies under about 12 sentences unless the user asks for detail.",
    "\n--- PRODUCT CONTEXT ---\n",
    productContext,
  ].join("\n");

  const modelName = process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const last = messages[messages.length - 1];
  if (last?.role !== "user") {
    return NextResponse.json({ error: "last_message_must_be_user" }, { status: 400 });
  }
  const prior = messages.slice(0, -1);
  const history = prior.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  try {
    const chat = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 1200, temperature: 0.6 },
    });
    const res = await chat.sendMessage(last.content);
    const text = res.response.text()?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "empty_response" }, { status: 502 });
    }
    return NextResponse.json({ reply: text });
  } catch (e) {
    console.error("[tour-product/assistant]", e);
    return NextResponse.json({ error: "assistant_failed" }, { status: 502 });
  }
}
