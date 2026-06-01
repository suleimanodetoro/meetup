import type { StepBodyProps } from '../types';
import { RadioCardList } from './RadioCardList';

const OPTIONS = [
  { id: 'go-together', label: 'Go together' },
  { id: 'meet-there', label: 'Meet there' },
  { id: 'chat-first', label: 'Message first' },
  { id: 'no-plans', label: 'No plans yet' },
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
