import { Pressable, Text, View } from 'react-native';

export interface RadioCardOption<Id extends string> {
  id: Id;
  label: string;
  emoji: string;
}

interface RadioCardListProps<Id extends string> {
  options: readonly RadioCardOption<Id>[];
  value: Id | undefined;
  setValue: (next: Id) => void;
  /** Diameter of the emoji circle. Default 56 (used by gender step). */
  iconSize?: number;
}

/**
 * Shared radio-style card list used by the gender, meeting-preference, and
 * gender-preference onboarding steps. Each card shows an emoji icon, label,
 * and a radio dot; tapping selects it.
 */
export function RadioCardList<Id extends string>({
  options,
  value,
  setValue,
  iconSize = 50,
}: RadioCardListProps<Id>) {
  return (
    <View style={{ gap: 16 }}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => setValue(opt.id)}
            style={{
              backgroundColor: 'white',
              padding: iconSize > 50 ? 24 : 20,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              borderWidth: 2,
              borderColor: selected ? '#007AFF' : 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: iconSize / 2,
                backgroundColor: selected ? '#E3F2FD' : '#F5F5F5',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: iconSize > 50 ? 28 : 24 }}>
                {opt.emoji}
              </Text>
            </View>
            <Text
              style={{
                fontSize: iconSize > 50 ? 18 : 17,
                flex: 1,
                color: '#333',
                fontWeight: selected ? '600' : '400',
              }}
            >
              {opt.label}
            </Text>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: selected ? '#007AFF' : '#E0E0E0',
                backgroundColor: selected ? '#007AFF' : 'white',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {selected ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'white',
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
