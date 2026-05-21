import type { StepBodyProps } from '../types';
import { RadioCardList } from './RadioCardList';

const OPTIONS = [
  { id: 'male', label: 'Male', emoji: '👨' },
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'other', label: 'Other', emoji: '✨' },
] as const;

export function GenderField({ value, setValue }: StepBodyProps<string>) {
  return (
    <RadioCardList
      options={OPTIONS}
      value={value as (typeof OPTIONS)[number]['id'] | undefined}
      setValue={(next) => setValue(next)}
      iconSize={56}
    />
  );
}
