import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

export type ParsedTransaction = {
  description: string;
  amount: number;
  date?: string;
};

export type VoiceIntent = 'transaction' | 'recurring' | 'unknown';

export type VoiceParseResult = {
  transcript: string;
  intent: VoiceIntent;
  transaction?: {
    description?: string;
    amount?: number;
    date?: string;
    category?: string;
    accountName?: string;
    accountId?: string;
  };
  recurring?: {
    kind: 'bill' | 'income' | 'transfer' | 'goal';
    name: string;
    amount: number;
    cadence: 'weekly' | 'biweekly' | 'monthly';
    weeklyDow?: number;
    monthlyDay?: number;
    accountId?: string;
    toAccountId?: string;
  };
};

const TRANSACTION_SYSTEM_PROMPT = `You extract banking transactions from user-provided content (screenshot or pasted text).

Rules:
- Return ONLY valid JSON, no markdown, matching this shape: {"transactions":[{"description":"string","amount":number,"date":"YYYY-MM-DD or omit"}]}
- amounts: spending/outflows MUST be negative numbers; deposits/inflows positive.
- description: concise merchant or label.
- date: include YYYY-MM-DD only when clearly visible per row; otherwise omit.
- Skip running balances, headers, totals, pending sections if they are summaries not individual txns.
- If uncertain about a row, skip it rather than hallucinate.`;

function isTransientNetworkError(e: unknown): boolean {
  const err = e as {
    cause?: { code?: string };
    code?: string;
    message?: string;
  };
  const code = err?.cause?.code || err?.code;
  const msg = String(err?.message || '');
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    msg.includes('APIConnectionError') ||
    msg.includes('ECONNRESET') ||
    msg.includes('socket hang up')
  );
}

async function withRetries<T>(
  fn: () => Promise<T>,
  retries = 4,
  baseDelayMs = 400,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransientNetworkError(e) || attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

@Injectable()
export class OpenAiService implements OnModuleInit {
  private readonly logger = new Logger(OpenAiService.name);
  private client!: OpenAI;
  private visionModel!: string;
  private transcribeModel!: string;
  private extractModel!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY');
    this.client = new OpenAI({
      apiKey,
      maxRetries: Number(this.config.get('OPENAI_MAX_RETRIES') ?? 6),
      timeout: Number(this.config.get('OPENAI_TIMEOUT_MS') ?? 90000),
    });
    this.visionModel =
      this.config.get('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';
    this.transcribeModel =
      this.config.get('OPENAI_TRANSCRIBE_MODEL') ?? 'whisper-1';
    this.extractModel =
      this.config.get('OPENAI_EXTRACT_MODEL') ?? 'gpt-4o-mini';
  }

  async parseTransactionsFromText(text: string): Promise<ParsedTransaction[]> {
    const out = await this.completionToTransactions([
      { type: 'text', text },
    ]);
    return out.transactions;
  }

  async parseTransactionsFromImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ParsedTransaction[]> {
    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    const out = await this.completionToTransactions(
      [
        {
          type: 'text',
          text: 'Extract all individual transactions from this account activity screenshot.',
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
      this.visionModel,
    );
    return out.transactions;
  }

  async transcribeAudio(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const file = await toFile(buffer, filename || 'audio.m4a', {
      type: mimeType || 'audio/m4a',
    });
    const result = await withRetries(() =>
      this.client.audio.transcriptions.create({
        file,
        model: this.transcribeModel,
      }),
    );
    return (result.text ?? '').trim();
  }

  async parseVoiceTranscript(transcript: string): Promise<VoiceParseResult> {
    const schemaHint = {
      type: 'object',
      additionalProperties: false,
      required: ['intent', 'transcript'],
      properties: {
        transcript: { type: 'string' },
        intent: { type: 'string', enum: ['transaction', 'recurring', 'unknown'] },
        transaction: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: { type: 'string' },
            amount: {
              type: 'number',
              description: 'Signed. Bills/spend should be negative.',
            },
            date: {
              type: 'string',
              description:
                'YYYY-MM-DD if specified or implied (today/yesterday/tomorrow). Omit if unknown.',
            },
            category: {
              type: 'string',
              description: 'Spending/income label e.g. Groceries. Omit if unknown.',
            },
          },
        },
        recurring: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'name', 'amount', 'cadence'],
          properties: {
            kind: { type: 'string', enum: ['bill', 'income', 'transfer', 'goal'] },
            name: { type: 'string' },
            amount: {
              type: 'number',
              description:
                'Positive number; app will treat bill vs income by kind.',
            },
            cadence: {
              type: 'string',
              enum: ['weekly', 'biweekly', 'monthly'],
            },
            weeklyDow: {
              type: 'number',
              description: '0=Sun..6=Sat (only for weekly/biweekly)',
            },
            monthlyDay: {
              type: 'number',
              description: '1..31 (only for monthly)',
            },
          },
        },
      },
    };

    const system =
      'You extract structured cashflow actions from a short speech transcript. ' +
      'Return ONLY valid JSON. Do not include markdown.';

    const user =
      `Transcript: ${JSON.stringify(transcript)}\n\n` +
      `Assume today is ${new Date().toISOString().slice(0, 10)}.\n` +
      `Rules:\n` +
      `- If user mentions monthly/weekly/biweekly or "every" or a day-of-month like "on the 1st", interpret as intent=recurring.\n` +
      `- Recurring kind bill vs income: if they say bill/rent/mortgage/utilities/subscription or imply spending, kind=bill. If they say paycheck/salary/income, kind=income.\n` +
      `- For transactions: infer negative amount for spend unless they clearly say income.\n` +
      `- If ambiguous, intent=unknown.\n\n` +
      `Return JSON that matches this JSON Schema:\n${JSON.stringify(schemaHint)}`;

    const completion = await withRetries(() =>
      this.client.chat.completions.create({
        model: this.extractModel,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    );

    const content = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) return { transcript, intent: 'unknown' };

    try {
      const parsed = JSON.parse(content) as VoiceParseResult;
      if (parsed.intent === 'recurring' && parsed.recurring) {
        parsed.recurring.amount = Math.abs(Number(parsed.recurring.amount));
      }
      return { ...parsed, transcript };
    } catch {
      return { transcript, intent: 'unknown' };
    }
  }

  private async completionToTransactions(
    userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[],
    model = this.visionModel,
  ): Promise<{ transactions: ParsedTransaction[] }> {
    const completion = await withRetries(() =>
      this.client.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: TRANSACTION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    );

    const raw = completion.choices?.[0]?.message?.content ?? '';
    let parsed: { transactions?: unknown[] };
    try {
      parsed = JSON.parse(raw) as { transactions?: unknown[] };
    } catch {
      throw new Error('Model did not return valid JSON');
    }

    const list = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    const transactions = list
      .map((t) => {
        const row = t as Record<string, unknown>;
        return {
          description: String(row.description ?? '').trim(),
          amount: Number(row.amount),
          date:
            typeof row.date === 'string' ? row.date.trim() : undefined,
        };
      })
      .filter((t) => t.description.length > 0 && Number.isFinite(t.amount))
      .map((t) => ({
        ...t,
        ...(t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
          ? { date: t.date }
          : { date: undefined }),
      }));

    return { transactions };
  }
}
