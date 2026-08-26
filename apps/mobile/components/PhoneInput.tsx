import { getLocales } from "expo-localization";
import {
  AsYouType,
  type CountryCode,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/examples.mobile.json";
import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors } from "@/lib/colors";

// Flags for countries we want the chip to render. Anything not listed falls
// back to a globe icon — the rest of the libphonenumber metadata still works
// (parse/format), it just won't have a pretty flag in the chip. Extend as
// markets open.
const FLAG_BY_COUNTRY: Partial<Record<CountryCode, string>> = {
  BR: "🇧🇷",
  US: "🇺🇸",
  PT: "🇵🇹",
  AR: "🇦🇷",
  MX: "🇲🇽",
  ES: "🇪🇸",
  GB: "🇬🇧",
  FR: "🇫🇷",
  DE: "🇩🇪",
  IT: "🇮🇹",
};

const FALLBACK_COUNTRY: CountryCode = "BR";

function detectCountry(): CountryCode {
  try {
    const region = getLocales()[0]?.regionCode as CountryCode | null | undefined;
    if (region && region in FLAG_BY_COUNTRY) return region;
  } catch {
    // expo-localization may throw on RN Web in some browsers — silently fall through.
  }
  return FALLBACK_COUNTRY;
}

interface PhoneInputProps {
  label?: string;
  /** E.164 string (e.g. "+5511998765432") or empty. Source of truth. */
  value: string;
  /** Always called with E.164 or empty string. */
  onChangeText: (e164: string) => void;
  error?: string;
}

export function PhoneInput({ label, value, onChangeText, error }: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Initial country: pick from value (if it parses) > device locale > BR.
  const [country, setCountry] = useState<CountryCode>(() => {
    const parsed = value ? parsePhoneNumberFromString(value) : null;
    return parsed?.country ?? detectCountry();
  });

  const callingCode = getCountryCallingCode(country);
  const flag = FLAG_BY_COUNTRY[country] ?? "🌐";

  // Example number for the active country, used both as placeholder copy and
  // as a length cap when we need to strip a duplicated calling code.
  const example = useMemo(() => getExampleNumber(country, examples), [country]);
  const maxNational = example?.nationalNumber.length ?? 15;
  const placeholder = useMemo(() => example?.formatNational() ?? "", [example]);

  // Format the current E.164 value back to the national, user-facing form.
  // We rebuild a fresh AsYouType every render — it's cheap and avoids the
  // stateful gotchas of reusing an instance across deletions.
  const display = useMemo(() => {
    if (!value) return "";
    const parsed = parsePhoneNumberFromString(value);
    if (!parsed?.nationalNumber) return "";
    return new AsYouType(country).input(parsed.nationalNumber);
  }, [value, country]);

  function handleChange(text: string) {
    const trimmed = text.trim();

    // Paste / explicit international: let libphonenumber pick the country.
    if (trimmed.startsWith("+")) {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (parsed?.country) {
        setCountry(parsed.country);
        onChangeText(parsed.number);
        return;
      }
      // Partial input like "+5" — keep the digits so the user can keep typing.
      const digits = trimmed.slice(1).replace(/\D/g, "");
      onChangeText(digits ? `+${digits}` : "");
      return;
    }

    // National typing path. Strip non-digits.
    let digits = trimmed.replace(/\D/g, "");

    // Smart strip: if the user typed the calling code at the start AND the
    // total would exceed a valid national length, treat it as a duplicate of
    // the chip (the Pedro / "+5555..." case). Don't strip on short inputs —
    // that would prevent typing a legit DDD that happens to start with the
    // calling code's digits (e.g. DDD 55 in BR / Santa Maria).
    if (digits.length > maxNational && digits.startsWith(callingCode)) {
      digits = digits.slice(callingCode.length);
    }

    // Cap at the max national length so paste of garbage doesn't blow up.
    digits = digits.slice(0, maxNational);

    onChangeText(digits ? `+${callingCode}${digits}` : "");
  }

  const borderStyle = error
    ? "border-[1.5px] border-danger-500"
    : isFocused
      ? "border-[1.5px] border-primary-400"
      : "border border-neutral-200";

  return (
    <View className="w-full">
      {label && <Text className="mb-1.5 text-sm font-sans-medium text-neutral-700">{label}</Text>}

      <View className={`h-[52px] flex-row items-center rounded-xl bg-white ${borderStyle}`}>
        <View className="h-full flex-row items-center gap-1.5 border-r border-neutral-200 px-4">
          <Text className="text-lg">{flag}</Text>
          <Text
            className="text-base font-sans-medium text-neutral-800"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            +{callingCode}
          </Text>
        </View>

        <TextInput
          className="flex-1 px-4 text-base font-sans text-neutral-800"
          style={{ fontVariant: ["tabular-nums"] }}
          value={display}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral[400]}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {error && <Text className="mt-1.5 text-xs font-sans-medium text-danger-500">{error}</Text>}
    </View>
  );
}

/** True for empty input (optional field) OR a libphonenumber-validated E.164. */
export function isValidPhone(e164: string): boolean {
  if (!e164) return true;
  try {
    return isValidPhoneNumber(e164);
  } catch {
    return false;
  }
}
