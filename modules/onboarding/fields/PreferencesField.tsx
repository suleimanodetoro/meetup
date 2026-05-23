import type { StepBodyProps } from '../types';
import { RadioCardList } from './RadioCardList';

const OPTIONS = [
  { id: 'go-together', label: 'Go together', emoji: '🚕' },
  { id: 'meet-there', label: 'Meet up there', emoji: '📍' },
  { id: 'chat-first', label: 'Message before making plans', emoji: '💬' },
  { id: 'no-plans', label: 'No plans to meet yet', emoji: '✨' },
] as const;

export function PreferencesField({ value, setValue }: StepBodyProps<string>) {
  return (
    <RadioCardList
      options={OPTIONS}
      value={value as (typeof OPTIONS)[number]['id'] | undefined}
      setValue={(next) => setValue(next)}
    />
  );
}
