import type { StepBodyProps } from '../types';
import { RadioCardList } from './RadioCardList';

const OPTIONS = [
  { id: 'guys', label: 'Men' },
  { id: 'girls', label: 'Women' },
  { id: 'everyone', label: 'Everyone' },
] as const;

export function GenderPreferenceField({ value, setValue }: StepBodyProps<string>) {
  return (
    <RadioCardList
      options={OPTIONS}
      value={value as (typeof OPTIONS)[number]['id'] | undefined}
      setValue={(next) => setValue(next)}
    />
  );
}
