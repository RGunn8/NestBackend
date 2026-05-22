export type VoiceTransactionType = 'income' | 'expense';

/** Structured transaction extracted from spoken input. */
export type VoiceTransactionDto = {
  description?: string;
  amount?: number;
  category?: string;
  date?: string;
  type?: VoiceTransactionType;
};

export type VoiceParseResponseDto = VoiceTransactionDto & {
  transcript: string;
};
