import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import type { VoiceTransactionDto } from '../modules/voice/dto/voice-transaction.dto';

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
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private client: OpenAI | null = null;
  private visionModel = 'gpt-4o-mini';
  private transcribeModel = 'whisper-1';
  private extractModel = 'gpt-4o-mini';

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Add it in Railway Variables.',
      );
    }

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

    return this.client;
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
      this.getClient().audio.transcriptions.create({
        file,
        model: this.transcribeModel,
      }),
    );
    return (result.text ?? '').trim();
  }

  async parseVoiceTransaction(
    transcript: string,
  ): Promise<VoiceTransactionDto> {
    const schemaHint = {
      type: 'object',
      additionalProperties: false,
      properties: {
        description: {
          type: 'string',
          description: 'Merchant or label, e.g. Walgreens, McDonald\'s',
        },
        amount: {
          type: 'number',
          description: 'Positive number in dollars, e.g. 12.5 for $12.50',
        },
        category: {
          type: 'string',
          description: 'Optional spending/income category',
        },
        date: {
          type: 'string',
          description:
            'YYYY-MM-DD if specified or implied (today/yesterday/tomorrow). Omit if unknown.',
        },
        type: {
          type: 'string',
          enum: ['income', 'expense'],
          description:
            'expense for purchases/bills; income for paychecks, deposits, refunds received',
        },
      },
    };

    const system =
      'You extract a single transaction from casual spoken input. ' +
      'Return ONLY valid JSON. Do not include markdown.';

    const user =
      `Transcript: ${JSON.stringify(transcript)}\n\n` +
      `Assume today is ${new Date().toISOString().slice(0, 10)}.\n` +
      `Rules:\n` +
      `- Examples: "Walgreens 12.50" -> expense at Walgreens for 12.50.\n` +
      `- "I bought McDonald's and the total was 12.80" -> expense, description McDonald's, amount 12.80.\n` +
      `- amount must be a positive number (never negative).\n` +
      `- Default type to expense when the user describes a purchase or payment.\n` +
      `- Use type income only for salary, paycheck, deposit, or money received.\n` +
      `- Omit fields you cannot infer; do not guess wildly.\n\n` +
      `Return JSON matching this JSON Schema:\n${JSON.stringify(schemaHint)}`;

    const completion = await withRetries(() =>
      this.getClient().chat.completions.create({
        model: this.extractModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    );

    const content = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) return {};

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return this.normalizeVoiceTransaction(parsed);
    } catch {
      return {};
    }
  }

  private normalizeVoiceTransaction(
    parsed: Record<string, unknown>,
  ): VoiceTransactionDto {
    const description =
      typeof parsed.description === 'string'
        ? parsed.description.trim()
        : undefined;

    const rawAmount = Number(parsed.amount);
    const amount =
      Number.isFinite(rawAmount) && rawAmount > 0
        ? Math.round(rawAmount * 100) / 100
        : undefined;

    const category =
      typeof parsed.category === 'string' ? parsed.category.trim() : undefined;

    const date =
      typeof parsed.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())
        ? parsed.date.trim()
        : undefined;

    const type =
      parsed.type === 'income' || parsed.type === 'expense'
        ? parsed.type
        : amount !== undefined
          ? 'expense'
          : undefined;

    return {
      ...(description ? { description } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(category ? { category } : {}),
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
    };
  }

  /** @deprecated Use parseVoiceTransaction for voice-parse endpoint */
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
      this.getClient().chat.completions.create({
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
      this.getClient().chat.completions.create({
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
