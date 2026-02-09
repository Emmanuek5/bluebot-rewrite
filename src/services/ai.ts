import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { OPENROUTER_API_KEY } from '../config.ts';

let openrouter: ReturnType<typeof createOpenRouter> | null = null;

function getProvider() {
    if (!openrouter) {
        if (!OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
        }
        openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY });
    }
    return openrouter;
}

export interface AIGenerateOptions {
    model: string;
    systemPrompt: string;
    userMessage: string;
    maxTokens?: number;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export async function generateAIResponse(options: AIGenerateOptions): Promise<string> {
    const { model, systemPrompt, userMessage, maxTokens = 1024, conversationHistory = [] } = options;
    const provider = getProvider();

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
    ];

    const { text } = await generateText({
        model: provider(model),
        messages,
        maxOutputTokens: maxTokens,
    });

    return text;
}

export function isAIConfigured(): boolean {
    return !!OPENROUTER_API_KEY;
}
