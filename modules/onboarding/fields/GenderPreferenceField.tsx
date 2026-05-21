import type { StepBodyProps } from '../types';
import { RadioCardList } from './RadioCardList';

const OPTIONS = [
  { id: 'guys', label: 'Only Guys', emoji: '🧔' },
  { id: 'girls', label: 'Only Girls', emoji: '👩' },
  { id: 'everyone', label: 'Everyone', emoji: '👫' },
] as const;

export function GenderPreferenceField({
  value,
  setValue,
}: StepBodyProps<string>) {
  return (
    <RadioCardList
      options={OPTIONS}
      value={value as (typeof OPTIONS)[number]['id'] | undefined}
      setValue={(next) => setValue(next)}
    />
  );
}
